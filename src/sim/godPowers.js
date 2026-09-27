import { logEvent } from './history.js';
import { addFeeling } from './mood.js';

// The player's only way to act. usePower is called by the UI with a power id
// and a target ({ x, y } for tiles, { humanId } for people). It spends Faith,
// applies the effect, and lets anyone nearby witness the miracle.
// Returns { ok, error?, x, y }.

export function usePower(state, data, powerId, target) {
  const power = data.powersById[powerId];
  if (state.faith < power.cost) return { ok: false, error: `Not enough Faith (${power.cost} needed)` };
  const h = target.humanId != null ? state.humans.find((o) => o.id === target.humanId) : null;
  if (power.target === 'human' && !h) return { ok: false, error: 'Tap a person to use this power' };
  if (power.target === 'focus' && !data.focusesById[target.focus]) return { ok: false, error: 'Choose what the omen calls for' };
  // An omen is seen above the settlement.
  const x = h ? h.x : target.x ?? state.stockpile.x;
  const y = h ? h.y : target.y ?? state.stockpile.y;
  const error = EFFECTS[powerId](state, data, power, { x, y, h, focus: target.focus });
  if (error) return { ok: false, error };
  state.faith -= power.cost;
  witness(state, data, x, y, power.awe);
  return { ok: true, x, y };
}

// Everyone awake nearby sees it: their devotion grows, they remember it (enough
// miracles lead to Worship), and their awe gives a little Faith back.
function witness(state, data, x, y, awe) {
  const f = data.config.faith;
  for (const o of state.humans) {
    if (o.action.type === 'sleep') continue;
    if (Math.abs(o.x - x) > f.witnessRadius || Math.abs(o.y - y) > f.witnessRadius) continue;
    o.counters.miraclesSeen = (o.counters.miraclesSeen ?? 0) + 1;
    o.devotion = Math.min(100, o.devotion + awe);
    state.faith = Math.min(f.max, state.faith + f.perWitness);
  }
}

// Each effect returns an error message if it can't be used there, else nothing.
const EFFECTS = {
  bless(state, data, p, { h }) {
    h.needs.hunger = h.needs.energy = h.needs.social = 100;
    h.health = 100;
    h.status.blessedUntil = state.tick + p.days * data.config.time.ticksPerDay;
    addFeeling(state, data, h, 'Blessed by the heavens', data.config.mood.blessValue, p.days);
    logEvent(state, `${h.name} was blessed by the heavens`);
  },

  omen(state, data, p, { focus }) {
    state.focus = { id: focus, until: state.tick + p.days * data.config.time.ticksPerDay };
    logEvent(state, `An omen blazed across the sky: the people feel called to ${data.focusesById[focus].name}`);
  },

  inspire(state, data, p, { h }) {
    h.status.inspiredUntil = state.tick + p.days * data.config.time.ticksPerDay;
    addFeeling(state, data, h, 'Had a strange dream', data.config.mood.inspireValue, p.days);
    logEvent(state, `${h.name} had a strange and vivid dream`);
  },
};
