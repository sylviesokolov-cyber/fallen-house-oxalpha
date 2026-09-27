import { pick } from './rng.js';
import { logEvent } from './history.js';
import { lifeStage } from './lifecycle.js';
import { statFactor } from './stats.js';
import { sleepCapacity } from './buildings.js';

// The sanctuary as a community: its name, its leader (the Warden), and how
// many people it has room for (one per bed).

export function createSettlement(state, data) {
  return { name: pick(state.rng, data.names.places), leaderId: null };
}

export function populationCap(state, data) {
  return sleepCapacity(state, data);
}

export function leaderOf(state) {
  return state.humans.find((h) => h.id === state.settlement.leaderId) ?? null;
}

export function leaderTitle(state, data, h) {
  return data.config.leader.title[h.sex];
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

// Once a day, make sure someone leads.
export function updateSettlement(state, data) {
  if (state.tick % data.config.time.ticksPerDay !== 0 || leaderOf(state)) return;
  const leader = chooseLeader(state, data);
  state.settlement.leaderId = leader?.id ?? null;
  if (leader) logEvent(state, `${leader.name} became ${leaderTitle(state, data, leader)} of ${state.settlement.name}`);
}
