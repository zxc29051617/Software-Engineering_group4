/**
 * Small seeded random number generator (xorshift32), so a "random" array can
 * be reproduced from its seed: in compare mode, in shared links and in tests.
 * @module input/random
 */

const FALLBACK_SEED = 0x9e3779b9;

/**
 * Normalises any number to a non-zero unsigned 32-bit seed.
 * @param {number} seed
 * @returns {number}
 */
export function normalizeSeed(seed) {
  const value = Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 0;
  return value === 0 ? FALLBACK_SEED : value;
}

/**
 * Returns a function that yields floats in [0, 1).
 * @param {number} seed
 * @returns {() => number}
 */
export function createRng(seed) {
  let x = normalizeSeed(seed);
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
}

/**
 * Random integer in [min, max] (inclusive).
 * @param {() => number} rng
 * @param {number} min
 * @param {number} max
 */
export function randomInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * Fisher–Yates shuffle, in place.
 * @template T
 * @param {T[]} items
 * @param {() => number} rng
 * @returns {T[]} the same array
 */
export function shuffle(items, rng) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = randomInt(rng, 0, i);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * A fresh seed from the platform's random source (not reproducible).
 * @returns {number}
 */
export function newSeed() {
  return normalizeSeed(Math.floor(Math.random() * 4294967296));
}
