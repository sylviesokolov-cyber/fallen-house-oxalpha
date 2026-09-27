import { createRng } from './rng.js';
import { generateWorld, updateResources } from './world.js';
import { spawnInitialHumans, killHuman } from './human.js';
import { updateNeeds } from './needs.js';
import { updateHuman } from './ai.js';
import { SAVE_VERSION } from './save.js';
import { dateOf } from './time.js';
import { updateProximity } from './bonds.js';
import { updateLifeCycle } from './lifecycle.js';
import { updateDiscovery } from './techs.js';
import { createStartingBuildings, isWarm } from './buildings.js';
import { handOutTools, spoilFood } from './items.js';
import { updateHomes } from './construction.js';
import { updateDungeon } from './dungeon.js';
import { expireFeelings } from './mood.js';
import { createSettlement, updateSettlement } from './settlement.js';

// Entry point of the simulation. `state` is plain data (saved as-is);
// `data` is the read-only JSON content from /data.

export function createSim(data, seed) {
  const state = {
    version: SAVE_VERSION,
    seed: String(seed),
    rng: createRng(seed),
    tick: 0,
    nextId: 1,
    world: null,
    stockpile: null,
    humans: [],
    bonds: {},
    buildings: [],
    nextBuildingId: 1,
    discoveries: {},
    tribeCounters: {},
    faith: data.config.faith.start,
    settlement: null,
    focus: null,
    dungeon: { deepest: 1, cleared: [], nextId: 1 },
    expeditions: [],
    dead: [],
    history: [],
  };
  state.world = generateWorld(state.rng, data);
  state.settlement = createSettlement(state, data);
  createStartingBuildings(state, data);
  spawnInitialHumans(state, data);
  return state;
}

export function stepSim(state, data) {
  state.tick++;
  const season = dateOf(state.tick, data.config.time).season;
  updateResources(state.world, data, season);
  const died = [];
  const winter = season === 'Winter';
  const newDay = state.tick % data.config.time.ticksPerDay === 0;
  for (const h of state.humans) {
    expireFeelings(state, h);
    if (newDay) h.devotion = Math.max(0, h.devotion - data.config.devotion.decayPerDay);
    // In the dungeon, needs are on hold and the fight is resolved by updateDungeon.
    if (h.away != null) continue;
    updateNeeds(h, data, winter && !isWarm(state, data, h));
    if (h.health <= 0) died.push(h);
    else updateHuman(state, data, h);
  }
  for (const h of died) killHuman(state, data, h, 'starvation');
  // A god's power slowly returns on its own, so the player is never stuck.
  if (newDay) state.faith = Math.min(data.config.faith.max, state.faith + data.config.faith.regenPerDay);
  updateProximity(state, data);
  updateLifeCycle(state, data);
  updateSettlement(state, data);
  updateDiscovery(state, data);
  spoilFood(state, data);
  updateDungeon(state, data);
  handOutTools(state, data);
  if (newDay) updateHomes(state, data);
}
