import { pick } from './rng.js';
import { logEvent } from './history.js';
import { lifeStage } from './lifecycle.js';
import { statFactor } from './stats.js';
import { sleepCapacity } from './buildings.js';
import { royalLine, rulerTitle, seat, successorOf, updateDynasty } from './dynasty.js';

// The sanctuary as a community: its name, its ruler (a Warden, or a King
// once the throne passes by blood; see dynasty.js), and how many
// people it has room for (one per bed).

export function createSettlement(state, data) {
  return { name: pick(state.rng, data.names.places), leaderId: null };
}

export function populationCap(state, data) {
  return sleepCapacity(state, data);
}

export function leaderOf(state) {
  return state.humans.find((h) => h.id === state.settlement.leaderId) ?? null;
}

export const leaderTitle = rulerTitle;

// A person's rank, if any: the ruler, their spouses, the heir, and (in a
// royal house) the ruler's children.
export function rankOf(state, data, h) {
  const ruler = leaderOf(state);
  if (!ruler) return null;
  const l = data.config.leader;
  const royal = state.dynasty.royal;
  if (h === ruler) return `${leaderTitle(state, data, h)} of ${state.settlement.name}`;
  if (ruler.partnerId === h.id) {
    if (royal) return `${l.queenTitle} of ${state.settlement.name}`;
    return `${h.id === state.dynasty.heiressId ? 'Heiress and wife' : 'Wife'} of the ${leaderTitle(state, data, ruler)}`;
  }
  if (h.partnerId === ruler.id) return royal ? l.consortTitle[h.sex] : `Wife of the ${leaderTitle(state, data, ruler)}`;
  if (state.dynasty.heirId === h.id) return `Heir to the throne`;
  if (royal && h.parents.includes(royalLine(state, ruler).id)) return l.heirTitle[h.sex];
  return null;
}

// Everyone works a little harder under a charismatic leader.
export function leaderWorkBonus(state, data) {
  const leader = leaderOf(state);
  return leader ? 1 + (leader.stats.cha - data.config.stats.base) * data.config.leader.workBonusPerCha : 1;
}

// The people choose the most admired grown man (a woman only if there's no
// man at all, and then as an heiress whose husband will rule).
function chooseLeader(state, data) {
  const l = data.config.leader;
  const adults = state.humans.filter((h) => lifeStage(h, state, data) !== 'child');
  const men = adults.filter((h) => h.sex === 'male');
  let best = null;
  let bestScore = -Infinity;
  for (const h of men.length ? men : adults) {
    const score = h.stats.cha * l.chaWeight * statFactor(h, data, 'cha') + h.level * l.levelWeight;
    if (score > bestScore) {
      bestScore = score;
      best = h;
    }
  }
  return best;
}

// Once a day: make sure someone rules (by blood if there's an heir, else by
// choice), and let the ruler court.
export function updateSettlement(state, data) {
  if (state.tick % data.config.time.ticksPerDay !== 0) return;
  const ruler = leaderOf(state);
  if (ruler) {
    updateDynasty(state, data, ruler);
    return;
  }
  const last = state.dynasty.rulers.at(-1);
  const prev = last && (state.humans.find((h) => h.id === last.id) ?? state.dead.find((h) => h.id === last.id));
  let next = successorOf(state, data, prev);
  if (!next) {
    const chosen = chooseLeader(state, data);
    if (!chosen) return;
    next = { ruler: chosen, how: 'chosen', heiress: chosen.sex === 'female' ? chosen : null };
  }
  seat(state, data, next, prev);
}
