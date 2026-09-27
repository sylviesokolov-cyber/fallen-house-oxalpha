import { randInt } from './rng.js';
import { rectTiles, tileIndex } from './world.js';

// state.buildings: { id, type, level, built, rx, ry, w, h, x, y, plot?, work?,
// upgrade?, owners? }. rx/ry/w/h is the footprint (rooms have walkable
// floors); x/y is its centre, used as the place to walk to when any spot
// inside will do. Unbuilt buildings are construction sites (see construction.js).

const defOf = (data, b) => data.buildingsById[b.type];

export function createStartingBuildings(state, data) {
  for (const l of data.sanctuary.buildings) {
    state.buildings.push({
      id: state.nextBuildingId++,
      type: l.type,
      level: 1,
      built: true,
      rx: l.x,
      ry: l.y,
      w: l.w,
      h: l.h,
      x: l.x + Math.floor(l.w / 2),
      y: l.y + Math.floor(l.h / 2),
    });
  }
}

// A building's effects at its current level: each upgrade reached overrides
// the base values it names.
export function effectsOf(data, b) {
  const def = defOf(data, b);
  if (!def.upgrades || b.level <= 1) return def.effects;
  let fx = def.effects;
  for (const u of def.upgrades) if (u.level <= b.level) fx = { ...fx, ...u.effects };
  return fx;
}

export function buildingEffect(data, b, key) {
  return b.built ? effectsOf(data, b)[key] : undefined;
}

export const inside = (b, x, y) => x >= b.rx && x < b.rx + b.w && y >= b.ry && y < b.ry + b.h;

export function hasBuilt(state, type) {
  return state.buildings.some((b) => b.built && b.type === type);
}

export function builtOfType(state, type) {
  return state.buildings.find((b) => b.built && b.type === type);
}

// The first finished building with a given effect, e.g. 'dining' or 'training'.
export function buildingWith(state, data, effect) {
  return state.buildings.find((b) => b.built && effectsOf(data, b)[effect]);
}

// The finished building with the highest value of an effect (e.g. the holiest
// place to pray).
export function bestBuildingFor(state, data, effect) {
  let best = null;
  for (const b of state.buildings) {
    const v = buildingEffect(data, b, effect);
    if (v && (!best || v > buildingEffect(data, best, effect))) best = b;
  }
  return best;
}

export function builtNear(state, data, x, y, type, radius) {
  return state.buildings.some((b) => b.built && b.type === type
    && x >= b.rx - radius && x < b.rx + b.w + radius && y >= b.ry - radius && y < b.ry + b.h + radius);
}

// Indoors in a warm building (or asleep in one): no winter hunger penalty and
// no cold nights.
export function isWarm(state, data, h) {
  return state.buildings.some((b) => b.built && effectsOf(data, b).warm && inside(b, h.x, h.y));
}

export function sleepCapacity(state, data) {
  let total = 0;
  for (const b of state.buildings) total += buildingEffect(data, b, 'sleepers') ?? 0;
  return total;
}

// A family home belongs to its owners, their partners and their children.
export function isHomeOf(b, h) {
  const o = b.owners ?? [];
  return o.includes(h.id) || (h.partnerId != null && o.includes(h.partnerId)) || h.parents.some((p) => o.includes(p));
}

// Where this person sleeps: their family's home if they have one with a free
// bed, otherwise a shared hall.
export function freeShelter(state, data, h) {
  const inUse = new Map();
  for (const o of state.humans) {
    if (o !== h && (o.action.type === 'sleep' || o.action.type === 'goSleep') && o.action.buildingId != null) {
      inUse.set(o.action.buildingId, (inUse.get(o.action.buildingId) ?? 0) + 1);
    }
  }
  const hasRoom = (b) => b.built && (inUse.get(b.id) ?? 0) < (buildingEffect(data, b, 'sleepers') ?? 0);
  const home = state.buildings.find((b) => buildingEffect(data, b, 'home') && isHomeOf(b, h) && hasRoom(b));
  return home ?? state.buildings.find((b) => !effectsOf(data, b).home && hasRoom(b));
}

// A bed is every other tile in each direction (the renderer draws them there).
export const isBed = (b, x, y) => (x - b.rx) % 2 === 0 && (y - b.ry) % 2 === 0;

// A free tile inside a building for this person (their bed, seat, or patch
// of training yard), so people spread out instead of piling on one tile.
// With `beds`, only bed tiles are used while any is free.
export function roomSpot(state, b, h, beds = false) {
  const taken = new Set();
  for (const o of state.humans) {
    const s = o !== h && o.action.spot;
    if (s) taken.add(tileIndex(state.world, s.x, s.y));
  }
  const all = rectTiles({ x: b.rx, y: b.ry, w: b.w, h: b.h });
  const bedTiles = beds ? all.filter(([x, y]) => isBed(b, x, y)) : [];
  const tiles = bedTiles.some(([x, y]) => !taken.has(tileIndex(state.world, x, y))) ? bedTiles : all;
  const free = tiles.filter(([x, y]) => !taken.has(tileIndex(state.world, x, y)));
  const pool = free.length ? free : tiles;
  const [x, y] = pool[randInt(state.rng, 0, pool.length - 1)];
  return { x, y };
}

export function buildingById(state, id) {
  return state.buildings.find((b) => b.id === id);
}
