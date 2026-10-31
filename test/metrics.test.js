// Inversion counting and the textbook cost properties of each algorithm.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { getAlgorithm } from '../backend/algorithms/index.js';
import { countInversions, isSorted, maxInversions } from '../backend/engine/metrics.js';
import { replay } from '../backend/engine/state.js';
import { recordTrace } from '../backend/engine/trace.js';
import { generatePreset, PRESETS } from '../backend/input/presets.js';
import { createRng, randomInt } from '../backend/input/random.js';

function stats(id, input) {
  const { events } = recordTrace(getAlgorithm(id), input);
  return replay(input, events).stats;
}

function bruteInversions(a) {
  let count = 0;
  for (let i = 0; i < a.length; i += 1) for (let j = i + 1; j < a.length; j += 1) if (a[i] > a[j]) count += 1;
  return count;
}

describe('countInversions', () => {
  test('matches the O(n²) definition on random arrays', () => {
    const rng = createRng(3);
    for (let run = 0; run < 200; run += 1) {
      const a = Array.from({ length: randomInt(rng, 0, 30) }, () => randomInt(rng, 0, 9));
      assert.equal(countInversions(a), bruteInversions(a), `[${a}]`);
    }
  });

  test('is 0 for sorted input and n(n−1)/2 for reversed distinct input', () => {
    assert.equal(countInversions([1, 2, 3, 4]), 0);
    assert.equal(countInversions([4, 3, 2, 1]), maxInversions(4));
    assert.equal(maxInversions(1), 0);
    assert.equal(maxInversions(10), 45);
  });

  test('does not modify its argument', () => {
    const a = [3, 1, 2];
    countInversions(a);
    assert.deepEqual(a, [3, 1, 2]);
  });

  test('isSorted', () => {
    assert.equal(isSorted([]), true);
    assert.equal(isSorted([1, 1, 2]), true);
    assert.equal(isSorted([2, 1]), false);
  });
});

describe('algorithm cost properties', () => {
  const inputs = PRESETS.map((preset) => generatePreset(preset, 40, 17));

  test('bubble, cocktail and insertion sort swap exactly once per inversion', () => {
    for (const input of inputs) {
      const inversions = countInversions(input);
      for (const id of ['bubble', 'cocktail', 'insertion']) assert.equal(stats(id, input).swaps, inversions, id);
    }
  });

  test('bubble and insertion sort need only n − 1 comparisons on sorted input (adaptive)', () => {
    const sorted = generatePreset('sorted', 50, 1);
    assert.equal(stats('bubble', sorted).comparisons, 49);
    assert.equal(stats('insertion', sorted).comparisons, 49);
    assert.equal(stats('cocktail', sorted).comparisons, 49);
  });

  test('selection sort always makes n(n−1)/2 comparisons and at most n − 1 swaps', () => {
    for (const input of inputs) {
      const { comparisons, swaps } = stats('selection', input);
      assert.equal(comparisons, maxInversions(input.length));
      assert.ok(swaps <= input.length - 1);
    }
  });

  test('merge sort makes at most n⌈log₂ n⌉ comparisons', () => {
    for (const input of inputs) {
      const bound = input.length * Math.ceil(Math.log2(input.length));
      assert.ok(stats('merge', input).comparisons <= bound);
    }
  });

  test('quick sort with the last element as pivot is quadratic on sorted input', () => {
    const sorted = generatePreset('sorted', 40, 1);
    assert.equal(stats('quick', sorted).comparisons, maxInversions(40));
    assert.ok(stats('quick', generatePreset('random', 40, 1)).comparisons < maxInversions(40) / 2);
  });

  test('heap sort stays within 2n⌊log₂ n⌋ + 2n comparisons on any input', () => {
    for (const input of inputs) {
      const n = input.length;
      assert.ok(stats('heap', input).comparisons <= 2 * n * Math.floor(Math.log2(n)) + 2 * n);
    }
  });

  test('counting sort writes each element once; radix sort once per digit pass', () => {
    const input = generatePreset('random', 40, 8);
    assert.equal(stats('counting', input).writes, 40);
    const wide = input.map((x) => x * 10);
    assert.equal(stats('radix', wide).writes, 40 * 3);
  });
});
