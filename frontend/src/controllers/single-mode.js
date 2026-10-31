/**
 * Single-algorithm mode: records a trace for the chosen algorithm and data,
 * plays it through a Player, and keeps every panel in sync with the cursor.
 * @module controllers/single-mode
 */

import { ALGORITHMS, getAlgorithm } from '../../../backend/algorithms/index.js';
import { describeDone, describeStep } from '../../../backend/engine/describe.js';
import { Player } from '../../../backend/engine/player.js';
import { recordTrace } from '../../../backend/engine/trace.js';
import { createBarChart } from '../components/bar-chart.js';
import { auxScaleFor } from '../components/highlights.js';
import { createInfoPanel } from '../components/info-panel.js';
import { createPlaybackControls } from '../components/playback-controls.js';
import { compareLeadsToSwap, createPredictPanel } from '../components/predict-panel.js';
import { createPseudocodePanel } from '../components/pseudocode-panel.js';
import { createStatsPanel } from '../components/stats-panel.js';
import { translateMessage } from '../i18n/index.js';
import { clampSpeedIndex, createLoop, speedAt, stepsDue } from '../services/scheduler.js';

/** Narration is announced to screen readers only at or below this speed. */
const LIVE_NARRATION_MAX_SPEED = 3;
/** Above this speed bar heights change without a transition. */
const SMOOTH_MAX_SPEED = 20;

/**
 * Value a sound should represent for an event, or null for silent events.
 * @param {import('../../../backend/engine/state.js').SortState} state
 */
function audibleValue(state) {
  const event = state.last;
  if (!event) return null;
  if (event.type === 'compare') return (event.target === 'aux' ? state.aux : state.array)[event.j];
  if (event.type === 'swap') return state.array[event.j];
  if (event.type === 'write') return event.value;
  return null;
}

/**
 * @param {{
 *   elements: Record<string, HTMLElement>,
 *   sound: ReturnType<import('../services/sound.js').createSound>,
 *   getT: () => (key: string, params?: object) => string,
 *   speedIndex: number,
 *   onSettingsChange: (settings: {algorithm?: string, speedSingle?: number}) => void,
 * }} options
 */
export function createSingleMode({ elements, sound, getT, speedIndex, onSettingsChange }) {
  const chart = createBarChart(elements.chart, { t: getT() });
  const code = createPseudocodePanel(elements.code);
  const stats = createStatsPanel(elements.stats);
  const info = createInfoPanel(elements.info);
  const loop = createLoop(onFrame);

  let algorithm = ALGORITHMS[0];
  let input = [];
  let player = new Player([], []);
  let maxValue = 1;
  let auxMax = 1;
  let playing = false;
  let carry = 0;
  let speed = clampSpeedIndex(speedIndex);
  let lastNarration = '';

  // Prediction quiz state.
  let predictOn = false;
  /** @type {{cursor: number, event: object, next: object|null, resumeAfter: boolean, answered: boolean}|null} */
  let question = null;
  let correctAnswers = 0;
  let totalAnswers = 0;
  /** Cursors already asked about for this trace (stepping back does not ask again). */
  const asked = new Set();

  const predict = createPredictPanel(elements.predict, { onAnswer: answer, onContinue: continueAfterAnswer });
  const controls = createPlaybackControls(elements.controls, {
    onAction: (action) => handleAction(action === 'toggle' ? 'togglePlay' : action),
    onSeek: (position) => {
      closeQuestion();
      pause();
      player.seek(position);
      render();
    },
    onSpeed: setSpeed,
  });

  const chips = ALGORITHMS.map((entry) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.dataset.algorithm = entry.id;
    button.dataset.i18n = `algo.${entry.id}.short`;
    button.addEventListener('click', () => selectAlgorithm(entry.id));
    return button;
  });
  elements.picker.replaceChildren(...chips);

  elements.predictToggle.addEventListener('change', () => setPredict(elements.predictToggle.checked));

  // ----- data and algorithm --------------------------------------------------

  function rebuild() {
    pause();
    closeQuestion();
    const trace = recordTrace(algorithm, input);
    player = new Player(input, trace.events);
    maxValue = Math.max(1, ...input);
    auxMax = auxScaleFor(trace.events, maxValue);
    stats.reset(input);
    asked.clear();
    render();
  }

  /** @param {string} id */
  function selectAlgorithm(id) {
    const next = getAlgorithm(id);
    if (!next) return;
    algorithm = next;
    for (const chip of chips) chip.setAttribute('aria-pressed', String(chip.dataset.algorithm === id));
    code.setLines(algorithm.pseudocode);
    renderStaticText();
    updatePredictAvailability();
    onSettingsChange({ algorithm: id });
    rebuild();
  }

  /** @param {number} step  +1 / -1 through the algorithm list */
  function cycleAlgorithm(step) {
    const index = ALGORITHMS.indexOf(algorithm);
    selectAlgorithm(ALGORITHMS[(index + step + ALGORITHMS.length) % ALGORITHMS.length].id);
  }

  // ----- playback --------------------------------------------------------------

  function play() {
    if (question && !question.answered) return;
    closeQuestion();
    if (player.atEnd) player.reset();
    if (player.length === 0) return;
    playing = true;
    carry = 0;
    loop.start();
    render();
  }

  function pause() {
    playing = false;
    loop.stop();
  }

  function stepForward() {
    if (question && !question.answered) return;
    closeQuestion();
    pause();
    if (player.stepForward()) {
      playSound();
      maybeAsk(false);
    }
    render();
  }

  /** @param {number} elapsed */
  function onFrame(elapsed) {
    const due = stepsDue(carry, elapsed, speedAt(speed));
    carry = due.carry;
    let moved = false;
    for (let k = 0; k < due.steps; k += 1) {
      if (!player.stepForward()) break;
      moved = true;
      if (maybeAsk(true)) break;
    }
    if (player.atEnd) pause();
    if (moved) {
      playSound();
      render();
    } else if (!playing) {
      render();
    }
  }

  /** @param {number} index */
  function setSpeed(index) {
    speed = clampSpeedIndex(index);
    elements.chart.classList.toggle('is-fast', speedAt(speed) > SMOOTH_MAX_SPEED);
    onSettingsChange({ speedSingle: speed });
    render();
  }

  /**
   * Runs a playback action (from buttons or the keyboard).
   * @param {string} action
   */
  function handleAction(action) {
    switch (action) {
      case 'togglePlay':
        if (playing) {
          pause();
          render();
        } else if (question?.answered) {
          continueAfterAnswer();
        } else {
          play();
        }
        break;
      case 'forward':
        if (question?.answered) continueAfterAnswer();
        else stepForward();
        break;
      case 'back':
        closeQuestion();
        pause();
        player.stepBack();
        render();
        break;
      case 'reset':
        closeQuestion();
        pause();
        player.reset();
        render();
        break;
      case 'end':
        closeQuestion();
        pause();
        player.toEnd();
        render();
        break;
      case 'faster':
        setSpeed(speed + 1);
        break;
      case 'slower':
        setSpeed(speed - 1);
        break;
      case 'predict':
        if (algorithm.predict) {
          elements.predictToggle.checked = !elements.predictToggle.checked;
          setPredict(elements.predictToggle.checked);
        }
        break;
      case 'previousAlgorithm':
        cycleAlgorithm(-1);
        break;
      case 'nextAlgorithm':
        cycleAlgorithm(1);
        break;
      default:
        break;
    }
  }

  function playSound() {
    if (!sound.enabled) return;
    const value = audibleValue(player.state);
    if (value !== null) sound.play(value, maxValue);
  }

  // ----- prediction quiz ---------------------------------------------------------

  /** @param {boolean} on */
  function setPredict(on) {
    predictOn = on && algorithm.predict;
    if (!predictOn) closeQuestion();
    render();
  }

  function updatePredictAvailability() {
    const t = getT();
    elements.predictToggle.disabled = !algorithm.predict;
    if (!algorithm.predict) elements.predictToggle.checked = false;
    predictOn = elements.predictToggle.checked && algorithm.predict;
    elements.predictHint.textContent = t(algorithm.predict ? 'controls.predictHint' : 'controls.predictUnavailable');
  }

  /**
   * Opens a question if the step just taken is a comparison worth predicting.
   * @param {boolean} resumeAfter  continue playing after the answer
   * @returns {boolean} whether playback must stop for the question
   */
  function maybeAsk(resumeAfter) {
    const event = player.state.last;
    if (!predictOn || !event || event.type !== 'compare' || event.target !== 'main') return false;
    if (asked.has(player.cursor)) return false;
    asked.add(player.cursor);
    pause();
    question = { cursor: player.cursor, event, next: player.peek(), resumeAfter, answered: false };
    const t = getT();
    const { i, j } = event;
    const text = t('predict.question', { i, j, x: player.state.array[i], y: player.state.array[j] });
    predict.ask(text, t('predict.score', { correct: correctAnswers, total: totalAnswers }));
    return true;
  }

  /** @param {boolean} guessSwap */
  function answer(guessSwap) {
    if (!question || question.answered) return;
    const t = getT();
    const swaps = compareLeadsToSwap(question.event, question.next);
    const correct = guessSwap === swaps;
    question.answered = true;
    totalAnswers += 1;
    if (correct) correctAnswers += 1;
    const { i, j } = question.event;
    const params = { x: player.state.array[i], y: player.state.array[j] };
    const feedback = t('predict.feedback', {
      verdict: { key: correct ? 'predict.correct' : 'predict.wrong' },
      explanation: { key: swaps ? 'predict.explainSwap' : 'predict.explainKeep', params },
    });
    predict.reveal(correct, feedback, t('predict.score', { correct: correctAnswers, total: totalAnswers }));
    render();
  }

  function continueAfterAnswer() {
    const resume = question?.resumeAfter;
    closeQuestion();
    if (resume) play();
    else stepForward();
  }

  function closeQuestion() {
    if (!question) return;
    question = null;
    predict.hide();
  }

  // ----- rendering -----------------------------------------------------------------

  function renderStaticText() {
    const t = getT();
    elements.title.textContent = t(`algo.${algorithm.id}.name`);
    info.render(algorithm, t);
  }

  function render() {
    const t = getT();
    const { state } = player;
    const done = player.atEnd && player.length > 0;
    chart.render(state, { done, maxValue, auxMax });
    code.highlight(done ? 0 : state.line);
    stats.render(state, { cursor: player.cursor, total: player.length, t });

    const hideOutcome = Boolean(question && !question.answered);
    const message = done ? describeDone(state, player.length) : describeStep(state, { hideOutcome });
    const narration = translateMessage(t, message);
    const live = !playing || speedAt(speed) <= LIVE_NARRATION_MAX_SPEED;
    elements.narration.setAttribute('aria-live', live ? 'polite' : 'off');
    if (narration !== lastNarration) {
      elements.narration.textContent = narration;
      lastNarration = narration;
    }
    if (!playing) elements.chart.setAttribute('aria-label', `${t('stage.label')}: ${state.array.join(', ')}`);

    controls.update({
      playing,
      value: player.cursor,
      max: player.length,
      atStart: player.atStart,
      atEnd: player.atEnd,
      speedIndex: speed,
      speedText: t('controls.speedValue', { value: speedAt(speed) }),
      positionText: t('controls.stepCount', { cursor: player.cursor, total: player.length }),
      playLabel: t('controls.play'),
      pauseLabel: t('controls.pause'),
    });
  }

  return {
    get algorithmId() {
      return algorithm.id;
    },

    /** @param {string} id */
    setAlgorithm: selectAlgorithm,

    /** @param {number[]} values */
    setData(values) {
      input = values.slice();
      rebuild();
    },

    handleAction,

    /** Stops playback (when the mode is hidden). */
    suspend() {
      closeQuestion();
      pause();
      render();
    },

    /** Re-renders texts after a language change. */
    retranslate() {
      chart.setTranslator(getT());
      renderStaticText();
      updatePredictAvailability();
      lastNarration = '';
      render();
    },

    init() {
      setSpeed(speed);
    },
  };
}
