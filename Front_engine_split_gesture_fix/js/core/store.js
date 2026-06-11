export function createPresentationStore(initialState = {}) {
  let state = structuredClone(initialState);
  const listeners = new Set();

  return {
    getState() {
      return state;
    },
    setState(patch) {
      const nextPatch = typeof patch === "function" ? patch(state) : patch;
      state = { ...state, ...nextPatch };
      listeners.forEach((listener) => listener(state));
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      listeners.clear();
    },
  };
}
