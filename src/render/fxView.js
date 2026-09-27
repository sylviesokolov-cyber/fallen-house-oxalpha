import { TILE_SIZE } from './constants.js';
import { dateOf } from '../sim/time.js';
import { activeExpedition } from '../sim/dungeon.js';

const px = TILE_SIZE;
const CHIMNEYS = { kitchen: [1, 0], blacksmith: [0.5, 0.5], tavern: [5, 0], great_hall: [11, 0], family_house: [3, 0] };
const WORK_EVERY_MS = 450;

// Living details, all cosmetic (plain Math.random is fine here): chimney
// smoke, seasonal weather, fireflies, chips and sparks from people at work,
// sparkles at the portal, and cloud shadows drifting over the sanctuary.
export class FxView {
  constructor(scene, sim, data) {
    this.scene = scene;
    this.data = data;
    const cfg = (extra) => ({ emitting: false, ...extra });
    this.smoke = scene.add.particles(0, 0, 'px-puff', cfg({
      lifespan: 2600, speedY: { min: -14, max: -8 }, speedX: { min: 2, max: 6 },
      scale: { start: 0.25, end: 0.9 }, alpha: { start: 0.55, end: 0 }, tint: 0xd9d4cc,
    })).setDepth(3.3);
    this.weather = scene.add.particles(0, 0, 'px-leaf', cfg({
      lifespan: 7000, speedY: { min: 8, max: 16 }, speedX: { min: -6, max: 6 },
      rotate: { start: 0, end: 360 }, scale: 0.45, alpha: { start: 0.9, end: 0.2 },
    })).setDepth(3.45);
    this.glow = scene.add.particles(0, 0, 'px-dot', cfg({
      lifespan: 3200, speed: { min: 2, max: 8 }, scale: { start: 0.6, end: 0.2 },
      alpha: { start: 0, end: 0, ease: 'Sine.easeInOut' }, blendMode: 'ADD',
    })).setDepth(3.7);
    this.bits = scene.add.particles(0, 0, 'px-chip', cfg({
      lifespan: 500, speed: { min: 20, max: 50 }, angle: { min: 200, max: 340 }, gravityY: 120,
      scale: { start: 0.9, end: 0.3 }, alpha: { start: 1, end: 0 },
    })).setDepth(3.2);
    this.clouds = [0, 1, 2].map((k) => scene.add.image(Math.random() * sim.world.width * px, (k * 0.33 + 0.1) * sim.world.height * px, 'px-cloud')
      .setScale(3 + k).setDepth(3.4).setAlpha(0.9));
    this.worldW = sim.world.width * px;
    this.nextSmoke = 0;
    this.nextWork = 0;
    this.weatherBudget = 0;
    this.last = 0;
  }

  update(sim, data, now, dark, sprites) {
    const dt = Math.min(100, now - (this.last || now));
    this.last = now;
    this.driftClouds(dt);
    if (now >= this.nextSmoke) {
      this.nextSmoke = now + 500;
      this.puffChimneys(sim, data);
      this.portalSparkles(sim, data);
    }
    this.seasonal(sim, data, dt, dark);
    if (now >= this.nextWork) {
      this.nextWork = now + WORK_EVERY_MS;
      this.workBits(sim, sprites);
    }
  }

  driftClouds(dt) {
    for (const c of this.clouds) {
      c.x += dt * 0.004 * (1 + c.scale * 0.1);
      if (c.x - c.displayWidth / 2 > this.worldW) c.x = -c.displayWidth / 2;
    }
  }

  puffChimneys(sim, data) {
    for (const b of sim.buildings) {
      const spot = b.built && CHIMNEYS[b.type];
      if (!spot || Math.random() < 0.3) continue;
      this.smoke.emitParticleAt((b.rx + spot[0] + 0.5) * px, (b.ry + spot[1]) * px, 1);
    }
  }

  // Violet motes rising from the portal; a flurry while a party is inside.
  portalSparkles(sim, data) {
    const p = data.sanctuary.portal;
    const exp = activeExpedition(sim);
    const n = exp && exp.phase !== 'called' ? 4 : 1;
    this.glow.setParticleTint(0xc9b0ff);
    this.glow.setParticleAlpha({ start: 0.9, end: 0 });
    this.glow.setParticleSpeed(0, -12);
    for (let k = 0; k < n; k++) this.glow.emitParticleAt((p.x + Math.random() * p.w) * px, (p.y + 1.2) * px, 1);
  }

  // Petals in spring, fireflies on summer nights, leaves in autumn, snow in
  // winter; spawned just above the visible part of the map.
  seasonal(sim, data, dt, dark) {
    const season = dateOf(sim.tick, data.config.time).season;
    const view = this.scene.cameras.main.worldView;
    const rate = { Spring: 1.5, Summer: 0, Autumn: 3, Winter: 16 }[season];
    this.weatherBudget += (rate * dt) / 1000;
    const style = {
      Spring: ['px-dot', [0xffd6e8, 0xffffff], 0.5],
      Autumn: ['px-leaf', [0xe8792a, 0xd9534f, 0xf5b301, 0xa0703a], 0.5],
      Winter: ['px-dot', [0xffffff], 0.9],
    }[season];
    while (this.weatherBudget >= 1 && style) {
      this.weatherBudget--;
      const [tex, tints, scale] = style;
      this.weather.setTexture(tex);
      this.weather.setParticleTint(tints[Math.floor(Math.random() * tints.length)]);
      this.weather.setParticleScale(scale);
      this.weather.emitParticleAt(view.x + Math.random() * view.width, view.y - 6, 1);
    }
    if (!style) this.weatherBudget = 0;
    // Fireflies drift about on warm nights.
    if ((season === 'Summer' || season === 'Spring') && dark > 0.5 && Math.random() < dt / 250) {
      this.glow.setParticleTint(0xd9ff7a);
      this.glow.setParticleAlpha({ start: 0.9, end: 0 });
      this.glow.setParticleSpeed(6, 6);
      this.glow.emitParticleAt(view.x + Math.random() * view.width, view.y + Math.random() * view.height, 1);
    }
  }

  // Chips fly from axes, soil from the field, dust and sparks from builders.
  workBits(sim, sprites) {
    for (const h of sim.humans) {
      const s = sprites.get(h.id);
      if (!s?.visible) continue;
      const a = h.action;
      let tint = null;
      if (a.type === 'harvest') {
        const r = sim.world.resources.find((o) => o.id === a.targetId);
        tint = r?.type === 'tree' ? 0xc9a06a : 0x6a4a2c;
      } else if (a.type === 'build' && !a.path?.length) tint = 0xd9c7a3;
      else if (a.type === 'craft' && !a.path?.length && Math.random() < 0.5) tint = 0xffd35c;
      else if (a.type === 'train' && !a.path?.length && Math.random() < 0.4) tint = 0xe8e2d0;
      if (tint == null) continue;
      this.bits.setParticleTint(tint);
      this.bits.emitParticleAt(s.x + (Math.random() - 0.5) * 6, s.y + 2, 3);
    }
  }

  destroy() {
    for (const o of [this.smoke, this.weather, this.glow, this.bits, ...this.clouds]) o.destroy();
  }
}
