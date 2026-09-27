import { TILE_SIZE, hexToInt } from './constants.js';

const TEXTURE_KEY = 'map';

// Cheap deterministic per-tile hash so the map looks less flat. Rendering-only.
function tileHash(x, y) {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function shade(color, factor) {
  const r = Math.min(255, ((color >> 16) & 255) * factor);
  const g = Math.min(255, ((color >> 8) & 255) * factor);
  const b = Math.min(255, (color & 255) * factor);
  return (r << 16) | (g << 8) | b;
}

// Per-tile texture so each ground type reads at a glance.
const DECOR = {
  grove(g, px, py, ts, base, n) {
    g.fillStyle(shade(base, 0.72));
    g.fillCircle(px + 5 + n * 6, py + 6 + n * 4, 4);
  },
  field(g, px, py, ts, base) {
    g.fillStyle(shade(base, 0.8));
    g.fillRect(px, py + 3, ts, 2);
    g.fillRect(px, py + 11, ts, 2);
  },
  wall(g, px, py, ts, base, n, x, y) {
    g.fillStyle(shade(base, 1.2));
    const off = y % 2 ? 0 : ts / 2;
    g.fillRect(px, py + ts / 2 - 1, ts, 1);
    g.fillRect(px + off, py, 1, ts / 2);
    g.fillRect(px + ((off + ts / 2) % ts), py + ts / 2, 1, ts / 2);
  },
  portal(g, px, py, ts) {
    g.fillStyle(0xb99cff);
    g.fillCircle(px + ts / 2, py + ts / 2, ts / 2 - 2);
    g.fillStyle(0x2a1a55);
    g.fillCircle(px + ts / 2, py + ts / 2, ts / 4);
  },
  floor(g, px, py, ts, base) {
    g.fillStyle(shade(base, 0.88));
    g.fillRect(px, py + ts - 1, ts, 1);
  },
  yard(g, px, py, ts, base, n) {
    g.fillStyle(shade(base, 0.85));
    g.fillRect(px + 3 + n * 8, py + 5 + n * 6, 2, 2);
  },
};

// Draws the whole tile map once into a texture; one image is far cheaper
// to render every frame than thousands of rectangles.
export function drawMap(scene, world, data) {
  const g = scene.make.graphics({ add: false });
  const ts = TILE_SIZE;
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const id = world.tiles[y * world.width + x];
      const base = hexToInt(data.tilesById[id].color);
      const n = tileHash(x, y);
      g.fillStyle(shade(base, 0.93 + n * 0.14));
      g.fillRect(x * ts, y * ts, ts, ts);
      DECOR[id]?.(g, x * ts, y * ts, ts, base, n, x, y);
    }
  }
  if (scene.textures.exists(TEXTURE_KEY)) scene.textures.remove(TEXTURE_KEY);
  g.generateTexture(TEXTURE_KEY, world.width * ts, world.height * ts);
  g.destroy();
  scene.textures.get(TEXTURE_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);
  return scene.add.image(0, 0, TEXTURE_KEY).setOrigin(0).setDepth(0);
}
