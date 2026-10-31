/**
 * Share links: the current mode, algorithm(s) and data encoded in the URL
 * query, so a teacher can send students the exact same example.
 *
 *   ?algo=quick&preset=sorted&n=30&seed=42
 *   ?algo=bubble&data=5,3,8,1
 *   ?mode=race&algos=bubble,insertion,merge&preset=nearly-sorted&n=40&seed=7
 *
 * Parsing is defensive: anything invalid is dropped and the app falls back
 * to its defaults for that field.
 * @module services/share-link
 */

import { parseNumberList } from '../../../backend/input/parse.js';

/**
 * @typedef {Object} ShareConfig
 * @property {'single'|'race'} [mode]
 * @property {string} [algorithm]
 * @property {string[]} [algorithms]
 * @property {string} [preset]
 * @property {number} [size]
 * @property {number} [seed]
 * @property {number[]|null} [values]  custom data; takes precedence over preset/size/seed
 */

/**
 * @param {ShareConfig} config
 * @returns {string} query string starting with "?"
 */
export function buildShareQuery(config) {
  const params = new URLSearchParams();
  if (config.mode === 'race') {
    params.set('mode', 'race');
    if (config.algorithms?.length) params.set('algos', config.algorithms.join(','));
  } else if (config.algorithm) {
    params.set('algo', config.algorithm);
  }
  if (config.values?.length) {
    params.set('data', config.values.join(','));
  } else {
    if (config.preset) params.set('preset', config.preset);
    if (Number.isInteger(config.size)) params.set('n', String(config.size));
    if (Number.isInteger(config.seed)) params.set('seed', String(config.seed));
  }
  return `?${params.toString()}`;
}

/**
 * @param {string} search  e.g. location.search
 * @param {{algorithmIds: string[], presets: readonly string[], sizeLimits: {min: number, max: number}}} options
 * @returns {ShareConfig} only the fields that were present and valid
 */
export function parseShareQuery(search, { algorithmIds, presets, sizeLimits }) {
  const params = new URLSearchParams(search);
  /** @type {ShareConfig} */
  const config = {};

  if (params.get('mode') === 'race') config.mode = 'race';
  else if (params.get('mode') === 'single') config.mode = 'single';

  const algorithm = params.get('algo');
  if (algorithm && algorithmIds.includes(algorithm)) config.algorithm = algorithm;

  const algorithms = (params.get('algos') ?? '')
    .split(',')
    .filter((id, index, list) => algorithmIds.includes(id) && list.indexOf(id) === index);
  if (algorithms.length >= 2) config.algorithms = algorithms;

  const data = params.get('data');
  if (data) {
    const parsed = parseNumberList(data);
    if (parsed.ok) config.values = parsed.values;
  }

  const preset = params.get('preset');
  if (preset && presets.includes(preset)) config.preset = preset;

  const size = Number(params.get('n'));
  if (params.has('n') && Number.isInteger(size) && size >= sizeLimits.min && size <= sizeLimits.max) {
    config.size = size;
  }

  const seed = Number(params.get('seed'));
  if (params.has('seed') && Number.isInteger(seed) && seed > 0 && seed <= 0xffffffff) config.seed = seed;

  return config;
}
