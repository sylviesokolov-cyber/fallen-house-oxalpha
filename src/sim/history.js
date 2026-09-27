import { dateOf } from './time.js';

const MAX_ENTRIES = 500;
// A life story keeps its first chapters and its latest ones.
const STORY_MAX = 40;
const STORY_KEEP_FIRST = 8;

// Entries store the tick, not a formatted date, so the display format can
// change later. Each entry also goes into the life story (h.story) of every
// living person it names.
export function logEvent(state, text) {
  const entry = { tick: state.tick, text };
  state.history.push(entry);
  if (state.history.length > MAX_ENTRIES) state.history.splice(0, state.history.length - MAX_ENTRIES);
  for (const h of state.humans) if (h.story && mentions(text, h.name)) addStory(h, entry);
}

export function addStory(h, entry) {
  h.story.push(entry);
  if (h.story.length > STORY_MAX) h.story.splice(STORY_KEEP_FIRST, 1);
}

function mentions(text, name) {
  let i = text.indexOf(name);
  while (i >= 0) {
    const before = text[i - 1];
    const after = text[i + name.length];
    if (!/[A-Za-z]/.test(before ?? ' ') && !/[a-z]/.test(after ?? ' ')) return true;
    i = text.indexOf(name, i + 1);
  }
  return false;
}

export function formatEntry(entry, timeCfg) {
  return `Day ${dateOf(entry.tick, timeCfg).day}: ${entry.text}`;
}
