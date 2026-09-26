// Adds id lookup tables to the raw JSON content. Content is read-only and is
// never part of the saved state.
export function prepareData(raw) {
  const byId = (list) => Object.fromEntries(list.map((e) => [e.id, e]));
  return {
    ...raw,
    tilesById: byId(raw.tiles),
    resourcesById: byId(raw.resources),
  };
}
