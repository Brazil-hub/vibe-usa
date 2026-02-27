// src/pages/Create/draftFileStore.js
// Module-level singleton — carries the File object across SPA navigation.
// File objects can't be serialized to sessionStorage/JSON, so we keep them here.

let _file = null;

export const draftFileStore = {
  set: (f) => { _file = f; },
  get: () => _file,
  clear: () => { _file = null; },
};
