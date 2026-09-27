import { logEvent } from './history.js';
import { addFeeling, feel } from './mood.js';
import { callParty, recallParty } from './dungeon.js';
import { learnTech } from './techs.js';
import { decreeCost, issueDecree } from './decrees.js';
import { leaderTitle } from './settlement.js';
import { expand } from './tiers.js';

// The player's only way to act. usePower is called by the UI with a power id
// and a target ({ x, y } for tiles, { humanId } for people). It spends Faith,
// applies the effect, and lets anyone nearby witness the miracle.
// Returns { ok, error?, x, y }.

export function usePower(state, data, powerId, target) {
  const power = data.powersById[powerId];
  if (power.target === 'decree') return decree(state, data, target);
  if (power.target === 'expand') {
    const error = expand(state, data);
    return error ? { ok: false, error } : { ok: true, x: state.stockpile.x, y: state.stockpile.y };
  }
  if (state.faith < power.cost) return { ok: false, error: `Not enough Faith (${power.cost} needed)` };
  const h = target.humanId != null ? state.humans.find((o) => o.id === target.humanId) : null;
  if (power.target === 'human' && !h) return { ok: false, error: 'Tap a person to use this power' };
  if (power.target === 'focus' && !data.focusesById[target.focus]) return { ok: false, error: 'Choose what the omen calls for' };
  if (power.target === 'party') return portal(state, data, target);
  // An omen is seen above the settlement.
  const x = h ? h.x : target.x ?? state.stockpile.x;
  const y = h ? h.y : target.y ?? state.stockpile.y;
  const error = EFFECTS[powerId](state, data, power, { x, y, h, focus: target.focus, skill: target.skill, tech: target.tech });
  if (error) return { ok: false, error };
  state.faith -= power.cost;
  witness(state, data, x, y, power.awe);
  return { ok: true, x, y };
}

// Decrees cost Faith by kind and are spoken by the puppet ruler.
function decree(state, data, target) {
  const cost = decreeCost(data, target.kind);
  if (state.faith < cost) return { ok: false, error: `Not enough Faith (${cost} needed)` };
  const error = issueDecree(state, data, target, leaderTitle);
  if (error) return { ok: false, error };
  state.faith -= cost;
  return { ok: true, x: state.stockpile.x, y: state.stockpile.y };
}

// Not a miracle anyone sees: the chosen simply feel the pull of the portal.
// target: { party: [ids], floor } to send a party, or { recall: true }.
function portal(state, data, target) {
  const error = target.recall ? recallParty(state) : callParty(state, data, target.party ?? [], target.floor);
  if (error) return { ok: false, error };
  if (target.recall) logEvent(state, 'The party in the dungeon felt a call to come home');
  const p = data.sanctuary.portal;
  return { ok: true, x: p.x, y: p.y };
}

// Everyone awake nearby sees it: their devotion grows, they remember it (enough
// miracles lead to Worship), and their awe gives a little Faith back.
function witness(state, data, x, y, awe) {
  const f = data.config.faith;
  for (const o of state.humans) {
    if (o.action.type === 'sleep' || o.away != null) continue;
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

  // A talent: several levels in one skill at once (and a little of the stat
  // behind it), or a piece of knowledge, even one the tribe had lost.
  gift(state, data, p, { h, skill, tech }) {
    if (tech) {
      if (!data.techsById[tech] || !state.discoveries[tech]) return 'Choose something the tribe has known';
      if (h.knows.includes(tech)) return `${h.name} already knows this`;
      learnTech(state, data, h, tech);
      logEvent(state, `${h.name} was granted the knowledge of ${data.techsById[tech].name} by the heavens`);
    } else {
      const def = data.skillsById[skill];
      if (!def) return 'Choose a talent to give';
      const s = (h.skills[skill] ??= { level: 0, xp: 0 });
      s.level = Math.min(data.config.skills.maxLevel, s.level + p.levels);
      s.xp = 0;
      h.stats[def.stat]++;
      logEvent(state, `${h.name} was gifted a talent for ${def.name}`);
    }
    feel(state, data, h, 'gifted', 'Touched by the gods');
    return null;
  },

  eternity(state, data, p, { h }) {
    if (h.eternal) return `${h.name} is already ageless`;
    h.eternal = true;
    h.health = 100;
    logEvent(state, `${h.name} was granted eternal youth by the heavens`);
    feel(state, data, h, 'gifted', 'Will never grow old');
    return null;
  },

  // Only the ruler can be made a puppet, and only one ruler at a time.
  puppet(state, data, p, { h }) {
    if (state.settlement.leaderId !== h.id) return 'Only the ruler can be made your puppet';
    if (state.dynasty.puppetId === h.id) return `${h.name} already obeys you`;
    state.dynasty.puppetId = h.id;
    h.devotion = 100;
    feel(state, data, h, 'heavenlyVoice', 'Hears the voice of the heavens');
    logEvent(state, `${h.name} began to hear the voice of the heavens`);
    return null;
  },

  inspire(state, data, p, { h }) {
    h.status.inspiredUntil = state.tick + p.days * data.config.time.ticksPerDay;
    addFeeling(state, data, h, 'Had a strange dream', data.config.mood.inspireValue, p.days);
    logEvent(state, `${h.name} had a strange and vivid dream`);
  },
};
