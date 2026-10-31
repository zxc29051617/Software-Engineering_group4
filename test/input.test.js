// Custom-input validation, presets and the seeded random generator.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { countInversions } from '../backend/engine/metrics.js';
import { formatNumberList, INPUT_LIMITS, parseNumberList, tokenize } from '../backend/input/parse.js';
import { FEW_UNIQUE_LEVELS, generatePreset, PRESETS, SIZE_LIMITS } from '../backend/input/presets.js';
import { createRng, newSeed, normalizeSeed, randomInt, shuffle } from '../backend/input/random.js';

describe('parseNumberList', () => {
  test('accepts commas, spaces, newlines, semicolons and the ideographic comma', () => {
    assert.deepEqual(parseNumberList('5, 3,8 1\n9;2、7'), { ok: true, values: [5, 3, 8, 1, 9, 2, 7] });
  });

  test('accepts full-width digits and commas typed with a Chinese IME', () => {
    assert.deepEqual(parseNumberList('５，３，８'), { ok: true, values: [5, 3, 8] });
  });

  test('accepts the limits themselves, a leading plus and leading zeros', () => {
    assert.deepEqual(parseNumberList('0 999 +7 007').values, [0, 999, 7, 7]);
  });

  test('reports an empty input', () => {
    for (const text of ['', '   ', ',,,', null, undefined]) {
      assert.deepEqual(parseNumberList(text), { ok: false, error: { code: 'empty' } }, String(text));
    }
  });

  test('reports the first non-integer with its 1-based position', () => {
    assert.deepEqual(parseNumberList('5, a, 3').error, { code: 'not-integer', index: 2, token: 'a' });
    assert.deepEqual(parseNumberList('1 2 3.5').error, { code: 'not-integer', index: 3, token: '3.5' });
    assert.equal(parseNumberList('1e3 2').error.code, 'not-integer');
    assert.equal(parseNumberList('0x10 2').error.code, 'not-integer');
  });

  test('reports values outside 0–999 with the allowed range', () => {
    assert.deepEqual(parseNumberList('5 1000').error, { code: 'out-of-range', index: 2, token: '1000', min: 0, max: 999 });
    assert.equal(parseNumberList('-1 5').error.code, 'out-of-range');
    assert.equal(parseNumberList('99999999999999999999 1').error.code, 'out-of-range');
  });

  test('normalises negative zero to zero', () => {
    assert.ok(Object.is(parseNumberList('-0 1').values[0], 0));
  });

  test('requires at least 2 and at most 100 numbers', () => {
    assert.deepEqual(parseNumberList('42').error, { code: 'too-few', count: 1, min: 2 });
    const tooMany = Array.from({ length: INPUT_LIMITS.maxCount + 1 }, (_, i) => i).join(' ');
    assert.deepEqual(parseNumberList(tooMany).error, { code: 'too-many', count: 101, max: 100 });
    const justEnough = Array.from({ length: INPUT_LIMITS.maxCount }, (_, i) => i).join(' ');
    assert.equal(parseNumberList(justEnough).ok, true);
  });

  test('custom limits can be passed in', () => {
    const limits = { minCount: 1, maxCount: 3, minValue: 1, maxValue: 10 };
    assert.equal(parseNumberList('11', limits).error.code, 'out-of-range');
    assert.equal(parseNumberList('4', limits).ok, true);
  });

  test('tokenize and formatNumberList round-trip', () => {
    assert.deepEqual(tokenize(' 1 ,2 ,, 3 '), ['1', '2', '3']);
    assert.equal(formatNumberList([5, 3, 8]), '5, 3, 8');
    assert.deepEqual(parseNumberList(formatNumberList([5, 3, 8])).values, [5, 3, 8]);
  });
});

describe('presets', () => {
  test('every preset has the requested size and values in 1..size', () => {
    for (const preset of PRESETS) {
      for (const size of [0, 1, SIZE_LIMITS.min, SIZE_LIMITS.default, SIZE_LIMITS.max]) {
        const values = generatePreset(preset, size, 123);
        assert.equal(values.length, size, `${preset} ${size}`);
        assert.ok(values.every((v) => Number.isInteger(v) && v >= 1 && v <= Math.max(size, 1)), preset);
      }
    }
  });

  test('the same seed gives the same data; another seed (usually) does not', () => {
    for (const preset of PRESETS) {
      assert.deepEqual(generatePreset(preset, 30, 7), generatePreset(preset, 30, 7), preset);
    }
    assert.notDeepEqual(generatePreset('random', 30, 7), generatePreset('random', 30, 8));
  });

  test('random is a permutation; sorted and reversed are ordered', () => {
    const random = generatePreset('random', 50, 5);
    assert.deepEqual([...random].sort((a, b) => a - b), Array.from({ length: 50 }, (_, i) => i + 1));
    assert.deepEqual(generatePreset('sorted', 5, 1), [1, 2, 3, 4, 5]);
    assert.deepEqual(generatePreset('reversed', 5, 1), [5, 4, 3, 2, 1]);
  });

  test('nearly sorted has a few inversions but is never fully sorted', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const values = generatePreset('nearly-sorted', 40, seed);
      const inversions = countInversions(values);
      assert.ok(inversions > 0 && inversions <= 40, `seed ${seed}: ${inversions}`);
    }
  });

  test('few unique uses at most four distinct values', () => {
    const values = generatePreset('few-unique', 60, 9);
    const distinct = new Set(values);
    assert.ok(distinct.size <= FEW_UNIQUE_LEVELS && distinct.size >= 2);
  });

  test('rejects unknown presets and bad sizes', () => {
    assert.throws(() => generatePreset('zigzag', 10, 1), RangeError);
    assert.throws(() => generatePreset('random', -1, 1), RangeError);
    assert.throws(() => generatePreset('random', 2.5, 1), RangeError);
  });
});

describe('seeded random numbers', () => {
  test('createRng is deterministic and stays in [0, 1)', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 1000; i += 1) {
      const x = a();
      assert.equal(x, b());
      assert.ok(x >= 0 && x < 1);
    }
  });

  test('seed 0 and invalid seeds still produce a usable generator', () => {
    assert.notEqual(normalizeSeed(0), 0);
    assert.notEqual(normalizeSeed(Number.NaN), 0);
    const rng = createRng(0);
    assert.notEqual(rng(), rng());
  });

  test('randomInt covers the inclusive range roughly uniformly', () => {
    const rng = createRng(1);
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i += 1) counts[randomInt(rng, 0, 3)] += 1;
    for (const count of counts) assert.ok(count > 850 && count < 1150, String(counts));
  });

  test('shuffle keeps the same elements', () => {
    const items = [1, 2, 3, 4, 5, 6];
    assert.deepEqual(shuffle(items.slice(), createRng(3)).sort(), items);
  });

  test('newSeed returns a positive 32-bit integer', () => {
    const seed = newSeed();
    assert.ok(Number.isInteger(seed) && seed > 0 && seed <= 0xffffffff);
  });
});
