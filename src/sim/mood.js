// Mood (0-100) is worked out on demand from needs, health and lasting
// feelings (h.feelings: [{ text, value, until, kind? }]) such as grief or being
// blessed. `kind` marks feelings that set an emotion (grief, anger).

export function addFeeling(state, data, h, text, value, days, kind) {
  h.feelings = h.feelings.filter((f) => f.text !== text);
  const f = { text, value, until: state.tick + days * data.config.time.ticksPerDay };
  if (kind) f.kind = kind;
  h.feelings.push(f);
}

// A feeling from config.feelings, e.g. feel(state, data, h, 'coldNight', 'Slept in the cold').
export function feel(state, data, h, key, text, kind) {
  const [value, days] = data.config.feelings[key];
  addFeeling(state, data, h, text, value, days, kind);
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
