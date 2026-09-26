import { TILE_SIZE, hexToInt } from './constants.js';

const FRUIT_OFFSETS = [[-2, -2], [2, -1], [-1, 2], [2, 2], [0, 0]];

// Redraws resources only when the sim has advanced a tick.
export class ResourceView {
  constructor(scene) {
    this.g = scene.add.graphics().setDepth(1);
    this.lastTick = -1;
  }

  update(sim, data) {
    if (sim.tick === this.lastTick) return;
    this.lastTick = sim.tick;
    const g = this.g;
    g.clear();

    const { stockpile } = sim;
    const scx = (stockpile.x + 0.5) * TILE_SIZE;
    const scy = (stockpile.y + 0.5) * TILE_SIZE;
    g.fillStyle(0xffd35c);
    g.fillTriangle(scx, scy - 8, scx - 7, scy + 5, scx + 7, scy + 5);

    for (const r of sim.world.resources) {
      const def = data.resourcesById[r.type];
      const cx = (r.x + 0.5) * TILE_SIZE;
      const cy = (r.y + 0.5) * TILE_SIZE;
      g.lineStyle(1, 0x1b1b1b, 0.8);
      g.fillStyle(hexToInt(def.color));
      g.fillCircle(cx, cy, 5);
      g.strokeCircle(cx, cy, 5);
      g.fillStyle(hexToInt(def.fruitColor));
      for (let k = 0; k < Math.min(r.amount, FRUIT_OFFSETS.length); k++) {
        g.fillCircle(cx + FRUIT_OFFSETS[k][0], cy + FRUIT_OFFSETS[k][1], 1.4);
      }
    }
  }

  destroy() {
    this.g.destroy();
  }
}
