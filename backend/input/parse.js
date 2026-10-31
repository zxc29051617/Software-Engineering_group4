/**
 * Validation of the custom input box. Returns error codes with parameters
 * rather than sentences, so the UI can show them in any language.
 * @module input/parse
 */

export const INPUT_LIMITS = Object.freeze({ minCount: 2, maxCount: 100, minValue: 0, maxValue: 999 });

/**
 * @typedef {{code: 'empty'}
 *   | {code: 'not-integer', index: number, token: string}
 *   | {code: 'out-of-range', index: number, token: string, min: number, max: number}
 *   | {code: 'too-few', count: number, min: number}
 *   | {code: 'too-many', count: number, max: number}} InputError
 *
 * @typedef {{ok: true, values: number[]} | {ok: false, error: InputError}} ParseResult
 */

/** Separators: whitespace, ASCII comma/semicolon and the ideographic comma 、. */
const SEPARATORS = /[\s,;、]+/u;
const INTEGER = /^[+-]?\d+$/;

/**
 * Splits user text into tokens. NFKC turns full-width digits and the
 * full-width comma (，) into their ASCII forms first.
 * @param {string} text
 * @returns {string[]}
 */
export function tokenize(text) {
  return String(text ?? '')
    .normalize('NFKC')
    .split(SEPARATORS)
    .filter((token) => token !== '');
}

/**
 * Parses a list such as "5, 3, 8 1" into integers and reports the first problem.
 * Indexes in errors are 1-based, as shown to the user.
 *
 * @param {string} text
 * @param {typeof INPUT_LIMITS} [limits]
 * @returns {ParseResult}
 */
export function parseNumberList(text, limits = INPUT_LIMITS) {
  const tokens = tokenize(text);
  if (tokens.length === 0) return { ok: false, error: { code: 'empty' } };
  if (tokens.length > limits.maxCount) {
    return { ok: false, error: { code: 'too-many', count: tokens.length, max: limits.maxCount } };
  }

  const values = [];
  for (const [position, token] of tokens.entries()) {
    const index = position + 1;
    if (!INTEGER.test(token)) return { ok: false, error: { code: 'not-integer', index, token } };
    const value = Number(token) + 0; // + 0 turns -0 into 0
    if (value < limits.minValue || value > limits.maxValue) {
      return {
        ok: false,
        error: { code: 'out-of-range', index, token, min: limits.minValue, max: limits.maxValue },
      };
    }
    values.push(value);
  }

  if (values.length < limits.minCount) {
    return { ok: false, error: { code: 'too-few', count: values.length, min: limits.minCount } };
  }
  return { ok: true, values };
}

/**
 * Formats values back into the canonical text form ("5, 3, 8").
 * @param {number[]} values
 */
export function formatNumberList(values) {
  return values.join(', ');
}
