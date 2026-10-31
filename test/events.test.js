// Event constructors, validation, and the trace verifier used as test oracle.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { ALGORITHMS } from '../backend/algorithms/index.js';
import * as ev from '../backend/engine/events.js';
import { createState } from '../backend/engine/state.js';
import { recordTrace } from '../backend/engine/trace.js';
import { verifyTrace } from '../backend/engine/verify.js';
import { generatePreset } from '../backend/input/presets.js';

const LINES = 10;

describe('event constructors', () => {
  test('build plain objects with type and line', () => {
    assert.deepEqual(ev.compare(1, 2, 3), { type: 'compare', i: 1, j: 2, target: 'main', line: 3 });
    assert.deepEqual(ev.compare(1, 2, 3, 'aux').target, 'aux');
    assert.deepEqual(ev.swap(0, 4, 7), { type: 'swap', i: 0, j: 4, line: 7 });
    assert.deepEqual(ev.write(2, 9, 5), { type: 'write', i: 2, value: 9, from: null, line: 5 });
    assert.deepEqual(ev.auxInit(4, 'count', 3, 10), { type: 'auxInit', size: 4, kind: 'count', base: 10, line: 3 });
    assert.deepEqual(ev.sorted([1, 2], 9), { type: 'sorted', indices: [1, 2], line: 9 });
    assert.deepEqual(ev.phase('gap', 4, 13), { type: 'phase', name: 'gap', value: 13, line: 4 });
  });

  test('isMutation is true only for events that change data', () => {
    assert.equal(ev.isMutation(ev.swap(0, 1, 1)), true);
    assert.equal(ev.isMutation(ev.write(0, 1, 1)), true);
    assert.equal(ev.isMutation(ev.auxWrite(0, 1, 1)), true);
    assert.equal(ev.isMutation(ev.compare(0, 1, 1)), false);
    assert.equal(ev.isMutation(ev.sorted([0], 1)), false);
    assert.equal(ev.isMutation(ev.pivot(0, 1)), false);
  });
});

describe('validateEvent', () => {
  const state = createState([5, 3, 8, 1]);

  test('accepts well-formed events', () => {
    for (const event of [
      ev.compare(0, 3, 1),
      ev.swap(1, 2, 2),
      ev.write(0, 42, 3),
      ev.sorted([0, 1, 2, 3], 4),
      ev.pivot(null, 5),
      ev.range(0, 3, 6),
      ev.range(null, null, 6),
      ev.mark('min', 2, 7),
      ev.phase('pass', 8, 1),
      ev.auxInit(10, 'bucket', 9),
    ]) {
      assert.equal(ev.validateEvent(event, state, LINES), null, JSON.stringify(event));
    }
  });

  test('rejects malformed events with a reason', () => {
    const cases = [
      [{ type: 'teleport', line: 1 }, /unknown type/],
      [ev.compare(0, 1, 0), /line 0/],
      [ev.compare(0, 1, 11), /line 11/],
      [ev.compare(0, 4, 1), /out of range/],
      [ev.compare(2, 2, 1), /itself/],
      [ev.compare(0, 1, 1, 'aux'), /out of range/],
      [ev.swap(-1, 0, 1), /out of range/],
      [ev.swap(3, 3, 1), /itself/],
      [ev.write(0, Number.NaN, 1), /finite/],
      [ev.write(0, 1, 1, 0), /outside aux/],
      [ev.auxInit(-1, 'count', 1), /bad size/],
      [ev.auxInit(3, 'heap', 1), /bad kind/],
      [ev.auxCopy(0, 1, 1), /no buffer/],
      [ev.auxWrite(0, 1, 1), /outside aux/],
      [ev.sorted([], 1), /no indices/],
      [ev.sorted([4], 1), /out of range/],
      [ev.range(3, 1, 1), /bad bounds/],
      [ev.mark('pointer', 1, 1), /unknown role/],
      [ev.phase('dance', 1), /unknown name/],
    ];
    for (const [event, pattern] of cases) {
      assert.match(ev.validateEvent(event, state, LINES) ?? 'valid', pattern, JSON.stringify(event));
    }
  });
});

describe('verifyTrace detects untrustworthy algorithms', () => {
  const lines = ['procedure fake(A)', '  ...', '  ...'];
  const fake = (sort) => ({ id: 'fake', sort, pseudocode: lines });

  test('a swap the events do not mention', () => {
    const silent = fake(function* (a) {
      [a[0], a[1]] = [a[1], a[0]];
      yield ev.sorted([0, 1], 1);
    });
    const { problems } = verifyTrace(silent, [2, 1]);
    assert.ok(problems.some((p) => p.includes('does not reproduce')), problems.join('\n'));
  });

  test('marking an element sorted before it is in place', () => {
    const early = fake(function* (a) {
      yield ev.sorted([0], 1);
      [a[0], a[1]] = [a[1], a[0]];
      yield ev.swap(0, 1, 2);
      yield ev.sorted([1], 3);
    });
    const { problems } = verifyTrace(early, [2, 1]);
    assert.ok(problems.some((p) => p.includes('marked sorted')), problems.join('\n'));
  });

  test('forgetting to mark elements sorted', () => {
    const lazy = fake(function* (a) {
      a.sort((x, y) => x - y);
      yield ev.write(0, a[0], 1);
      yield ev.write(1, a[1], 1);
    });
    const { problems } = verifyTrace(lazy, [2, 1]);
    assert.ok(problems.some((p) => p.includes('0 of 2')), problems.join('\n'));
  });

  test('an out-of-range index', () => {
    const wild = fake(function* () {
      yield ev.compare(0, 5, 1);
    });
    const { problems } = verifyTrace(wild, [2, 1]);
    assert.match(problems[0], /out of range/);
  });
});

describe('algorithm-specific event properties', () => {
  const input = generatePreset('random', 30, 99);

  test('predict-enabled algorithms swap exactly the compared pair when it is out of order', () => {
    for (const algorithm of ALGORITHMS.filter((a) => a.predict)) {
      const { events } = recordTrace(algorithm, input);
      const values = input.slice();
      events.forEach((event, index) => {
        if (event.type === 'compare') {
          const next = events[index + 1];
          const outOfOrder = values[event.i] > values[event.j];
          const swapsPair = next?.type === 'swap' && next.i === event.i && next.j === event.j;
          assert.equal(swapsPair, outOfOrder, `${algorithm.id} event #${index}`);
        }
        if (event.type === 'swap') [values[event.i], values[event.j]] = [values[event.j], values[event.i]];
      });
    }
  });

  test('counting and radix sort never compare elements', () => {
    for (const id of ['counting', 'radix']) {
      const { events } = recordTrace(ALGORITHMS.find((a) => a.id === id), input);
      assert.equal(events.filter((e) => e.type === 'compare').length, 0, id);
    }
  });

  test('only merge, counting and radix use an auxiliary array', () => {
    for (const algorithm of ALGORITHMS) {
      const { events } = recordTrace(algorithm, input);
      const usesAux = events.some((e) => e.type === 'auxInit');
      assert.equal(usesAux, ['merge', 'counting', 'radix'].includes(algorithm.id), algorithm.id);
      assert.equal(usesAux, !algorithm.inPlace, `${algorithm.id} inPlace flag`);
    }
  });

  test('in-place comparison sorts change data only through swaps', () => {
    for (const algorithm of ALGORITHMS.filter((a) => a.inPlace)) {
      const { events } = recordTrace(algorithm, input);
      assert.ok(events.every((e) => e.type !== 'write'), algorithm.id);
    }
  });
});
