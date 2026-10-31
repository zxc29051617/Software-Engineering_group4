/**
 * Step-by-step playback of a recorded trace, forwards and backwards.
 *
 * Stepping forward applies the next event. Stepping back (or seeking anywhere)
 * restores the nearest saved checkpoint and replays from there, so every
 * position costs at most `checkpointInterval` event applications.
 *
 * @module engine/player
 */

import { applyEvent, cloneState, createState } from './state.js';

const DEFAULT_INTERVAL = 64;

export class Player {
  /** @type {number[]} */ #input;
  /** @type {import('./events.js').SortEvent[]} */ #events;
  /** @type {number} */ #interval;
  /** @type {import('./state.js').SortState[]} */ #checkpoints = [];
  /** @type {import('./state.js').SortState} */ #state;
  /** @type {import('./state.js').SortState} */ #final;
  #cursor = 0;

  /**
   * @param {number[]} input
   * @param {import('./events.js').SortEvent[]} events
   * @param {{checkpointInterval?: number}} [options]
   */
  constructor(input, events, { checkpointInterval = DEFAULT_INTERVAL } = {}) {
    if (!Number.isInteger(checkpointInterval) || checkpointInterval < 1) {
      throw new RangeError('checkpointInterval must be a positive integer');
    }
    this.#input = input.slice();
    this.#events = events;
    this.#interval = checkpointInterval;

    const state = createState(this.#input);
    this.#checkpoints.push(cloneState(state));
    events.forEach((event, index) => {
      applyEvent(state, event);
      if ((index + 1) % checkpointInterval === 0) this.#checkpoints.push(cloneState(state));
    });
    this.#final = state;
    this.#state = createState(this.#input);
  }

  /** Number of events (the last valid cursor). */
  get length() {
    return this.#events.length;
  }

  /** Number of events applied so far (0 = initial input). */
  get cursor() {
    return this.#cursor;
  }

  /** State at the cursor. Treat as read-only. */
  get state() {
    return this.#state;
  }

  /** State after the last event (totals for the whole run). Treat as read-only. */
  get finalState() {
    return this.#final;
  }

  /** The input array this player started from. */
  get input() {
    return this.#input.slice();
  }

  get atStart() {
    return this.#cursor === 0;
  }

  get atEnd() {
    return this.#cursor === this.#events.length;
  }

  /**
   * The event `offset` positions after the cursor (0 = the next one), or null.
   * @param {number} [offset]
   */
  peek(offset = 0) {
    return this.#events[this.#cursor + offset] ?? null;
  }

  /** Applies the next event. Returns false when already at the end. */
  stepForward() {
    if (this.atEnd) return false;
    applyEvent(this.#state, this.#events[this.#cursor]);
    this.#cursor += 1;
    return true;
  }

  /** Undoes the last event. Returns false when already at the start. */
  stepBack() {
    if (this.atStart) return false;
    this.seek(this.#cursor - 1);
    return true;
  }

  /**
   * Moves the cursor to `target` (clamped to 0..length).
   * @param {number} target
   */
  seek(target) {
    const goal = Math.min(Math.max(Math.round(Number(target) || 0), 0), this.length);
    if (goal === this.#cursor) return;
    if (goal > this.#cursor && goal - this.#cursor <= this.#interval) {
      while (this.#cursor < goal) this.stepForward();
      return;
    }
    const slot = Math.floor(goal / this.#interval);
    const state = cloneState(this.#checkpoints[slot]);
    for (let index = slot * this.#interval; index < goal; index += 1) {
      applyEvent(state, this.#events[index]);
    }
    this.#state = state;
    this.#cursor = goal;
  }

  /** Back to the initial input. */
  reset() {
    this.seek(0);
  }

  /** Jump to the sorted result. */
  toEnd() {
    this.seek(this.length);
  }
}
