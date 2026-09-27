import { TILE_SIZE } from './constants.js';

const px = TILE_SIZE;

// Trees in the grove and potato plants in the field, as images from the
// baked textures (swapped only when an amount changes), plus the stockpile,
// whose piles grow with what's stored.
export class ResourceView {
  constructor(scene) {
    this.scene = scene;
    this.images = new Map();
    this.g = scene.add.graphics().setDepth(1.2);
    this.stockKey = null;
  }

  update(sim, data) {
    const seen = new Set();
    for (const r of sim.world.resources) {
      seen.add(r.id);
      const def = data.resourcesById[r.type];
      let img = this.images.get(r.id);
      if (!img) {
        img = this.scene.add.image((r.x + 0.5) * px, (r.y + 1) * px, '__DEFAULT').setScale(0.5);
        // Trees stand up from their tile and overlap the row behind; lower rows draw on top.
        img.setOrigin(0.5, def.material === 'wood' ? 0.93 : 0.8).setDepth(1 + r.y * 0.001);
        img.kind = def.material === 'wood' ? ((r.x * 7 + r.y * 13) % 3 === 0 ? 'pine' : 'round') : null;
        this.images.set(r.id, img);
      }
      const key = img.kind
        ? `tree-${img.kind}-${Math.round((r.amount / def.maxAmount) * 5)}`
        : `potato-${Math.min(3, r.amount)}`;
      if (img.texture.key !== key) img.setTexture(key);
    }
    for (const [id, img] of this.images) {
      if (!seen.has(id)) {
        img.destroy();
        this.images.delete(id);
      }
    }
    this.drawStock(sim.stockpile);
  }

  // Crates, a log pile and sacks that grow with the stock.
  drawStock(s) {
    const logs = Math.min(4, Math.ceil((s.wood ?? 0) / 40));
    const sacks = Math.min(3, Math.ceil((s.food ?? 0) / 60));
    const key = `${logs}|${sacks}`;
    if (key === this.stockKey) return;
    this.stockKey = key;
    const g = this.g;
    g.clear();
    const cx = (s.x + 0.5) * px;
    const cy = (s.y + 0.5) * px;
    g.fillStyle(0x000000, 0.22);
    g.fillEllipse(cx + 1, cy + 6, 22, 7);
    g.lineStyle(1, 0x3d2b1f);
    for (const [dx, dy] of [[-7, -1], [0, -1], [-4, -7]]) {
      g.fillStyle(0xb5824a);
      g.fillRect(cx + dx, cy + dy, 6, 6);
      g.strokeRect(cx + dx, cy + dy, 6, 6);
      g.fillStyle(0xd9a86a);
      g.fillRect(cx + dx + 1, cy + dy + 1, 4, 1);
    }
    for (let k = 0; k < logs; k++) {
      g.fillStyle(0x7a5230);
      g.fillRect(cx + 7, cy + 3 - k * 2.5, 8, 2.2);
      g.fillStyle(0xe8c28a);
      g.fillCircle(cx + 15, cy + 4 - k * 2.5, 1.1);
    }
    for (let k = 0; k < sacks; k++) {
      g.fillStyle(0xd9c7a3);
      g.fillCircle(cx - 10 - k * 1.5, cy + 3 - k * 3, 2.8);
      g.fillStyle(0xa08a60);
      g.fillRect(cx - 11 - k * 1.5, cy - k * 3, 2, 1.2);
    }
  }

  destroy() {
    for (const img of this.images.values()) img.destroy();
    this.images.clear();
    this.g.destroy();
  }
}
