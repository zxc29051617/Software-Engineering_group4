/**
 * Bubble sort with the early-exit flag (stops after a pass without swaps).
 * @module algorithms/bubble
 */

import * as ev from '../engine/events.js';
import { greater, indexRange, swap } from './ops.js';

const PSEUDOCODE = [
  'procedure bubbleSort(A)',
  '  n ← length(A)',
  '  for pass ← 1 to n − 1',
  '    swapped ← false',
  '    for j ← 0 to n − 1 − pass',
  '      if A[j] > A[j + 1] then',
  '        swap A[j], A[j + 1]',
  '        swapped ← true',
  '    ▷ A[n − pass] is now in place',
  '    if not swapped then',
  '      return    ▷ already sorted',
];

const LINE = { start: 2, pass: 3, compare: 6, swap: 7, placed: 9, stop: 11 };

/**
 * @param {number[]} a  sorted in place
 */
export function* bubbleSort(a) {
  const n = a.length;
  if (n === 1) yield ev.sorted([0], LINE.start);
  for (let pass = 1; pass <= n - 1; pass += 1) {
    yield ev.phase('pass', LINE.pass, pass);
    let swapped = false;
    for (let j = 0; j <= n - 1 - pass; j += 1) {
      if (yield* greater(a, j, j + 1, LINE.compare)) {
        yield* swap(a, j, j + 1, LINE.swap);
        swapped = true;
      }
    }
    yield ev.sorted(pass === n - 1 ? [n - pass, 0] : [n - pass], LINE.placed);
    if (!swapped && pass < n - 1) {
      yield ev.sorted(indexRange(0, n - pass - 1), LINE.stop);
      return;
    }
  }
}

export default {
  id: 'bubble',
  sort: bubbleSort,
  pseudocode: PSEUDOCODE,
  complexity: { best: 'O(n)', average: 'O(n²)', worst: 'O(n²)', space: 'O(1)' },
  stable: true,
  inPlace: true,
  adaptive: true,
  comparison: true,
  predict: true,
};
