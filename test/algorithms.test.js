// Every algorithm must sort correctly and emit a trustworthy event stream.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { ALGORITHMS, algorithmIds, getAlgorithm } from '../backend/algorithms/index.js';
import { verifyTrace } from '../backend/engine/verify.js';
import { generatePreset, PRESETS } from '../backend/input/presets.js';
import { createRng, randomInt } from '../backend/input/random.js';

const RANDOM_RUNS = 150;

/** Fixed edge cases every algorithm must handle. */
const EDGE_CASES = {
  empty: [],
  single: [7],
  'two sorted': [1, 2],
  'two reversed': [2, 1],
  'two equal': [4, 4],
  'all equal': [5, 5, 5, 5, 5, 5],
  'already sorted': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  reversed: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
  duplicates: [3, 1, 3, 2, 1, 3, 2, 2, 1, 3],
  'with zero': [0, 5, 0, 3, 999, 1],
  'wide range': [999, 0, 500, 1, 998, 2],
  'v1 example': [7, 3, 9, 2, 5, 8, 1],
};

function assertVerified(algorithm, input) {
  const { problems } = verifyTrace(algorithm, input);
  assert.deepEqual(problems, [], `${algorithm.id} on [${input}]`);
}

describe('algorithm registry', () => {
  test('lists ten algorithms with unique ids, bubble sort first', () => {
    const ids = algorithmIds();
    assert.equal(ids.length, 10);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(ids[0], 'bubble');
    for (const id of ['selection', 'insertion', 'shell', 'merge', 'quick', 'heap', 'counting', 'radix']) {
      assert.ok(ids.includes(id), id);
    }
  });

  test('getAlgorithm finds by id and returns undefined otherwise', () => {
    assert.equal(getAlgorithm('quick').id, 'quick');
    assert.equal(getAlgorithm('nope'), undefined);
  });

  for (const algorithm of ALGORITHMS) {
    test(`${algorithm.id} has complete metadata`, () => {
      assert.equal(typeof algorithm.sort, 'function');
      assert.ok(algorithm.pseudocode.length >= 5);
      for (const key of ['best', 'average', 'worst', 'space']) assert.match(algorithm.complexity[key], /O\(/);
      assert.ok([true, false, null].includes(algorithm.stable));
      for (const key of ['inPlace', 'adaptive', 'comparison', 'predict']) assert.equal(typeof algorithm[key], 'boolean');
    });
  }
});

for (const algorithm of ALGORITHMS) {
  describe(`${algorithm.id} sort`, () => {
    for (const [name, input] of Object.entries(EDGE_CASES)) {
      test(`sorts ${name}`, () => assertVerified(algorithm, input));
    }

    test(`sorts ${RANDOM_RUNS} random arrays (sizes 0–40, many duplicates)`, () => {
      const rng = createRng(2026 + algorithm.id.length);
      for (let run = 0; run < RANDOM_RUNS; run += 1) {
        const size = randomInt(rng, 0, 40);
        const maxValue = randomInt(rng, 1, run % 2 === 0 ? 5 : 999);
        const input = Array.from({ length: size }, () => randomInt(rng, 0, maxValue));
        assertVerified(algorithm, input);
      }
    });

    test('sorts every preset at sizes 5, 20 and 100', () => {
      for (const preset of PRESETS) {
        for (const size of [5, 20, 100]) assertVerified(algorithm, generatePreset(preset, size, size * 7 + 1));
      }
    });

    test('does not modify the caller’s input array', () => {
      const input = [3, 1, 2];
      verifyTrace(algorithm, input);
      assert.deepEqual(input, [3, 1, 2]);
    });
  });
}

describe('negative values', () => {
  // The UI only accepts 0–999, but the algorithms themselves are general.
  for (const algorithm of ALGORITHMS) {
    test(`${algorithm.id} sorts negative and mixed values`, () => {
      assertVerified(algorithm, [-3, 5, -10, 0, 7, -3, 2]);
    });
  }
});
