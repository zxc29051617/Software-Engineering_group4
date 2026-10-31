// Pure UI logic: bar colouring, prediction answers, shortcuts, share links,
// playback timing, storage and small formatting helpers.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { algorithmIds } from '../backend/algorithms/index.js';
import * as ev from '../backend/engine/events.js';
import { applyEvent, createState } from '../backend/engine/state.js';
import { PRESETS, SIZE_LIMITS } from '../backend/input/presets.js';
import { auxScaleFor, describeBar, highlightsFor } from '../frontend/src/components/highlights.js';
import { propertyKey } from '../frontend/src/components/info-panel.js';
import { compareLeadsToSwap } from '../frontend/src/components/predict-panel.js';
import { progressPercent } from '../frontend/src/components/stats-panel.js';
import { DEFAULT_RACE, normalizeSelection } from '../frontend/src/controllers/race-mode.js';
import { clampSpeedIndex, createLoop, DEFAULT_SPEED_INDEX, MAX_FRAME_MS, SPEEDS, speedAt, stepsDue } from '../frontend/src/services/scheduler.js';
import { buildShareQuery, parseShareQuery } from '../frontend/src/services/share-link.js';
import { actionForKey } from '../frontend/src/services/shortcuts.js';
import { FREQUENCY_RANGE, frequencyFor } from '../frontend/src/services/sound.js';
import { loadPrefs, savePrefs } from '../frontend/src/services/storage.js';

describe('bar highlights', () => {
  test('each event type highlights the right bars', () => {
    assert.deepEqual([...highlightsFor(ev.compare(1, 2, 1)).main], [[1, 'compare'], [2, 'compare']]);
    assert.deepEqual([...highlightsFor(ev.compare(0, 3, 1, 'aux')).aux], [[0, 'compare'], [3, 'compare']]);
    assert.deepEqual([...highlightsFor(ev.swap(4, 5, 1)).main], [[4, 'swap'], [5, 'swap']]);
    const write = highlightsFor(ev.write(2, 9, 1, 7));
    assert.deepEqual([...write.main], [[2, 'write']]);
    assert.deepEqual([...write.aux], [[7, 'read']]);
    const count = highlightsFor(ev.auxWrite(3, 1, 1, 0));
    assert.deepEqual([...count.aux], [[3, 'write']]);
    assert.deepEqual([...count.main], [[0, 'read']]);
    assert.equal(highlightsFor(ev.auxCopy(1, 3, 1)).main.size, 3);
    assert.equal(highlightsFor(ev.sorted([0], 1)).main.size, 0);
    assert.equal(highlightsFor(null).main.size, 0);
  });

  test('describeBar: action beats sorted, sorted beats pivot, pointers hide on sorted bars', () => {
    const state = createState([3, 1, 2, 4]);
    applyEvent(state, ev.pivot(3, 1));
    applyEvent(state, ev.mark('boundary', 0, 1));
    applyEvent(state, ev.range(0, 2, 1));
    applyEvent(state, ev.sorted([2], 1));
    const none = new Map();
    assert.deepEqual(describeBar(state, 3, none, false), { state: 'pivot', dim: true, tags: ['pivot'] });
    assert.deepEqual(describeBar(state, 0, none, false), { state: 'default', dim: false, tags: ['boundary'] });
    assert.equal(describeBar(state, 2, none, false).state, 'sorted');
    assert.equal(describeBar(state, 2, new Map([[2, 'swap']]), false).state, 'swap');
    assert.equal(describeBar(state, 3, new Map([[3, 'compare']]), false).dim, false, 'an active bar is never dimmed');
    applyEvent(state, ev.range(0, 1, 1));
    assert.equal(describeBar(state, 2, none, false).dim, false, 'a bar in its final place is never dimmed');
    applyEvent(state, ev.range(0, 2, 1));
    applyEvent(state, ev.mark('boundary', 2, 1));
    assert.deepEqual(describeBar(state, 2, none, false).tags, []);
    assert.deepEqual(describeBar(state, 1, none, true), { state: 'sorted', dim: false, tags: [] });
  });

  test('auxScaleFor keeps the auxiliary row on a fixed scale', () => {
    assert.equal(auxScaleFor([ev.auxWrite(0, 3, 1), ev.auxWrite(1, 5, 1)], 50), 5);
    assert.equal(auxScaleFor([ev.auxCopy(0, 3, 1)], 50), 50);
    assert.equal(auxScaleFor([], 50), 1);
  });
});

describe('prediction quiz', () => {
  test('a compare "leads to a swap" only when the next event swaps the same pair', () => {
    const compare = ev.compare(2, 3, 1);
    assert.equal(compareLeadsToSwap(compare, ev.swap(2, 3, 1)), true);
    assert.equal(compareLeadsToSwap(compare, ev.swap(1, 2, 1)), false);
    assert.equal(compareLeadsToSwap(compare, ev.compare(3, 4, 1)), false);
    assert.equal(compareLeadsToSwap(compare, null), false);
  });
});

describe('keyboard shortcuts', () => {
  const key = (k, extra = {}) => actionForKey({ key: k, target: { tagName: 'BODY' }, ...extra });

  test('map keys to actions', () => {
    assert.equal(key(' '), 'togglePlay');
    assert.equal(key('ArrowRight'), 'forward');
    assert.equal(key('ArrowLeft'), 'back');
    assert.equal(key('Home'), 'reset');
    assert.equal(key('End'), 'end');
    assert.equal(key('ArrowUp'), 'faster');
    assert.equal(key('ArrowDown'), 'slower');
    assert.equal(key(']'), 'nextAlgorithm');
    assert.equal(key('['), 'previousAlgorithm');
    assert.equal(key('N'), 'shuffle');
    assert.equal(key('n'), 'shuffle');
    assert.equal(key('?'), 'help');
    assert.equal(key('x'), null);
  });

  test('leave keys alone in text fields, with modifiers, and for focused buttons', () => {
    assert.equal(key('ArrowRight', { target: { tagName: 'INPUT', type: 'text' } }), null);
    assert.equal(key('n', { target: { tagName: 'TEXTAREA' } }), null);
    assert.equal(key('n', { target: { tagName: 'DIV', isContentEditable: true } }), null);
    assert.equal(key('ArrowRight', { ctrlKey: true }), null);
    assert.equal(key('r', { metaKey: true }), null);
    assert.equal(key(' ', { target: { tagName: 'BUTTON' } }), null, 'the browser clicks the button');
    assert.equal(key('ArrowRight', { target: { tagName: 'BUTTON' } }), 'forward');
  });

  test('sliders keep their arrow keys but not Space; checkboxes keep Space', () => {
    const slider = { tagName: 'INPUT', type: 'range' };
    assert.equal(key('ArrowRight', { target: slider }), null);
    assert.equal(key(' ', { target: slider }), 'togglePlay');
    const checkbox = { tagName: 'INPUT', type: 'checkbox' };
    assert.equal(key(' ', { target: checkbox }), null);
    assert.equal(key('n', { target: checkbox }), 'shuffle');
  });
});

describe('share links', () => {
  const options = { algorithmIds: algorithmIds(), presets: PRESETS, sizeLimits: SIZE_LIMITS };

  test('round-trip a preset configuration', () => {
    const query = buildShareQuery({ mode: 'single', algorithm: 'quick', preset: 'sorted', size: 30, seed: 42, values: null });
    assert.equal(query, '?algo=quick&preset=sorted&n=30&seed=42');
    assert.deepEqual(parseShareQuery(query, options), { algorithm: 'quick', preset: 'sorted', size: 30, seed: 42 });
  });

  test('round-trip custom data and compare mode', () => {
    const query = buildShareQuery({ mode: 'race', algorithms: ['bubble', 'merge'], values: [5, 3, 8] });
    const parsed = parseShareQuery(query, options);
    assert.deepEqual(parsed, { mode: 'race', algorithms: ['bubble', 'merge'], values: [5, 3, 8] });
  });

  test('ignores invalid or hostile values', () => {
    const parsed = parseShareQuery('?algo=evil&algos=bubble,nope,bubble&data=1,x&preset=zigzag&n=5000&seed=-3&mode=party', options);
    assert.deepEqual(parsed, {});
    assert.deepEqual(parseShareQuery('?algos=bubble,quick,bubble', options).algorithms, ['bubble', 'quick']);
  });
});

describe('playback timing', () => {
  test('speed table is increasing and the default is valid', () => {
    assert.ok(SPEEDS.every((v, i) => i === 0 || v > SPEEDS[i - 1]));
    assert.equal(speedAt(DEFAULT_SPEED_INDEX), SPEEDS[DEFAULT_SPEED_INDEX]);
    assert.equal(speedAt(-4), SPEEDS[0]);
    assert.equal(speedAt(999), SPEEDS.at(-1));
    assert.equal(clampSpeedIndex('abc'), DEFAULT_SPEED_INDEX);
    assert.equal(clampSpeedIndex(3.6), 4);
  });

  test('stepsDue converts elapsed time into whole steps and carries the rest', () => {
    assert.deepEqual(stepsDue(0, 100, 10), { steps: 1, carry: 0 });
    let carry = 0;
    let total = 0;
    for (let frame = 0; frame < 60; frame += 1) {
      const due = stepsDue(carry, 1000 / 60, 2);
      carry = due.carry;
      total += due.steps;
    }
    assert.equal(total, 2, 'two steps per second over one second of frames');
    assert.equal(stepsDue(0, 10_000, 100).steps, (MAX_FRAME_MS / 1000) * 100, 'long pauses are capped');
    assert.equal(stepsDue(0, -5, 100).steps, 0);
  });

  test('createLoop starts, reports elapsed time, and stops', () => {
    let clock = 0;
    const queue = [];
    const frames = [];
    const loop = createLoop((elapsed) => frames.push(elapsed), {
      now: () => clock,
      requestFrame: (cb) => queue.push(cb),
      cancelFrame: () => queue.pop(),
    });
    loop.start();
    loop.start();
    assert.equal(queue.length, 1, 'starting twice does not double the loop');
    clock = 16;
    queue.shift()();
    clock = 40;
    queue.shift()();
    assert.deepEqual(frames, [16, 24]);
    assert.ok(loop.running);
    loop.stop();
    assert.equal(loop.running, false);
  });
});

describe('small helpers', () => {
  test('progressPercent', () => {
    assert.equal(progressPercent(0, 0), 100);
    assert.equal(progressPercent(10, 10), 0);
    assert.equal(progressPercent(10, 4), 60);
  });

  test('propertyKey', () => {
    assert.equal(propertyKey(true), 'info.yes');
    assert.equal(propertyKey(false), 'info.no');
    assert.equal(propertyKey(null), 'info.na');
  });

  test('frequencyFor maps values onto the audible range', () => {
    assert.equal(frequencyFor(0, 10), FREQUENCY_RANGE.low);
    assert.equal(frequencyFor(10, 10), FREQUENCY_RANGE.high);
    assert.equal(frequencyFor(50, 10), FREQUENCY_RANGE.high);
    assert.equal(frequencyFor(5, 0), FREQUENCY_RANGE.low);
  });

  test('normalizeSelection keeps known ids in registry order', () => {
    assert.deepEqual(normalizeSelection(['quick', 'nope', 'bubble', 'quick']), ['bubble', 'quick']);
    assert.ok(DEFAULT_RACE.length >= 2);
  });

  test('preferences survive a round trip and broken storage is ignored', () => {
    const memory = new Map();
    const storage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v) };
    savePrefs({ lang: 'en' }, storage);
    savePrefs({ theme: 'dark' }, storage);
    assert.deepEqual(loadPrefs(storage), { lang: 'en', theme: 'dark' });
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    assert.deepEqual(loadPrefs(broken), {});
    assert.doesNotThrow(() => savePrefs({ lang: 'en' }, broken));
    memory.set('bubble-sort-visualizer:v2', '{not json');
    assert.deepEqual(loadPrefs(storage), {});
  });
});
