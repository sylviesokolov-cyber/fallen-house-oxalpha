import { TILE_SIZE, hexToInt } from './constants.js';

const TEXTURE_KEY = 'map';
// The map is baked at twice the world resolution and shown at half scale, so
// it stays crisp when zoomed in.
const R = 2;
const T = TILE_SIZE * R;

// Cheap deterministic per-tile hash so the map looks less flat. Rendering-only.
function hash(x, y, salt = 0) {
  let h = (x * 374761393 + y * 668265263 + salt * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function shade(color, factor) {
  const r = Math.min(255, ((color >> 16) & 255) * factor);
  const g = Math.min(255, ((color >> 8) & 255) * factor);
  const b = Math.min(255, (color & 255) * factor);
  return (r << 16) | (g << 8) | b;
}

const FLOWERS = [0xf5f0d8, 0xffd35c, 0xe98fb3, 0xb99cff, 0x9fd0ff];

// Where the paths meet: every door, the store, the portal, the field and the
// grove all connect to a hub in the middle of the sanctuary.
function pathNodes(data) {
  const L = data.sanctuary;
  const nodes = [];
  for (const b of L.buildings) nodes.push([b.x + Math.floor(b.w / 2), b.y + b.h]);
  for (const kind of ['plots', 'smallPlots', 'homePlots']) {
    for (const p of L[kind] ?? []) nodes.push([p.x + Math.floor(p.w / 2), p.y + p.h]);
  }
  nodes.push([L.portal.x + 1, L.portal.y + L.portal.h + 1]);
  for (const z of L.zones) {
    if (z.resource === 'tree') nodes.push([z.x + z.w, z.y + Math.floor(z.h / 2)]);
    else nodes.push([z.x + Math.floor(z.w / 2), z.y - 1]);
  }
  return nodes;
}

const HUB = (data) => [data.sanctuary.stockpile.x + 1, data.sanctuary.stockpile.y - 3];

// Lamp posts at path junctions near the heart of the sanctuary (their light
// is drawn at night by the ambient view).
export function lanternSpots(data) {
  const [hx, hy] = HUB(data);
  const spots = [[hx - 6, hy], [hx + 6, hy], [hx, hy + 4], [hx - 1, hy - 8]];
  const p = data.sanctuary.portal;
  spots.push([p.x - 1, p.y + 2], [p.x + p.w, p.y + 2]);
  return spots;
}

// Ground colours for the normal map and the snowy winter one.
const PALETTES = {
  normal: { grove: [0x2f6a34, 0x285c2c, 0x3a7a3a], soil: [0x6a4a2c, 0x7a5a36, 0x8a6840, 0x5e4228], path: [0x8f7a52, 0xb59a68, 0xc4aa76], tufts: true },
  winter: { grass: 0xe6edf4, grove: [0xc4d2c8, 0xb0c0b4, 0xd8e2da], soil: [0x9a8a78, 0xc9c2b8, 0xe8eef4, 0xa89a88], path: [0xa89c88, 0xcfc6b4, 0xe0d8c8], tufts: false },
};

function drawGrass(g, x, y, base, pal) {
  const n = hash(x, y);
  g.fillStyle(shade(base, 0.94 + n * 0.1));
  g.fillRect(x * T, y * T, T, T);
  // Soft darker blotches break up the grid.
  if (hash(x, y, 1) < 0.35) {
    g.fillStyle(shade(base, 0.88), 0.6);
    g.fillCircle(x * T + hash(x, y, 2) * T, y * T + hash(x, y, 3) * T, T * (0.3 + hash(x, y, 4) * 0.3));
  }
  if (!pal.tufts) {
    if (n > 0.85) {
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(x * T + n * T, y * T + hash(x, y, 5) * T, 2);
    }
    return;
  }
  if (n < 0.45) {
    g.fillStyle(shade(base, 0.72));
    const tx = x * T + 4 + n * 40;
    const ty = y * T + 8 + ((x * 3 + y) % 12);
    g.fillRect(tx, ty, 2, 5);
    g.fillRect(tx + 3, ty - 2, 2, 7);
    g.fillRect(tx + 6, ty + 1, 2, 4);
  }
  if (n > 0.9) {
    g.fillStyle(FLOWERS[(x + y * 3) % FLOWERS.length]);
    const fx = x * T + 6 + (n - 0.9) * 180;
    const fy = y * T + 18;
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) g.fillCircle(fx + dx, fy + dy, 1.8);
    g.fillStyle(0xffe066);
    g.fillCircle(fx, fy, 1.4);
  }
}

// The grove floor: dark, mossy, with a feathered edge onto the grass.
function drawGrove(g, z, pal) {
  const x = z.x * T;
  const y = z.y * T;
  const w = z.w * T;
  const h = z.h * T;
  for (let k = 3; k >= 0; k--) {
    g.fillStyle(shade(pal.grove[0], 1.25 - k * 0.07), 0.35 + (3 - k) * 0.2);
    g.fillRoundedRect(x - k * 6, y - k * 6, w + k * 12, h + k * 12, 28 + k * 6);
  }
  for (let ty = z.y; ty < z.y + z.h; ty++) {
    for (let tx = z.x; tx < z.x + z.w; tx++) {
      const n = hash(tx, ty, 7);
      g.fillStyle(n < 0.5 ? pal.grove[1] : pal.grove[2], 0.7);
      g.fillCircle(tx * T + n * T, ty * T + hash(tx, ty, 8) * T, 5 + n * 6);
      if (n > 0.8) {
        g.fillStyle(0xd9d2a0);
        g.fillCircle(tx * T + 10, ty * T + 20, 2);
      }
    }
  }
}

// The potato field: tilled furrows inside a rail fence.
function drawField(g, z, pal) {
  const x = z.x * T;
  const y = z.y * T;
  const w = z.w * T;
  const h = z.h * T;
  g.fillStyle(pal.soil[0]);
  g.fillRoundedRect(x - 4, y - 4, w + 8, h + 8, 10);
  g.fillStyle(pal.soil[1]);
  g.fillRoundedRect(x, y, w, h, 8);
  for (let ty = 0; ty < z.h * 2; ty++) {
    g.fillStyle(ty % 2 ? pal.soil[2] : pal.soil[3]);
    g.fillRect(x + 4, y + 6 + ty * (T / 2), w - 8, 5);
  }
  // Fence: posts and two rails.
  const fx = x - 8;
  const fy = y - 8;
  const fw = w + 16;
  const fh = h + 16;
  g.lineStyle(3, 0x8a5a2b);
  g.strokeRect(fx, fy + 4, fw, fh - 8);
  g.lineStyle(2, 0xa0703a);
  g.strokeRect(fx, fy + 10, fw, fh - 20);
  g.fillStyle(0x6b4a2b);
  for (let px = fx; px <= fx + fw; px += T) {
    g.fillRect(px - 2, fy, 5, 14);
    g.fillRect(px - 2, fy + fh - 14, 5, 14);
  }
  for (let py = fy; py <= fy + fh; py += T) {
    g.fillRect(fx - 2, py, 5, 12);
    g.fillRect(fx + fw - 3, py, 5, 12);
  }
}

// Dirt paths: each node joins the hub with an L-shaped route, drawn as a wide
// dark edge, then a lighter centre, then scattered pebbles.
function drawPaths(g, data, pal) {
  const [hx, hy] = HUB(data);
  const routes = pathNodes(data).map(([nx, ny]) => [[nx, ny], [nx, hy], [hx, hy]]);
  const pass = (width, color, alpha) => {
    g.lineStyle(width, color, alpha);
    g.fillStyle(color, alpha);
    for (const route of routes) {
      for (let i = 0; i < route.length - 1; i++) {
        const [ax, ay] = route[i];
        const [bx, by] = route[i + 1];
        g.lineBetween((ax + 0.5) * T, (ay + 0.5) * T, (bx + 0.5) * T, (by + 0.5) * T);
      }
      for (const [px, py] of route) g.fillCircle((px + 0.5) * T, (py + 0.5) * T, width / 2);
    }
  };
  pass(T * 0.95, pal.path[0], 0.55);
  pass(T * 0.7, pal.path[1], 0.9);
  pass(T * 0.35, pal.path[2], 0.5);
}

// A cobbled plaza around the hub and the store.
function drawPlaza(g, data) {
  const [hx, hy] = HUB(data);
  const cx = (hx + 0.5) * T;
  const cy = (hy + 1.5) * T;
  g.fillStyle(0x6f6a62);
  g.fillEllipse(cx, cy, T * 7.4, T * 4.6);
  g.fillStyle(0x8c867c);
  g.fillEllipse(cx, cy, T * 7, T * 4.2);
  for (let k = 0; k < 90; k++) {
    const a = hash(k, 1, 9) * Math.PI * 2;
    const r = Math.sqrt(hash(k, 2, 9));
    const sx = cx + Math.cos(a) * r * T * 3.3;
    const sy = cy + Math.sin(a) * r * T * 1.9;
    g.fillStyle(hash(k, 3, 9) < 0.5 ? 0xa39c90 : 0x9a9386);
    g.fillRoundedRect(sx - 5, sy - 3.5, 10, 7, 3);
  }
}

function drawLanterns(g, data) {
  for (const [x, y] of lanternSpots(data)) {
    const cx = (x + 0.5) * T;
    const cy = (y + 0.5) * T;
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(cx + 3, cy + 12, 14, 6);
    g.fillStyle(0x3a3a40);
    g.fillRect(cx - 2, cy - 14, 4, 26);
    g.fillStyle(0x50535c);
    g.fillRect(cx - 6, cy - 22, 12, 9);
    g.fillStyle(0xffd38a);
    g.fillRect(cx - 4, cy - 20, 8, 5);
  }
}

// Stone blocks with a lit top edge and a shaded base.
function drawWall(g, x, y, base) {
  const px = x * T;
  const py = y * T;
  g.fillStyle(shade(base, 0.92 + hash(x, y) * 0.12));
  g.fillRect(px, py, T, T);
  const off = y % 2 ? 0 : T / 2;
  g.fillStyle(shade(base, 0.7));
  g.fillRect(px, py + T / 2 - 1, T, 2);
  g.fillRect(px + off, py, 2, T / 2);
  g.fillRect(px + ((off + T / 2) % T), py + T / 2, 2, T / 2);
  g.fillStyle(shade(base, 1.3));
  g.fillRect(px, py, T, 3);
  g.fillStyle(0x000000, 0.25);
  g.fillRect(px, py + T - 4, T, 4);
}

// Wooden planks: three boards per tile, each a slightly different tone, with
// joints staggered so the floor doesn't read as a grid (or as bricks).
function drawFloor(g, x, y) {
  const px = x * T;
  const py = y * T;
  const board = T / 3;
  for (let k = 0; k < 3; k++) {
    const n = hash(x, y * 3 + k, 11);
    g.fillStyle(shade(0xb08a5e, 0.9 + n * 0.16));
    g.fillRect(px, py + k * board, T, board);
    g.fillStyle(0x6b4a2b, 0.55);
    g.fillRect(px, py + (k + 1) * board - 1, T, 1);
    if ((x + y * 3 + k) % 3 === 0) g.fillRect(px + Math.floor(n * (T - 4)) + 2, py + k * board, 1, board);
    g.fillStyle(0xffffff, 0.06);
    g.fillRect(px, py + k * board, T, 1);
  }
}

function drawYard(g, x, y, base) {
  const px = x * T;
  const py = y * T;
  g.fillStyle(shade(base, 0.95 + hash(x, y) * 0.08));
  g.fillRect(px, py, T, T);
  g.fillStyle(shade(base, 0.82));
  for (let k = 0; k < 3; k++) g.fillCircle(px + hash(x, y, k) * T, py + hash(x, y, k + 5) * T, 1.5);
}

function drawPortal(g, data) {
  const p = data.sanctuary.portal;
  const x = p.x * T;
  const y = p.y * T;
  const w = p.w * T;
  // Stone arch around a violet gate.
  g.fillStyle(0x4a4450);
  g.fillRoundedRect(x - 10, y - 2, w + 20, T + 10, { tl: 20, tr: 20, bl: 0, br: 0 });
  g.fillStyle(0x2a1a55);
  g.fillRoundedRect(x - 2, y + 4, w + 4, T + 2, { tl: 14, tr: 14, bl: 0, br: 0 });
  g.fillStyle(0x6d4bd1, 0.8);
  g.fillEllipse(x + w / 2, y + T * 0.7, w * 0.8, T * 0.9);
  g.fillStyle(0xb99cff, 0.7);
  g.fillEllipse(x + w / 2, y + T * 0.7, w * 0.45, T * 0.5);
}

// Draws the whole map once into a texture; one image is far cheaper to
// render every frame than thousands of shapes.
// `variant` is 'normal' or 'winter' (snow on the ground; the ambient view
// fades it in and out with the season).
export function drawMap(scene, world, data, variant = 'normal') {
  const pal = PALETTES[variant];
  const key = `${TEXTURE_KEY}-${variant}`;
  const g = scene.make.graphics({ add: false });
  const grass = pal.grass ?? hexToInt(data.tilesById.grass.color);
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) drawGrass(g, x, y, grass, pal);
  }
  for (const z of data.sanctuary.zones) (z.resource === 'tree' ? drawGrove : drawField)(g, z, pal);
  drawPaths(g, data, pal);
  drawPlaza(g, data);
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const id = world.tiles[y * world.width + x];
      const base = hexToInt(data.tilesById[id].color);
      if (id === 'wall') drawWall(g, x, y, base);
      else if (id === 'floor') drawFloor(g, x, y, base);
      else if (id === 'yard') drawYard(g, x, y, base);
    }
  }
  drawPortal(g, data);
  drawLanterns(g, data);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  g.generateTexture(key, world.width * T, world.height * T);
  g.destroy();
  return scene.add.image(0, 0, key).setOrigin(0).setScale(1 / R).setDepth(variant === 'winter' ? 0.01 : 0);
}
