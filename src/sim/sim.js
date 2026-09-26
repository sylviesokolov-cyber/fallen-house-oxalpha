import { createRng } from './rng.js';
import { generateWorld, updateResources } from './world.js';
import { spawnInitialHumans, killHuman } from './human.js';
import { updateNeeds } from './needs.js';
import { updateHuman } from './ai.js';
import { SAVE_VERSION } from './save.js';
import { dateOf } from './time.js';

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
  updateResources(state.world, data, season);
  const died = [];
  for (const h of state.humans) {
    updateNeeds(h, data, season);
    if (h.health <= 0) died.push(h);
    else updateHuman(state, data, h);
  }
  for (const h of died) killHuman(state, data, h, 'starvation');
}
