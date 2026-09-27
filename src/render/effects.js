import { TILE_SIZE } from './constants.js';

// Short-lived visuals for god powers. Purely cosmetic, so plain Math.random is
// fine here (it never touches the sim).

const DURATION = { rain: 1600, lightning: 450, spawn_food: 900, bless: 1200, inspire: 1400, omen: 2000 };

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
