/**
 * Runs an algorithm's generator to completion and records its events.
 * @module engine/trace
 */

/** Safety limit so a broken generator cannot freeze the page. */
export const MAX_EVENTS = 2_000_000;

/**
 * @typedef {Object} Trace
 * @property {string} algorithmId
 * @property {number[]} input   Copy of the input array.
 * @property {import('./events.js').SortEvent[]} events
 * @property {number[]} output  The array the generator itself sorted.
 */

/**
 * Records every event an algorithm yields for `input`.
 * The input array is never modified.
 *
 * @param {{id: string, sort: (a: number[]) => Generator}} algorithm
 * @param {number[]} input
 * @param {{maxEvents?: number}} [options]
 * @returns {Trace}
 */
export function recordTrace(algorithm, input, { maxEvents = MAX_EVENTS } = {}) {
  const work = input.slice();
  const events = [];
  for (const event of algorithm.sort(work)) {
    events.push(event);
    if (events.length > maxEvents) {
      throw new RangeError(`${algorithm.id} produced more than ${maxEvents} events`);
    }
  }
  return { algorithmId: algorithm.id, input: input.slice(), events, output: work };
}
