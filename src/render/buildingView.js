import { TILE_SIZE, hexToInt } from './constants.js';

// Simple placeholder shapes per building type. Sites under construction are
// drawn faded, with a progress bar underneath.
const DRAW = {
  campfire(g, cx, cy, color) {
    g.lineStyle(2, 0x5a5a56);
    g.strokeCircle(cx, cy + 2, 5);
    g.fillStyle(color);
    g.fillTriangle(cx, cy - 6, cx - 4, cy + 3, cx + 4, cy + 3);
    g.fillStyle(0xffd35c);
    g.fillTriangle(cx, cy - 2, cx - 2, cy + 3, cx + 2, cy + 3);
  },
  lean_to(g, cx, cy, color) {
    g.fillStyle(color);
    g.fillTriangle(cx - 7, cy + 6, cx + 6, cy + 6, cx - 3, cy - 6);
    g.lineStyle(1, 0x3d2b1f);
    g.strokeTriangle(cx - 7, cy + 6, cx + 6, cy + 6, cx - 3, cy - 6);
  },
  hut(g, cx, cy, color) {
    g.fillStyle(color);
    g.fillRect(cx - 6, cy - 1, 12, 8);
    g.fillStyle(0x6b4a2b);
    g.fillTriangle(cx - 8, cy, cx + 8, cy, cx, cy - 8);
    g.fillStyle(0x3d2b1f);
    g.fillRect(cx - 2, cy + 2, 4, 5);
  },
  storage_pit(g, cx, cy, color) {
    g.fillStyle(color);
    g.fillCircle(cx, cy, 6);
    g.fillStyle(0x2b2a27);
    g.fillCircle(cx, cy, 4);
  },
  farm_plot(g, cx, cy, color) {
    g.fillStyle(color);
    g.fillRect(cx - 7, cy - 7, 14, 14);
    g.lineStyle(1, 0x5a3f22);
    for (let dy = -4; dy <= 4; dy += 4) g.lineBetween(cx - 6, cy + dy, cx + 6, cy + dy);
  },
};

export class BuildingView {
  constructor(scene) {
    this.g = scene.add.graphics().setDepth(0.9);
    this.lastTick = -1;
  }

  update(sim, data) {
    if (sim.tick === this.lastTick) return;
    this.lastTick = sim.tick;
    const g = this.g;
    g.clear();
    for (const b of sim.buildings) {
      const def = data.buildingsById[b.type];
      const cx = (b.x + 0.5) * TILE_SIZE;
      const cy = (b.y + 0.5) * TILE_SIZE;
      const color = hexToInt(def.color);
      DRAW[b.type]?.(g, cx, cy, b.built ? color : fade(color));
      if (!b.built) {
        g.fillStyle(0x000000, 0.5);
        g.fillRect(cx - 7, cy + 7, 14, 3);
        g.fillStyle(0xffd35c, 1);
        g.fillRect(cx - 7, cy + 7, 14 * Math.min(1, b.work / def.work), 3);
      }
    }
  }

  destroy() {
    this.g.destroy();
  }
}

// Unfinished buildings are drawn washed-out toward grey.
function fade(color) {
  const mix = (c) => Math.round(c * 0.45 + 0x99 * 0.55);
  return (mix((color >> 16) & 255) << 16) | (mix((color >> 8) & 255) << 8) | mix(color & 255);
}
