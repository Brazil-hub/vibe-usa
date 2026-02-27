// Module-level store for the draft cover image File object.
// File objects cannot be serialised to JSON / sessionStorage, so we keep
// them here and read them at publish time in ReviewEvent.

let _file = null;

export const draftFileStore = {
  set: (f) => { _file = f; },
  get: () => _file,
  clear: () => { _file = null; },
};
