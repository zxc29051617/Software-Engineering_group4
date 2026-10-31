/**
 * The data card: size slider, preset buttons, "new data", custom input with
 * validation messages, and the share-link button.
 * @module components/data-panel
 */

import { INPUT_LIMITS, formatNumberList, parseNumberList } from '../../../backend/input/parse.js';
import { PRESETS, SIZE_LIMITS } from '../../../backend/input/presets.js';

/**
 * Translates a validation error from the parser into a sentence.
 * @param {import('../../../backend/input/parse.js').InputError} error
 * @param {(key: string, params?: object) => string} t
 */
export function inputErrorMessage(error, t) {
  return t(`error.${error.code}`, error);
}

/**
 * @param {HTMLElement} root
 * @param {{onSize: (size: number) => void, onPreset: (preset: string) => void, onShuffle: () => void,
 *          onCustom: (values: number[]) => void, onShare: () => void}} handlers
 */
export function createDataPanel(root, handlers) {
  const size = root.querySelector('#size-input');
  const sizeValue = root.querySelector('#size-value');
  const presetBox = root.querySelector('#preset-buttons');
  const form = root.querySelector('#custom-form');
  const custom = root.querySelector('#custom-input');
  const message = root.querySelector('#custom-message');
  const shareMessage = root.querySelector('#share-message');

  size.min = String(SIZE_LIMITS.min);
  size.max = String(SIZE_LIMITS.max);
  custom.maxLength = INPUT_LIMITS.maxCount * 5;

  const presetButtons = PRESETS.map((preset) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.dataset.preset = preset;
    button.dataset.i18n = `preset.${preset}`;
    button.addEventListener('click', () => handlers.onPreset(preset));
    return button;
  });
  presetBox.replaceChildren(...presetButtons);

  size.addEventListener('input', () => handlers.onSize(Number(size.value)));
  root.querySelector('#shuffle-button').addEventListener('click', () => handlers.onShuffle());
  root.querySelector('#share-button').addEventListener('click', () => handlers.onShare());
  custom.addEventListener('input', () => {
    custom.removeAttribute('aria-invalid');
    message.textContent = '';
    message.className = 'message';
  });

  /** @type {(key: string, params?: object) => string} */
  let t = (key) => key;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = parseNumberList(custom.value);
    if (!result.ok) {
      custom.setAttribute('aria-invalid', 'true');
      message.className = 'message is-error';
      message.textContent = inputErrorMessage(result.error, t);
      custom.focus();
      return;
    }
    custom.removeAttribute('aria-invalid');
    custom.value = formatNumberList(result.values);
    message.className = 'message is-ok';
    message.textContent = t('input.applied', { count: result.values.length });
    handlers.onCustom(result.values);
  });

  return {
    /**
     * Reflects the current data source.
     * @param {{size: number, preset: string|null, values: number[], custom: boolean}} view
     * @param {(key: string, params?: object) => string} translate
     */
    update(view, translate) {
      t = translate;
      size.value = String(Math.min(Math.max(view.size, SIZE_LIMITS.min), SIZE_LIMITS.max));
      sizeValue.textContent = t('input.sizeValue', { value: view.values.length });
      for (const button of presetButtons) {
        button.setAttribute('aria-pressed', String(!view.custom && button.dataset.preset === view.preset));
      }
      if (view.custom && document.activeElement !== custom) custom.value = formatNumberList(view.values);
    },

    /** @param {string} text  @param {boolean} ok */
    showShareMessage(text, ok) {
      shareMessage.className = ok ? 'message is-ok' : 'message is-error';
      shareMessage.textContent = text;
    },

    /** Clears messages that belong to the previous language. */
    clearMessages() {
      message.textContent = '';
      shareMessage.textContent = '';
    },
  };
}
