// Compare mode: a shared operation clock over several players.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { getAlgorithm } from '../backend/algorithms/index.js';
import * as ev from '../backend/engine/events.js';
import { cumulativeCosts, cursorAtTime, eventCost, Race, rankLanes } from '../backend/engine/race.js';
import { recordTrace } from '../backend/engine/trace.js';
import { generatePreset } from '../backend/input/presets.js';

function entry(id, input) {
  return { id, input, events: recordTrace(getAlgorithm(id), input).events };
}

describe('operation clock', () => {
  test('array operations cost one tick, visual events are free', () => {
    assert.equal(eventCost(ev.compare(0, 1, 1)), 1);
    assert.equal(eventCost(ev.swap(0, 1, 1)), 1);
    assert.equal(eventCost(ev.write(0, 1, 1)), 1);
    assert.equal(eventCost(ev.auxWrite(0, 1, 1)), 1);
    assert.equal(eventCost(ev.auxCopy(2, 5, 1)), 4);
    for (const free of [ev.sorted([0], 1), ev.pivot(0, 1), ev.range(0, 1, 1), ev.mark('min', 0, 1), ev.phase('pass', 1, 1)]) {
      assert.equal(eventCost(free), 0, free.type);
    }
  });

  test('cursorAtTime includes the free events that follow the last paid one', () => {
    const events = [ev.phase('pass', 1, 1), ev.compare(0, 1, 1), ev.swap(0, 1, 1), ev.sorted([1], 1), ev.compare(0, 1, 1)];
    const cum = cumulativeCosts(events);
    assert.deepEqual(cum, [0, 0, 1, 2, 2, 3]);
    assert.equal(cursorAtTime(cum, 0), 1);
    assert.equal(cursorAtTime(cum, 1), 2);
    assert.equal(cursorAtTime(cum, 2), 4);
    assert.equal(cursorAtTime(cum, 3), 5);
    assert.equal(cursorAtTime(cum, 99), 5);
  });

  test('rankLanes orders by operations and shares ranks on ties', () => {
    const ranks = rankLanes([
      { id: 'a', totalOps: 30 },
      { id: 'b', totalOps: 10 },
      { id: 'c', totalOps: 30 },
      { id: 'd', totalOps: 40 },
    ]);
    assert.deepEqual(
      ranks.map((r) => [r.id, r.rank]),
      [
        ['b', 1],
        ['a', 2],
        ['c', 2],
        ['d', 4],
      ],
    );
  });
});

describe('Race', () => {
  const input = generatePreset('random', 20, 5);
  const ids = ['bubble', 'insertion', 'merge', 'quick'];

  test('every lane starts at the input and ends sorted', () => {
    const race = new Race(ids.map((id) => entry(id, input)));
    assert.equal(race.time, 0);
    for (const lane of race.lanes) assert.deepEqual(lane.player.state.array, input);
    race.toEnd();
    assert.ok(race.atEnd);
    const sorted = input.slice().sort((a, b) => a - b);
    for (const lane of race.lanes) {
      assert.deepEqual(lane.player.state.array, sorted, lane.id);
      assert.ok(race.isFinished(lane));
      assert.ok(lane.player.atEnd, `${lane.id} applied every event`);
    }
  });

  test('lanes spend the same number of operations per tick until they finish', () => {
    const race = new Race(ids.map((id) => entry(id, input)));
    for (let t = 1; t <= 40; t += 1) {
      race.stepForward();
      for (const lane of race.lanes) {
        const { comparisons, swaps, writes, auxWrites } = lane.player.state.stats;
        assert.equal(comparisons + swaps + writes + auxWrites <= t, true, lane.id);
      }
    }
  });

  test('duration is the slowest lane and ranking follows total operations', () => {
    const race = new Race(ids.map((id) => entry(id, input)));
    const totals = race.lanes.map((lane) => lane.totalOps);
    assert.equal(race.duration, Math.max(...totals));
    const ranking = race.rankings();
    assert.equal(ranking[0].totalOps, Math.min(...totals));
    assert.equal(ranking.length, ids.length);
  });

  test('stepping back and seeking are consistent', () => {
    const race = new Race(ids.map((id) => entry(id, input)));
    race.seek(25);
    const arrays = race.lanes.map((lane) => lane.player.state.array.slice());
    race.stepForward(5);
    race.stepBack(5);
    assert.equal(race.time, 25);
    assert.deepEqual(
      race.lanes.map((lane) => lane.player.state.array),
      arrays,
    );
    race.reset();
    assert.ok(race.atStart);
    assert.equal(race.stepBack(), false);
  });

  test('on nearly sorted input insertion sort beats quick sort', () => {
    const nearly = generatePreset('nearly-sorted', 50, 3);
    const race = new Race([entry('insertion', nearly), entry('quick', nearly)]);
    assert.equal(race.rankings()[0].id, 'insertion');
  });
});
