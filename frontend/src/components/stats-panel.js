/**
 * Live counters and the "sortedness" meter based on remaining inversions.
 * @module components/stats-panel
 */

import { countInversions } from '../../../backend/engine/metrics.js';

/**
 * Share of the initial inversions already removed, 0–100.
 * @param {number} initial
 * @param {number} remaining
 */
export function progressPercent(initial, remaining) {
  if (initial <= 0) return 100;
  return Math.round(((initial - remaining) / initial) * 100);
}

/**
 * @param {HTMLElement} root  element containing `[data-stat]` placeholders
 */
export function createStatsPanel(root) {
  const fields = Object.fromEntries([...root.querySelectorAll('[data-stat]')].map((node) => [node.dataset.stat, node]));
  let initialInversions = 0;

  function set(name, text) {
    const node = fields[name];
    if (node && node.textContent !== text) node.textContent = text;
  }

  return {
    /** Call when a new input is loaded. @param {number[]} input */
    reset(input) {
      initialInversions = countInversions(input);
    },

    /**
     * @param {import('../../../backend/engine/state.js').SortState} state
     * @param {{cursor: number, total: number, t: (key: string, params?: object) => string}} context
     */
    render(state, { cursor, total, t }) {
      const { comparisons, swaps, writes, auxWrites } = state.stats;
      set('step', `${cursor} / ${total}`);
      set('comparisons', String(comparisons));
      set('swaps', String(swaps));
      set('writes', String(writes));
      set('auxWrites', String(auxWrites));
      set('extraSpace', t('stats.extraSpaceValue', { value: state.auxPeak }));
      const remaining = countInversions(state.array);
      const percent = progressPercent(initialInversions, remaining);
      set('inversions', String(remaining));
      set('progress', t('stats.progress', { value: percent }));
      const bar = fields['progress-bar'];
      if (bar) bar.style.width = `${percent}%`;
    },
  };
}
