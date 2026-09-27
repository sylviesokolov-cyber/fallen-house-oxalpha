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
import { isWarm } from './buildings.js';
import { spoilFood } from './items.js';
import { updateWeather } from './weather.js';
import { expireFeelings } from './mood.js';

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
    dead: [],
    history: [],
  };
  state.world = generateWorld(state.rng, data);
  spawnInitialHumans(state, data);
  return state;
}

export function stepSim(state, data) {
  state.tick++;
  const season = dateOf(state.tick, data.config.time).season;
  updateWeather(state, data, season);
  updateResources(state.world, data, season);
  const died = [];
  const winter = season === 'Winter';
  const newDay = state.tick % data.config.time.ticksPerDay === 0;
  for (const h of state.humans) {
    updateNeeds(h, data, winter && !isWarm(state, data, h));
    expireFeelings(state, h);
    if (newDay) h.devotion = Math.max(0, h.devotion - data.config.devotion.decayPerDay);
    if (h.health <= 0) died.push(h);
    else updateHuman(state, data, h);
  }
  for (const h of died) killHuman(state, data, h, 'starvation');
  // A god's power slowly returns on its own, so the player is never stuck.
  if (newDay) state.faith = Math.min(data.config.faith.max, state.faith + data.config.faith.regenPerDay);
  updateProximity(state, data);
  updateLifeCycle(state, data);
  updateDiscovery(state, data);
  spoilFood(state, data);
}
