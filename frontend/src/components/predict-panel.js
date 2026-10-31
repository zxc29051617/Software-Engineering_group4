/**
 * Prediction quiz: at a comparison the learner guesses whether the two bars
 * will be swapped before the answer is shown.
 * @module components/predict-panel
 */

/**
 * Whether the event after a compare swaps the same pair.
 * @param {import('../../../backend/engine/events.js').SortEvent} compareEvent
 * @param {import('../../../backend/engine/events.js').SortEvent|null} nextEvent
 */
export function compareLeadsToSwap(compareEvent, nextEvent) {
  return Boolean(
    nextEvent && nextEvent.type === 'swap' && nextEvent.i === compareEvent.i && nextEvent.j === compareEvent.j,
  );
}

/**
 * @param {HTMLElement} root  the `.predict` container from index.html
 * @param {{onAnswer: (guessSwap: boolean) => void, onContinue: () => void}} handlers
 */
export function createPredictPanel(root, { onAnswer, onContinue }) {
  const question = root.querySelector('[data-role="question"]');
  const feedback = root.querySelector('[data-role="feedback"]');
  const score = root.querySelector('[data-role="score"]');
  const answerButtons = [...root.querySelectorAll('[data-answer]')];
  const continueButton = root.querySelector('[data-role="continue"]');

  for (const button of answerButtons) {
    button.addEventListener('click', () => onAnswer(button.dataset.answer === 'swap'));
  }
  continueButton.addEventListener('click', () => onContinue());

  return {
    /**
     * Shows the question; focus moves to the first answer button.
     * @param {string} text
     * @param {string} scoreText
     */
    ask(text, scoreText) {
      root.hidden = false;
      root.dataset.stage = 'question';
      question.textContent = text;
      feedback.textContent = '';
      score.textContent = scoreText;
      answerButtons.forEach((button) => (button.disabled = false));
      continueButton.hidden = true;
      answerButtons[0].focus({ preventScroll: true });
    },

    /**
     * @param {boolean} correct
     * @param {string} text
     * @param {string} scoreText
     */
    reveal(correct, text, scoreText) {
      root.dataset.stage = correct ? 'correct' : 'wrong';
      feedback.textContent = text;
      score.textContent = scoreText;
      answerButtons.forEach((button) => (button.disabled = true));
      continueButton.hidden = false;
      continueButton.focus({ preventScroll: true });
    },

    hide() {
      root.hidden = true;
      delete root.dataset.stage;
    },

    get open() {
      return !root.hidden;
    },
  };
}
