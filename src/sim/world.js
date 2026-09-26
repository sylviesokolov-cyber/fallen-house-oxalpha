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

  const world = { width, height, tiles, resources: [], nextResourceId: 1 };
  for (const def of data.resources) {
    for (let i = 0; i < tiles.length; i++) {
      if (def.spawnOn.includes(tiles[i]) && next(rng) < def.density) {
        world.resources.push({
          id: world.nextResourceId++,
          type: def.id,
          x: i % width,
          y: Math.floor(i / width),
          amount: def.maxAmount,
          regrow: 0,
        });
      }
    }
  }
  return world;
}

export const tileIndex = (world, x, y) => y * world.width + x;

export function isWalkable(world, data, i) {
  return data.tilesById[world.tiles[i]].walkable;
}

// Each depleted resource regains one unit every `regrowTicks` ticks, scaled by
// the current season (a multiplier of 0 means it doesn't regrow that season).
// Resources with no `regrowTicks` (e.g. stone) never regrow at all.
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
