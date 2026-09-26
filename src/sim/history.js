import { dateOf } from './time.js';

const MAX_ENTRIES = 500;

// Entries store the tick, not a formatted date, so the display format can change later.
export function logEvent(state, text) {
  state.history.push({ tick: state.tick, text });
  if (state.history.length > MAX_ENTRIES) state.history.splice(0, state.history.length - MAX_ENTRIES);
}

export function formatEntry(entry, timeCfg) {
  return `Day ${dateOf(entry.tick, timeCfg).day}: ${entry.text}`;
}
