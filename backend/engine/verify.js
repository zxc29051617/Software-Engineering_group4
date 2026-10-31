/**
 * Checks that an algorithm's event stream is trustworthy:
 *  - every event is well-formed for the state it is applied to;
 *  - replaying the events from the input reproduces the generator's result,
 *    and that result is the sorted input;
 *  - an index marked "sorted" already holds its final value and is never
 *    swapped or written again;
 *  - by the end every index has been marked sorted.
 *
 * Used by the unit tests; cheap enough to run on any trace.
 *
 * @module engine/verify
 */

import { EventType, validateEvent } from './events.js';
import { applyEvent, createState } from './state.js';
import { recordTrace } from './trace.js';

const MAX_PROBLEMS = 5;

/**
 * @param {number[]} a
 * @param {number[]} b
 */
function sameValues(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * @param {import('./events.js').SortEvent} event
 * @returns {number[]} indices of the main array the event would change
 */
function touchedIndices(event) {
  if (event.type === EventType.SWAP) return [event.i, event.j];
  if (event.type === EventType.WRITE) return [event.i];
  return [];
}

/**
 * Records and verifies one run.
 * @param {import('../algorithms/index.js').Algorithm} algorithm
 * @param {number[]} input
 * @returns {{problems: string[], events: import('./events.js').SortEvent[], state: import('./state.js').SortState}}
 */
export function verifyTrace(algorithm, input) {
  const trace = recordTrace(algorithm, input);
  const expected = input.slice().sort((x, y) => x - y);
  const state = createState(input);
  const problems = [];

  for (const [index, event] of trace.events.entries()) {
    if (problems.length >= MAX_PROBLEMS) break;
    const problem = validateEvent(event, state, algorithm.pseudocode.length);
    if (problem) {
      problems.push(`event #${index}: ${problem}`);
      break;
    }
    for (const i of touchedIndices(event)) {
      if (state.sorted[i]) problems.push(`event #${index}: ${event.type} changes A[${i}] after it was marked sorted`);
    }
    applyEvent(state, event);
    if (event.type === EventType.SORTED) {
      for (const i of event.indices) {
        if (state.array[i] !== expected[i]) {
          problems.push(`event #${index}: A[${i}] = ${state.array[i]} marked sorted, final value is ${expected[i]}`);
        }
      }
    }
  }

  if (!sameValues(trace.output, expected)) problems.push(`generator result ${trace.output} is not sorted`);
  if (!sameValues(state.array, trace.output)) problems.push('replaying the events does not reproduce the result');
  if (state.sortedCount !== input.length) {
    problems.push(`${state.sortedCount} of ${input.length} indices were marked sorted`);
  }
  return { problems, events: trace.events, state };
}
