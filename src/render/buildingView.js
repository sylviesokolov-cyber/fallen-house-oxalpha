import { TILE_SIZE, hexToInt } from './constants.js';
import { buildingEffect, effectsOf, isBed } from '../sim/buildings.js';
import { PLOT_KINDS, jobProgress, nextUpgrade, plotList } from '../sim/construction.js';
import { activeExpedition } from '../sim/dungeon.js';

// Buildings are rooms: a floor, an outline, a name label and a few
// furnishings so each reads at a glance. Empty plots are dashed outlines;
// construction sites are faded with a progress bar. Everything is redrawn only
// when something visible changes (a site progresses, a level goes up).

const FLOOR = 0xa58a66;
const FONT = 'Nunito, system-ui, sans-serif';
const px = TILE_SIZE;

function beds(g, b, count) {
  g.fillStyle(0xd9c7a3);
  let n = 0;
  for (let y = b.ry; y < b.ry + b.h; y++) {
    for (let x = b.rx; x < b.rx + b.w; x++) {
      if (n >= count || !isBed(b, x, y)) continue;
      g.fillStyle(0xd9c7a3);
      g.fillRect(x * px + 2, y * px + 3, px - 4, px - 6);
      g.fillStyle(0xf5f0e6);
      g.fillRect(x * px + 3, y * px + 4, px - 6, 3);
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
  blacksmith(g, b) {
    // Forge glowing in the corner, an anvil in the middle.
    g.fillStyle(0x3a3a40);
    g.fillRect(b.rx * px + 2, b.ry * px + 2, px * 2 - 4, px * 2 - 4);
    g.fillStyle(0xe8792a);
    g.fillCircle((b.rx + 1) * px, (b.ry + 1) * px, 5);
    g.fillStyle(0xffd35c);
    g.fillCircle((b.rx + 1) * px, (b.ry + 1) * px, 2.5);
    g.fillStyle(0x50535c);
    const ax = (b.rx + 3.5) * px;
    const ay = (b.ry + 2.5) * px;
    g.fillRect(ax - 6, ay - 3, 12, 4);
    g.fillRect(ax - 2, ay + 1, 4, 5);
  },
  infirmary(g, b, data) {
    beds(g, b, 99);
    g.fillStyle(0xd9534f);
    const cx = (b.rx + b.w - 1) * px + px / 2;
    const cy = (b.ry + b.h - 1) * px + px / 2;
    g.fillRect(cx - 5, cy - 1.5, 10, 3);
    g.fillRect(cx - 1.5, cy - 5, 3, 10);
  },
  mage_tower(g, b) {
    // A rune circle around a floating crystal.
    const cx = (b.rx + b.w / 2) * px;
    const cy = (b.ry + b.h / 2) * px;
    g.lineStyle(1.5, 0xb99cff, 0.9);
    g.strokeCircle(cx, cy, px * 1.6);
    g.strokeCircle(cx, cy, px * 1.1);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      g.fillStyle(0xd9c9ff);
      g.fillCircle(cx + Math.cos(a) * px * 1.35, cy + Math.sin(a) * px * 1.35, 1.5);
    }
    g.fillStyle(0x6d4bd1);
    g.fillTriangle(cx, cy - 7, cx - 4, cy, cx + 4, cy);
    g.fillStyle(0xb99cff);
    g.fillTriangle(cx, cy + 7, cx - 4, cy, cx + 4, cy);
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

  // Names keep a readable size on screen at any zoom.
  scaleLabels() {
    const s = Math.max(0.45, Math.min(1.4, 1.5 / this.scene.cameras.main.zoom));
    if (s === this.labelScale && !this.dirty) return;
    this.labelScale = s;
    this.dirty = false;
    for (const l of this.labels) l.setScale(s);
  }

  update(sim, data) {
    this.scaleLabels();
    const key = signature(sim, data);
    if (key === this.key) return;
    this.key = key;
    this.g.clear();
    for (const l of this.labels) l.destroy();
    this.labels = [];
    this.drawPlots(sim, data);
    for (const b of sim.buildings) this.drawBuilding(b, data);
    this.drawPortal(sim, data);
    this.dirty = true;
    this.scaleLabels();
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
    for (const [kind, list] of PLOT_KINDS.map((k) => [k, plotList(data, k)])) {
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
    const x = b.rx * px;
    const y = b.ry * px;
    const w = b.w * px;
    const h = b.h * px;
    const open = effectsOf(data, b).training;
    // A soft shadow to the lower right, so rooms stand up off the grass.
    g.fillStyle(0x000000, 0.22);
    g.fillRect(x + w + 1, y + 4, 4, h + (open ? 0 : 5));
    g.fillRect(x + 4, y + h + (open ? 1 : 6), w, 4);
    if (b.plot) {
      g.fillStyle(FLOOR);
      g.fillRect(x, y, w, h);
    }
    FURNISH[b.type]?.(g, b, data);
    if (effectsOf(data, b).training) {
      // An open yard: a low fence instead of walls.
      g.lineStyle(2, color);
      g.strokeRect(x, y, w, h);
    } else {
      g.lineStyle(3, shade(color, 0.6));
      g.strokeRect(x, y, w, h);
      g.lineStyle(1, shade(color, 1.35), 0.8);
      g.strokeRect(x + 2, y + 2, w - 4, h - 4);
      // The front wall seen from above: a strip of wall face with shuttered
      // windows and the doorway, which gives the room some height.
      const face = shade(color, 0.5);
      g.fillStyle(face);
      g.fillRect(x - 1.5, y + h + 1.5, w + 3, 5);
      g.fillStyle(shade(color, 0.75));
      g.fillRect(x - 1.5, y + h + 1.5, w + 3, 1);
      g.fillStyle(0x2a1d14);
      for (let k = 1; k < b.w; k += 2) {
        if (Math.abs(k + 0.5 - b.w / 2) < 1) continue;
        g.fillRect(x + k * px + 3, y + h + 3, 6, 2.5);
      }
      g.fillStyle(0x6b4a2b);
      g.fillRect(x + w / 2 - 5, y + h - 2, 10, 4);
      g.fillStyle(0x3a2616);
      g.fillRect(x + w / 2 - 4, y + h + 1.5, 8, 5);
    }
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

function shade(color, f) {
  const c = (v) => Math.min(255, Math.round(v * f));
  return (c((color >> 16) & 255) << 16) | (c((color >> 8) & 255) << 8) | c(color & 255);
}

// A name plate: the text on a dark rounded pill, anchored at its bottom.
function label(scene, x, y, text, color) {
  const t = scene.add.text(0, -1, text, { fontFamily: FONT, fontSize: '9px', fontStyle: '900', color })
    .setOrigin(0.5, 1)
    .setResolution(3);
  const w = t.width + 10;
  const h = t.height + 2;
  const bg = scene.add.graphics();
  bg.fillStyle(0x0b0f18, 0.72).fillRoundedRect(-w / 2, -h, w, h, h / 2);
  bg.lineStyle(1, 0xffffff, 0.12).strokeRoundedRect(-w / 2, -h, w, h, h / 2);
  return scene.add.container(x, y - 2, [bg, t]).setDepth(4);
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
