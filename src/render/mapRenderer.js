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
      if (id === 'forest') {
        g.fillStyle(shade(base, 0.72));
        g.fillCircle(x * ts + 5 + n * 6, y * ts + 6 + n * 4, 4);
      } else if (id === 'stone') {
        g.fillStyle(shade(base, 1.18));
        g.fillRect(x * ts + 3 + n * 6, y * ts + 4 + n * 5, 4, 3);
      }
    }
  }
  if (scene.textures.exists(TEXTURE_KEY)) scene.textures.remove(TEXTURE_KEY);
  g.generateTexture(TEXTURE_KEY, world.width * ts, world.height * ts);
  g.destroy();
  scene.textures.get(TEXTURE_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);
  return scene.add.image(0, 0, TEXTURE_KEY).setOrigin(0).setDepth(0);
}
