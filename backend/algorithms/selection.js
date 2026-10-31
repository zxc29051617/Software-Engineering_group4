/**
 * Selection sort: repeatedly select the minimum of the unsorted part.
 * @module algorithms/selection
 */

import * as ev from '../engine/events.js';
import { less, swap } from './ops.js';

const PSEUDOCODE = [
  'procedure selectionSort(A)',
  '  n ← length(A)',
  '  for i ← 0 to n − 2',
  '    min ← i',
  '    for j ← i + 1 to n − 1',
  '      if A[j] < A[min] then',
  '        min ← j',
  '    if min ≠ i then swap A[i], A[min]',
  '    ▷ A[i] is now in place',
];

const LINE = { start: 2, outer: 3, initMin: 4, compare: 6, newMin: 7, swap: 8, placed: 9 };

/**
 * @param {number[]} a  sorted in place
 */
export function* selectionSort(a) {
  const n = a.length;
  if (n === 1) yield ev.sorted([0], LINE.start);
  for (let i = 0; i <= n - 2; i += 1) {
    let min = i;
    yield ev.mark('min', min, LINE.initMin);
    for (let j = i + 1; j <= n - 1; j += 1) {
      if (yield* less(a, j, min, LINE.compare)) {
        min = j;
        yield ev.mark('min', min, LINE.newMin);
      }
    }
    if (min !== i) yield* swap(a, i, min, LINE.swap);
    yield ev.sorted(i === n - 2 ? [i, n - 1] : [i], LINE.placed);
  }
}

export default {
  id: 'selection',
  sort: selectionSort,
  pseudocode: PSEUDOCODE,
  complexity: { best: 'O(n²)', average: 'O(n²)', worst: 'O(n²)', space: 'O(1)' },
  stable: false,
  inPlace: true,
  adaptive: false,
  comparison: true,
  predict: false,
};
