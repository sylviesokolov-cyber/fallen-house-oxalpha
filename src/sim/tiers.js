import { logEvent } from './history.js';
import { addResource } from './world.js';
import { rectTiles } from './world.js';
import { rankIndex } from './rank.js';

// The sanctuary grows in tiers (Sanctuary, Town, City) from the `tiers` in
// data/sanctuary.json. Only the god can raise the walls, and only once the
// people are ready (population, buildings, milestones...). The map grows east
// and south: the old east and south walls come down, a new ring goes up, and
// the new land brings its own groves, fields and plots. New kinds of
// buildings and techs name the tier they need.

export const tierOf = (state) => state.settlement.tier ?? 1;
export const tierDef = (data, level) => data.sanctuary.tiers?.find((t) => t.level === level) ?? null;
export const nextTier = (state, data) => tierDef(data, tierOf(state) + 1);

const HAVE = {
  population: (s) => s.humans.length,
  plotBuildings: (s) => s.buildings.filter((b) => b.built && b.plot).length,
  goals: (s) => Object.keys(s.goals ?? {}).length,
  rank: (s, d, r) => s.humans.filter((h) => rankIndex(s, d, h) >= d.ranks.findIndex((k) => k.id === r.rank)).length,
};

// [{ label, have, need, ok }] for the next tier, or null at the top.
export function tierRequirements(state, data) {
  const t = nextTier(state, data);
  if (!t) return null;
  const out = t.requires.map((r) => {
    const have = HAVE[r.type](state, data, r);
    return { label: r.label, have: Math.min(have, r.min), need: r.min, ok: have >= r.min };
  });
  out.push({ label: 'Faith', have: Math.min(Math.floor(state.faith), t.cost), need: t.cost, ok: state.faith >= t.cost });
  return out;
}

// Raises the walls. Returns an error message, or null.
export function expand(state, data) {
  const t = nextTier(state, data);
  if (!t) return 'The sanctuary cannot grow any further';
  const unmet = tierRequirements(state, data).filter((r) => !r.ok);
  if (unmet.length) return `Not yet: ${unmet.map((r) => r.label.toLowerCase()).join(', ')}`;
  state.faith -= t.cost;
  growWorld(state, data, t);
  state.settlement.tier = t.level;
  logEvent(state, `By the god's will the walls of ${state.settlement.name} were raised anew: the ${tierDef(data, t.level - 1).name} became a ${t.name}`);
  return null;
}

function growWorld(state, data, t) {
  const old = state.world;
  const { width, height } = t;
  const tiles = new Array(width * height).fill('grass');
  for (let y = 0; y < old.height; y++) {
    for (let x = 0; x < old.width; x++) {
      const tile = old.tiles[y * old.width + x];
      // The old east and south walls come down (the north and west stay).
      const oldEdge = (x === old.width - 1 && y > 0) || (y === old.height - 1 && x > 0);
      tiles[y * width + x] = oldEdge && tile === 'wall' ? 'grass' : tile;
    }
  }
  const set = (x, y, v) => { tiles[y * width + x] = v; };
  for (let i = 0; i < width; i++) {
    set(i, 0, tiles[i] === 'portal' ? 'portal' : 'wall');
    set(i, height - 1, 'wall');
  }
  for (let i = 0; i < height; i++) {
    set(0, i, 'wall');
    set(width - 1, i, 'wall');
  }
  Object.assign(old, { width, height, tiles });
  for (const zone of t.zones ?? []) {
    const def = data.resourcesById[zone.resource];
    for (const [x, y] of rectTiles(zone)) {
      set(x, y, zone.tile);
      // Evenly spread rather than rolled, so expanding doesn't shift the RNG.
      if (((x * 7 + y * 13) % 100) / 100 < zone.density) addResource(old, def.id, x, y, def.maxAmount);
    }
  }
}

// Every zone in the sanctuary so far (the renderer draws groves and fields).
export function zonesOf(state, data) {
  const tiers = (data.sanctuary.tiers ?? []).filter((t) => t.level <= tierOf(state));
  return [...data.sanctuary.zones, ...tiers.flatMap((t) => t.zones ?? [])];
}
