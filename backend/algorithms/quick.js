/**
 * Quick sort with Lomuto partitioning and the last element as pivot.
 * Already-sorted input is its worst case, which the visualizer makes visible.
 * @module algorithms/quick
 */

import * as ev from '../engine/events.js';
import { less, swap } from './ops.js';

const PSEUDOCODE = [
  'procedure quickSort(A, lo, hi)',
  '  if lo < hi then',
  '    p ← partition(A, lo, hi)',
  '    quickSort(A, lo, p − 1)',
  '    quickSort(A, p + 1, hi)',
  'procedure partition(A, lo, hi)',
  '  pivot ← A[hi]',
  '  i ← lo',
  '  for j ← lo to hi − 1',
  '    if A[j] < pivot then',
  '      swap A[i], A[j]   ▷ if i ≠ j',
  '      i ← i + 1',
  '  swap A[i], A[hi]   ▷ pivot in place',
  '  return i',
];

const LINE = { check: 2, pivot: 7, boundary: 8, compare: 10, swap: 11, advance: 12, place: 13, placed: 14 };

/**
 * @param {number[]} a  sorted in place
 */
export function* quickSort(a) {
  yield* sortRange(a, 0, a.length - 1);
}

/**
 * @param {number[]} a
 * @param {number} lo
 * @param {number} hi
 */
function* sortRange(a, lo, hi) {
  if (lo === hi) {
    yield ev.sorted([lo], LINE.check);
    return;
  }
  if (lo > hi) return;
  const p = yield* partition(a, lo, hi);
  yield* sortRange(a, lo, p - 1);
  yield* sortRange(a, p + 1, hi);
}

/**
 * Partitions a[lo..hi] around a[hi] and returns the pivot's final index.
 * @param {number[]} a
 * @param {number} lo
 * @param {number} hi
 */
function* partition(a, lo, hi) {
  yield ev.range(lo, hi, LINE.check);
  yield ev.pivot(hi, LINE.pivot);
  let i = lo;
  yield ev.mark('boundary', i, LINE.boundary);
  for (let j = lo; j <= hi - 1; j += 1) {
    if (yield* less(a, j, hi, LINE.compare)) {
      if (i !== j) yield* swap(a, i, j, LINE.swap);
      i += 1;
      yield ev.mark('boundary', i, LINE.advance);
    }
  }
  if (i !== hi) {
    yield* swap(a, i, hi, LINE.place);
    yield ev.pivot(i, LINE.place);
  }
  yield ev.sorted([i], LINE.placed);
  return i;
}

export default {
  id: 'quick',
  sort: quickSort,
  pseudocode: PSEUDOCODE,
  complexity: { best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n²)', space: 'O(log n)' },
  stable: false,
  inPlace: true,
  adaptive: false,
  comparison: true,
  predict: false,
};
