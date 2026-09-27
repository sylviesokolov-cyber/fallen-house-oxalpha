import { TILE_SIZE } from './constants.js';

const px = TILE_SIZE;

// Trees in the grove, potato plants in the field, and the stockpile (piles
// that grow with what's stored). Redrawn only when the sim has advanced.
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
      const cx = (r.x + 0.5) * px;
      const cy = (r.y + 0.5) * px;
      if (def.material === 'wood') tree(g, cx, cy, r.amount / def.maxAmount, r.x * 7 + r.y * 13);
      else potato(g, cx, cy, r.amount, def.maxAmount);
    }
    stockpile(g, sim.stockpile);
  }

  destroy() {
    this.g.destroy();
  }
}

// A full tree has a round, layered canopy; felled wood leaves a stump that
// regrows as a sapling.
function tree(g, cx, cy, fullness, seed) {
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(cx + 1, cy + 5, 13, 5);
  if (fullness <= 0) {
    g.fillStyle(0x6b4a2b);
    g.fillEllipse(cx, cy + 3, 6, 4);
    g.fillStyle(0xa07440);
    g.fillEllipse(cx, cy + 2, 5, 3);
    return;
  }
  const r = 3 + fullness * 3.5;
  g.fillStyle(0x5a3a22);
  g.fillRect(cx - 1, cy, 2.5, 5);
  const lean = (seed % 3) - 1;
  g.fillStyle(0x1f4d25);
  g.fillCircle(cx + lean, cy - 2, r);
  g.fillStyle(0x2f6a34);
  g.fillCircle(cx - r * 0.35 + lean, cy - 2 - r * 0.3, r * 0.75);
  g.fillCircle(cx + r * 0.4 + lean, cy - 1 - r * 0.2, r * 0.6);
  g.fillStyle(0x4f9a4a);
  g.fillCircle(cx - r * 0.3 + lean, cy - 3 - r * 0.45, r * 0.35);
}

// Leafy tops over a soil mound, with potatoes peeking out when ripe.
function potato(g, cx, cy, amount, max) {
  g.fillStyle(0x5a3f24);
  g.fillEllipse(cx, cy + 3, 11, 5);
  if (amount <= 0) {
    g.fillStyle(0x7da33e);
    g.fillCircle(cx, cy + 1, 1.2);
    return;
  }
  const size = 1.6 + (amount / max) * 1.6;
  g.fillStyle(0x3f7a2a);
  g.fillCircle(cx - 2.5, cy - 1, size);
  g.fillCircle(cx + 2.5, cy - 1, size);
  g.fillStyle(0x6cae3c);
  g.fillCircle(cx, cy - 2.5, size);
  g.fillStyle(0xd9b36a);
  for (let k = 0; k < amount; k++) g.fillCircle(cx - 3 + k * 3, cy + 3, 1.3);
}

// Crates, a log pile and sacks that grow with the stock.
function stockpile(g, s) {
  const cx = (s.x + 0.5) * px;
  const cy = (s.y + 0.5) * px;
  g.fillStyle(0x000000, 0.2);
  g.fillEllipse(cx, cy + 6, 18, 6);
  g.lineStyle(1, 0x3d2b1f);
  g.fillStyle(0xb5824a);
  for (const [dx, dy] of [[-7, -1], [0, -1], [-4, -7]]) {
    g.fillRect(cx + dx, cy + dy, 6, 6);
    g.strokeRect(cx + dx, cy + dy, 6, 6);
  }
  const logs = Math.min(4, Math.ceil((s.wood ?? 0) / 40));
  g.fillStyle(0x7a5230);
  for (let k = 0; k < logs; k++) g.fillRect(cx + 7, cy + 3 - k * 2.5, 7, 2);
  const sacks = Math.min(3, Math.ceil((s.food ?? 0) / 60));
  g.fillStyle(0xd9c7a3);
  for (let k = 0; k < sacks; k++) g.fillCircle(cx - 10 - k * 1.5, cy + 3 - k * 3, 2.6);
}
