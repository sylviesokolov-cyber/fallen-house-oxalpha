// Temporary conditions from god powers, stored as expiry ticks in h.status.

export function isBlessed(h, state) {
  return (h.status.blessedUntil ?? 0) > state.tick;
}

export function isInspired(h, state) {
  return (h.status.inspiredUntil ?? 0) > state.tick;
}
