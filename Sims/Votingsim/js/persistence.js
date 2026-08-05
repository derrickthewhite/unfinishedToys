import { SAVE_SCHEMA_VERSION } from './constants.js';
import { createSavePayload, cloneState } from './state.js';

const STORAGE_KEY = 'voting-sim-saves';

export function loadAllSaves() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('Unable to load saves', error);
    return [];
  }
}

export function saveSimulation(state, saveName) {
  const saves = loadAllSaves();
  const existingIndex = saves.findIndex((save) => save.name === saveName);
  const payload = createSavePayload(cloneState(state));

  if (existingIndex >= 0) {
    saves[existingIndex] = { name: saveName, payload };
  } else {
    saves.push({ name: saveName, payload });
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
  return saves;
}

export function loadSimulation(saveName) {
  const saves = loadAllSaves();
  const save = saves.find((entry) => entry.name === saveName);
  if (!save) {
    return null;
  }

  if (save.payload.schemaVersion !== SAVE_SCHEMA_VERSION) {
    return null;
  }

  return save.payload.state;
}

export function deleteSave(saveName) {
  const saves = loadAllSaves().filter((save) => save.name !== saveName);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
  return saves;
}
