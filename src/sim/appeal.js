import { next, randInt } from './rng.js';
import { skillLevel } from './skills.js';

// Looks (1-10) run in families, and everyone is drawn to something in
// particular: beauty, strength, standing, wit or kindness. `appeal` is how
// attractive one person finds another (0-100); it colours who seeks whom out,
// who falls in love, and whom a ruler takes as a consort.

export function rollLooks(state, parents = []) {
  if (!parents.length) return Math.min(10, randInt(state.rng, 1, 5) + randInt(state.rng, 1, 5));
  const avg = parents.reduce((s, p) => s + (p.looks ?? 5), 0) / parents.length;
  return Math.max(1, Math.min(10, Math.round(avg + randInt(state.rng, -2, 2))));
}

export function rollPreference(state, data) {
  const keys = Object.keys(data.config.appeal.preferences);
  return keys[Math.floor(next(state.rng) * keys.length)];
}

const COMBAT = ['swordsmanship', 'archery', 'defense', 'magic'];

// What `b` offers in the one quality `a` cares about most, on roughly 0-10.
function preferred(state, a, b) {
  switch (a.drawnTo) {
    case 'looks': return b.looks ?? 5;
    case 'strength': return Math.min(10, (b.stats.str + Math.max(...COMBAT.map((s) => skillLevel(b, s)))) / 2);
    case 'status': return state.settlement?.leaderId === b.id ? 10 : Math.min(10, b.level / 3);
    case 'wit': return Math.min(10, b.stats.int * 0.8);
    case 'kindness': return Math.min(10, (b.traits.includes('kind') ? 5 : 0) + b.stats.cha * 0.5);
    default: return 5;
  }
}

export function appeal(state, data, a, b) {
  const c = data.config.appeal;
  const v = (b.looks ?? 5) * c.looksWeight + preferred(state, a, b) * c.preferenceWeight;
  return Math.max(0, Math.min(100, v));
}

const LOOKS = {
  female: ['Homely', 'Homely', 'Plain', 'Plain', 'Pretty', 'Pretty', 'Beautiful', 'Beautiful', 'Stunning', 'Stunning'],
  male: ['Homely', 'Homely', 'Plain', 'Plain', 'Good-looking', 'Good-looking', 'Handsome', 'Handsome', 'Striking', 'Striking'],
};

export function looksLabel(h) {
  return LOOKS[h.sex][Math.max(1, Math.min(10, h.looks ?? 5)) - 1];
}
