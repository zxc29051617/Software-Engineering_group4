/**
 * Insertion sort, exchange form: the new element swaps leftwards until it fits.
 * @module algorithms/insertion
 */

import * as ev from '../engine/events.js';
import { greater, indexRange, swap } from './ops.js';

const PSEUDOCODE = [
  'procedure insertionSort(A)',
  '  n ← length(A)',
  '  for i ← 1 to n − 1',
  '    j ← i          ▷ A[0..i − 1] sorted',
  '    while j > 0 and A[j − 1] > A[j]',
  '      swap A[j − 1], A[j]',
  '      j ← j − 1',
  '  ▷ every element is in place',
];

const LINE = { insert: 4, compare: 5, swap: 6, done: 8 };

/**
 * @param {number[]} a  sorted in place
 */
export function* insertionSort(a) {
  const n = a.length;
  for (let i = 1; i <= n - 1; i += 1) {
    yield ev.range(0, i, LINE.insert);
    let j = i;
    while (j > 0 && (yield* greater(a, j - 1, j, LINE.compare))) {
      yield* swap(a, j - 1, j, LINE.swap);
      j -= 1;
    }
  }
  if (n > 0) yield ev.sorted(indexRange(0, n - 1), LINE.done);
}

export default {
  id: 'insertion',
  sort: insertionSort,
  pseudocode: PSEUDOCODE,
  complexity: { best: 'O(n)', average: 'O(n²)', worst: 'O(n²)', space: 'O(1)' },
  stable: true,
  inPlace: true,
  adaptive: true,
  comparison: true,
  predict: true,
};
