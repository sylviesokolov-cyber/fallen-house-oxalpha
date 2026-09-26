// The sim state is plain JSON data, so saving is just stringify/parse.
// Bump SAVE_VERSION whenever the state shape changes incompatibly.
export const SAVE_VERSION = 5;

export function serialize(state) {
  return JSON.stringify(state);
}

export function deserialize(json) {
  const state = JSON.parse(json);
  if (state?.version !== SAVE_VERSION) {
    throw new Error(`Save is from an incompatible version (${state?.version})`);
  }
  return state;
}
