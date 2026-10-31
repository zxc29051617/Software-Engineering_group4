/**
 * Compare mode: two or more algorithms sort the same data on one shared
 * operation clock.
 * @module controllers/race-mode
 */

import { ALGORITHMS, getAlgorithm } from '../../../backend/algorithms/index.js';
import { Race } from '../../../backend/engine/race.js';
import { recordTrace } from '../../../backend/engine/trace.js';
import { createPlaybackControls } from '../components/playback-controls.js';
import { createRaceView } from '../components/race-view.js';
import { clampSpeedIndex, createLoop, speedAt, stepsDue } from '../services/scheduler.js';

export const DEFAULT_RACE = Object.freeze(['bubble', 'insertion', 'merge', 'quick']);
export const MIN_LANES = 2;

/**
 * Keeps only known, distinct ids in registry order.
 * @param {string[]} ids
 */
export function normalizeSelection(ids) {
  const wanted = new Set(ids);
  return ALGORITHMS.map((algorithm) => algorithm.id).filter((id) => wanted.has(id));
}

/**
 * @param {{
 *   elements: Record<string, HTMLElement>,
 *   getT: () => (key: string, params?: object) => string,
 *   speedIndex: number,
 *   algorithms: string[],
 *   onSettingsChange: (settings: {raceAlgorithms?: string[], speedRace?: number}) => void,
 * }} options
 */
export function createRaceMode({ elements, getT, speedIndex, algorithms, onSettingsChange }) {
  const view = createRaceView(elements.lanes, elements.summary);
  const loop = createLoop(onFrame);
  let selection = normalizeSelection(algorithms);
  if (selection.length < MIN_LANES) selection = [...DEFAULT_RACE];
  let input = [];
  let maxValue = 1;
  /** @type {Race|null} */
  let race = null;
  let dirty = true;
  let visible = false;
  let playing = false;
  let carry = 0;
  let speed = clampSpeedIndex(speedIndex);

  const controls = createPlaybackControls(elements.controls, {
    onAction: (action) => handleAction(action === 'toggle' ? 'togglePlay' : action),
    onSeek: (time) => {
      pause();
      race?.seek(time);
      render();
    },
    onSpeed: setSpeed,
  });

  const boxes = ALGORITHMS.map((algorithm) => {
    const label = document.createElement('label');
    label.className = 'check';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.value = algorithm.id;
    box.checked = selection.includes(algorithm.id);
    box.addEventListener('change', onPickerChange);
    const text = document.createElement('span');
    text.dataset.i18n = `algo.${algorithm.id}.name`;
    label.append(box, text);
    elements.picker.append(label);
    return box;
  });

  function onPickerChange() {
    const chosen = boxes.filter((box) => box.checked).map((box) => box.value);
    if (chosen.length < MIN_LANES) {
      elements.error.textContent = getT()('race.pickError');
      return;
    }
    elements.error.textContent = '';
    selection = chosen;
    onSettingsChange({ raceAlgorithms: selection });
    invalidate();
  }

  function invalidate() {
    dirty = true;
    if (visible) rebuild();
  }

  function rebuild() {
    pause();
    const entries = selection.map((id) => ({ id, input, events: recordTrace(getAlgorithm(id), input).events }));
    race = new Race(entries);
    maxValue = Math.max(1, ...input);
    view.build(selection, getT());
    dirty = false;
    render();
  }

  function play() {
    if (!race) return;
    if (race.atEnd) race.reset();
    playing = true;
    carry = 0;
    loop.start();
    render();
  }

  function pause() {
    playing = false;
    loop.stop();
  }

  /** @param {number} elapsed */
  function onFrame(elapsed) {
    const due = stepsDue(carry, elapsed, speedAt(speed));
    carry = due.carry;
    if (due.steps > 0) race.stepForward(due.steps);
    if (race.atEnd) pause();
    if (due.steps > 0 || !playing) render();
  }

  /** @param {number} index */
  function setSpeed(index) {
    speed = clampSpeedIndex(index);
    elements.lanes.classList.toggle('is-fast', speedAt(speed) > 20);
    onSettingsChange({ speedRace: speed });
    render();
  }

  /** @param {string} action */
  function handleAction(action) {
    if (!race) return;
    switch (action) {
      case 'togglePlay':
        if (playing) pause();
        else play();
        break;
      case 'forward':
        pause();
        race.stepForward();
        break;
      case 'back':
        pause();
        race.stepBack();
        break;
      case 'reset':
        pause();
        race.reset();
        break;
      case 'end':
        pause();
        race.toEnd();
        break;
      case 'faster':
        setSpeed(speed + 1);
        return;
      case 'slower':
        setSpeed(speed - 1);
        return;
      default:
        return;
    }
    render();
  }

  function render() {
    if (!race) return;
    const t = getT();
    view.render(race, { maxValue, t });
    elements.clock.textContent = t('race.clock', { time: race.time, duration: race.duration });
    controls.update({
      playing,
      value: race.time,
      max: race.duration,
      atStart: race.atStart,
      atEnd: race.atEnd,
      speedIndex: speed,
      speedText: t('controls.speedValueRace', { value: speedAt(speed) }),
      positionText: t('race.clock', { time: race.time, duration: race.duration }),
      playLabel: t('controls.play'),
      pauseLabel: t('controls.pause'),
    });
  }

  return {
    get selection() {
      return [...selection];
    },

    /** @param {number[]} values */
    setData(values) {
      input = values.slice();
      invalidate();
    },

    handleAction,

    show() {
      visible = true;
      if (dirty) rebuild();
      else render();
    },

    hide() {
      visible = false;
      pause();
    },

    retranslate() {
      const t = getT();
      view.retranslate(t);
      if (elements.error.textContent) elements.error.textContent = t('race.pickError');
      render();
    },

    init() {
      setSpeed(speed);
    },
  };
}
