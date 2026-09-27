import { serialize, deserialize } from '../sim/save.js';
import { dateOf } from '../sim/time.js';

// Save slots in localStorage: three the player manages plus an autosave.
// Each slot keeps a small summary next to the full state, so the menu can
// list slots without parsing whole saves.

export const SLOTS = ['auto', '1', '2', '3'];
const stateKey = (slot) => `godsim.slot.${slot}`;
const metaKey = (slot) => `godsim.meta.${slot}`;
const OLD_KEY = 'godsim.save';

export function summary(sim, data) {
  const d = dateOf(sim.tick, data.config.time);
  return { name: sim.settlement.name, day: d.day, year: d.year, season: d.season, pop: sim.humans.length, savedAt: Date.now() };
}

export function readMeta(slot) {
  try {
    return JSON.parse(localStorage.getItem(metaKey(slot)));
  } catch {
    return null;
  }
}

// Throws if storage is full or unavailable.
export function saveTo(slot, sim, data) {
  localStorage.setItem(stateKey(slot), serialize(sim));
  localStorage.setItem(metaKey(slot), JSON.stringify(summary(sim, data)));
}

// Throws if the save is missing or from an incompatible version.
export function loadFrom(slot) {
  const json = localStorage.getItem(stateKey(slot));
  if (!json) throw new Error('Empty slot');
  return deserialize(json);
}

export function deleteSlot(slot) {
  localStorage.removeItem(stateKey(slot));
  localStorage.removeItem(metaKey(slot));
}

// The single save from before slots existed becomes slot 1.
export function migrateOldSave() {
  try {
    const old = localStorage.getItem(OLD_KEY);
    if (!old || localStorage.getItem(stateKey('1'))) return;
    const sim = JSON.parse(old);
    localStorage.setItem(stateKey('1'), old);
    localStorage.setItem(metaKey('1'), JSON.stringify({ name: sim.settlement?.name ?? 'Old save', day: '?', year: '?', pop: sim.humans?.length ?? 0, savedAt: 0 }));
    localStorage.removeItem(OLD_KEY);
  } catch {
    // Nothing to migrate.
  }
}
