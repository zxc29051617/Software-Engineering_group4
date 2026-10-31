/**
 * Typed events emitted by the sorting algorithms.
 *
 * Algorithms never touch the DOM. They yield these plain objects, and the
 * engine (state, player, race) and the UI decide how to replay or draw them.
 * Every event carries `line`, the 1-based pseudocode line it belongs to.
 *
 * @module engine/events
 */

/**
 * @typedef {'main'|'aux'} Target
 * @typedef {'buffer'|'count'|'bucket'} AuxKind
 *
 * @typedef {Object} SortEvent
 * @property {string} type  One of {@link EventType}.
 * @property {number} line  1-based line in the algorithm's pseudocode.
 */

/** All event types. Only `swap`, `write`, `auxInit`, `auxCopy` and `auxWrite` change data. */
export const EventType = Object.freeze({
  COMPARE: 'compare',
  SWAP: 'swap',
  WRITE: 'write',
  AUX_INIT: 'auxInit',
  AUX_COPY: 'auxCopy',
  AUX_WRITE: 'auxWrite',
  SORTED: 'sorted',
  PIVOT: 'pivot',
  RANGE: 'range',
  MARK: 'mark',
  PHASE: 'phase',
});

/** Kinds of auxiliary array an algorithm may show under the main bars. */
export const AUX_KINDS = Object.freeze(['buffer', 'count', 'bucket']);

/** Roles for `mark` events (a labelled pointer under one bar). */
export const MARK_ROLES = Object.freeze(['min', 'boundary']);

/** Names for `phase` events (narration only, no visual change). */
export const PHASES = Object.freeze(['pass', 'gap', 'build-heap', 'extract', 'count', 'collect', 'digit']);

const KNOWN_TYPES = new Set(Object.values(EventType));

/**
 * Compare two elements. `target` says which array the indices refer to.
 * @param {number} i
 * @param {number} j
 * @param {number} line
 * @param {Target} [target]
 */
export const compare = (i, j, line, target = 'main') => ({ type: EventType.COMPARE, i, j, target, line });

/** Swap `array[i]` and `array[j]`. */
export const swap = (i, j, line) => ({ type: EventType.SWAP, i, j, line });

/**
 * Overwrite `array[i]` with `value`. `from` is the aux index it was read from, if any.
 * @param {number} i
 * @param {number} value
 * @param {number} line
 * @param {number|null} [from]
 */
export const write = (i, value, line, from = null) => ({ type: EventType.WRITE, i, value, from, line });

/**
 * Create (or with `size` 0, release) the auxiliary array.
 * `buffer` starts empty (null cells), `count` and `bucket` start at 0.
 * `base` is added to an aux index to label it (e.g. count[k] counts value k + base).
 * @param {number} size
 * @param {AuxKind} kind
 * @param {number} line
 * @param {number} [base]
 */
export const auxInit = (size, kind, line, base = 0) => ({ type: EventType.AUX_INIT, size, kind, base, line });

/** Copy `array[lo..hi]` into `aux[lo..hi]` (merge sort's temporary buffer). */
export const auxCopy = (lo, hi, line) => ({ type: EventType.AUX_COPY, lo, hi, line });

/** Set `aux[k] = value`. `from` is the main-array index that was read, if any. */
export const auxWrite = (k, value, line, from = null) => ({ type: EventType.AUX_WRITE, k, value, from, line });

/** Mark indices as being in their final sorted position. */
export const sorted = (indices, line) => ({ type: EventType.SORTED, indices, line });

/** Highlight the pivot index, or clear it with `null`. */
export const pivot = (i, line) => ({ type: EventType.PIVOT, i, line });

/** Highlight the active sub-array `lo..hi`, or clear it with `null`. */
export const range = (lo, hi, line) => ({ type: EventType.RANGE, lo, hi, line });

/** Put a labelled pointer (`role`) under index `i`, or clear it with `null`. */
export const mark = (role, i, line) => ({ type: EventType.MARK, role, i, line });

/** Announce a phase of the algorithm; `value` is phase-specific (pass number, gap, ...). */
export const phase = (name, line, value = null) => ({ type: EventType.PHASE, name, value, line });

/**
 * Returns true for events that change the main or auxiliary array.
 * @param {SortEvent} event
 */
export function isMutation(event) {
  return (
    event.type === EventType.SWAP ||
    event.type === EventType.WRITE ||
    event.type === EventType.AUX_INIT ||
    event.type === EventType.AUX_COPY ||
    event.type === EventType.AUX_WRITE
  );
}

const isIndex = (value, length) => Number.isInteger(value) && value >= 0 && value < length;
const isOptionalIndex = (value, length) => value === null || isIndex(value, length);

/**
 * Checks one event against the state it is about to be applied to.
 * Used by tests and by the trace verifier; the player trusts its input.
 *
 * @param {SortEvent} event
 * @param {{ array: number[], aux: (number|null)[]|null }} state  State before the event.
 * @param {number} lineCount  Number of pseudocode lines.
 * @returns {string|null} A description of the problem, or null if the event is well-formed.
 */
export function validateEvent(event, state, lineCount) {
  if (!event || typeof event !== 'object') return 'event is not an object';
  if (!KNOWN_TYPES.has(event.type)) return `unknown type "${event.type}"`;
  if (!Number.isInteger(event.line) || event.line < 1 || event.line > lineCount) {
    return `${event.type}: line ${event.line} outside 1..${lineCount}`;
  }
  const n = state.array.length;
  const auxSize = state.aux ? state.aux.length : 0;

  switch (event.type) {
    case EventType.COMPARE: {
      const size = event.target === 'aux' ? auxSize : n;
      if (event.target !== 'main' && event.target !== 'aux') return `compare: bad target ${event.target}`;
      if (!isIndex(event.i, size) || !isIndex(event.j, size)) return `compare: index out of range (${event.i}, ${event.j})`;
      if (event.i === event.j) return 'compare: an element is compared with itself';
      if (event.target === 'aux' && (state.aux[event.i] === null || state.aux[event.j] === null)) {
        return 'compare: empty aux cell';
      }
      return null;
    }
    case EventType.SWAP:
      if (!isIndex(event.i, n) || !isIndex(event.j, n)) return `swap: index out of range (${event.i}, ${event.j})`;
      if (event.i === event.j) return 'swap: an element is swapped with itself';
      return null;
    case EventType.WRITE:
      if (!isIndex(event.i, n)) return `write: index ${event.i} out of range`;
      if (!Number.isFinite(event.value)) return 'write: value is not a finite number';
      if (!isOptionalIndex(event.from, auxSize)) return `write: from ${event.from} outside aux`;
      return null;
    case EventType.AUX_INIT:
      if (!Number.isInteger(event.size) || event.size < 0) return `auxInit: bad size ${event.size}`;
      if (!AUX_KINDS.includes(event.kind)) return `auxInit: bad kind ${event.kind}`;
      if (!Number.isFinite(event.base)) return 'auxInit: base is not a number';
      return null;
    case EventType.AUX_COPY:
      if (!state.aux || state.auxKind !== 'buffer') return 'auxCopy: no buffer allocated';
      if (!isIndex(event.lo, n) || !isIndex(event.hi, n) || event.lo > event.hi) return 'auxCopy: bad range';
      if (event.hi >= auxSize) return 'auxCopy: range exceeds buffer';
      return null;
    case EventType.AUX_WRITE:
      if (!isIndex(event.k, auxSize)) return `auxWrite: index ${event.k} outside aux`;
      if (!Number.isFinite(event.value)) return 'auxWrite: value is not a finite number';
      if (!isOptionalIndex(event.from, n)) return `auxWrite: from ${event.from} out of range`;
      return null;
    case EventType.SORTED:
      if (!Array.isArray(event.indices) || event.indices.length === 0) return 'sorted: no indices';
      if (!event.indices.every((i) => isIndex(i, n))) return 'sorted: index out of range';
      return null;
    case EventType.PIVOT:
      return isOptionalIndex(event.i, n) ? null : `pivot: index ${event.i} out of range`;
    case EventType.RANGE:
      if (event.lo === null && event.hi === null) return null;
      if (!isIndex(event.lo, n) || !isIndex(event.hi, n) || event.lo > event.hi) return 'range: bad bounds';
      return null;
    case EventType.MARK:
      if (!MARK_ROLES.includes(event.role)) return `mark: unknown role ${event.role}`;
      return isOptionalIndex(event.i, n) ? null : `mark: index ${event.i} out of range`;
    case EventType.PHASE:
      return PHASES.includes(event.name) ? null : `phase: unknown name ${event.name}`;
    default:
      return `unhandled type ${event.type}`;
  }
}
