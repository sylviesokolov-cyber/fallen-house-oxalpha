// Every content file in /data, loaded by BootScene (and the tests).
export const DATA_FILES = [
  'config', 'tiles', 'resources', 'names', 'traits', 'skills', 'techs', 'buildings', 'items', 'powers', 'stats', 'grades',
  'emotions', 'focuses', 'sanctuary', 'monsters', 'dungeon', 'goals', 'events',
];

// Adds id lookup tables to the raw JSON content. Content is read-only and is
// never part of the saved state.
export function prepareData(raw) {
  const byId = (list) => Object.fromEntries(list.map((e) => [e.id, e]));
  return {
    ...raw,
    tilesById: byId(raw.tiles),
    resourcesById: byId(raw.resources),
    traitsById: byId(raw.traits),
    skillsById: byId(raw.skills),
    techsById: byId(raw.techs),
    buildingsById: byId(raw.buildings),
    itemsById: byId(raw.items),
    powersById: byId(raw.powers),
    statsById: byId(raw.stats),
    emotionsById: byId(raw.emotions),
    focusesById: byId(raw.focuses),
    monstersById: byId(raw.monsters),
    floorsById: byId(raw.dungeon.floors),
  };
}
