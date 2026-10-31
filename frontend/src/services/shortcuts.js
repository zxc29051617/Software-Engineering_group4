/**
 * Keyboard shortcuts. `actionForKey` is pure (it only reads the event's
 * fields), so the mapping and its exceptions are unit-tested.
 * @module services/shortcuts
 */

/** key (lower-case) -> action name */
export const SHORTCUTS = Object.freeze({
  ' ': 'togglePlay',
  arrowright: 'forward',
  arrowleft: 'back',
  home: 'reset',
  end: 'end',
  arrowup: 'faster',
  arrowdown: 'slower',
  '[': 'previousAlgorithm',
  ']': 'nextAlgorithm',
  n: 'shuffle',
  p: 'predict',
  c: 'mode',
  m: 'sound',
  '?': 'help',
});

const NAVIGATION_KEYS = new Set(['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'home', 'end', 'pageup', 'pagedown']);
const ACTIVATION_KEYS = new Set([' ', 'enter']);
const BUTTON_LIKE_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset']);

/**
 * Whether the focused element already uses this key itself.
 * @param {*} target  the event target (a DOM element, or a plain object in tests)
 * @param {string} key  lower-case key
 */
function targetOwnsKey(target, key) {
  if (!target || typeof target !== 'object') return false;
  if (target.isContentEditable === true) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') return ACTIVATION_KEYS.has(key);
  if (tag !== 'INPUT') return false;
  const type = String(target.type || 'text').toLowerCase();
  if (type === 'range') return NAVIGATION_KEYS.has(key);
  if (BUTTON_LIKE_INPUTS.has(type)) return ACTIVATION_KEYS.has(key) || (type === 'radio' && NAVIGATION_KEYS.has(key));
  return true; // text-like inputs keep every key
}

/**
 * Returns the action for a keydown event, or null when the key should be
 * left alone: modifier combinations, typing in text fields, arrows on a
 * slider, and Space/Enter on a focused button (the browser clicks it).
 *
 * @param {{key: string, ctrlKey?: boolean, metaKey?: boolean, altKey?: boolean, target?: *}} event
 * @returns {string|null}
 */
export function actionForKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const key = String(event.key).toLowerCase();
  if (targetOwnsKey(event.target, key)) return null;
  return SHORTCUTS[key] ?? null;
}
