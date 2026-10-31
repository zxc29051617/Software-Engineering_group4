/**
 * Light/dark theme. Without a saved choice the page follows the system
 * setting (CSS prefers-color-scheme); the toggle stores an explicit choice.
 * @module services/theme
 */

const THEMES = ['light', 'dark'];

/** @returns {boolean} whether the system prefers a dark theme */
function systemPrefersDark() {
  return Boolean(globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches);
}

/**
 * Applies a saved theme, or follows the system when `theme` is not light/dark.
 * @param {string|null|undefined} theme
 */
export function applyTheme(theme) {
  const root = document.documentElement;
  if (THEMES.includes(theme)) root.dataset.theme = theme;
  else delete root.dataset.theme;
}

/** @returns {'light'|'dark'} the theme currently shown */
export function currentTheme() {
  const explicit = document.documentElement.dataset.theme;
  if (THEMES.includes(explicit)) return explicit;
  return systemPrefersDark() ? 'dark' : 'light';
}

/** Switches to the other theme and returns it. */
export function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

/** @returns {boolean} whether the visitor asked for reduced motion */
export function prefersReducedMotion() {
  return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}
