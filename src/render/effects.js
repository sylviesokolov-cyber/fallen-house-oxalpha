import { TILE_SIZE } from './constants.js';

// Short-lived visuals for god powers. Purely cosmetic, so plain Math.random is
// fine here (it never touches the sim).

const DURATION = { rain: 1600, lightning: 450, spawn_food: 900, bless: 1200, inspire: 1400, omen: 2000, gift: 1500, eternity: 2200, puppet: 1800, decree: 1600, smite: 700, storm: 2000, pestilence: 2200 };

const DRAW = {
  rain(g, cx, cy, t, e) {
    const r = e.radius * TILE_SIZE;
    g.lineStyle(1.5, 0x9cc8ff, 1 - t);
    for (const d of e.drops) {
      const y = cy - r + ((d.y + t * 3) % 1) * 2 * r;
      g.lineBetween(cx + d.x * r, y, cx + d.x * r - 2, y + 7);
    }
  },
  lightning(g, cx, cy, t, e) {
    g.fillStyle(0xffffff, 0.5 * (1 - t));
    g.fillCircle(cx, cy, 30 * (1 + t));
    g.lineStyle(3, 0xfff3a0, 1 - t);
    g.strokePoints(e.bolt, false);
  },
  spawn_food(g, cx, cy, t) {
    g.lineStyle(2, 0x7be07b, 1 - t);
    g.strokeCircle(cx, cy, 6 + t * 40);
  },
  bless(g, cx, cy, t, e) {
    g.fillStyle(0xffd35c, 1 - t);
    for (const d of e.drops) g.fillCircle(cx + d.x * 12, cy + 6 - t * 30 * d.y - 4, 1.8);
    g.lineStyle(2, 0xffd35c, 1 - t);
    g.strokeCircle(cx, cy, 10 + t * 6);
  },
  omen(g, cx, cy, t) {
    g.lineStyle(3, 0xffd35c, 1 - t);
    g.strokeCircle(cx, cy - 60, 10 + t * 50);
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4 + t;
      g.lineBetween(cx + Math.cos(a) * 14, cy - 60 + Math.sin(a) * 14, cx + Math.cos(a) * (30 + t * 60), cy - 60 + Math.sin(a) * (30 + t * 60));
    }
  },
  smite(g, cx, cy, t, e) {
    DRAW.lightning(g, cx, cy, Math.min(1, t * 1.5), e);
    g.fillStyle(0x2a1d14, 0.5 * (1 - t));
    g.fillEllipse(cx, cy + 5, 18, 7);
  },
  // Rain lashing a wide circle, with bolts striking here and there.
  storm(g, cx, cy, t, e) {
    DRAW.rain(g, cx, cy, t, e);
    g.fillStyle(0x0b1330, 0.25 * Math.sin(t * Math.PI));
    g.fillCircle(cx, cy, e.radius * TILE_SIZE * 1.2);
    const k = Math.floor(t * 5);
    if ((t * 5) % 1 < 0.3) {
      const bx = cx + (e.drops[k].x) * e.radius * TILE_SIZE;
      const by = cy + (e.drops[k].y - 0.5) * e.radius * TILE_SIZE;
      g.lineStyle(2, 0xfff3a0, 1);
      g.lineBetween(bx + 10, by - 160, bx - 4, by - 60);
      g.lineBetween(bx - 4, by - 60, bx + 3, by);
    }
  },
  // A sickly green miasma spreading out and settling.
  pestilence(g, cx, cy, t, e) {
    e.drops.slice(0, 18).forEach((d, k) => {
      const a = k * 2.1 + t * 1.5;
      const r = (6 + d.y * 38) * Math.min(1, t * 2);
      g.fillStyle(k % 3 ? 0x6fbf4a : 0x9fd86a, 0.35 * (1 - t));
      g.fillCircle(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.6 - t * 10, 5 + d.x * 3);
    });
  },
  // Sparkles spiralling up around the person.
  gift(g, cx, cy, t, e) {
    e.drops.slice(0, 16).forEach((d, k) => {
      const a = t * 8 + k * 0.8;
      const r = 12 * (1 - t) + 3;
      const y = cy - 4 - t * 26 * (0.6 + d.y * 0.6);
      g.fillStyle(k % 2 ? 0x8ff0ff : 0xffe27a, 1 - t);
      g.fillCircle(cx + Math.cos(a) * r, y + Math.sin(a) * r * 0.35, 1.4 + (k % 3) * 0.4);
    });
  },
  // A pillar of light, then a golden ring rising into a halo.
  eternity(g, cx, cy, t) {
    const beam = Math.sin(Math.min(1, t * 1.6) * Math.PI);
    g.fillStyle(0xfff1b0, 0.35 * beam);
    g.fillRect(cx - 7, cy - 260, 14, 262);
    g.fillStyle(0xffffff, 0.5 * beam);
    g.fillRect(cx - 2.5, cy - 260, 5, 262);
    g.lineStyle(2, 0xffe27a, 1 - t);
    g.strokeEllipse(cx, cy + 4 - t * 16, 22 * (1 - t) + 8, (22 * (1 - t) + 8) * 0.35);
  },
  // Golden threads come down from the sky and take hold.
  puppet(g, cx, cy, t) {
    const reach = Math.min(1, t * 2);
    g.lineStyle(1, 0xffd35c, 1 - Math.max(0, t - 0.5) * 2);
    for (const dx of [-5, 0, 5]) g.lineBetween(cx + dx * 3, cy - 200, cx + dx, cy - 200 + (200 - 6) * reach);
    g.fillStyle(0xffd35c, 0.6 * (1 - t));
    g.fillCircle(cx, cy - 6, 4 + t * 10);
  },
  // Rays and a ring spreading from the ruler as the decree is proclaimed.
  decree(g, cx, cy, t) {
    g.lineStyle(3, 0xffd35c, 1 - t);
    g.strokeCircle(cx, cy, 8 + t * 90);
    g.lineStyle(1.5, 0xfff1b0, (1 - t) * 0.8);
    g.strokeCircle(cx, cy, 4 + t * 60);
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI) / 6;
      g.lineBetween(cx + Math.cos(a) * (10 + t * 30), cy + Math.sin(a) * (10 + t * 30), cx + Math.cos(a) * (18 + t * 70), cy + Math.sin(a) * (18 + t * 70));
    }
  },
  inspire(g, cx, cy, t) {
    g.lineStyle(2, 0xb99cff, 1 - t);
    for (let k = 0; k < 3; k++) {
      const a = t * 6 + (k * Math.PI * 2) / 3;
      g.strokeCircle(cx + Math.cos(a) * 9, cy - 12 + Math.sin(a) * 4, 3);
    }
  },
};

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.g = scene.add.graphics().setDepth(5);
    this.active = [];
  }

  play(powerId, x, y, radius = 1) {
    const cx = (x + 0.5) * TILE_SIZE;
    const cy = (y + 0.5) * TILE_SIZE;
    const drops = Array.from({ length: 40 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() }));
    const bolt = [{ x: cx + 20, y: cy - 220 }];
    for (let k = 1; k <= 6; k++) bolt.push({ x: cx + (Math.random() - 0.5) * 24 * (1 - k / 6), y: cy - 220 + (220 * k) / 6 });
    this.active.push({ powerId, cx, cy, radius, drops, bolt, start: this.scene.time.now });
  }

  update(now) {
    const g = this.g;
    g.clear();
    this.active = this.active.filter((e) => now - e.start < DURATION[e.powerId]);
    for (const e of this.active) DRAW[e.powerId](g, e.cx, e.cy, (now - e.start) / DURATION[e.powerId], e);
  }

  destroy() {
    this.g.destroy();
  }
}
