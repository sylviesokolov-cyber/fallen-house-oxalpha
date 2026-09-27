import { chance, next } from './rng.js';
import { traitMod } from './traits.js';
import { gainXp, skillLevel } from './skills.js';
import { logEvent } from './history.js';
import { teachTech, techEffect } from './techs.js';
import { addFeeling, feel } from './mood.js';
import { emotionEffect } from './emotions.js';
import { statFactor } from './stats.js';

// Relationships live in state.bonds, keyed "lowId-highId". Only pairs that
// have interacted have an entry. `peak` is the highest friendship tier ever
// reached, so becoming friends is logged once, not every time it wobbles.

const TIER_ORDER = ['acquaintance', 'friend', 'closeFriend'];
const TIER_TEXT = { friend: 'became friends', closeFriend: 'became close friends' };

const pairKey = (a, b) => (a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`);

export function bondValue(state, a, b) {
  return state.bonds[pairKey(a, b)]?.value ?? 0;
}

export function isFamily(a, b) {
  return a.parents.includes(b.id) || b.parents.includes(a.id) || a.parents.some((p) => b.parents.includes(p));
}

// The label shown in the UI and used for decisions.
export function relationType(state, data, a, b) {
  if (a.partnerId === b.id) return 'partner';
  if (isFamily(a, b)) return 'family';
  const v = bondValue(state, a, b);
  const t = data.config.social.tiers;
  if (v <= t.rival) return 'rival';
  if (v >= t.closeFriend) return 'closeFriend';
  if (v >= t.friend) return 'friend';
  if (v >= t.acquaintance) return 'acquaintance';
  return 'stranger';
}

export function changeBond(state, data, a, b, delta) {
  const key = pairKey(a, b);
  const bond = (state.bonds[key] ??= { value: 0, peak: -1, rival: false });
  bond.value = Math.max(-100, Math.min(100, bond.value + delta));
  if (isFamily(a, b) || a.partnerId === b.id) return;

  const t = data.config.social.tiers;
  const tier = TIER_ORDER.findLastIndex((name) => bond.value >= t[name]);
  if (tier > bond.peak) {
    bond.peak = tier;
    const text = TIER_TEXT[TIER_ORDER[tier]];
    if (text) logEvent(state, `${a.name} and ${b.name} ${text}`);
    if (TIER_ORDER[tier] === 'friend') {
      feel(state, data, a, 'newFriend', `Befriended ${b.name}`);
      feel(state, data, b, 'newFriend', `Befriended ${a.name}`);
    }
  }
  if (!bond.rival && bond.value <= t.rival) {
    bond.rival = true;
    logEvent(state, `${a.name} and ${b.name} became rivals`);
    feel(state, data, a, 'newRival', `Rivalry with ${b.name}`);
    feel(state, data, b, 'newRival', `Rivalry with ${a.name}`);
  }
}

// Shared traits draw people together, opposite traits push them apart.
function compatibility(a, b, data) {
  const s = data.config.social;
  let c = 0;
  for (const id of a.traits) {
    if (b.traits.includes(id)) c += s.sharedTraitBonus;
    if (b.traits.includes(data.traitsById[id].opposite)) c -= s.oppositeTraitPenalty;
  }
  return c;
}

// Resolves one conversation: the bond shifts (or they argue), both feel less
// lonely, each may teach the other, and close enough pairs may become partners.
export function resolveChat(state, data, a, b, canPartner) {
  const s = data.config.social;
  const conflictOdds = s.conflictChance * traitMod(a, data, 'conflict') * traitMod(b, data, 'conflict')
    * emotionEffect(a, data, 'conflict') * emotionEffect(b, data, 'conflict') * (bondValue(state, a, b) < 0 ? 2 : 1);
  if (chance(state.rng, conflictOdds)) {
    changeBond(state, data, a, b, -s.conflictLoss);
    feel(state, data, a, 'argued', `Argued with ${b.name}`, 'anger');
    feel(state, data, b, 'argued', `Argued with ${a.name}`, 'anger');
  } else {
    const friendliness = (traitMod(a, data, 'friendliness') + traitMod(b, data, 'friendliness')) / 2;
    const charm = (statFactor(a, data, 'cha') + statFactor(b, data, 'cha')) / 2;
    changeBond(state, data, a, b, s.chatGain * friendliness * charm * (0.5 + next(state.rng)) + compatibility(a, b, data));
    feel(state, data, a, 'niceChat', 'Had a good talk');
    feel(state, data, b, 'niceChat', 'Had a good talk');
    teach(state, data, a, b);
    teach(state, data, b, a);
  }
  a.counters.chats = (a.counters.chats ?? 0) + 1;
  b.counters.chats = (b.counters.chats ?? 0) + 1;
  const restore = data.config.needs.social.chatRestore;
  a.needs.social = Math.min(100, a.needs.social + restore);
  b.needs.social = Math.min(100, b.needs.social + restore);
  maybePartner(state, data, a, b, canPartner);
}

// Passes on the teacher's biggest skill advantage and maybe a tech the student
// is ready for. Stronger bonds, a better Teaching skill and Storytelling make
// lessons count for more; family always teaches well.
export function teach(state, data, teacher, student) {
  const s = data.config.social;
  const bond = isFamily(teacher, student) ? Math.max(s.familyBond, bondValue(state, teacher, student)) : bondValue(state, teacher, student);
  if (bond < s.tiers.acquaintance) return;
  const quality = (1 + skillLevel(teacher, 'teaching') * s.teachingBonusPerLevel) * (0.5 + bond / 100) * statFactor(teacher, data, 'cha');
  const taughtTech = teachTech(state, data, teacher, student, quality);
  let best = null;
  let bestGap = s.teachGap - 1;
  for (const [id, sk] of Object.entries(teacher.skills)) {
    if (id === 'teaching') continue;
    const gap = sk.level - skillLevel(student, id);
    if (gap > bestGap) {
      bestGap = gap;
      best = id;
    }
  }
  if (best) gainXp(state, data, student, best, s.teachXp * quality * techEffect(teacher, data, 'teachingMultiplier'));
  if (best || taughtTech) gainXp(state, data, teacher, 'teaching', data.skillsById.teaching.xpPerAction);
}

function attractedTo(a, b) {
  if (a.attraction === 'both') return true;
  return (a.sex === b.sex) === (a.attraction === 'same');
}

function maybePartner(state, data, a, b, canPartner) {
  const s = data.config.social;
  if (a.partnerId || b.partnerId || !canPartner(a) || !canPartner(b) || isFamily(a, b)) return;
  if (!attractedTo(a, b) || !attractedTo(b, a)) return;
  if (bondValue(state, a, b) < s.partnerAt || !chance(state.rng, s.partnerChancePerChat)) return;
  a.partnerId = b.id;
  b.partnerId = a.id;
  const m = data.config.mood;
  addFeeling(state, data, a, `In love with ${b.name}`, m.joyValue, m.joyDays);
  addFeeling(state, data, b, `In love with ${a.name}`, m.joyValue, m.joyDays);
  logEvent(state, `${a.name} and ${b.name} became partners`);
}

// Spending time near each other slowly builds familiarity (or friction, for
// clashing personalities) and eases loneliness.
// Runs every few ticks rather than every tick; it compares every pair.
export function updateProximity(state, data) {
  const s = data.config.social;
  if (state.tick % s.proximityEveryTicks !== 0) return;
  const awake = state.humans.filter((h) => h.action.type !== 'sleep' && h.away == null);
  const restore = data.config.needs.social.nearbyRestore;
  for (let i = 0; i < awake.length; i++) {
    for (let j = i + 1; j < awake.length; j++) {
      const a = awake[i];
      const b = awake[j];
      if (Math.abs(a.x - b.x) > s.proximityRange || Math.abs(a.y - b.y) > s.proximityRange) continue;
      changeBond(state, data, a, b, s.proximityGain + compatibility(a, b, data) * s.proximityCompatibilityFactor);
      a.needs.social = Math.min(100, a.needs.social + restore);
      b.needs.social = Math.min(100, b.needs.social + restore);
    }
  }
}
