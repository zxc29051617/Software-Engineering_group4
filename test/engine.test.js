// State replay and the step-by-step player (forward, back, seek, reset).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { ALGORITHMS, getAlgorithm } from '../backend/algorithms/index.js';
import * as ev from '../backend/engine/events.js';
import { Player } from '../backend/engine/player.js';
import { applyEvent, cloneState, createState, replay } from '../backend/engine/state.js';
import { MAX_EVENTS, recordTrace } from '../backend/engine/trace.js';
import { generatePreset } from '../backend/input/presets.js';
import { createRng, randomInt } from '../backend/input/random.js';

/** Comparable snapshot of the parts of a state the UI draws. */
function snapshot(state) {
  return {
    array: state.array.slice(),
    aux: state.aux ? state.aux.slice() : null,
    auxKind: state.auxKind,
    sorted: Array.from(state.sorted),
    sortedCount: state.sortedCount,
    pivot: state.pivot,
    range: state.range,
    marks: { ...state.marks },
    phase: state.phase,
    last: state.last,
    line: state.line,
    stats: { ...state.stats },
  };
}

/** State after the first `count` events, computed the slow, obvious way. */
function naiveStateAt(input, events, count) {
  return snapshot(replay(input, events.slice(0, count)));
}

describe('state', () => {
  test('createState copies the input and starts with zero counters', () => {
    const input = [3, 1, 2];
    const state = createState(input);
    state.array[0] = 99;
    assert.deepEqual(input, [3, 1, 2]);
    assert.deepEqual(state.stats, { comparisons: 0, swaps: 0, writes: 0, auxWrites: 0 });
    assert.equal(state.last, null);
    assert.equal(state.line, 0);
  });

  test('applyEvent updates arrays, marks and counters', () => {
    const state = createState([3, 1, 2]);
    applyEvent(state, ev.compare(0, 1, 2));
    applyEvent(state, ev.swap(0, 1, 3));
    applyEvent(state, ev.write(2, 7, 4));
    applyEvent(state, ev.sorted([0, 0], 5));
    applyEvent(state, ev.pivot(1, 6));
    applyEvent(state, ev.range(0, 1, 6));
    applyEvent(state, ev.mark('min', 2, 7));
    assert.deepEqual(state.array, [1, 3, 7]);
    assert.deepEqual(state.stats, { comparisons: 1, swaps: 1, writes: 1, auxWrites: 0 });
    assert.equal(state.sortedCount, 1, 'marking the same index twice counts once');
    assert.equal(state.pivot, 1);
    assert.deepEqual(state.range, [0, 1]);
    assert.deepEqual(state.marks, { min: 2 });
    assert.equal(state.line, 7);
    applyEvent(state, ev.mark('min', null, 7));
    applyEvent(state, ev.range(null, null, 7));
    assert.deepEqual(state.marks, {});
    assert.equal(state.range, null);
  });

  test('auxiliary array events track contents, writes and peak size', () => {
    const state = createState([4, 2, 9]);
    applyEvent(state, ev.auxInit(3, 'buffer', 1));
    assert.deepEqual(state.aux, [null, null, null]);
    applyEvent(state, ev.auxCopy(0, 2, 2));
    assert.deepEqual(state.aux, [4, 2, 9]);
    applyEvent(state, ev.auxInit(5, 'count', 3, 10));
    assert.deepEqual(state.aux, [0, 0, 0, 0, 0]);
    applyEvent(state, ev.auxWrite(4, 2, 4));
    assert.equal(state.aux[4], 2);
    assert.equal(state.auxBase, 10);
    assert.equal(state.stats.auxWrites, 4);
    applyEvent(state, ev.auxInit(0, 'count', 5));
    assert.equal(state.aux, null);
    assert.equal(state.auxPeak, 5);
  });

  test('applyEvent rejects unknown events', () => {
    assert.throws(() => applyEvent(createState([1]), { type: 'oops', line: 1 }), /Unknown event type/);
  });

  test('cloneState is independent of the original', () => {
    const state = createState([2, 1]);
    applyEvent(state, ev.mark('min', 0, 1));
    const copy = cloneState(state);
    applyEvent(state, ev.swap(0, 1, 1));
    applyEvent(state, ev.sorted([0], 1));
    applyEvent(state, ev.mark('min', 1, 1));
    assert.deepEqual(copy.array, [2, 1]);
    assert.equal(copy.sorted[0], 0);
    assert.deepEqual(copy.marks, { min: 0 });
    assert.equal(copy.stats.swaps, 0);
  });
});

describe('recordTrace', () => {
  test('returns the events and leaves the input untouched', () => {
    const input = [3, 2, 1];
    const trace = recordTrace(getAlgorithm('bubble'), input);
    assert.deepEqual(input, [3, 2, 1]);
    assert.deepEqual(trace.output, [1, 2, 3]);
    assert.ok(trace.events.length > 0);
    assert.equal(trace.algorithmId, 'bubble');
  });

  test('stops a runaway generator', () => {
    const endless = {
      id: 'endless',
      *sort() {
        for (;;) yield ev.compare(0, 1, 1);
      },
    };
    assert.throws(() => recordTrace(endless, [1, 2], { maxEvents: 100 }), RangeError);
    assert.ok(MAX_EVENTS >= 1_000_000);
  });
});

describe('Player', () => {
  const input = [5, 1, 4, 2, 3];
  const { events } = recordTrace(getAlgorithm('bubble'), input);

  test('starts at the input and walks forward to the sorted result', () => {
    const player = new Player(input, events, { checkpointInterval: 4 });
    assert.equal(player.cursor, 0);
    assert.ok(player.atStart);
    assert.deepEqual(player.state.array, input);
    let steps = 0;
    while (player.stepForward()) steps += 1;
    assert.equal(steps, events.length);
    assert.ok(player.atEnd);
    assert.deepEqual(player.state.array, [1, 2, 3, 4, 5]);
    assert.equal(player.stepForward(), false, 'no step past the end');
  });

  test('stepBack undoes exactly one event each time', () => {
    const player = new Player(input, events, { checkpointInterval: 4 });
    player.toEnd();
    for (let cursor = events.length; cursor > 0; cursor -= 1) {
      assert.deepEqual(snapshot(player.state), naiveStateAt(input, events, cursor), `cursor ${cursor}`);
      assert.equal(player.stepBack(), true);
    }
    assert.ok(player.atStart);
    assert.deepEqual(snapshot(player.state), naiveStateAt(input, events, 0));
    assert.equal(player.stepBack(), false, 'no step before the start');
  });

  test('forward then back returns to the same state', () => {
    const player = new Player(input, events, { checkpointInterval: 3 });
    player.seek(7);
    const before = snapshot(player.state);
    player.stepForward();
    player.stepForward();
    player.stepBack();
    player.stepBack();
    assert.deepEqual(snapshot(player.state), before);
  });

  test('reset returns to the input after any amount of playback', () => {
    const player = new Player(input, events);
    player.seek(10);
    player.reset();
    assert.equal(player.cursor, 0);
    assert.deepEqual(player.state.array, input);
    assert.equal(player.state.stats.comparisons, 0);
    assert.equal(player.state.last, null);
  });

  test('seek clamps to the valid range and accepts odd values', () => {
    const player = new Player(input, events);
    player.seek(-5);
    assert.equal(player.cursor, 0);
    player.seek(10_000);
    assert.equal(player.cursor, events.length);
    player.seek('3');
    assert.equal(player.cursor, 3);
    player.seek(Number.NaN);
    assert.equal(player.cursor, 0);
  });

  test('random seeks match a fresh replay for every algorithm', () => {
    const rng = createRng(7);
    for (const algorithm of ALGORITHMS) {
      const data = generatePreset('random', 24, 11);
      const trace = recordTrace(algorithm, data);
      const player = new Player(data, trace.events, { checkpointInterval: 16 });
      for (let k = 0; k < 25; k += 1) {
        const target = randomInt(rng, 0, trace.events.length);
        player.seek(target);
        assert.deepEqual(snapshot(player.state), naiveStateAt(data, trace.events, target), `${algorithm.id} @${target}`);
      }
    }
  });

  test('peek shows upcoming events without moving', () => {
    const player = new Player(input, events);
    assert.equal(player.peek(), events[0]);
    assert.equal(player.peek(1), events[1]);
    assert.equal(player.cursor, 0);
    player.toEnd();
    assert.equal(player.peek(), null);
  });

  test('finalState has the totals of the whole run', () => {
    const player = new Player(input, events);
    assert.deepEqual(player.finalState.array, [1, 2, 3, 4, 5]);
    assert.equal(player.finalState.sortedCount, input.length);
    assert.equal(player.state.stats.comparisons, 0, 'current state is still the start');
  });

  test('works with an empty trace and rejects a bad checkpoint interval', () => {
    const player = new Player([], []);
    assert.ok(player.atStart && player.atEnd);
    assert.equal(player.stepForward(), false);
    assert.throws(() => new Player([1], [], { checkpointInterval: 0 }), RangeError);
  });
});
