// Translations: both languages complete, placeholders consistent, every key
// used by the page and by the narration actually exists.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import { ALGORITHMS } from '../backend/algorithms/index.js';
import { describeDone, describeStep } from '../backend/engine/describe.js';
import { Player } from '../backend/engine/player.js';
import { recordTrace } from '../backend/engine/trace.js';
import { parseNumberList } from '../backend/input/parse.js';
import { generatePreset, PRESETS } from '../backend/input/presets.js';
import { inputErrorMessage } from '../frontend/src/components/data-panel.js';
import {
  createTranslator,
  DEFAULT_LANGUAGE,
  DICTIONARIES,
  format,
  LANGUAGES,
  normalizeLanguage,
  translateMessage,
} from '../frontend/src/i18n/index.js';

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('dictionaries', () => {
  const zh = DICTIONARIES['zh-Hant'];
  const en = DICTIONARIES.en;

  test('Traditional Chinese is the default and both languages are available', () => {
    assert.equal(DEFAULT_LANGUAGE, 'zh-Hant');
    assert.deepEqual([...LANGUAGES].sort(), ['en', 'zh-Hant']);
  });

  test('both languages define exactly the same keys', () => {
    assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
  });

  test('no empty strings and the same placeholders in both languages', () => {
    for (const key of Object.keys(zh)) {
      assert.ok(zh[key].trim() && en[key].trim(), key);
      assert.deepEqual(placeholders(en[key]), placeholders(zh[key]), key);
    }
  });

  test('every algorithm, preset and error code has its texts', () => {
    for (const { id } of ALGORITHMS) {
      for (const field of ['name', 'short', 'desc', 'tip']) assert.ok(zh[`algo.${id}.${field}`], `${id}.${field}`);
    }
    for (const preset of PRESETS) assert.ok(zh[`preset.${preset}`], preset);
    for (const code of ['empty', 'not-integer', 'out-of-range', 'too-few', 'too-many']) assert.ok(zh[`error.${code}`], code);
  });

  test('every data-i18n key used in index.html exists', () => {
    const keys = [
      ...[...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]),
      ...[...html.matchAll(/data-i18n-attr="([^"]+)"/g)].flatMap((m) => m[1].split(';').map((pair) => pair.split(':')[1].trim())),
    ];
    assert.ok(keys.length > 50);
    for (const key of keys) assert.ok(key in zh, `missing key ${key}`);
  });

  test('the page is declared as Traditional Chinese', () => {
    assert.match(html, /<html lang="zh-Hant">/);
  });
});

describe('translator', () => {
  test('fills placeholders and leaves unknown ones visible', () => {
    const t = createTranslator('en');
    assert.equal(t('controls.speedValue', { value: 8 }), '8 steps/s');
    assert.equal(format('{a} and {b}', { a: 1 }, t), '1 and {b}');
  });

  test('translates nested messages', () => {
    const t = createTranslator('zh-Hant');
    assert.equal(t('narr.phase.digit', { place: { key: 'place.1', params: {} } }), '依十位的數字把元素分到桶子');
  });

  test('falls back to Chinese for unknown languages and to the key for unknown keys', () => {
    assert.equal(normalizeLanguage('fr'), 'zh-Hant');
    assert.equal(createTranslator('fr')('mode.race'), '比較模式');
    assert.equal(createTranslator('en')('no.such.key'), 'no.such.key');
  });
});

describe('narration and error messages are complete', () => {
  /** Translates and checks that no `{placeholder}` was left unfilled. */
  function assertComplete(t, message, context) {
    assert.ok(message.key in DICTIONARIES['zh-Hant'], `${context}: missing key ${message.key}`);
    const text = translateMessage(t, message);
    assert.doesNotMatch(text, /\{\w+\}/, `${context}: ${text}`);
    assert.doesNotMatch(text, /undefined|NaN/, `${context}: ${text}`);
  }

  test('every step of every algorithm can be narrated in both languages', () => {
    const inputs = [generatePreset('random', 12, 4), generatePreset('few-unique', 12, 4), [0, 1000, 5, 12000, 3]];
    for (const lang of LANGUAGES) {
      const t = createTranslator(lang);
      for (const algorithm of ALGORITHMS) {
        for (const input of inputs) {
          const { events } = recordTrace(algorithm, input);
          const player = new Player(input, events);
          assertComplete(t, describeStep(player.state), `${lang} ${algorithm.id} start`);
          while (player.stepForward()) {
            const where = `${lang} ${algorithm.id} #${player.cursor}`;
            assertComplete(t, describeStep(player.state), where);
            assertComplete(t, describeStep(player.state, { hideOutcome: true }), `${where} hidden`);
          }
          assertComplete(t, describeDone(player.state, player.length), `${lang} ${algorithm.id} done`);
        }
      }
    }
  });

  test('hidden compares do not reveal the outcome', () => {
    const t = createTranslator('zh-Hant');
    const { events } = recordTrace(ALGORITHMS[0], [2, 1]);
    const player = new Player([2, 1], events);
    while (player.state.last?.type !== 'compare') player.stepForward();
    assert.match(translateMessage(t, describeStep(player.state)), /2 > 1/);
    assert.doesNotMatch(translateMessage(t, describeStep(player.state, { hideOutcome: true })), />/);
  });

  test('every validation error renders a full sentence in both languages', () => {
    const samples = ['', '5, a', '5 1000', '7', Array.from({ length: 101 }, () => '1').join(' ')];
    for (const lang of LANGUAGES) {
      const t = createTranslator(lang);
      for (const sample of samples) {
        const result = parseNumberList(sample);
        assert.equal(result.ok, false);
        const text = inputErrorMessage(result.error, t);
        assert.doesNotMatch(text, /\{\w+\}|undefined/, `${lang}: ${text}`);
      }
    }
    assert.equal(
      inputErrorMessage(parseNumberList('5, a').error, createTranslator('zh-Hant')),
      '第 2 個值「a」不是整數。',
    );
  });
});
