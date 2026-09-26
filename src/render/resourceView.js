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
    for (const r of sim.world.resources) {
      const def = data.resourcesById[r.type];
      const cx = (r.x + 0.5) * TILE_SIZE;
      const cy = (r.y + 0.5) * TILE_SIZE;
      g.fillStyle(hexToInt(def.color));
      g.fillCircle(cx, cy, 5);
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
