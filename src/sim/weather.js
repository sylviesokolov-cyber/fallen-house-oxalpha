import { chance, randInt } from './rng.js';
import { logEvent } from './history.js';

// Natural lightning: in warm seasons a strike can set a tree near the camp
// burning for a few days. Burning trees are how the tribe first meets fire.

export function updateWeather(state, data, season) {
  const w = data.config.weather;
  const tpd = data.config.time.ticksPerDay;
  for (const r of state.world.resources) {
    if (r.burning && --r.burning <= 0) {
      delete r.burning;
      r.amount = 0;
      r.regrow = 0;
    }
  }
  if (state.tick % tpd !== 0 || !chance(state.rng, w.lightningChancePerDay[season] ?? 0)) return;
  strikeNear(state, data, state.stockpile.x, state.stockpile.y, w.strikeRadius);
}

export function strikeNear(state, data, x, y, radius) {
  const trees = state.world.resources.filter(
    (r) => r.type === 'tree' && r.amount > 0 && !r.burning && Math.abs(r.x - x) <= radius && Math.abs(r.y - y) <= radius,
  );
  if (!trees.length) return null;
  return strikeTree(state, data, trees[randInt(state.rng, 0, trees.length - 1)], true);
}

export function strikeTree(state, data, tree, natural) {
  tree.burning = data.config.weather.burnDays * data.config.time.ticksPerDay;
  logEvent(state, natural ? 'Lightning set a tree ablaze near the camp' : 'A bolt from the sky set a tree ablaze');
  return tree;
}
