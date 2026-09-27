import { TILE_SIZE, hexToInt } from './constants.js';

// Buildings are rooms: an outline over their floor, a name label, and a few
// furnishings so each reads at a glance. Empty building plots are marked with
// a dashed outline. Everything here is static, so it's drawn once.

const FURNISH = {
  great_hall(g, b, px) {
    // Beds on every other tile, matching isBed() in the sim.
    g.fillStyle(0xd9c7a3);
    for (let y = b.ry; y < b.ry + b.h; y += 2) {
      for (let x = b.rx; x < b.rx + b.w; x += 2) g.fillRect(x * px + 2, y * px + 3, px - 4, px - 6);
    }
  },
  kitchen(g, b, px) {
    g.fillStyle(0x3a2a22);
    g.fillRect(b.rx * px + 4, b.ry * px + 4, px * 2 - 8, px - 6);
    g.fillStyle(0xe8792a);
    g.fillRect(b.rx * px + 8, b.ry * px + 6, px - 8, 3);
  },
  dining_hall(g, b, px) {
    g.fillStyle(0x6b4a2b);
    for (let y = b.ry + 1; y < b.ry + b.h - 1; y += 2) g.fillRect((b.rx + 1) * px, y * px + 4, (b.w - 2) * px, px - 8);
  },
  training_ground(g, b, px) {
    g.fillStyle(0x6b4a2b);
    for (let k = 0; k < 3; k++) {
      const x = (b.rx + 2 + k * 3) * px + px / 2;
      const y = (b.ry + 1) * px + px / 2;
      g.fillRect(x - 1, y - 4, 3, 10);
      g.fillCircle(x, y - 5, 3);
    }
  },
};

export class BuildingView {
  constructor(scene, sim, data) {
    this.g = scene.add.graphics().setDepth(0.9);
    this.labels = [];
    const g = this.g;
    const px = TILE_SIZE;

    g.lineStyle(1, 0xffffff, 0.35);
    for (const p of data.sanctuary.plots) {
      dashedRect(g, p.x * px + 1, p.y * px + 1, p.w * px - 2, p.h * px - 2);
      this.labels.push(label(scene, (p.x + p.w / 2) * px, (p.y + p.h / 2) * px, 'Empty plot', '#ffffffaa'));
    }

    for (const b of sim.buildings) {
      const def = data.buildingsById[b.type];
      FURNISH[b.type]?.(g, b, px);
      g.lineStyle(2, hexToInt(def.color));
      g.strokeRect(b.rx * px, b.ry * px, b.w * px, b.h * px);
      this.labels.push(label(scene, (b.rx + b.w / 2) * px, b.ry * px - 1, def.name, '#ffffff'));
    }
  }

  update() {}

  destroy() {
    this.g.destroy();
    for (const l of this.labels) l.destroy();
  }
}

function label(scene, x, y, text, color) {
  return scene.add.text(x, y, text, { fontSize: '9px', fontStyle: 'bold', color, stroke: '#000000', strokeThickness: 3 })
    .setOrigin(0.5, 1)
    .setResolution(3)
    .setDepth(4);
}

function dashedRect(g, x, y, w, h) {
  const dash = 4;
  for (let i = 0; i < w; i += dash * 2) {
    g.lineBetween(x + i, y, x + Math.min(i + dash, w), y);
    g.lineBetween(x + i, y + h, x + Math.min(i + dash, w), y + h);
  }
  for (let i = 0; i < h; i += dash * 2) {
    g.lineBetween(x, y + i, x, y + Math.min(i + dash, h));
    g.lineBetween(x + w, y + i, x + w, y + Math.min(i + dash, h));
  }
}
