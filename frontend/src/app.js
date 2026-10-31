/**
 * Entry point: reads preferences and the share link, creates both modes and
 * the shared data panel, and wires the header, keyboard and help dialog.
 * @module app
 */

import { algorithmIds, DEFAULT_ALGORITHM_ID } from '../../backend/algorithms/index.js';
import { generatePreset, PRESETS, SIZE_LIMITS } from '../../backend/input/presets.js';
import { newSeed } from '../../backend/input/random.js';
import { createDataPanel } from './components/data-panel.js';
import { createRaceMode, DEFAULT_RACE } from './controllers/race-mode.js';
import { createSingleMode } from './controllers/single-mode.js';
import { applyTranslations, createTranslator, normalizeLanguage } from './i18n/index.js';
import { DEFAULT_SPEED_INDEX } from './services/scheduler.js';
import { buildShareQuery, parseShareQuery } from './services/share-link.js';
import { actionForKey } from './services/shortcuts.js';
import { createSound } from './services/sound.js';
import { loadPrefs, savePrefs } from './services/storage.js';
import { applyTheme, currentTheme, toggleTheme } from './services/theme.js';

const RACE_DEFAULT_SPEED_INDEX = 8;

const $ = (selector) => document.querySelector(selector);

const prefs = loadPrefs();
const shared = parseShareQuery(location.search, { algorithmIds: algorithmIds(), presets: PRESETS, sizeLimits: SIZE_LIMITS });

let lang = normalizeLanguage(prefs.lang);
let t = createTranslator(lang);
const getT = () => t;
const sound = createSound();

/** The data both modes sort: a preset (with seed) or custom values. */
const data = {
  preset: shared.preset ?? (PRESETS.includes(prefs.preset) ? prefs.preset : 'random'),
  size: shared.size ?? clampSize(prefs.size ?? SIZE_LIMITS.default),
  seed: shared.seed ?? newSeed(),
  custom: shared.values ?? null,
};

/** @param {number} size */
function clampSize(size) {
  const value = Math.round(Number(size));
  if (!Number.isFinite(value)) return SIZE_LIMITS.default;
  return Math.min(Math.max(value, SIZE_LIMITS.min), SIZE_LIMITS.max);
}

function currentValues() {
  return data.custom ?? generatePreset(data.preset, data.size, data.seed);
}

// ----- modes -----------------------------------------------------------------------

const single = createSingleMode({
  elements: {
    picker: $('#algo-picker'),
    title: $('#stage-title'),
    narration: $('#narration'),
    chart: $('#chart'),
    predict: $('#predict'),
    predictToggle: $('#predict-toggle'),
    predictHint: $('#predict-hint'),
    controls: $('#single-controls'),
    code: $('#code'),
    stats: $('#stats'),
    info: $('#info'),
  },
  sound,
  getT,
  speedIndex: prefs.speedSingle ?? DEFAULT_SPEED_INDEX,
  onSettingsChange: savePrefs,
});

const race = createRaceMode({
  elements: {
    picker: $('#race-picker'),
    error: $('#race-error'),
    controls: $('#race-controls'),
    clock: $('#race-clock'),
    lanes: $('#lanes'),
    summary: $('#race-summary'),
  },
  getT,
  speedIndex: prefs.speedRace ?? RACE_DEFAULT_SPEED_INDEX,
  algorithms: shared.algorithms ?? prefs.raceAlgorithms ?? [...DEFAULT_RACE],
  onSettingsChange: savePrefs,
});

let mode = shared.mode ?? (prefs.mode === 'race' ? 'race' : 'single');

/** @param {'single'|'race'} next */
function setMode(next) {
  mode = next;
  $('#main').dataset.mode = mode;
  for (const view of document.querySelectorAll('[data-view]')) view.hidden = view.dataset.view !== mode;
  for (const button of document.querySelectorAll('[data-mode-button]')) {
    button.setAttribute('aria-pressed', String(button.dataset.modeButton === mode));
  }
  if (mode === 'race') {
    single.suspend();
    race.show();
  } else {
    race.hide();
  }
  savePrefs({ mode });
}

// ----- data panel ------------------------------------------------------------------------

let pendingData = 0;

/** Rebuilds both modes with the current data (coalesced to one per frame). */
function applyData() {
  cancelAnimationFrame(pendingData);
  pendingData = requestAnimationFrame(() => {
    const values = currentValues();
    single.setData(values);
    race.setData(values);
    dataPanel.update({ size: data.size, preset: data.preset, values, custom: data.custom !== null }, t);
  });
}

const dataPanel = createDataPanel($('#data-card'), {
  onSize(size) {
    data.size = clampSize(size);
    data.custom = null;
    savePrefs({ size: data.size });
    applyData();
  },
  onPreset(preset) {
    data.preset = preset;
    data.seed = newSeed();
    data.custom = null;
    savePrefs({ preset });
    applyData();
  },
  onShuffle: shuffle,
  onCustom(values) {
    data.custom = values;
    applyData();
  },
  onShare: share,
});

function shuffle() {
  data.seed = newSeed();
  data.custom = null;
  applyData();
}

async function share() {
  const query = buildShareQuery({
    mode,
    algorithm: single.algorithmId,
    algorithms: race.selection,
    preset: data.preset,
    size: data.size,
    seed: data.seed,
    values: data.custom,
  });
  const url = `${location.origin}${location.pathname}${query}`;
  try {
    await navigator.clipboard.writeText(url);
    dataPanel.showShareMessage(t('input.shareDone'), true);
  } catch {
    history.replaceState(null, '', query);
    dataPanel.showShareMessage(t('input.shareFailed'), false);
  }
}

// ----- header: language, theme, sound, help ----------------------------------------

function translatePage() {
  document.documentElement.lang = lang;
  document.title = t('app.documentTitle');
  applyTranslations(document, t);
  // The language button is labelled in the other language.
  $('#language-toggle').lang = lang === 'en' ? 'zh-Hant' : 'en';
  updateSoundButton();
}

function toggleLanguage() {
  lang = lang === 'en' ? 'zh-Hant' : 'en';
  t = createTranslator(lang);
  savePrefs({ lang });
  translatePage();
  dataPanel.clearMessages();
  dataPanel.update({ size: data.size, preset: data.preset, values: currentValues(), custom: data.custom !== null }, t);
  single.retranslate();
  race.retranslate();
}

function updateSoundButton() {
  const button = $('#sound-toggle');
  const label = t(sound.enabled ? 'header.soundOff' : 'header.soundOn');
  button.setAttribute('aria-pressed', String(sound.enabled));
  button.setAttribute('aria-label', label);
  button.title = label;
}

function toggleSound() {
  sound.setEnabled(!sound.enabled);
  updateSoundButton();
}

function updateThemeButton() {
  $('#theme-toggle').setAttribute('aria-pressed', String(currentTheme() === 'dark'));
}

const helpDialog = $('#help-dialog');

function openHelp() {
  if (typeof helpDialog.showModal === 'function') helpDialog.showModal();
  else helpDialog.setAttribute('open', '');
}

$('#language-toggle').addEventListener('click', toggleLanguage);
$('#theme-toggle').addEventListener('click', () => {
  savePrefs({ theme: toggleTheme() });
  updateThemeButton();
});
$('#sound-toggle').addEventListener('click', toggleSound);
$('#help-open').addEventListener('click', openHelp);
function closeHelp() {
  if (typeof helpDialog.close === 'function') helpDialog.close();
  else helpDialog.removeAttribute('open');
}

$('#help-close').addEventListener('click', closeHelp);
helpDialog.addEventListener('click', (event) => {
  if (event.target === helpDialog) closeHelp();
});
for (const button of document.querySelectorAll('[data-mode-button]')) {
  button.addEventListener('click', () => setMode(button.dataset.modeButton));
}

// ----- keyboard ------------------------------------------------------------------------------

document.addEventListener('keydown', (event) => {
  if (helpDialog.open) return;
  const action = actionForKey(event);
  if (!action) return;
  event.preventDefault();
  switch (action) {
    case 'help':
      openHelp();
      break;
    case 'mode':
      setMode(mode === 'single' ? 'race' : 'single');
      break;
    case 'sound':
      toggleSound();
      break;
    case 'shuffle':
      shuffle();
      break;
    default:
      (mode === 'race' ? race : single).handleAction(action);
  }
});

// ----- start -----------------------------------------------------------------------------------

applyTheme(prefs.theme);
updateThemeButton();
translatePage();
single.init();
race.init();
single.setAlgorithm(shared.algorithm ?? (algorithmIds().includes(prefs.algorithm) ? prefs.algorithm : DEFAULT_ALGORITHM_ID));
setMode(mode);
applyData();
requestAnimationFrame(() => {
  document.documentElement.dataset.ready = 'true';
});
