// Temporary conditions from god powers, stored as expiry ticks in h.status,
// and the tribe-wide focus set by an Omen (state.focus).

export function focusValue(state, data, key, fallback = 1) {
  const f = state.focus;
  if (!f || f.until <= state.tick) return fallback;
  return data.focusesById[f.id].effects[key] ?? fallback;
}

export function isBlessed(h, state) {
  return (h.status.blessedUntil ?? 0) > state.tick;
}

export function isInspired(h, state) {
  return (h.status.inspiredUntil ?? 0) > state.tick;
}
