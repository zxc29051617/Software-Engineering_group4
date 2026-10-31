/**
 * Input presets. The four classic initial conditions (random, nearly sorted,
 * reversed, few unique) show that the input shape matters as much as the
 * algorithm; "sorted" shows which algorithms are adaptive.
 * @module input/presets
 */

import { createRng, randomInt, shuffle } from './random.js';

export const PRESETS = Object.freeze(['random', 'sorted', 'reversed', 'nearly-sorted', 'few-unique']);

export const SIZE_LIMITS = Object.freeze({ min: 5, max: 100, default: 20 });

/** Number of distinct values used by the "few unique" preset. */
export const FEW_UNIQUE_LEVELS = 4;

/**
 * Generates an input array. Values are 1..size (a permutation) except for
 * "few-unique", which uses four distinct values spread over 1..size.
 *
 * @param {string} preset  one of {@link PRESETS}
 * @param {number} size
 * @param {number} seed    makes the result reproducible
 * @returns {number[]}
 */
export function generatePreset(preset, size, seed) {
  if (!PRESETS.includes(preset)) throw new RangeError(`Unknown preset: ${preset}`);
  if (!Number.isInteger(size) || size < 0) throw new RangeError(`Bad size: ${size}`);
  const rng = createRng(seed);
  const ascending = Array.from({ length: size }, (_, i) => i + 1);

  switch (preset) {
    case 'random':
      return shuffle(ascending, rng);
    case 'sorted':
      return ascending;
    case 'reversed':
      return ascending.reverse();
    case 'nearly-sorted':
      return nearlySorted(ascending, rng);
    default:
      return fewUnique(size, rng);
  }
}

/**
 * Swaps about 10% of the elements with a neighbour at distance 1 or 2.
 * @param {number[]} values  ascending values, modified in place
 * @param {() => number} rng
 */
function nearlySorted(values, rng) {
  const n = values.length;
  if (n < 2) return values;
  const swaps = Math.max(1, Math.round(n / 10));
  for (let s = 0; s < swaps; s += 1) {
    const i = randomInt(rng, 0, n - 2);
    const j = Math.min(n - 1, i + randomInt(rng, 1, 2));
    [values[i], values[j]] = [values[j], values[i]];
  }
  // Guarantee at least one inversion so the preset is never fully sorted.
  if (values.every((value, index) => index === 0 || values[index - 1] <= value)) {
    [values[0], values[1]] = [values[1], values[0]];
  }
  return values;
}

/**
 * @param {number} size
 * @param {() => number} rng
 */
function fewUnique(size, rng) {
  const levels = Array.from({ length: FEW_UNIQUE_LEVELS }, (_, k) =>
    Math.max(1, Math.round((size * (k + 1)) / FEW_UNIQUE_LEVELS)),
  );
  return Array.from({ length: size }, () => levels[randomInt(rng, 0, levels.length - 1)]);
}
