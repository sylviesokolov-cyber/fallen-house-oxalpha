import { chance } from './rng.js';
import { gainXp, skillLevel } from './skills.js';
import { hasBuilt } from './buildings.js';

// Tools are personal (h.tools: { itemId: usesLeft }) and wear out with use.
// Goods (pottery, cooked food) live in the shared stockpile.

export function hasTool(h, itemId) {
  return (h.tools[itemId] ?? 0) > 0;
}

// Wears a tool down by one use; it breaks when it runs out.
export function useTool(h, itemId) {
  if (!hasTool(h, itemId)) return;
  if (--h.tools[itemId] <= 0) delete h.tools[itemId];
}

// Multiplier on work time for a skill from the tools this person carries.
export function toolWorkFactor(h, data, skillId) {
  let m = 1;
  for (const id of Object.keys(h.tools)) m *= data.itemsById[id].effects.workSpeed?.[skillId] ?? 1;
  return m;
}

export function carryCapacity(h, data) {
  let cap = data.config.humans.carryCapacity;
  for (const id of Object.keys(h.tools)) cap += data.itemsById[id].effects.carryBonus ?? 0;
  return cap;
}

export function canStoreFood(h, data) {
  return Object.keys(h.tools).some((id) => data.itemsById[id].effects.storesFood);
}

export function foodReserveWanted(state, data) {
  return state.humans.length * data.config.food.reservePerPerson;
}

const affordable = (stockpile, cost) => Object.entries(cost).every(([k, v]) => (stockpile[k] ?? 0) >= v);

// Something this person knows how to make, that is wanted, and that the
// stockpile has materials for (and whose station, e.g. a campfire, exists).
export function craftChoice(state, data, h) {
  const pop = state.humans.length;
  for (const def of data.items) {
    if (!h.knows.includes(def.tech) || !affordable(state.stockpile, def.cost)) continue;
    if (def.station && !hasBuilt(state, def.station)) continue;
    if (def.kind === 'tool') {
      if (hasTool(h, def.id)) continue;
      if (def.effects.workSpeed && !Object.keys(def.effects.workSpeed).some((s) => skillLevel(h, s) > 0)) continue;
      return def;
    }
    const want = def.want.count ?? Math.ceil(pop * (def.want.perPerson ?? 0));
    if ((state.stockpile[def.id] ?? 0) < want) return def;
  }
  return null;
}

// Materials are taken when the work is finished, so an interrupted crafter
// wastes nothing. Returns false if someone else used the materials meanwhile.
export function finishCraft(state, data, h, def) {
  if (!affordable(state.stockpile, def.cost)) return false;
  for (const [k, v] of Object.entries(def.cost)) state.stockpile[k] -= v;
  if (def.kind === 'tool') h.tools[def.id] = def.durability;
  else state.stockpile[def.id] = (state.stockpile[def.id] ?? 0) + 1;
  gainXp(state, data, h, def.skill, data.skillsById[def.skill].xpPerAction);
  return true;
}

export function foodInStock(state) {
  return state.stockpile.food + state.stockpile.cooked_food;
}

// Eats one meal from the stockpile (cooked if there is any). Returns false if empty.
export function eatFromStock(state, data, h) {
  const s = state.stockpile;
  if (s.cooked_food > 0) {
    s.cooked_food--;
    h.needs.hunger = Math.min(100, h.needs.hunger + data.itemsById.cooked_food.food);
    return true;
  }
  if (s.food > 0) {
    s.food--;
    h.needs.hunger = Math.min(100, h.needs.hunger + data.config.food.rawValue);
    return true;
  }
  return false;
}

// Once a day, stored food rots a little. A storage pit and enough pots slow it.
export function spoilFood(state, data) {
  if (state.tick % data.config.time.ticksPerDay !== 0) return;
  let rate = data.config.food.spoilPerDay;
  for (const b of data.buildings) if (b.effects.spoilage && hasBuilt(state, b.id)) rate *= b.effects.spoilage;
  const pots = data.itemsById.pottery;
  if ((state.stockpile.pottery ?? 0) >= pots.effects.needed) rate *= pots.effects.spoilage;
  for (const key of ['food', 'cooked_food']) {
    const exact = state.stockpile[key] * rate;
    const lost = Math.floor(exact) + (chance(state.rng, exact % 1) ? 1 : 0);
    state.stockpile[key] -= lost;
    state.tribeCounters.foodSpoiled = (state.tribeCounters.foodSpoiled ?? 0) + lost;
  }
}
