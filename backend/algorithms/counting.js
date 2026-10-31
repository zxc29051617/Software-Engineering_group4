/**
 * Counting sort for integers: count each value, then rewrite the array in
 * order. It never compares two elements; its cost depends on the value
 * range k = max − min + 1, shown as the count array under the bars.
 * @module algorithms/counting
 */

import * as ev from '../engine/events.js';
import { auxWrite, write } from './ops.js';

const PSEUDOCODE = [
  'procedure countingSort(A)',
  '  lo ← min(A);  hi ← max(A)',
  '  count ← array of (hi − lo + 1) zeros',
  '  for each x in A',
  '    count[x − lo] ← count[x − lo] + 1',
  '  k ← 0',
  '  for v ← 0 to hi − lo',
  '    while count[v] > 0',
  '      A[k] ← v + lo;  k ← k + 1',
  '      count[v] ← count[v] − 1',
];

const LINE = { range: 2, alloc: 3, count: 5, collect: 6, write: 9, decrement: 10 };

/**
 * @param {number[]} a  sorted in place
 */
export function* countingSort(a) {
  const n = a.length;
  if (n === 0) return;
  const lo = Math.min(...a);
  const hi = Math.max(...a);
  yield ev.phase('count', LINE.range, { min: lo, max: hi });

  const count = new Array(hi - lo + 1).fill(0);
  yield ev.auxInit(count.length, 'count', LINE.alloc, lo);
  for (let i = 0; i < n; i += 1) {
    const slot = a[i] - lo;
    yield* auxWrite(count, slot, count[slot] + 1, LINE.count, i);
  }

  yield ev.phase('collect', LINE.collect);
  let k = 0;
  for (let v = 0; v < count.length; v += 1) {
    while (count[v] > 0) {
      yield* write(a, k, v + lo, LINE.write, v);
      yield ev.sorted([k], LINE.write);
      k += 1;
      yield* auxWrite(count, v, count[v] - 1, LINE.decrement);
    }
  }
}

export default {
  id: 'counting',
  sort: countingSort,
  pseudocode: PSEUDOCODE,
  complexity: { best: 'O(n + k)', average: 'O(n + k)', worst: 'O(n + k)', space: 'O(k)' },
  stable: null,
  inPlace: false,
  adaptive: false,
  comparison: false,
  predict: false,
};
