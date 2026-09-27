import { TILE_SIZE } from './constants.js';
import { dateOf } from '../sim/time.js';
import { effectsOf } from '../sim/buildings.js';
import { activeExpedition } from '../sim/dungeon.js';
import { lanternSpots } from './mapRenderer.js';

const px = TILE_SIZE;
const SEASON_TINT = { Spring: [0x9be37a, 0.03], Summer: [0xfff2a8, 0.05], Autumn: [0xd98a3a, 0.1], Winter: [0xcfe0ff, 0.06] };
const NIGHT_ALPHA = 0.5;
const THAW_DAYS = 2;

// Atmosphere, drawn over the world: the light of the day, the colour of the
// season, warm windows after dark, and the portal's slow swirl. Rendering
// only; the sim has no night (people sleep when they're tired).
export class AmbientView {
  constructor(scene, sim, data) {
    const w = sim.world.width * px;
    const h = sim.world.height * px;
    this.season = scene.add.rectangle(0, 0, w, h, 0xffffff, 0).setOrigin(0).setDepth(0.95);
    this.night = scene.add.rectangle(0, 0, w, h, 0x0b1330, 1).setOrigin(0).setDepth(3.5).setAlpha(0);
    this.lights = scene.add.graphics().setDepth(3.6).setBlendMode(Phaser.BlendModes.ADD);
    this.portal = scene.add.graphics().setDepth(1.5);
    const p = data.sanctuary.portal;
    this.portal.setPosition((p.x + p.w / 2) * px, (p.y + p.h) * px);
    this.lightKey = null;
    this.lanterns = lanternSpots(data);
    this.dark = 0;
  }

  update(sim, data, alpha, time, winterMap) {
    const t = data.config.time;
    const frac = ((sim.tick % t.ticksPerDay) + alpha) / t.ticksPerDay;
    const dark = darkness(frac);
    this.dark = dark;
    this.night.setAlpha(dark * NIGHT_ALPHA);
    const date = dateOf(sim.tick, t);
    const [color, a] = SEASON_TINT[date.season];
    this.season.setFillStyle(color, a);
    // Snow settles over the first days of winter and melts at the end.
    if (winterMap) {
      const into = ((date.day - 1) % t.daysPerSeason) + (sim.tick % t.ticksPerDay) / t.ticksPerDay;
      const snow = date.season === 'Winter' ? Math.min(1, into / THAW_DAYS, (t.daysPerSeason - into) / THAW_DAYS) : 0;
      winterMap.setAlpha(Math.max(0, snow));
    }
    this.drawLights(sim, data, dark);
    this.drawPortal(sim, time);
  }

  // Warm light spilling from every heated building once the sun is down.
  drawLights(sim, data, dark) {
    const key = `${Math.round(dark * 20)}|${sim.buildings.length}|${sim.buildings.filter((b) => b.built).length}`;
    if (key === this.lightKey) return;
    this.lightKey = key;
    const g = this.lights;
    g.clear();
    if (dark <= 0) return;
    for (const b of sim.buildings) {
      if (!b.built || !effectsOf(data, b).warm) continue;
      const cx = (b.rx + b.w / 2) * px;
      const cy = (b.ry + b.h / 2) * px;
      // A warm pool inside the room and a spill of light at the door.
      g.fillStyle(0xffa040, 0.1 * dark);
      g.fillEllipse(cx, cy, b.w * px * 0.8, b.h * px * 0.8);
      g.fillStyle(0xffc46a, 0.18 * dark);
      g.fillEllipse(cx, (b.ry + b.h) * px + 4, px * 1.6, px * 0.8);
    }
    for (const [x, y] of this.lanterns) {
      const cx = (x + 0.5) * px;
      const cy = (y + 0.5) * px - 5;
      g.fillStyle(0xffc46a, 0.12 * dark);
      g.fillCircle(cx, cy + 6, px * 1.4);
      g.fillStyle(0xffe0a0, 0.35 * dark);
      g.fillCircle(cx, cy, px * 0.35);
    }
  }

  // Two slowly turning arcs; brighter and faster while a party is inside.
  drawPortal(sim, time) {
    const exp = activeExpedition(sim);
    const busy = exp && exp.phase !== 'called';
    const g = this.portal;
    g.clear();
    const spin = time / (busy ? 400 : 1400);
    for (let k = 0; k < 2; k++) {
      g.lineStyle(2, busy ? 0xd9c9ff : 0xb99cff, busy ? 0.9 : 0.55);
      g.beginPath();
      g.arc(0, 0, px * (0.9 + k * 0.5), spin + k * Math.PI, spin + k * Math.PI + Math.PI * 0.9);
      g.strokePath();
    }
  }

  destroy() {
    for (const o of [this.season, this.night, this.lights, this.portal]) o.destroy();
  }
}

// 0 at midday, 1 at midnight, with dusk and dawn in between.
function darkness(f) {
  if (f < 0.1) return 1 - f / 0.1;
  if (f < 0.7) return 0;
  if (f < 0.82) return (f - 0.7) / 0.12;
  return 1;
}
