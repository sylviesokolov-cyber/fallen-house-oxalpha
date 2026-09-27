import { pick } from './rng.js';
import { logEvent } from './history.js';
import { lifeStage } from './lifecycle.js';
import { statFactor } from './stats.js';

// The tribe's home grows through tiers (data/settlements.json): Camp, Village,
// Town, City, Kingdom. Each tier has requirements and a population cap, and
// the settlement has a leader whose title grows with it.

export function createSettlement(state, data) {
  return { name: pick(state.rng, data.names.places), tier: 0, leaderId: null };
}

export function currentTier(state, data) {
  return data.settlements[state.settlement.tier];
}

export function populationCap(state, data) {
  return currentTier(state, data).populationCap;
}

// Requirement rows for the next tier, for both the tier-up check and the UI:
// [{ label, have, need, met }]. Null when already at the top tier.
export function nextTierProgress(state, data) {
  const next = data.settlements[state.settlement.tier + 1];
  if (!next) return null;
  const r = next.requirements;
  const rows = [];
  const built = state.buildings.filter((b) => b.built);
  const known = Object.values(state.discoveries).filter((d) => !d.lost).length;
  if (r.population) rows.push({ label: 'People', have: state.humans.length, need: r.population });
  if (r.techs) rows.push({ label: 'Known techs', have: known, need: r.techs });
  if (r.buildings) rows.push({ label: 'Buildings', have: built.length, need: r.buildings });
  for (const type of r.hasBuildings ?? []) {
    rows.push({ label: `A ${data.buildingsById[type].name}`, have: built.some((b) => b.type === type) ? 1 : 0, need: 1 });
  }
  if (r.heroes) {
    const have = state.humans.filter((h) => h.level >= r.heroes.level).length;
    rows.push({ label: `Heroes of level ${r.heroes.level}+`, have, need: r.heroes.count });
  }
  for (const row of rows) row.met = row.have >= row.need;
  return { tier: next, rows };
}

export function leaderOf(state) {
  return state.humans.find((h) => h.id === state.settlement.leaderId) ?? null;
}

export function leaderTitle(state, data, h) {
  return currentTier(state, data).leaderTitle[h.sex];
}

// Everyone works a little harder under a charismatic leader.
export function leaderWorkBonus(state, data) {
  const leader = leaderOf(state);
  return leader ? 1 + (leader.stats.cha - data.config.stats.base) * data.config.leader.workBonusPerCha : 1;
}

function chooseLeader(state, data) {
  const l = data.config.leader;
  let best = null;
  let bestScore = -Infinity;
  for (const h of state.humans) {
    if (lifeStage(h, state, data) === 'child') continue;
    const score = h.stats.cha * l.chaWeight * statFactor(h, data, 'cha') + h.level * l.levelWeight;
    if (score > bestScore) {
      bestScore = score;
      best = h;
    }
  }
  return best;
}

// Once a day: grow to the next tier if every requirement is met, and make
// sure someone leads.
export function updateSettlement(state, data) {
  if (state.tick % data.config.time.ticksPerDay !== 0) return;
  const s = state.settlement;
  const progress = nextTierProgress(state, data);
  if (progress && progress.rows.every((row) => row.met)) {
    s.tier++;
    logEvent(state, `${s.name} has grown into a ${progress.tier.name}!`);
    const leader = leaderOf(state);
    if (leader) logEvent(state, `${leader.name} is now ${leaderTitle(state, data, leader)} of ${s.name}`);
  }
  if (!leaderOf(state)) {
    const leader = chooseLeader(state, data);
    s.leaderId = leader?.id ?? null;
    if (leader) logEvent(state, `${leader.name} became ${leaderTitle(state, data, leader)} of ${s.name}`);
  }
}
