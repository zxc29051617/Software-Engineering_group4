/**
 * Heap sort: build a max-heap, then repeatedly move the root to the end.
 * @module algorithms/heap
 */

import * as ev from '../engine/events.js';
import { greater, less, swap } from './ops.js';

const PSEUDOCODE = [
  'procedure heapSort(A)',
  '  n ← length(A)',
  '  for i ← ⌊n/2⌋ − 1 downto 0  ▷ build heap',
  '    siftDown(A, i, n)',
  '  for end ← n − 1 downto 1',
  '    swap A[0], A[end]  ▷ max to the end',
  '    siftDown(A, 0, end)',
  'procedure siftDown(A, i, size)',
  '  while 2i + 1 < size',
  '    c ← 2i + 1',
  '    if c + 1 < size and A[c+1] > A[c]',
  '      c ← c + 1',
  '    if A[i] ≥ A[c] then return',
  '    swap A[i], A[c]',
  '    i ← c',
];

const LINE = { start: 2, build: 3, extract: 5, moveMax: 6, child: 11, parent: 13, sift: 14 };

/**
 * @param {number[]} a  sorted in place
 */
export function* heapSort(a) {
  const n = a.length;
  if (n === 1) yield ev.sorted([0], LINE.start);
  if (n < 2) return;
  yield ev.phase('build-heap', LINE.build);
  for (let i = Math.floor(n / 2) - 1; i >= 0; i -= 1) yield* siftDown(a, i, n);

  yield ev.phase('extract', LINE.extract);
  for (let end = n - 1; end >= 1; end -= 1) {
    yield* swap(a, 0, end, LINE.moveMax);
    yield ev.sorted(end === 1 ? [1, 0] : [end], LINE.moveMax);
    if (end > 1) {
      yield ev.range(0, end - 1, LINE.extract);
      yield* siftDown(a, 0, end);
    }
  }
}

/**
 * Moves a[i] down until both children are not larger (heap of length `size`).
 * @param {number[]} a
 * @param {number} i
 * @param {number} size
 */
function* siftDown(a, i, size) {
  let parent = i;
  while (2 * parent + 1 < size) {
    let child = 2 * parent + 1;
    if (child + 1 < size && (yield* greater(a, child + 1, child, LINE.child))) child += 1;
    if (!(yield* less(a, parent, child, LINE.parent))) return;
    yield* swap(a, parent, child, LINE.sift);
    parent = child;
  }
}

export default {
  id: 'heap',
  sort: heapSort,
  pseudocode: PSEUDOCODE,
  complexity: { best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n log n)', space: 'O(1)' },
  stable: false,
  inPlace: true,
  adaptive: false,
  comparison: true,
  predict: false,
};
