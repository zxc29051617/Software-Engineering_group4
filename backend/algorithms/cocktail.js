/**
 * Cocktail shaker sort: bubble sort that alternates left-to-right and
 * right-to-left passes, so small values near the end move quickly too.
 * @module algorithms/cocktail
 */

import * as ev from '../engine/events.js';
import { greater, indexRange, swap } from './ops.js';

const PSEUDOCODE = [
  'procedure cocktailShakerSort(A)',
  '  lo ← 0;  hi ← length(A) − 1',
  '  while lo < hi',
  '    swapped ← false',
  '    for j ← lo to hi − 1       ▷ →',
  '      if A[j] > A[j + 1] then',
  '        swap A[j], A[j + 1]',
  '        swapped ← true',
  '    if not swapped then return',
  '    hi ← hi − 1        ▷ max in place',
  '    swapped ← false',
  '    for j ← hi downto lo + 1   ▷ ←',
  '      if A[j − 1] > A[j] then',
  '        swap A[j − 1], A[j]',
  '        swapped ← true',
  '    lo ← lo + 1        ▷ min in place',
  '    if not swapped then return',
];

const LINE = {
  start: 2,
  round: 3,
  forward: 6,
  forwardSwap: 7,
  stopForward: 9,
  placeHi: 10,
  backward: 13,
  backwardSwap: 14,
  placeLo: 16,
  stopBackward: 17,
};

/**
 * @param {number[]} a  sorted in place
 */
export function* cocktailSort(a) {
  let lo = 0;
  let hi = a.length - 1;
  let round = 0;
  while (lo < hi) {
    round += 1;
    yield ev.phase('pass', LINE.round, round);
    let swapped = false;
    for (let j = lo; j < hi; j += 1) {
      if (yield* greater(a, j, j + 1, LINE.forward)) {
        yield* swap(a, j, j + 1, LINE.forwardSwap);
        swapped = true;
      }
    }
    if (!swapped) {
      yield ev.sorted(indexRange(lo, hi), LINE.stopForward);
      return;
    }
    yield ev.sorted([hi], LINE.placeHi);
    hi -= 1;
    swapped = false;
    for (let j = hi; j > lo; j -= 1) {
      if (yield* greater(a, j - 1, j, LINE.backward)) {
        yield* swap(a, j - 1, j, LINE.backwardSwap);
        swapped = true;
      }
    }
    yield ev.sorted([lo], LINE.placeLo);
    lo += 1;
    if (!swapped && lo <= hi) {
      yield ev.sorted(indexRange(lo, hi), LINE.stopBackward);
      return;
    }
  }
  if (lo === hi) yield ev.sorted([lo], LINE.start);
}

export default {
  id: 'cocktail',
  sort: cocktailSort,
  pseudocode: PSEUDOCODE,
  complexity: { best: 'O(n)', average: 'O(n²)', worst: 'O(n²)', space: 'O(1)' },
  stable: true,
  inPlace: true,
  adaptive: true,
  comparison: true,
  predict: true,
};
