import { TILE_SIZE } from '../render/constants.js';
import { drawMap } from '../render/mapRenderer.js';
import { ResourceView } from '../render/resourceView.js';
import { HumanView } from '../render/humanView.js';
import { BuildingView } from '../render/buildingView.js';
import { setupCameraControls } from '../render/cameraControls.js';
import { Effects } from '../render/effects.js';
import { createHud } from '../ui/hud.js';
import { usePower } from '../sim/godPowers.js';

// Drives the sim clock and draws the world. It only reads sim state.
export class WorldScene extends Phaser.Scene {
  constructor(ctx) {
    super('World');
    this.ctx = ctx;
  }

  create() {
    const { world } = this.ctx.sim;
    this.camControls = setupCameraControls(this, world.width * TILE_SIZE, world.height * TILE_SIZE, (x, y) => this.onTap(x, y),
      () => ({
        top: document.getElementById('topbar').offsetHeight,
        bottom: document.getElementById('powers').offsetHeight,
      }),
    );
    this.hud = createHud(this.ctx);
    this.effects = new Effects(this);
    this.buildViews();
    this.ctx.events.on('sim-replaced', () => this.buildViews());
    this.ctx.events.on('focus-human', (id) => {
      const h = this.ctx.sim.humans.find((o) => o.id === id);
      if (h) this.cameras.main.pan((h.x + 0.5) * TILE_SIZE, (h.y + 0.5) * TILE_SIZE, 300);
    });
  }

  buildViews() {
    this.mapImage?.destroy();
    this.resourceView?.destroy();
    this.buildingView?.destroy();
    this.humanView?.destroy();
    const { sim, data } = this.ctx;
    this.mapImage = drawMap(this, sim.world, data);
    this.resourceView = new ResourceView(this);
    this.buildingView = new BuildingView(this);
    this.humanView = new HumanView(this);
    this.focusOnTribe();
  }

  focusOnTribe() {
    const { humans, world } = this.ctx.sim;
    const n = humans.length || 1;
    const cx = humans.length ? humans.reduce((s, h) => s + h.x, 0) / n : world.width / 2;
    const cy = humans.length ? humans.reduce((s, h) => s + h.y, 0) / n : world.height / 2;
    this.camControls.centerOn((cx + 0.5) * TILE_SIZE, (cy + 0.5) * TILE_SIZE, 2.5);
  }

  onTap(wx, wy) {
    if (this.ctx.selectedPower) {
      this.castPower(this.ctx.selectedPower, wx, wy);
      return;
    }
    const radius = Math.max(10, 22 / this.cameras.main.zoom);
    const id = this.humanView.humanAt(wx, wy, radius);
    this.ctx.selectedId = id;
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
    this.effects.play(powerId, result.x, result.y, power.radius ?? 1);
    this.hud.powerUsed();
  }

  update(time, delta) {
    const { runner, sim, data, selectedId } = this.ctx;
    runner.update(delta);
    this.resourceView.update(sim, data);
    this.buildingView.update(sim, data);
    this.humanView.update(sim, data, runner.alpha, selectedId);
    this.effects.update(time);
    this.hud.update(time);
  }
}
