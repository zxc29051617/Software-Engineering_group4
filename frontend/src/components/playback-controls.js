/**
 * Transport bar: reset / back / play-pause / forward / end buttons, a
 * timeline slider and a speed slider. The markup lives in index.html; this
 * module wires it up and reflects the current playback state.
 * @module components/playback-controls
 */

import { SPEEDS } from '../services/scheduler.js';

/**
 * @param {HTMLElement} root  element containing `[data-action]` buttons and `[data-role]` inputs
 * @param {{onAction: (action: string) => void, onSeek: (position: number) => void, onSpeed: (index: number) => void}} handlers
 */
export function createPlaybackControls(root, { onAction, onSeek, onSpeed }) {
  const buttons = Object.fromEntries([...root.querySelectorAll('[data-action]')].map((b) => [b.dataset.action, b]));
  const timeline = root.querySelector('[data-role="timeline"]');
  const speed = root.querySelector('[data-role="speed"]');
  const speedValue = root.querySelector('[data-role="speed-value"]');
  const position = root.querySelector('[data-role="position"]');

  speed.max = String(SPEEDS.length - 1);
  for (const [action, button] of Object.entries(buttons)) button.addEventListener('click', () => onAction(action));
  timeline.addEventListener('input', () => onSeek(Number(timeline.value)));
  speed.addEventListener('input', () => onSpeed(Number(speed.value)));

  return {
    /**
     * @param {{playing: boolean, value: number, max: number, atStart: boolean, atEnd: boolean,
     *          speedIndex: number, speedText: string, positionText: string, playLabel: string, pauseLabel: string}} view
     */
    update(view) {
      root.classList.toggle('is-playing', view.playing);
      const toggle = buttons.toggle;
      const label = view.playing ? view.pauseLabel : view.playLabel;
      if (toggle.getAttribute('aria-label') !== label) {
        toggle.setAttribute('aria-label', label);
        toggle.title = label;
      }
      toggle.setAttribute('aria-pressed', String(view.playing));
      buttons.reset.disabled = view.atStart;
      buttons.back.disabled = view.atStart;
      buttons.forward.disabled = view.atEnd;
      buttons.end.disabled = view.atEnd;
      toggle.disabled = view.atEnd && !view.playing && view.max === 0;
      if (timeline.max !== String(view.max)) timeline.max = String(view.max);
      if (timeline.value !== String(view.value)) timeline.value = String(view.value);
      timeline.setAttribute('aria-valuetext', view.positionText);
      if (speed.value !== String(view.speedIndex)) speed.value = String(view.speedIndex);
      speed.setAttribute('aria-valuetext', view.speedText);
      if (speedValue.textContent !== view.speedText) speedValue.textContent = view.speedText;
      if (position && position.textContent !== view.positionText) position.textContent = view.positionText;
    },
  };
}
