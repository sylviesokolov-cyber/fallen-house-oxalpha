// Mood (0-100) is worked out on demand from needs, health and lasting
// feelings (h.feelings: [{ text, value, until }]) such as grief or being blessed.

export function addFeeling(state, data, h, text, value, days) {
  h.feelings = h.feelings.filter((f) => f.text !== text);
  h.feelings.push({ text, value, until: state.tick + days * data.config.time.ticksPerDay });
}

export function expireFeelings(state, h) {
  if (h.feelings.length) h.feelings = h.feelings.filter((f) => f.until > state.tick);
}

export function mood(h) {
  const base = (h.needs.hunger + h.needs.energy + h.needs.social + h.health) / 4;
  let m = base;
  for (const f of h.feelings) m += f.value;
  return Math.max(0, Math.min(100, m));
}

export function moodLearnFactor(h, data) {
  const c = data.config.mood;
  const m = mood(h);
  return m < c.lowBelow ? c.lowLearn : m > c.highAbove ? c.highLearn : 1;
}

export function moodConflictFactor(h, data) {
  return mood(h) < data.config.mood.lowBelow ? data.config.mood.lowConflict : 1;
}
