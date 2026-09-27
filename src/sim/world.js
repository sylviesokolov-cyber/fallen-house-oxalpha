import { next } from './rng.js';

// The sanctuary: a walled map laid out by data/sanctuary.json. A wall rings
// the edge (with the portal set into it); zones like the tree grove and the
// potato field are painted in and seeded with their resources; buildings get
// their own floor tiles.

const rectTiles = (r) => {
  const out = [];
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) out.push([x, y]);
  return out;
};

export function generateWorld(rng, data) {
  const L = data.sanctuary;
  const { width, height } = L;
  const tiles = new Array(width * height).fill('grass');
  const set = (x, y, t) => { tiles[y * width + x] = t; };
  for (let i = 0; i < width; i++) {
    set(i, 0, 'wall');
    set(i, height - 1, 'wall');
  }
  for (let i = 0; i < height; i++) {
    set(0, i, 'wall');
    set(width - 1, i, 'wall');
  }
  for (const [x, y] of rectTiles(L.portal)) set(x, y, 'portal');

  const world = { width, height, tiles, resources: [], nextResourceId: 1 };
  for (const zone of L.zones) {
    const def = data.resourcesById[zone.resource];
    for (const [x, y] of rectTiles(zone)) {
      set(x, y, zone.tile);
      if (next(rng) < zone.density) addResource(world, def.id, x, y, def.maxAmount);
    }
  }
  for (const b of L.buildings) {
    const floor = data.buildingsById[b.type].effects.training ? 'yard' : 'floor';
    for (const [x, y] of rectTiles(b)) set(x, y, floor);
  }
  return world;
}

export { rectTiles };

export const tileIndex = (world, x, y) => y * world.width + x;

// True if a tile of the given type is within `radius` tiles (square area).
export function tileNear(world, x, y, tile, radius) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= world.width || ny >= world.height) continue;
      if (world.tiles[ny * world.width + nx] === tile) return true;
    }
  }
  return false;
}

export function addResource(world, type, x, y, amount) {
  const r = { id: world.nextResourceId++, type, x, y, amount, regrow: 0 };
  world.resources.push(r);
  return r;
}

export function isWalkable(world, data, i) {
  return data.tilesById[world.tiles[i]].walkable;
}

// Each depleted resource regains one unit every `regrowTicks` ticks, scaled by
// the current season (a multiplier of 0 means it doesn't regrow that season).
export function updateResources(world, data, season) {
  for (const r of world.resources) {
    const def = data.resourcesById[r.type];
    if (!def.regrowTicks || r.amount >= def.maxAmount) continue;
    const mult = def.seasonMultiplier?.[season] ?? 1;
    if (mult <= 0) continue;
    if (++r.regrow >= def.regrowTicks * mult) {
      r.amount++;
      r.regrow = 0;
    }
  }
}
