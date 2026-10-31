/**
 * Turns the most recent event into a narration message: an i18n key plus
 * parameters. The UI translates it, so this module stays language-neutral.
 *
 * Parameters may themselves be `{key, params}` objects; the translator
 * resolves those recursively (used for the digit place in radix sort).
 *
 * @module engine/describe
 */

import { EventType } from './events.js';

/**
 * @typedef {{key: string, params: Record<string, *>}} Message
 */

/**
 * Comparison symbol between two values.
 * @param {number} x
 * @param {number} y
 * @returns {'<'|'='|'>'}
 */
export function comparisonSymbol(x, y) {
  if (x < y) return '<';
  if (x > y) return '>';
  return '=';
}

/**
 * Message for the run as a whole once every event has been applied.
 * @param {import('./state.js').SortState} state
 * @param {number} steps
 * @returns {Message}
 */
export function describeDone(state, steps) {
  return { key: 'narr.done', params: { steps, ...state.stats } };
}

/**
 * Describes `state.last` using the values in `state` (the state *after* the event).
 *
 * @param {import('./state.js').SortState} state
 * @param {{hideOutcome?: boolean}} [options]  hide the result of a compare (prediction quiz)
 * @returns {Message}
 */
export function describeStep(state, { hideOutcome = false } = {}) {
  const event = state.last;
  if (!event) return { key: 'narr.ready', params: {} };
  switch (event.type) {
    case EventType.COMPARE:
      return describeCompare(state, event, hideOutcome);
    case EventType.SWAP:
      // After the swap, the old A[i] sits at j and the old A[j] at i.
      return { key: 'narr.swap', params: { i: event.i, j: event.j, x: state.array[event.j], y: state.array[event.i] } };
    case EventType.WRITE:
      return describeWrite(state, event);
    case EventType.AUX_INIT:
      return describeAuxInit(event);
    case EventType.AUX_COPY:
      return { key: 'narr.auxCopy', params: { lo: event.lo, hi: event.hi } };
    case EventType.AUX_WRITE:
      return describeAuxWrite(state, event);
    case EventType.SORTED:
      return event.indices.length === 1
        ? { key: 'narr.sorted.one', params: { i: event.indices[0], x: state.array[event.indices[0]] } }
        : { key: 'narr.sorted.many', params: { count: event.indices.length } };
    case EventType.PIVOT:
      return event.i === null
        ? { key: 'narr.pivot.clear', params: {} }
        : { key: 'narr.pivot', params: { i: event.i, x: state.array[event.i] } };
    case EventType.RANGE:
      return event.lo === null
        ? { key: 'narr.range.clear', params: {} }
        : { key: 'narr.range', params: { lo: event.lo, hi: event.hi } };
    case EventType.MARK:
      if (event.i === null) return { key: 'narr.mark.clear', params: {} };
      return { key: `narr.mark.${event.role}`, params: { i: event.i, x: state.array[event.i] } };
    case EventType.PHASE:
      return describePhase(event);
    default:
      return { key: 'narr.unknown', params: { type: event.type } };
  }
}

function describeCompare(state, event, hideOutcome) {
  const source = event.target === 'aux' ? state.aux : state.array;
  const x = source[event.i];
  const y = source[event.j];
  const base = event.target === 'aux' ? 'narr.compare.aux' : 'narr.compare';
  const params = { i: event.i, j: event.j, x, y, op: comparisonSymbol(x, y) };
  return { key: hideOutcome ? `${base}.hidden` : base, params };
}

function describeWrite(state, event) {
  const params = { i: event.i, value: event.value, from: event.from };
  if (state.auxKind === 'buffer') return { key: 'narr.write.buffer', params };
  if (state.auxKind === 'count') return { key: 'narr.write.count', params };
  if (state.auxKind === 'bucket') return { key: 'narr.write.bucket', params };
  return { key: 'narr.write', params };
}

function describeAuxInit(event) {
  if (event.size === 0) return { key: 'narr.auxInit.free', params: {} };
  const params = { size: event.size, min: event.base, max: event.base + event.size - 1 };
  return { key: `narr.auxInit.${event.kind}`, params };
}

function describeAuxWrite(state, event) {
  const reading = event.from !== null;
  const params = {
    k: event.k,
    label: event.k + state.auxBase,
    value: event.value,
    from: event.from,
    x: reading ? state.array[event.from] : null,
  };
  if (state.auxKind === 'count') return { key: reading ? 'narr.auxWrite.countUp' : 'narr.auxWrite.countDown', params };
  if (state.auxKind === 'bucket') return { key: reading ? 'narr.auxWrite.bucketIn' : 'narr.auxWrite.bucketOut', params };
  return { key: 'narr.auxWrite', params };
}

/** Largest digit position with its own name (0 = ones ... 3 = thousands). */
const NAMED_PLACES = 3;

function describePhase(event) {
  const key = `narr.phase.${event.name}`;
  if (event.name === 'digit') {
    const position = Math.round(Math.log10(event.value));
    const place =
      position <= NAMED_PLACES
        ? { key: `place.${position}`, params: {} }
        : { key: 'place.other', params: { exp: event.value } };
    return { key, params: { value: event.value, place } };
  }
  if (event.name === 'count') return { key, params: { min: event.value.min, max: event.value.max } };
  return { key, params: { value: event.value } };
}
