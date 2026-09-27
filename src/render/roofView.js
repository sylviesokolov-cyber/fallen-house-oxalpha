import { TILE_SIZE, hexToInt } from './constants.js';
import { effectsOf } from '../sim/buildings.js';

// Roofs over the finished buildings. Seen from afar the sanctuary is a town
// of roofs; zooming in lifts them away so the rooms and people inside show.
// The roof over whoever is selected stays see-through. Cosmetic only.

const px = TILE_SIZE;
const SHOW_BELOW = 1.0; // camera zoom where roofs are fully on
const GONE_ABOVE = 1.45; // and where they have faded out

function shade(color, f) {
  const c = (v) => Math.min(255, Math.round(v * f));
  return (c((color >> 16) & 255) << 16) | (c((color >> 8) & 255) << 8) | c(color & 255);
}

// A roof between the walls: two slopes meeting at a ridge along the longer
// side, rows of shingles, and a chimney on the warm buildings.
function drawRoof(g, b, def, data) {
  const base = hexToInt(def.roof ?? def.color);
  const x = b.rx * px - 2;
  const y = b.ry * px - 3;
  const w = b.w * px + 4;
  const h = b.h * px + 5;
  const wide = w >= h;
  g.fillStyle(0x000000, 0.25).fillRect(x + 3, y + 4, w, h);
  g.fillStyle(shade(base, 0.95)).fillRect(x, y, w, h);
  if (wide) {
    g.fillStyle(shade(base, 1.2)).fillRect(x, y, w, h / 2);
    g.lineStyle(1, shade(base, 0.7), 0.7);
    for (let yy = y + 4; yy < y + h; yy += 4) g.lineBetween(x + 1, yy, x + w - 1, yy);
    g.lineStyle(2, shade(base, 0.55)).lineBetween(x, y + h / 2, x + w, y + h / 2);
  } else {
    g.fillStyle(shade(base, 1.2)).fillRect(x, y, w / 2, h);
    g.lineStyle(1, shade(base, 0.7), 0.7);
    for (let xx = x + 4; xx < x + w; xx += 4) g.lineBetween(xx, y + 1, xx, y + h - 1);
    g.lineStyle(2, shade(base, 0.55)).lineBetween(x + w / 2, y, x + w / 2, y + h);
  }
  g.lineStyle(1.5, shade(base, 0.45)).strokeRect(x, y, w, h);
  if (effectsOf(data, b).warm || def.effects?.forge) {
    const cx = x + w * 0.75;
    const cy = y + h * 0.25;
    g.fillStyle(0x6b5a50).fillRect(cx - 3, cy - 3, 6, 6);
    g.fillStyle(0x2a1d14).fillRect(cx - 2, cy - 2, 4, 4);
  }
}

export class RoofView {
  constructor(scene) {
    this.scene = scene;
    this.roofs = new Map(); // building id -> { g, key, b }
  }

  update(sim, data, selected) {
    const zoom = this.scene.cameras.main.zoom;
    const far = Math.max(0, Math.min(1, (GONE_ABOVE - zoom) / (GONE_ABOVE - SHOW_BELOW)));
    const seen = new Set();
    for (const b of sim.buildings) {
      const def = data.buildingsById[b.type];
      if (!b.built || effectsOf(data, b).training || def.noRoof) continue;
      seen.add(b.id);
      let r = this.roofs.get(b.id);
      const key = `${b.rx},${b.ry},${b.w},${b.h},${b.level}`;
      if (!r) {
        r = { g: this.scene.add.graphics().setDepth(3.6), key: null };
        this.roofs.set(b.id, r);
      }
      if (r.key !== key) {
        r.key = key;
        r.g.clear();
        drawRoof(r.g, b, def, data);
      }
      const inside = selected && selected.away == null && selected.x >= b.rx && selected.x < b.rx + b.w && selected.y >= b.ry && selected.y < b.ry + b.h;
      r.g.setAlpha(far * (inside ? 0.25 : 1)).setVisible(far > 0.01);
    }
    for (const [id, r] of this.roofs) {
      if (seen.has(id)) continue;
      r.g.destroy();
      this.roofs.delete(id);
    }
  }

  destroy() {
    for (const r of this.roofs.values()) r.g.destroy();
    this.roofs.clear();
  }
}
