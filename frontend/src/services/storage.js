/**
 * Remembers per-visitor preferences (language, theme, sound, speed, last
 * algorithm) in localStorage. Every access is guarded: private windows and
 * blocked storage simply fall back to the defaults.
 * @module services/storage
 */

const STORAGE_KEY = 'bubble-sort-visualizer:v2';

/**
 * @param {Storage|undefined} [storage]
 * @returns {Record<string, *>}
 */
export function loadPrefs(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Merges `patch` into the stored preferences.
 * @param {Record<string, *>} patch
 * @param {Storage|undefined} [storage]
 */
export function savePrefs(patch, storage = globalThis.localStorage) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify({ ...loadPrefs(storage), ...patch }));
  } catch {
    // Storage unavailable: preferences last for this visit only.
  }
}
