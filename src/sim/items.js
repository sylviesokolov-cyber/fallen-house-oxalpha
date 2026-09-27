import { chance } from './rng.js';
import { gainXp } from './skills.js';
import { buildingEffect, builtOfType } from './buildings.js';
import { addFeeling } from './mood.js';

// Tools are personal (h.tools: { itemId: usesLeft }) and wear out with use.
// Carpenters make them for the stockpile and people pick up what they need.
// Meals and drinks live in the shared stockpile.

export function hasTool(h, itemId) {
  return (h.tools[itemId] ?? 0) > 0;
}

// Wears a tool down by one use; it breaks when it runs out.
export function useTool(h, itemId) {
  if (!hasTool(h, itemId)) return;
  if (--h.tools[itemId] <= 0) delete h.tools[itemId];
}

// Wears every tool used for this skill.
export function wearTools(h, data, skillId) {
  for (const id of Object.keys(h.tools)) if (data.itemsById[id].forSkills?.includes(skillId)) useTool(h, id);
}

// Multiplier on work time for a skill from the tools this person carries.
export function toolWorkFactor(h, data, skillId) {
  let m = 1;
  for (const id of Object.keys(h.tools)) m *= data.itemsById[id].effects.workSpeed?.[skillId] ?? 1;
  return m;
}

// Multiplier from tools used for a skill, e.g. a wooden sword's trainingXp.
export function toolEffect(h, data, skillId, key) {
  let m = 1;
  for (const id of Object.keys(h.tools)) {
    const def = data.itemsById[id];
    if (def.forSkills?.includes(skillId)) m *= def.effects[key] ?? 1;
  }
  return m;
}

export function carryCapacity(h, data) {
  const st = data.config.stats;
  const strBonus = Math.min(st.maxCarryBonus, Math.floor((h.stats.str - st.base) / st.carryPerStr));
  let cap = data.config.humans.carryCapacity + strBonus;
  for (const id of Object.keys(h.tools)) cap += data.itemsById[id].effects.carryBonus ?? 0;
  return Math.max(1, cap);
}

// Farmers bring potatoes in to the stockpile.
export function canStoreFood(h) {
  return h.knows.includes('farming');
}

export function foodReserveWanted(state, data) {
  return state.humans.length * data.config.food.reservePerPerson;
}

const affordable = (stockpile, cost) => Object.entries(cost).every(([k, v]) => (stockpile[k] ?? 0) >= v);
const mealsOf = (data) => data.items.filter((d) => d.kind === 'meal');

export function mealsInStock(state, data) {
  return mealsOf(data).reduce((n, d) => n + (state.stockpile[d.id] ?? 0), 0);
}

// Whether someone would use this tool: they've started one of its skills.
const usesTool = (h, def) => def.forSkills.some((s) => h.skills[s]);

function toolUsers(state, def) {
  return state.humans.filter((o) => !hasTool(o, def.id) && usesTool(o, def)).length;
}

// The building an item is made in, if it's built and good enough.
export function stationFor(state, data, def) {
  const b = builtOfType(state, def.station);
  if (!b || (buildingEffect(data, b, 'recipeLevel') ?? 1) < (def.stationLevel ?? 1)) return null;
  return b;
}

// Something this person knows how to make, that is wanted, and that the
// stockpile has materials for. Cooks make the best meal they can.
export function craftChoice(state, data, h) {
  const pop = state.humans.length;
  let meal = null;
  for (const def of data.items) {
    if (!h.knows.includes(def.tech) || !affordable(state.stockpile, def.cost) || !stationFor(state, data, def)) continue;
    const stock = state.stockpile[def.id] ?? 0;
    if (def.kind === 'tool') {
      if (toolUsers(state, def) > stock) return def;
    } else if (def.kind === 'drink') {
      // Brewing eats potatoes, so only from a surplus.
      const spare = state.stockpile.food >= foodReserveWanted(state, data) / 2;
      if (spare && stock < Math.ceil(pop * def.want.perPerson)) return def;
    } else if (def.kind === 'meal' && (!meal || def.food > meal.food)) {
      meal = def;
    }
  }
  return meal && mealsInStock(state, data) < pop * data.config.food.mealsPerPerson ? meal : null;
}

// Materials are taken when the work is finished, so an interrupted crafter
// wastes nothing. Returns false if someone else used the materials meanwhile.
export function finishCraft(state, data, h, def) {
  if (!affordable(state.stockpile, def.cost)) return false;
  for (const [k, v] of Object.entries(def.cost)) state.stockpile[k] -= v;
  state.stockpile[def.id] = (state.stockpile[def.id] ?? 0) + 1;
  gainXp(state, data, h, def.skill, data.skillsById[def.skill].xpPerAction);
  h.counters[`craft:${def.id}`] = (h.counters[`craft:${def.id}`] ?? 0) + 1;
  return true;
}

// Once a day, people take the tools they'd use from the stockpile.
export function handOutTools(state, data) {
  if (state.tick % data.config.time.ticksPerDay !== 0) return;
  for (const def of data.items) {
    if (def.kind !== 'tool') continue;
    for (const h of state.humans) {
      if (!state.stockpile[def.id]) break;
      if (hasTool(h, def.id) || !usesTool(h, def)) continue;
      state.stockpile[def.id]--;
      h.tools[def.id] = def.durability;
    }
  }
}

export function foodInStock(state, data) {
  return state.stockpile.food + mealsInStock(state, data);
}

// Eats one meal from the stockpile, the tastiest there is, else a raw potato.
// Returns false if empty.
export function eatFromStock(state, data, h, moodScale = 1) {
  const s = state.stockpile;
  let best = null;
  for (const def of mealsOf(data)) if (s[def.id] > 0 && (!best || def.mood > best.mood)) best = def;
  if (best) {
    s[best.id]--;
    h.needs.hunger = Math.min(100, h.needs.hunger + best.food);
    h.feelings = h.feelings.filter((f) => !f.meal);
    addFeeling(state, data, h, `Ate ${best.name.toLowerCase()}`, Math.round(best.mood * moodScale), 1);
    h.feelings.at(-1).meal = true;
    return true;
  }
  if (s.food > 0) {
    s.food--;
    h.needs.hunger = Math.min(100, h.needs.hunger + data.config.food.rawValue);
    return true;
  }
  return false;
}

// Once a day, stored food and drink rot a little. Buildings with a
// `spoilage` effect (the Storehouse) slow it.
export function spoilFood(state, data) {
  if (state.tick % data.config.time.ticksPerDay !== 0) return;
  let rate = data.config.food.spoilPerDay;
  for (const b of state.buildings) rate *= buildingEffect(data, b, 'spoilage') ?? 1;
  const keys = ['food', ...data.items.filter((d) => d.perishable || d.kind === 'meal' || d.kind === 'drink').map((d) => d.id)];
  for (const key of keys) {
    const exact = (state.stockpile[key] ?? 0) * rate;
    const lost = Math.floor(exact) + (chance(state.rng, exact % 1) ? 1 : 0);
    if (!lost) continue;
    state.stockpile[key] -= lost;
    state.tribeCounters.foodSpoiled = (state.tribeCounters.foodSpoiled ?? 0) + lost;
  }
}
