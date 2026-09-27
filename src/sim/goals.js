import { logEvent } from './history.js';

// Milestones in chapters, from data/goals.json. Checked once a day; each is
// reached once, logged, and rewards Faith. `goalProgress` gives the UI a
// current/target pair for a progress bar.
// state.goals: { [goalId]: tickReached }

const plotBuilt = (state) => state.buildings.filter((b) => b.built && b.plot).length;

const CHECKS = {
  stock: (s, d, c) => [s.stockpile[c.item] ?? 0, c.min],
  plotBuildings: (s, d, c) => [plotBuilt(s), c.min],
  births: (s, d, c) => [s.tribeCounters.births ?? 0, c.min],
  population: (s, d, c) => [s.humans.length, c.min],
  cleared: (s, d, c) => [s.dungeon.cleared.includes(c.floor) ? 1 : 0, 1],
  built: (s, d, c) => [s.buildings.some((b) => b.built && b.type === c.building) ? 1 : 0, 1],
  royal: (s) => [s.dynasty.royal ? 1 : 0, 1],
  maxLevel: (s, d, c) => [Math.max(0, ...s.humans.map((h) => h.level)), c.min],
  houseSize: (s, d, c) => {
    const n = {};
    for (const h of s.humans) n[h.house] = (n[h.house] ?? 0) + 1;
    return [Math.max(0, ...Object.values(n)), c.min];
  },
};

export function goalProgress(state, data, goal) {
  const [have, need] = CHECKS[goal.check.type](state, data, goal.check);
  return { have: Math.min(have, need), need, done: state.goals[goal.id] != null };
}

export function updateGoals(state, data) {
  if (state.tick % data.config.time.ticksPerDay !== 0) return;
  for (const g of data.goals) {
    if (state.goals[g.id] != null) continue;
    const [have, need] = CHECKS[g.check.type](state, data, g.check);
    if (have < need) continue;
    state.goals[g.id] = state.tick;
    state.faith = Math.min(data.config.faith.max, state.faith + g.reward);
    logEvent(state, `Milestone reached: ${g.name}`);
  }
}

// The chapter the sanctuary is working through: the first with goals left.
export function currentChapter(state, data) {
  return data.goals.find((g) => state.goals[g.id] == null)?.chapter ?? null;
}
