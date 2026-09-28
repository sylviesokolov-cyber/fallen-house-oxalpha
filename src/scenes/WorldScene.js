import { TILE_SIZE } from '../render/constants.js';
import { drawMap } from '../render/mapRenderer.js';
import { ResourceView } from '../render/resourceView.js';
import { HumanView } from '../render/humanView.js';
import { BuildingView } from '../render/buildingView.js';
import { RoofView } from '../render/roofView.js';
import { AmbientView } from '../render/ambientView.js';
import { makeTextures } from '../render/textures.js';
import { FxView } from '../render/fxView.js';
import { BubbleView } from '../render/bubbleView.js';
import { setupCameraControls } from '../render/cameraControls.js';
import { Effects } from '../render/effects.js';
import { createHud } from '../ui/hud.js';
import { usePower } from '../sim/godPowers.js';
import { zonesOf } from '../sim/tiers.js';

// Drives the sim clock and draws the world. It only reads sim state.
export class WorldScene extends Phaser.Scene {
  constructor(ctx) {
    super('World');
    this.ctx = ctx;
  }

  create() {
    this.camControls = setupCameraControls(this, () => ({ w: this.ctx.sim.world.width * TILE_SIZE, h: this.ctx.sim.world.height * TILE_SIZE }), (x, y) => this.onTap(x, y),
      () => ({
        top: document.getElementById('topbar').offsetHeight,
        bottom: document.getElementById('powers').offsetHeight,
      }),
    );
    this.hud = createHud(this.ctx, this.ctx.sound);
    this.effects = new Effects(this);
    this.buildViews();
    this.ctx.events.on('sim-replaced', () => this.buildViews());
    // The walls moved out: re-bake the map at its new size.
    this.ctx.events.on('world-expanded', () => {
      this.buildViews(false);
      this.camControls.refresh();
    });
    this.ctx.events.on('power-used', ({ powerId, x, y, radius }) => this.effects.play(powerId, x, y, radius));
    // The camera keeps the selected person in view (in the part of the
    // screen the open sheet doesn't cover) until the player pans away.
    this.followId = null;
    this.ctx.events.on('focus-human', (id) => {
      this.followId = id;
    });
    this.camControls.onPan(() => {
      this.followId = null;
      this.ctx.events.emit('camera-moved');
    });
  }

  buildViews(refocus = true) {
    this.mapImage?.destroy();
    this.winterMap?.destroy();
    this.resourceView?.destroy();
    this.buildingView?.destroy();
    this.roofView?.destroy();
    this.humanView?.destroy();
    this.ambientView?.destroy();
    this.fxView?.destroy();
    this.bubbleView?.destroy();
    const { sim, data } = this.ctx;
    makeTextures(this);
    const zones = zonesOf(sim, data);
    const tier = sim.settlement.tier ?? 1;
    this.mapImage = drawMap(this, sim.world, data, 'normal', zones, tier);
    this.winterMap = drawMap(this, sim.world, data, 'winter', zones, tier).setAlpha(0);
    this.resourceView = new ResourceView(this);
    this.buildingView = new BuildingView(this, sim, data);
    this.roofView = new RoofView(this);
    this.humanView = new HumanView(this);
    this.ambientView = new AmbientView(this, sim, data);
    this.fxView = new FxView(this, sim, data);
    this.bubbleView = new BubbleView(this);
    if (refocus) this.focusOnTribe();
    this.camControls.refresh();
  }

  // Start looking at the heart of the sanctuary: the Great Hall.
  focusOnTribe() {
    const hall = this.ctx.sim.buildings.find((b) => this.ctx.data.buildingsById[b.type].effects.sleepers);
    const { world } = this.ctx.sim;
    const x = hall ? hall.x : world.width / 2;
    const y = hall ? hall.y : world.height / 2;
    this.camControls.centerOn((x + 0.5) * TILE_SIZE, (y + 2) * TILE_SIZE, 1.6);
  }

  onTap(wx, wy) {
    if (this.ctx.selectedPower) {
      this.castPower(this.ctx.selectedPower, wx, wy);
      return;
    }
    const radius = Math.max(10, 22 / this.cameras.main.zoom);
    const id = this.humanView.humanAt(wx, wy, radius);
    const p = this.ctx.data.sanctuary.portal;
    const tx = Math.floor(wx / TILE_SIZE);
    const ty = Math.floor(wy / TILE_SIZE);
    if (id == null && tx >= p.x - 1 && tx <= p.x + p.w && ty >= p.y - 1 && ty <= p.y + p.h) {
      this.hud.openPortal();
      return;
    }
    this.ctx.selectedId = id;
    this.followId = id;
    this.hud.showInspect(id);
  }

  // The player's command: the sim applies the power; we only show it.
  castPower(powerId, wx, wy) {
    const { sim, data } = this.ctx;
    const power = data.powersById[powerId];
    let target;
    if (power.target === 'human') {
      const humanId = this.humanView.humanAt(wx, wy, Math.max(10, 22 / this.cameras.main.zoom));
      if (humanId == null) return this.hud.toast('Tap a person to use this power');
      target = { humanId };
    } else {
      const x = Math.floor(wx / TILE_SIZE);
      const y = Math.floor(wy / TILE_SIZE);
      if (x < 0 || y < 0 || x >= sim.world.width || y >= sim.world.height) return;
      target = { x, y };
    }
    const result = usePower(sim, data, powerId, target);
    if (!result.ok) return this.hud.toast(result.error);
    this.ctx.events.emit('power-used', { powerId, x: result.x, y: result.y, radius: power.radius ?? 1 });
    this.hud.powerUsed();
  }

  follow() {
    const { selectedId } = this.ctx;
    if (this.followId == null || this.followId !== selectedId) return;
    const s = this.humanView.sprites.get(selectedId);
    if (!s?.visible) return;
    const cam = this.cameras.main;
    const top = document.getElementById('topbar').offsetHeight;
    const sheet = document.querySelector('.panel:not(.hidden)');
    const bottom = sheet ? sheet.getBoundingClientRect().top : cam.height;
    const sy = (top + bottom) / 2;
    const tx = s.x - cam.width / 2;
    const ty = s.y - cam.height / 2 - (sy - cam.height / 2) / cam.zoom;
    cam.scrollX += (tx - cam.scrollX) * 0.12;
    cam.scrollY += (ty - cam.scrollY) * 0.12;
  }

  update(time, delta) {
    const { runner, sim, data, selectedId } = this.ctx;
    runner.update(delta);
    this.resourceView.update(sim, data);
    this.buildingView.update(sim, data);

    this.humanView.update(sim, data, runner.alpha, selectedId);
    this.roofView.update(sim, data, sim.humans.find((h) => h.id === selectedId));
    this.follow();
    this.ambientView.update(sim, data, runner.alpha, time, this.winterMap);
    this.fxView.update(sim, data, time, this.ambientView.dark, this.humanView.sprites);
    this.bubbleView.update(sim, data, this.humanView.sprites, selectedId);
    this.effects.update(time);
    this.hud.update(time);
  }
}
