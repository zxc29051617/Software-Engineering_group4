/**
 * Shell sort with Knuth's gap sequence 1, 4, 13, 40, ...
 * Each round is an insertion sort over elements that are `h` apart.
 * @module algorithms/shell
 */

import * as ev from '../engine/events.js';
import { greater, indexRange, swap } from './ops.js';

const PSEUDOCODE = [
  'procedure shellSort(A)',
  '  n ← length(A);  h ← 1',
  '  while h < n / 3',
  '    h ← 3h + 1         ▷ 1, 4, 13, 40, …',
  '  while h ≥ 1',
  '    for i ← h to n − 1',
  '      j ← i',
  '      while j ≥ h and A[j − h] > A[j]',
  '        swap A[j − h], A[j]',
  '        j ← j − h',
  '    h ← ⌊h / 3⌋',
  '  ▷ every element is in place',
];

const LINE = { gap: 5, compare: 8, swap: 9, done: 12 };

/**
 * Largest Knuth gap below n / 3 (at least 1).
 * @param {number} n
 */
export function initialGap(n) {
  let h = 1;
  while (h < n / 3) h = 3 * h + 1;
  return h;
}

/**
 * @param {number[]} a  sorted in place
 */
export function* shellSort(a) {
  const n = a.length;
  for (let h = initialGap(n); h >= 1 && n > 1; h = Math.floor(h / 3)) {
    yield ev.phase('gap', LINE.gap, h);
    for (let i = h; i <= n - 1; i += 1) {
      let j = i;
      while (j >= h && (yield* greater(a, j - h, j, LINE.compare))) {
        yield* swap(a, j - h, j, LINE.swap);
        j -= h;
      }
    }
  }
  if (n > 0) yield ev.sorted(indexRange(0, n - 1), LINE.done);
}

export default {
  id: 'shell',
  sort: shellSort,
  pseudocode: PSEUDOCODE,
  complexity: { best: 'O(n log n)', average: '≈ O(n^1.25)', worst: 'O(n^1.5)', space: 'O(1)' },
  stable: false,
  inPlace: true,
  adaptive: true,
  comparison: true,
  predict: true,
};
