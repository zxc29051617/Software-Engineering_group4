/**
 * Top-down merge sort with one auxiliary buffer of length n.
 * The buffer is shown under the main bars, so the O(n) extra memory is visible.
 * @module algorithms/merge
 */

import * as ev from '../engine/events.js';
import { lessAux, write } from './ops.js';

const PSEUDOCODE = [
  'procedure mergeSort(A)',
  '  aux ← new array of length(A)',
  '  sort(A, 0, length(A) − 1)',
  'procedure sort(A, lo, hi)',
  '  if lo ≥ hi then return',
  '  mid ← ⌊(lo + hi) / 2⌋',
  '  sort(A, lo, mid)',
  '  sort(A, mid + 1, hi)',
  '  merge(A, lo, mid, hi)',
  'procedure merge(A, lo, mid, hi)',
  '  copy A[lo..hi] into aux[lo..hi]',
  '  i ← lo;  j ← mid + 1',
  '  for k ← lo to hi',
  '    if i > mid then A[k] ← aux[j++]',
  '    else if j > hi then A[k] ← aux[i++]',
  '    else if aux[j] < aux[i] then',
  '      A[k] ← aux[j++]',
  '    else A[k] ← aux[i++]',
];

const LINE = {
  start: 1,
  alloc: 2,
  merge: 9,
  copy: 11,
  leftDone: 14,
  rightDone: 15,
  compare: 16,
  takeRight: 17,
  takeLeft: 18,
};

/**
 * @param {number[]} a  sorted in place
 */
export function* mergeSort(a) {
  const n = a.length;
  if (n === 1) yield ev.sorted([0], LINE.start);
  if (n < 2) return;
  const aux = new Array(n).fill(null);
  yield ev.auxInit(n, 'buffer', LINE.alloc);
  yield* sortRange(a, aux, 0, n - 1);
}

/**
 * @param {number[]} a
 * @param {(number|null)[]} aux
 * @param {number} lo
 * @param {number} hi
 */
function* sortRange(a, aux, lo, hi) {
  if (lo >= hi) return;
  const mid = Math.floor((lo + hi) / 2);
  yield* sortRange(a, aux, lo, mid);
  yield* sortRange(a, aux, mid + 1, hi);
  yield* merge(a, aux, lo, mid, hi);
}

/**
 * Merges the sorted runs a[lo..mid] and a[mid+1..hi]. Taking from the left
 * run on ties keeps the sort stable. During the final merge every write is
 * final, so each position is marked sorted as soon as it is written.
 */
function* merge(a, aux, lo, mid, hi) {
  const final = lo === 0 && hi === a.length - 1;
  yield ev.range(lo, hi, LINE.merge);
  for (let k = lo; k <= hi; k += 1) aux[k] = a[k];
  yield ev.auxCopy(lo, hi, LINE.copy);

  let i = lo;
  let j = mid + 1;
  for (let k = lo; k <= hi; k += 1) {
    if (i > mid) {
      yield* write(a, k, aux[j], LINE.leftDone, j);
      j += 1;
    } else if (j > hi) {
      yield* write(a, k, aux[i], LINE.rightDone, i);
      i += 1;
    } else if (yield* lessAux(aux, j, i, LINE.compare)) {
      yield* write(a, k, aux[j], LINE.takeRight, j);
      j += 1;
    } else {
      yield* write(a, k, aux[i], LINE.takeLeft, i);
      i += 1;
    }
    if (final) yield ev.sorted([k], LINE.merge);
  }
}

export default {
  id: 'merge',
  sort: mergeSort,
  pseudocode: PSEUDOCODE,
  complexity: { best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n log n)', space: 'O(n)' },
  stable: true,
  inPlace: false,
  adaptive: false,
  comparison: true,
  predict: false,
};
