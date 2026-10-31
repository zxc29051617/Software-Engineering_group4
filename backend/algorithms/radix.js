/**
 * LSD radix sort, base 10: distribute by one digit into ten FIFO buckets,
 * collect, and repeat from the ones digit upwards. The buckets keep equal
 * digits in order, which is what makes the later passes correct.
 * @module algorithms/radix
 */

import * as ev from '../engine/events.js';
import { auxWrite, indexRange, write } from './ops.js';

const PSEUDOCODE = [
  'procedure radixSort(A)   ▷ integers ≥ 0',
  '  m ← max(A);  exp ← 1',
  '  while ⌊m / exp⌋ > 0',
  '    bucket[0..9] ← empty queues',
  '    for each x in A, left to right',
  '      d ← ⌊x / exp⌋ mod 10',
  '      append x to bucket[d]',
  '    k ← 0',
  '    for d ← 0 to 9',
  '      while bucket[d] is not empty',
  '        A[k++] ← dequeue(bucket[d])',
  '    exp ← exp × 10',
];

const LINE = { max: 2, digit: 3, alloc: 4, distribute: 7, collect: 8, write: 11 };
const BASE = 10;

/**
 * Digit of `x` at place value `exp` (1, 10, 100, ...).
 * @param {number} x
 * @param {number} exp
 */
export function digitAt(x, exp) {
  return Math.floor(x / exp) % BASE;
}

/**
 * @param {number[]} a  sorted in place
 */
export function* radixSort(a) {
  const n = a.length;
  if (n === 0) return;
  // Negative values are shifted so the digits are taken from x − offset ≥ 0.
  const offset = Math.min(0, ...a);
  const max = Math.max(...a) - offset;
  if (max === 0) {
    yield ev.sorted(indexRange(0, n - 1), LINE.max);
    return;
  }
  let passes = 0;
  for (let exp = 1; Math.floor(max / exp) > 0; exp *= BASE) passes += 1;

  let exp = 1;
  for (let pass = 1; pass <= passes; pass += 1, exp *= BASE) {
    const last = pass === passes;
    yield ev.phase('digit', LINE.digit, exp);
    const sizes = new Array(BASE).fill(0);
    const buckets = Array.from({ length: BASE }, () => []);
    yield ev.auxInit(BASE, 'bucket', LINE.alloc);
    for (let i = 0; i < n; i += 1) {
      const d = digitAt(a[i] - offset, exp);
      buckets[d].push(a[i]);
      yield* auxWrite(sizes, d, sizes[d] + 1, LINE.distribute, i);
    }
    yield ev.phase('collect', LINE.collect);
    let k = 0;
    for (let d = 0; d < BASE; d += 1) {
      for (const x of buckets[d]) {
        yield* write(a, k, x, LINE.write, d);
        if (last) yield ev.sorted([k], LINE.write);
        k += 1;
        yield* auxWrite(sizes, d, sizes[d] - 1, LINE.write);
      }
    }
  }
}

export default {
  id: 'radix',
  sort: radixSort,
  pseudocode: PSEUDOCODE,
  complexity: { best: 'O(d·(n + b))', average: 'O(d·(n + b))', worst: 'O(d·(n + b))', space: 'O(n + b)' },
  stable: true,
  inPlace: false,
  adaptive: false,
  comparison: false,
  predict: false,
};
