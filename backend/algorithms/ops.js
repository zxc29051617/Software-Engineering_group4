/**
 * Generator helpers that change the working array and emit the matching event
 * in one place, so an algorithm cannot do one without the other.
 *
 * Use them with `yield*`, for example:
 *   if (yield* greater(a, j, j + 1, LINE.compare)) yield* swap(a, j, j + 1, LINE.swap);
 *
 * @module algorithms/ops
 */

import * as ev from '../engine/events.js';

/**
 * Emits a compare event and returns `a[i] > a[j]`.
 * @param {number[]} a
 * @param {number} i
 * @param {number} j
 * @param {number} line
 */
export function* greater(a, i, j, line) {
  yield ev.compare(i, j, line);
  return a[i] > a[j];
}

/**
 * Emits a compare event and returns `a[i] < a[j]`.
 * @param {number[]} a
 * @param {number} i
 * @param {number} j
 * @param {number} line
 */
export function* less(a, i, j, line) {
  yield ev.compare(i, j, line);
  return a[i] < a[j];
}

/**
 * Emits a compare event on the auxiliary array and returns `aux[i] < aux[j]`.
 * @param {(number|null)[]} aux
 * @param {number} i
 * @param {number} j
 * @param {number} line
 */
export function* lessAux(aux, i, j, line) {
  yield ev.compare(i, j, line, 'aux');
  return aux[i] < aux[j];
}

/**
 * Swaps `a[i]` and `a[j]` and emits a swap event.
 * @param {number[]} a
 * @param {number} i
 * @param {number} j
 * @param {number} line
 */
export function* swap(a, i, j, line) {
  const tmp = a[i];
  a[i] = a[j];
  a[j] = tmp;
  yield ev.swap(i, j, line);
}

/**
 * Sets `a[i] = value` and emits a write event.
 * @param {number[]} a
 * @param {number} i
 * @param {number} value
 * @param {number} line
 * @param {number|null} [from]  aux index the value came from
 */
export function* write(a, i, value, line, from = null) {
  a[i] = value;
  yield ev.write(i, value, line, from);
}

/**
 * Sets `aux[k] = value` and emits an auxWrite event.
 * @param {(number|null)[]} aux
 * @param {number} k
 * @param {number} value
 * @param {number} line
 * @param {number|null} [from]  main-array index that was read
 */
export function* auxWrite(aux, k, value, line, from = null) {
  aux[k] = value;
  yield ev.auxWrite(k, value, line, from);
}

/**
 * Indices `lo..hi` (inclusive) as an array, for `sorted` events.
 * @param {number} lo
 * @param {number} hi
 */
export function indexRange(lo, hi) {
  const out = [];
  for (let i = lo; i <= hi; i += 1) out.push(i);
  return out;
}
