// The sim state is plain JSON data, so saving is just stringify/parse.
// Bump SAVE_VERSION whenever the state shape changes incompatibly.
export const SAVE_VERSION = 11;

export function serialize(state) {
  return JSON.stringify(state);
}

export function deserialize(json) {
  const state = JSON.parse(json);
  if (state?.version !== SAVE_VERSION) {
    throw new Error(`Save is from an incompatible version (${state?.version})`);
  }
  state.goals ??= {};
  state.director ??= { tension: 0, calmDays: 0, crisis: null };
  state.eras ??= [];
  state.annals ??= []; // added without a version bump; older saves start with none reached
  return state;
}
