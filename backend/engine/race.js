/**
 * Compare mode: several algorithms sort the same input on one shared clock.
 *
 * The clock counts array operations, not events, so the race is fair:
 * one comparison, one swap or one array write costs one tick, while purely
 * visual events (pivot, range, phase, ...) are free. At time `t` every lane
 * shows the state after its first `t` operations.
 *
 * @module engine/race
 */

import { EventType } from './events.js';
import { Player } from './player.js';

/**
 * Operations an event costs on the race clock.
 * @param {import('./events.js').SortEvent} event
 * @returns {number}
 */
export function eventCost(event) {
  switch (event.type) {
    case EventType.COMPARE:
    case EventType.SWAP:
    case EventType.WRITE:
    case EventType.AUX_WRITE:
      return 1;
    case EventType.AUX_COPY:
      return event.hi - event.lo + 1;
    default:
      return 0;
  }
}

/**
 * Prefix sums of event costs: `cum[c]` is the cost of the first `c` events.
 * @param {import('./events.js').SortEvent[]} events
 * @returns {number[]}
 */
export function cumulativeCosts(events) {
  const cum = new Array(events.length + 1);
  cum[0] = 0;
  events.forEach((event, index) => {
    cum[index + 1] = cum[index] + eventCost(event);
  });
  return cum;
}

/**
 * Largest cursor `c` whose cost `cum[c]` fits in `time` (binary search).
 * Free events right after the last paid one are included.
 * @param {number[]} cum
 * @param {number} time
 */
export function cursorAtTime(cum, time) {
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (cum[mid] <= time) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Ranks lanes by total operations; equal totals share a rank.
 * @param {{id: string, totalOps: number}[]} lanes
 * @returns {{id: string, totalOps: number, rank: number}[]}
 */
export function rankLanes(lanes) {
  const ordered = [...lanes].sort((a, b) => a.totalOps - b.totalOps);
  let rank = 0;
  return ordered.map((lane, index) => {
    if (index === 0 || lane.totalOps !== ordered[index - 1].totalOps) rank = index + 1;
    return { id: lane.id, totalOps: lane.totalOps, rank };
  });
}

/**
 * @typedef {Object} Lane
 * @property {string} id
 * @property {Player} player
 * @property {number[]} cum
 * @property {number} totalOps
 */

export class Race {
  /** @type {Lane[]} */ #lanes;
  #time = 0;

  /**
   * @param {{id: string, input: number[], events: import('./events.js').SortEvent[]}[]} entries
   */
  constructor(entries) {
    this.#lanes = entries.map(({ id, input, events }) => {
      const cum = cumulativeCosts(events);
      return { id, player: new Player(input, events), cum, totalOps: cum[cum.length - 1] };
    });
    this.#sync();
  }

  /** @returns {readonly Lane[]} */
  get lanes() {
    return this.#lanes;
  }

  /** Operations elapsed on the shared clock. */
  get time() {
    return this.#time;
  }

  /** Time at which the slowest lane finishes. */
  get duration() {
    return Math.max(0, ...this.#lanes.map((lane) => lane.totalOps));
  }

  get atStart() {
    return this.#time === 0;
  }

  get atEnd() {
    return this.#time >= this.duration;
  }

  /**
   * @param {Lane} lane
   * @returns {boolean} whether the lane has finished at the current time
   */
  isFinished(lane) {
    return this.#time >= lane.totalOps;
  }

  /** Final ranking (by total operations). */
  rankings() {
    return rankLanes(this.#lanes);
  }

  /**
   * Moves the shared clock to `time` (clamped to 0..duration).
   * @param {number} time
   */
  seek(time) {
    this.#time = Math.min(Math.max(Math.round(Number(time) || 0), 0), this.duration);
    this.#sync();
  }

  /** @param {number} [ops] */
  stepForward(ops = 1) {
    if (this.atEnd) return false;
    this.seek(this.#time + ops);
    return true;
  }

  /** @param {number} [ops] */
  stepBack(ops = 1) {
    if (this.atStart) return false;
    this.seek(this.#time - ops);
    return true;
  }

  reset() {
    this.seek(0);
  }

  toEnd() {
    this.seek(this.duration);
  }

  #sync() {
    for (const lane of this.#lanes) lane.player.seek(cursorAtTime(lane.cum, this.#time));
  }
}
