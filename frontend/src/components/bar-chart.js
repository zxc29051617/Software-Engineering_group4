/**
 * Draws a sort state as bars: the main array, and under it the auxiliary
 * array when the algorithm uses one. DOM nodes are reused between frames.
 * @module components/bar-chart
 */

import { describeBar, highlightsFor } from './highlights.js';

/** Minimum column width (px) for value labels to fit under the bars. */
const LABEL_MIN_WIDTH = 18;

/**
 * @param {string} tag
 * @param {string} className
 */
function element(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

/** Creates one bar column: track with fill, value label, pointer tag. */
function createBar() {
  const bar = element('div', 'bar');
  const track = element('div', 'bar-track');
  const fill = element('div', 'bar-fill');
  track.append(fill);
  bar.append(track, element('span', 'bar-value'), element('span', 'bar-tag'));
  return bar;
}

/**
 * Adds or removes bar columns so `row` has exactly `count`.
 * @param {HTMLElement} row
 * @param {HTMLElement[]} bars
 * @param {number} count
 */
function ensureBars(row, bars, count) {
  while (bars.length < count) {
    const bar = createBar();
    bars.push(bar);
    row.append(bar);
  }
  while (bars.length > count) bars.pop().remove();
  row.style.setProperty('--count', String(Math.max(count, 1)));
  row.dataset.density = count > 64 ? 'dense' : count > 32 ? 'medium' : 'sparse';
}

/**
 * Updates one bar, touching the DOM only when something changed.
 * @param {HTMLElement} bar
 * @param {{height: number, state: string, dim: boolean, label: string, tag: string}} look
 */
function paintBar(bar, look) {
  const fill = bar.firstChild.firstChild;
  const height = `${Math.max(look.height, 0)}%`;
  if (fill.style.height !== height) fill.style.height = height;
  if (bar.dataset.state !== look.state) bar.dataset.state = look.state;
  bar.classList.toggle('is-dim', look.dim);
  const [, value, tag] = bar.children;
  if (value.textContent !== look.label) value.textContent = look.label;
  if (tag.textContent !== look.tag) tag.textContent = look.tag;
}

/**
 * @param {HTMLElement} container
 * @param {{compact?: boolean, t?: (key: string, params?: object) => string}} [options]
 */
export function createBarChart(container, { compact = false, t = (key) => key } = {}) {
  container.replaceChildren();
  container.classList.add('chart');
  container.classList.toggle('chart-compact', compact);

  const mainRow = element('div', 'chart-bars');
  const auxBlock = element('div', 'chart-aux');
  const auxCaption = element('p', 'chart-aux-caption');
  const auxRow = element('div', 'chart-bars chart-bars-aux');
  auxBlock.append(auxCaption, auxRow);
  auxBlock.hidden = true;
  container.append(mainRow, auxBlock);

  /** @type {HTMLElement[]} */ const mainBars = [];
  /** @type {HTMLElement[]} */ const auxBars = [];
  let width = container.clientWidth;
  let translate = t;
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => (width = container.clientWidth)) : null;
  observer?.observe(container);

  function renderAux(state, auxMax, transient, done) {
    const visible = !compact && state.aux !== null && !done;
    auxBlock.hidden = !visible;
    if (!visible) return;
    const size = state.aux.length;
    ensureBars(auxRow, auxBars, size);
    auxCaption.textContent = translate(`stage.aux.${state.auxKind}`);
    const showIndex = state.auxKind !== 'buffer';
    auxRow.classList.toggle('show-labels', width / size >= LABEL_MIN_WIDTH);
    for (let k = 0; k < size; k += 1) {
      const value = state.aux[k];
      paintBar(auxBars[k], {
        height: value === null ? 0 : (value / auxMax) * 100,
        state: transient.get(k) ?? (value === null ? 'empty' : 'default'),
        dim: state.auxKind === 'buffer' && state.range !== null && (k < state.range[0] || k > state.range[1]),
        label: value === null ? '' : String(value),
        tag: showIndex ? String(k + state.auxBase) : '',
      });
    }
  }

  return {
    /**
     * @param {import('../../../backend/engine/state.js').SortState} state
     * @param {{done?: boolean, maxValue?: number, auxMax?: number}} [options]
     */
    render(state, { done = false, maxValue = 1, auxMax = 1 } = {}) {
      const n = state.array.length;
      ensureBars(mainRow, mainBars, n);
      const { main, aux } = highlightsFor(done ? null : state.last);
      mainRow.classList.toggle('show-labels', !compact && width / Math.max(n, 1) >= LABEL_MIN_WIDTH);
      const scale = Math.max(maxValue, 1);
      for (let i = 0; i < n; i += 1) {
        const look = describeBar(state, i, main, done);
        const value = state.array[i];
        paintBar(mainBars[i], {
          height: Math.max((value / scale) * 100, 1.5),
          state: look.state,
          dim: look.dim,
          label: String(value),
          tag: look.tags.map((role) => translate(`marker.${role}`)).join(' · '),
        });
      }
      renderAux(state, Math.max(auxMax, 1), aux, done);
    },

    /** @param {(key: string, params?: object) => string} nextT */
    setTranslator(nextT) {
      translate = nextT;
    },

    destroy() {
      observer?.disconnect();
      container.replaceChildren();
    },
  };
}
