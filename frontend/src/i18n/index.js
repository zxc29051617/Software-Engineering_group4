/**
 * Minimal i18n: flat dictionaries, `{name}` placeholders, Traditional Chinese
 * as default and fallback. The DOM helper is separate from the pure parts so
 * the dictionaries and formatter can be unit-tested in Node.
 * @module i18n
 */

import en from './en.js';
import zhHant from './zh-Hant.js';

export const DICTIONARIES = Object.freeze({ 'zh-Hant': zhHant, en });
export const DEFAULT_LANGUAGE = 'zh-Hant';
export const LANGUAGES = Object.freeze(Object.keys(DICTIONARIES));

/**
 * @param {string} lang
 * @returns {string} a supported language code
 */
export function normalizeLanguage(lang) {
  return LANGUAGES.includes(lang) ? lang : DEFAULT_LANGUAGE;
}

/**
 * Replaces `{name}` placeholders. A parameter shaped like `{key, params}` is
 * translated first (nested messages).
 * @param {string} template
 * @param {Record<string, *>} params
 * @param {(key: string, params?: object) => string} translate
 */
export function format(template, params, translate) {
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    if (!(name in params)) return match;
    const value = params[name];
    if (value && typeof value === 'object' && typeof value.key === 'string') {
      return translate(value.key, value.params ?? {});
    }
    return String(value);
  });
}

/**
 * Creates `t(key, params)` for one language, falling back to Traditional
 * Chinese and finally to the key itself.
 * @param {string} lang
 * @returns {(key: string, params?: Record<string, *>) => string}
 */
export function createTranslator(lang) {
  const dictionary = DICTIONARIES[normalizeLanguage(lang)];
  const fallback = DICTIONARIES[DEFAULT_LANGUAGE];
  const translate = (key, params = {}) => {
    const template = dictionary[key] ?? fallback[key] ?? key;
    return format(template, params, translate);
  };
  return translate;
}

/**
 * Translates a narration/validation message object.
 * @param {(key: string, params?: object) => string} t
 * @param {{key: string, params?: object}} message
 */
export function translateMessage(t, message) {
  return t(message.key, message.params ?? {});
}

/**
 * Fills elements marked with `data-i18n` (text) and `data-i18n-attr`
 * ("aria-label:key; title:key") under `root`.
 * @param {ParentNode} root
 * @param {(key: string) => string} t
 */
export function applyTranslations(root, t) {
  for (const element of root.querySelectorAll('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const element of root.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of element.dataset.i18nAttr.split(';')) {
      const [attribute, key] = pair.split(':').map((part) => part.trim());
      if (attribute && key) element.setAttribute(attribute, t(key));
    }
  }
}
