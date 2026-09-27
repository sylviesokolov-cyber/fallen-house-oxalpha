import { randInt } from './rng.js';
import { rectTiles, tileIndex } from './world.js';

// state.buildings: { id, type, level, built, rx, ry, w, h, x, y }. rx/ry/w/h
// is the footprint (rooms have walkable floors); x/y is its centre, used as
// the place to walk to when any spot inside will do.

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

export const inside = (b, x, y) => x >= b.rx && x < b.rx + b.w && y >= b.ry && y < b.ry + b.h;

export function hasBuilt(state, type) {
  return state.buildings.some((b) => b.built && b.type === type);
}

// The first finished building with a given effect, e.g. 'dining' or 'training'.
export function buildingWith(state, data, effect) {
  return state.buildings.find((b) => b.built && defOf(data, b).effects[effect]);
}

export function builtNear(state, data, x, y, type, radius) {
  return state.buildings.some((b) => b.built && b.type === type
    && x >= b.rx - radius && x < b.rx + b.w + radius && y >= b.ry - radius && y < b.ry + b.h + radius);
}

// Indoors in a warm building (or asleep in one): no winter hunger penalty and
// no cold nights.
export function isWarm(state, data, h) {
  return state.buildings.some((b) => b.built && defOf(data, b).effects.warm && inside(b, h.x, h.y));
}

const knowsTech = (h, def) => !def.tech || h.knows.includes(def.tech);

export function sleepCapacity(state, data) {
  let total = 0;
  for (const b of state.buildings) if (b.built) total += defOf(data, b).effects.sleepers ?? 0;
  return total;
}

// A finished building with beds this person can use, and a bed free in it.
export function freeShelter(state, data, h) {
  const inUse = new Map();
  for (const o of state.humans) {
    if (o !== h && o.action.buildingId != null && o.action.type !== 'pray') {
      inUse.set(o.action.buildingId, (inUse.get(o.action.buildingId) ?? 0) + 1);
    }
  }
  return state.buildings.find((b) => {
    const def = defOf(data, b);
    return b.built && def.effects.sleepers && knowsTech(h, def) && (inUse.get(b.id) ?? 0) < def.effects.sleepers;
  });
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
