import { randInt } from './rng.js';

// Picks a random set of traits, never two that are marked as opposites.
export function rollTraits(state, data) {
  const cfg = data.config.humans;
  const count = randInt(state.rng, cfg.traitsMin, cfg.traitsMax);
  const picked = [];
  let pool = data.traits.map((t) => t.id);
  while (picked.length < count && pool.length) {
    const id = pool[randInt(state.rng, 0, pool.length - 1)];
    const opposite = data.traitsById[id].opposite;
    picked.push(id);
    pool = pool.filter((p) => p !== id && p !== opposite);
  }
  return picked;
}

// Combined effect of a person's traits on one modifier (they multiply).
// Keys used by the sim: workWeight, wanderWeight, wanderRadius, learnRate,
// workSpeed, hungerDecay, energyDecay. A missing key means 1 (no effect).
export function traitMod(h, data, key) {
  let m = 1;
  for (const id of h.traits) m *= data.traitsById[id].modifiers[key] ?? 1;
  return m;
}
