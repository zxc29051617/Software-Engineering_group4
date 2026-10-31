/**
 * Visual state of one sorting run, and the pure function that advances it.
 *
 * The state is everything the UI needs to draw a frame: the arrays, which bars
 * are final, the pivot/range/pointers, the current pseudocode line and the
 * running counters. Replaying the same events from the same input always
 * produces the same state.
 *
 * @module engine/state
 */

import { EventType } from './events.js';

/**
 * @typedef {Object} Stats
 * @property {number} comparisons
 * @property {number} swaps
 * @property {number} writes     Overwrites of the main array.
 * @property {number} auxWrites  Writes into the auxiliary array.
 *
 * @typedef {Object} SortState
 * @property {number[]} array
 * @property {(number|null)[]|null} aux
 * @property {'buffer'|'count'|'bucket'|null} auxKind
 * @property {number} auxBase    Label offset for aux cells.
 * @property {number} auxPeak    Largest aux size seen so far (extra memory).
 * @property {Uint8Array} sorted 1 where the element is in its final position.
 * @property {number} sortedCount
 * @property {number|null} pivot
 * @property {[number, number]|null} range
 * @property {Record<string, number>} marks  role -> index
 * @property {{name: string, value: *}|null} phase
 * @property {import('./events.js').SortEvent|null} last  The event applied most recently.
 * @property {number} line       Pseudocode line of `last` (0 before the first event).
 * @property {Stats} stats
 */

/**
 * Creates the state before any event has been applied.
 * @param {number[]} input
 * @returns {SortState}
 */
export function createState(input) {
  return {
    array: input.slice(),
    aux: null,
    auxKind: null,
    auxBase: 0,
    auxPeak: 0,
    sorted: new Uint8Array(input.length),
    sortedCount: 0,
    pivot: null,
    range: null,
    marks: {},
    phase: null,
    last: null,
    line: 0,
    stats: { comparisons: 0, swaps: 0, writes: 0, auxWrites: 0 },
  };
}

/**
 * Applies one event to `state` in place.
 * @param {SortState} state
 * @param {import('./events.js').SortEvent} event
 * @returns {SortState} the same state object
 */
export function applyEvent(state, event) {
  const { stats } = state;
  switch (event.type) {
    case EventType.COMPARE:
      stats.comparisons += 1;
      break;
    case EventType.SWAP: {
      const tmp = state.array[event.i];
      state.array[event.i] = state.array[event.j];
      state.array[event.j] = tmp;
      stats.swaps += 1;
      break;
    }
    case EventType.WRITE:
      state.array[event.i] = event.value;
      stats.writes += 1;
      break;
    case EventType.AUX_INIT:
      applyAuxInit(state, event);
      break;
    case EventType.AUX_COPY:
      for (let k = event.lo; k <= event.hi; k += 1) state.aux[k] = state.array[k];
      stats.auxWrites += event.hi - event.lo + 1;
      break;
    case EventType.AUX_WRITE:
      state.aux[event.k] = event.value;
      stats.auxWrites += 1;
      break;
    case EventType.SORTED:
      for (const i of event.indices) {
        if (!state.sorted[i]) {
          state.sorted[i] = 1;
          state.sortedCount += 1;
        }
      }
      break;
    case EventType.PIVOT:
      state.pivot = event.i;
      break;
    case EventType.RANGE:
      state.range = event.lo === null ? null : [event.lo, event.hi];
      break;
    case EventType.MARK:
      state.marks = { ...state.marks };
      if (event.i === null) delete state.marks[event.role];
      else state.marks[event.role] = event.i;
      break;
    case EventType.PHASE:
      state.phase = { name: event.name, value: event.value };
      break;
    default:
      throw new Error(`Unknown event type: ${event.type}`);
  }
  state.last = event;
  state.line = event.line;
  return state;
}

/**
 * @param {SortState} state
 * @param {{size: number, kind: string, base: number}} event
 */
function applyAuxInit(state, event) {
  if (event.size === 0) {
    state.aux = null;
    state.auxKind = null;
    state.auxBase = 0;
    return;
  }
  state.aux = new Array(event.size).fill(event.kind === 'buffer' ? null : 0);
  state.auxKind = event.kind;
  state.auxBase = event.base;
  state.auxPeak = Math.max(state.auxPeak, event.size);
}

/**
 * Deep-copies the parts of a state that `applyEvent` mutates.
 * @param {SortState} state
 * @returns {SortState}
 */
export function cloneState(state) {
  return {
    ...state,
    array: state.array.slice(),
    aux: state.aux ? state.aux.slice() : null,
    sorted: state.sorted.slice(),
    marks: { ...state.marks },
    stats: { ...state.stats },
  };
}

/**
 * Replays a list of events from the input and returns the final state.
 * @param {number[]} input
 * @param {import('./events.js').SortEvent[]} events
 * @returns {SortState}
 */
export function replay(input, events) {
  const state = createState(input);
  for (const event of events) applyEvent(state, event);
  return state;
}
