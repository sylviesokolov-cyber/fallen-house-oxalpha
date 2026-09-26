import { next } from './rng.js';
import { fractalNoise } from './noise.js';

export function generateWorld(rng, data) {
  const { width, height, waterLevel, stoneLevel, forestMoisture } = data.config.world;
  const elevation = fractalNoise(rng, width, height, [[16, 0.6], [8, 0.3], [4, 0.1]]);
  const moisture = fractalNoise(rng, width, height, [[12, 0.7], [6, 0.3]]);

  const tiles = new Array(width * height);
  for (let i = 0; i < tiles.length; i++) {
    const e = elevation[i];
    if (e < waterLevel) tiles[i] = 'water';
    else if (e > stoneLevel) tiles[i] = 'stone';
    else if (moisture[i] > forestMoisture) tiles[i] = 'forest';
    else tiles[i] = 'grass';
  }

  // Damp grass beside water becomes fertile soil (good for farming).
  const { fertileNearWater, fertileMoisture } = data.config.world;
  const draft = { width, height, tiles };
  for (let i = 0; i < tiles.length; i++) {
    const x = i % width;
    const y = Math.floor(i / width);
    if (tiles[i] === 'grass' && moisture[i] > fertileMoisture && tileNear(draft, x, y, 'water', fertileNearWater)) {
      tiles[i] = 'fertile';
    }
  }

  const world = { width, height, tiles, resources: [], nextResourceId: 1 };
  for (const def of data.resources) {
    for (let i = 0; i < tiles.length; i++) {
      if (!def.spawnOn.includes(tiles[i])) continue;
      const near = def.spawnNear;
      if (near && !tileNear(world, i % width, Math.floor(i / width), near.tile, near.radius)) continue;
      if (next(rng) < def.density) addResource(world, def.id, i % width, Math.floor(i / width), def.maxAmount);
    }
  }
  return world;
}

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
// Resources with no `regrowTicks` (e.g. stone) never regrow at all.
export function updateResources(world, data, season) {
  for (const r of world.resources) {
    const def = data.resourcesById[r.type];
    if (!def.regrowTicks || r.amount >= def.maxAmount || r.burning) continue;
    const mult = def.seasonMultiplier?.[season] ?? 1;
    if (mult <= 0) continue;
    if (++r.regrow >= def.regrowTicks * mult) {
      r.amount++;
      r.regrow = 0;
    }
  }
}
