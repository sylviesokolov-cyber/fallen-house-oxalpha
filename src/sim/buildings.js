import { bfs } from './pathfinding.js';
import { tileIndex, addResource } from './world.js';
import { gainXp, workTimeFactor } from './skills.js';
import { logEvent } from './history.js';
import { focusValue } from './status.js';

// state.buildings holds construction sites and finished buildings:
// { id, type, x, y, built, work }. Materials are taken from the stockpile when
// a site is placed, and `work` counts up until it reaches the building's cost.

const defOf = (data, b) => data.buildingsById[b.type];

export function builtNear(state, data, x, y, type, radius) {
  return state.buildings.some((b) => b.built && b.type === type && Math.abs(b.x - x) <= radius && Math.abs(b.y - y) <= radius);
}

export function hasBuilt(state, type) {
  return state.buildings.some((b) => b.built && b.type === type);
}

// Warm = asleep in a warm shelter, or near a finished campfire. The warm
// don't suffer the winter hunger penalty and don't count cold nights.
export function isWarm(state, data, h) {
  const inside = h.action.buildingId != null && state.buildings.find((b) => b.id === h.action.buildingId);
  if (inside && h.action.type === 'sleep' && defOf(data, inside).effects.warm) return true;
  return state.buildings.some((b) => {
    const r = b.built && defOf(data, b).effects.warmthRadius;
    return r && Math.abs(b.x - h.x) <= r && Math.abs(b.y - h.y) <= r;
  });
}

const knowsTech = (h, def) => h.knows.includes(def.tech);
const affordable = (stockpile, cost) => Object.entries(cost).every(([k, v]) => (stockpile[k] ?? 0) >= v);

function sleepCapacity(state, data) {
  let total = 0;
  for (const b of state.buildings) total += defOf(data, b).effects.sleepers ?? 0;
  return total;
}

// The next building this person thinks the tribe needs, knows how to build,
// and can afford. For beds, only the best shelter they know is considered.
export function wantedBuilding(state, data, h) {
  const pop = state.humans.length;
  const count = (type) => state.buildings.filter((b) => b.type === type).length;
  const bestShelter = data.buildings
    .filter((d) => d.want.sleepCapacity && knowsTech(h, d))
    .sort((a, b) => b.effects.sleepers - a.effects.sleepers)[0];
  for (const def of data.buildings) {
    if (!knowsTech(h, def) || !affordable(state.stockpile, def.cost)) continue;
    const w = def.want;
    // A Harvest omen means more fields per person; a Build omen, spare beds.
    const perPop = w.perPop && w.perPop * (def.id === 'farm_plot' ? focusValue(state, data, 'farmPerPop') : 1);
    const beds = pop + focusValue(state, data, 'extraBeds', 0);
    const wanted = (perPop && count(def.id) < Math.ceil(pop / perPop))
      || (w.count && count(def.id) < w.count)
      || (w.sleepCapacity && def === bestShelter && sleepCapacity(state, data) < beds);
    if (wanted) return def;
  }
  return null;
}

// Finds a free tile near the stockpile (preferring e.g. fertile soil for farms),
// pays for the building and marks out the site.
export function placeSite(state, data, def) {
  const { world, stockpile } = state;
  const occupied = new Set([tileIndex(world, stockpile.x, stockpile.y)]);
  for (const b of state.buildings) occupied.add(tileIndex(world, b.x, b.y));
  for (const r of world.resources) occupied.add(tileIndex(world, r.x, r.y));
  const { reached } = bfs(world, data, tileIndex(world, stockpile.x, stockpile.y), { maxDist: def.placement.radius });
  const free = reached.filter((i) => !occupied.has(i) && def.placement.tiles.includes(world.tiles[i]));
  const spot = free.find((i) => world.tiles[i] === def.placement.prefer) ?? free[0];
  if (spot == null) return null;
  for (const [k, v] of Object.entries(def.cost)) stockpile[k] -= v;
  const site = { id: state.nextBuildingId++, type: def.id, x: spot % world.width, y: Math.floor(spot / world.width), built: false, work: 0 };
  state.buildings.push(site);
  return site;
}

export function openSiteFor(state, data, h) {
  return state.buildings.find((b) => !b.built && knowsTech(h, defOf(data, b)));
}

// One tick of work on a site. Building skill makes each tick count for more.
export function workOnSite(state, data, h, site) {
  const def = defOf(data, site);
  site.work += 1 / workTimeFactor(h, data, 'building');
  gainXp(state, data, h, 'building', data.skillsById.building.xpPerAction);
  if (site.work < def.work) return false;
  site.built = true;
  if (def.effects.createsResource) addResource(state.world, def.effects.createsResource, site.x, site.y, 0);
  logEvent(state, `${h.name} finished building a ${def.name}`);
  return true;
}

// A finished shelter this person knows how to use, with a free bed.
export function freeShelter(state, data, h) {
  const inUse = new Map();
  for (const o of state.humans) {
    if (o !== h && o.action.buildingId != null) inUse.set(o.action.buildingId, (inUse.get(o.action.buildingId) ?? 0) + 1);
  }
  return state.buildings.find((b) => {
    const def = defOf(data, b);
    return b.built && def.effects.sleepers && knowsTech(h, def) && (inUse.get(b.id) ?? 0) < def.effects.sleepers;
  });
}

export function buildingById(state, id) {
  return state.buildings.find((b) => b.id === id);
}
