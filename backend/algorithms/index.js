/**
 * Registry of all algorithms, in the order the UI lists them.
 *
 * Every entry has the same shape:
 *   id          stable identifier used in URLs, storage and i18n keys
 *   sort        generator function (array) => events; sorts the array in place
 *   pseudocode  lines that event.line points into (1-based)
 *   complexity  { best, average, worst, space } in big-O notation
 *   stable, inPlace, adaptive, comparison   properties (stable may be null = not applicable)
 *   predict     true when every compare decides a swap of the same pair (prediction quiz)
 *
 * @module algorithms
 */

import bubble from './bubble.js';
import cocktail from './cocktail.js';
import counting from './counting.js';
import heap from './heap.js';
import insertion from './insertion.js';
import merge from './merge.js';
import quick from './quick.js';
import radix from './radix.js';
import selection from './selection.js';
import shell from './shell.js';

/**
 * @typedef {Object} Algorithm
 * @property {string} id
 * @property {(a: number[]) => Generator<import('../engine/events.js').SortEvent>} sort
 * @property {string[]} pseudocode
 * @property {{best: string, average: string, worst: string, space: string}} complexity
 * @property {boolean|null} stable
 * @property {boolean} inPlace
 * @property {boolean} adaptive
 * @property {boolean} comparison
 * @property {boolean} predict
 */

/** @type {readonly Algorithm[]} */
export const ALGORITHMS = Object.freeze([
  bubble,
  cocktail,
  selection,
  insertion,
  shell,
  merge,
  quick,
  heap,
  counting,
  radix,
]);

export const DEFAULT_ALGORITHM_ID = 'bubble';

const BY_ID = new Map(ALGORITHMS.map((algorithm) => [algorithm.id, algorithm]));

/**
 * @param {string} id
 * @returns {Algorithm|undefined}
 */
export function getAlgorithm(id) {
  return BY_ID.get(id);
}

/** @returns {string[]} all algorithm ids */
export function algorithmIds() {
  return ALGORITHMS.map((algorithm) => algorithm.id);
}
