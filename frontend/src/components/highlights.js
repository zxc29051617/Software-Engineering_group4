/**
 * Decides how each bar looks for a given state. Pure functions, so the
 * colour rules are unit-tested without a browser.
 * @module components/highlights
 */

/**
 * Bars touched by the most recent event (shown for one step only).
 * Roles: compare, swap, write (value written here), read (value read from here).
 *
 * @param {import('../../../backend/engine/events.js').SortEvent|null} event
 * @returns {{main: Map<number, string>, aux: Map<number, string>}}
 */
export function highlightsFor(event) {
  const main = new Map();
  const aux = new Map();
  if (!event) return { main, aux };
  switch (event.type) {
    case 'compare': {
      const side = event.target === 'aux' ? aux : main;
      side.set(event.i, 'compare');
      side.set(event.j, 'compare');
      break;
    }
    case 'swap':
      main.set(event.i, 'swap');
      main.set(event.j, 'swap');
      break;
    case 'write':
      main.set(event.i, 'write');
      if (event.from !== null) aux.set(event.from, 'read');
      break;
    case 'auxWrite':
      aux.set(event.k, 'write');
      if (event.from !== null) main.set(event.from, 'read');
      break;
    case 'auxCopy':
      for (let k = event.lo; k <= event.hi; k += 1) {
        main.set(k, 'read');
        aux.set(k, 'write');
      }
      break;
    default:
      break;
  }
  return { main, aux };
}

/**
 * Visual description of main-array bar `index`.
 * Precedence: this step's action, then "sorted", then pivot, then default.
 * Bars outside the active range are dimmed unless they are already in place;
 * pointers and the pivot are hidden on bars that are in place.
 *
 * @param {import('../../../backend/engine/state.js').SortState} state
 * @param {number} index
 * @param {Map<number, string>} transient  from {@link highlightsFor}
 * @param {boolean} done  every event applied: show the plain finished array
 * @returns {{state: string, dim: boolean, tags: string[]}}
 */
export function describeBar(state, index, transient, done) {
  if (done) return { state: 'sorted', dim: false, tags: [] };
  const isSorted = state.sorted[index] === 1;
  const isPivot = state.pivot === index && !isSorted;
  let look = 'default';
  if (transient.has(index)) look = transient.get(index);
  else if (isSorted) look = 'sorted';
  else if (isPivot) look = 'pivot';

  const outside = state.range !== null && (index < state.range[0] || index > state.range[1]);
  const dim = outside && !transient.has(index) && !isSorted;
  const tags = [];
  if (!isSorted) {
    for (const [role, markedIndex] of Object.entries(state.marks)) {
      if (markedIndex === index) tags.push(role);
    }
    if (isPivot) tags.push('pivot');
  }
  return { state: look, dim, tags };
}

/**
 * Largest value the auxiliary row will show during a trace, so its scale
 * stays fixed while the animation runs.
 * @param {import('../../../backend/engine/events.js').SortEvent[]} events
 * @param {number} mainMax  largest value in the input (used for merge's buffer)
 */
export function auxScaleFor(events, mainMax) {
  let max = 1;
  for (const event of events) {
    if (event.type === 'auxWrite' && event.value > max) max = event.value;
    if (event.type === 'auxCopy') max = Math.max(max, mainMax);
  }
  return max;
}
