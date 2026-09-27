import { traitMod } from './traits.js';
import { logEvent } from './history.js';
import { isBlessed } from './status.js';
import { emotionEffect } from './emotions.js';
import { gainCharacterXp, statFactor } from './stats.js';

// Skills are learned by doing: each finished unit of work grants XP in the
// related skill. h.skills only holds skills the person has started learning.

export function skillLevel(h, skillId) {
  return h.skills[skillId]?.level ?? 0;
}

export function xpToNext(level, cfg) {
  return Math.round(cfg.xpBase * cfg.xpGrowth ** level);
}

export function gainXp(state, data, h, skillId, baseXp) {
  const cfg = data.config.skills;
  const s = (h.skills[skillId] ??= { level: 0, xp: 0 });
  if (s.level >= cfg.maxLevel) return;
  const blessing = isBlessed(h, state) ? data.powersById.bless.learnMultiplier : 1;
  const xp = baseXp * traitMod(h, data, 'learnRate') * statFactor(h, data, 'int') * emotionEffect(h, data, 'learn') * blessing;
  s.xp += xp;
  gainCharacterXp(state, data, h, xp, skillId);
  while (s.level < cfg.maxLevel && s.xp >= xpToNext(s.level, cfg)) {
    s.xp -= xpToNext(s.level, cfg);
    s.level++;
    const title = cfg.titles[s.level];
    if (title) logEvent(state, `${h.name} became a ${title} ${data.skillsById[skillId].noun}`);
  }
  if (s.level >= cfg.maxLevel) s.xp = 0;
}

// Fraction of the normal time an action takes (skill and traits make it faster).
export function workTimeFactor(h, data, skillId) {
  const def = data.skillsById[skillId];
  const bySkill = 1 - (def.speedPerLevel ?? 0) * skillLevel(h, skillId);
  const speed = traitMod(h, data, 'workSpeed') * statFactor(h, data, def.stat);
  return Math.max(data.config.skills.minWorkTime, bySkill / speed);
}

export function yieldFactor(h, data, skillId) {
  return 1 + (data.skillsById[skillId].yieldPerLevel ?? 0) * skillLevel(h, skillId);
}
