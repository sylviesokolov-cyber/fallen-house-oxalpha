import { TILE_SIZE, hexToInt } from './constants.js';
import { buildingEffect, isBed } from '../sim/buildings.js';
import { jobProgress, nextUpgrade } from '../sim/construction.js';
import { activeExpedition } from '../sim/dungeon.js';

// Buildings are rooms: a floor, an outline, a name label and a few
// furnishings so each reads at a glance. Empty plots are dashed outlines;
// construction sites are faded with a progress bar. Everything is redrawn only
// when something visible changes (a site progresses, a level goes up).

const FLOOR = 0xa58a66;
const px = TILE_SIZE;

function beds(g, b, count) {
  g.fillStyle(0xd9c7a3);
  let n = 0;
  for (let y = b.ry; y < b.ry + b.h; y++) {
    for (let x = b.rx; x < b.rx + b.w; x++) {
      if (n >= count || !isBed(b, x, y)) continue;
      g.fillRect(x * px + 2, y * px + 3, px - 4, px - 6);
      n++;
    }
  }
}

const FURNISH = {
  great_hall(g, b, data) {
    beds(g, b, buildingEffect(data, b, 'sleepers'));
  },
  family_house(g, b, data) {
    beds(g, b, buildingEffect(data, b, 'sleepers'));
  },
  kitchen(g, b, data) {
    g.fillStyle(0x3a2a22);
    g.fillRect(b.rx * px + 4, b.ry * px + 4, px * 2 - 8, px - 6);
    g.fillStyle(0xe8792a);
    g.fillRect(b.rx * px + 8, b.ry * px + 6, px - 8, 3);
    if (b.level >= 2) {
      g.fillStyle(0x6b4a2b);
      g.fillRect((b.rx + 2) * px + 2, (b.ry + b.h - 1) * px + 2, px * 2, px - 6);
    }
  },
  dining_hall(g, b) {
    g.fillStyle(0x6b4a2b);
    for (let y = b.ry + 1; y < b.ry + b.h - 1; y += 2) g.fillRect((b.rx + 1) * px, y * px + 4, (b.w - 2) * px, px - 8);
  },
  training_ground(g, b) {
    g.fillStyle(0x6b4a2b);
    const dummies = 2 + b.level;
    for (let k = 0; k < dummies; k++) {
      const x = (b.rx + 1 + k * 2) * px + px / 2;
      const y = (b.ry + 1) * px + px / 2;
      g.fillRect(x - 1, y - 4, 3, 10);
      g.fillCircle(x, y - 5, 3);
    }
  },
  carpentry_workshop(g, b) {
    g.fillStyle(0x6b4a2b);
    g.fillRect((b.rx + 1) * px, (b.ry + 1) * px + 3, px * 3, px - 6);
    g.fillStyle(0x8a5a2b);
    for (let k = 0; k < 3; k++) g.fillCircle((b.rx + b.w - 1) * px + 5, (b.ry + b.h - 2 + k * 0.4) * px, 3);
  },
  storehouse(g, b) {
    g.fillStyle(0x8a6a3a);
    for (let y = b.ry + 1; y < b.ry + b.h - 1; y++) {
      for (let x = b.rx + 1; x < b.rx + b.w - 1; x += 2) g.fillRect(x * px + 2, y * px + 2, px - 4, px - 4);
    }
  },
  library(g, b) {
    g.fillStyle(0x5a3a22);
    g.fillRect(b.rx * px + 2, b.ry * px + 2, b.w * px - 4, px - 6);
    g.fillStyle(0x7a4a8a);
    for (let x = 0; x < b.w * 2 - 1; x++) g.fillRect(b.rx * px + 4 + x * 8, b.ry * px + 3, 3, px - 9);
    g.fillStyle(0x6b4a2b);
    g.fillRect((b.rx + 2) * px, (b.ry + 3) * px + 4, px * 2, px - 8);
  },
  tavern(g, b) {
    g.fillStyle(0x6b4a2b);
    g.fillCircle((b.rx + 1.5) * px, (b.ry + 2.5) * px, 6);
    g.fillCircle((b.rx + 4.5) * px, (b.ry + 2.5) * px, 6);
    g.fillStyle(0x9a6a3a);
    g.fillCircle((b.rx + b.w - 0.5) * px, (b.ry + 0.5) * px, 5);
  },
  shrine(g, b) {
    g.fillStyle(0xf5e6a8, 0.35);
    g.fillCircle(b.x * px + px / 2, b.y * px + px / 2, px * 1.4);
    g.fillStyle(0xd9c27a);
    g.fillRect(b.x * px + 3, b.y * px + 3, px - 6, px - 6);
  },
};

export class BuildingView {
  constructor(scene, sim, data) {
    this.scene = scene;
    this.g = scene.add.graphics().setDepth(0.9);
    this.labels = [];
    this.key = null;
    this.update(sim, data);
  }

  update(sim, data) {
    const key = signature(sim, data);
    if (key === this.key) return;
    this.key = key;
    this.g.clear();
    for (const l of this.labels) l.destroy();
    this.labels = [];
    this.drawPlots(sim, data);
    for (const b of sim.buildings) this.drawBuilding(b, data);
    this.drawPortal(sim, data);
  }

  // The portal glows while a party is on the other side.
  drawPortal(sim, data) {
    const exp = activeExpedition(sim);
    if (!exp || exp.phase === 'called') return;
    const p = data.sanctuary.portal;
    const cx = (p.x + p.w / 2) * px;
    const cy = (p.y + p.h) * px;
    this.g.fillStyle(0xb99cff, 0.25);
    this.g.fillCircle(cx, cy, px * 2.2);
    this.g.fillStyle(0xb99cff, 0.35);
    this.g.fillCircle(cx, cy, px * 1.2);
    const fl = data.floorsById[exp.floor];
    this.labels.push(label(this.scene, cx, cy + px * 2.6, `Party in Floor ${fl.id}`, '#d9c9ff'));
  }

  drawPlots(sim, data) {
    const g = this.g;
    const used = new Set(sim.buildings.map((b) => b.plot));
    g.lineStyle(1, 0xffffff, 0.35);
    for (const [kind, list] of [['plot', data.sanctuary.plots], ['home', data.sanctuary.homePlots ?? []]]) {
      list.forEach((p, i) => {
        if (used.has(`${kind}:${i}`)) return;
        dashedRect(g, p.x * px + 1, p.y * px + 1, p.w * px - 2, p.h * px - 2);
        const text = kind === 'home' ? 'Home plot' : 'Empty plot';
        this.labels.push(label(this.scene, (p.x + p.w / 2) * px, (p.y + p.h / 2 + 0.4) * px, text, '#ffffff88'));
      });
    }
  }

  drawBuilding(b, data) {
    const g = this.g;
    const def = data.buildingsById[b.type];
    const color = hexToInt(def.color);
    const cx = (b.rx + b.w / 2) * px;
    const progress = jobProgress(data, b);
    if (!b.built) {
      g.fillStyle(FLOOR, 0.35);
      g.fillRect(b.rx * px, b.ry * px, b.w * px, b.h * px);
      g.lineStyle(2, color, 0.9);
      dashedRect(g, b.rx * px, b.ry * px, b.w * px, b.h * px);
      this.progressBar(cx, b.ry * px + 3, progress);
      this.labels.push(label(this.scene, cx, b.ry * px - 1, `${def.name} (building)`, '#ffe9a8'));
      return;
    }
    if (b.plot) {
      g.fillStyle(FLOOR);
      g.fillRect(b.rx * px, b.ry * px, b.w * px, b.h * px);
    }
    FURNISH[b.type]?.(g, b, data);
    g.lineStyle(2, color);
    g.strokeRect(b.rx * px, b.ry * px, b.w * px, b.h * px);
    let text = b.level > 1 ? `${def.name} Lv${b.level}` : def.name;
    if (b.upgrade) {
      text += ` → Lv${nextUpgrade(data, b).level}`;
      this.progressBar(cx, b.ry * px + 3, progress);
    }
    this.labels.push(label(this.scene, cx, b.ry * px - 1, text, b.upgrade ? '#ffe9a8' : '#ffffff'));
  }

  progressBar(cx, y, progress) {
    const w = 28;
    this.g.fillStyle(0x000000, 0.6);
    this.g.fillRect(cx - w / 2 - 1, y - 1, w + 2, 5);
    this.g.fillStyle(0xf5b301);
    this.g.fillRect(cx - w / 2, y, w * Math.min(1, progress), 3);
  }

  destroy() {
    this.g.destroy();
    for (const l of this.labels) l.destroy();
  }
}

// Changes when anything drawn changes; progress is rounded to 5% steps.
function signature(sim, data) {
  return sim.buildings.map((b) => {
    const p = jobProgress(data, b);
    return `${b.id}:${b.built ? 1 : 0}:${b.level}:${p == null ? '' : Math.floor(p * 20)}`;
  }).join('|') + `|${activeExpedition(sim)?.phase ?? ''}`;
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
