/**
 * Compare-mode lanes (one small bar chart per algorithm) and the results table.
 * @module components/race-view
 */

import { createBarChart } from './bar-chart.js';

/**
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 */
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * @param {HTMLElement} lanesRoot
 * @param {HTMLElement} summaryRoot  section with a <table> inside
 */
export function createRaceView(lanesRoot, summaryRoot) {
  /** @type {{id: string, chart: ReturnType<typeof createBarChart>, card: HTMLElement, title: HTMLElement,
   *          badge: HTMLElement, meter: HTMLElement, numbers: HTMLElement}[]} */
  let lanes = [];

  return {
    /**
     * Creates one lane per algorithm id.
     * @param {string[]} ids
     * @param {(key: string, params?: object) => string} t
     */
    build(ids, t) {
      lanes.forEach((lane) => lane.chart.destroy());
      lanes = ids.map((id) => {
        const card = element('article', 'lane');
        card.dataset.algorithm = id;
        const header = element('header', 'lane-header');
        const title = element('h3', 'lane-title', t(`algo.${id}.name`));
        const badge = element('span', 'lane-badge');
        header.append(title, badge);
        const chartHost = element('div', 'lane-chart');
        const meter = element('div', 'meter');
        meter.append(element('span'));
        const numbers = element('p', 'lane-numbers');
        card.append(header, chartHost, meter, numbers);
        return { id, card, title, badge, meter, numbers, chart: createBarChart(chartHost, { compact: true, t }) };
      });
      lanesRoot.replaceChildren(...lanes.map((lane) => lane.card));
      lanesRoot.dataset.count = String(lanes.length);
    },

    /**
     * @param {import('../../../backend/engine/race.js').Race} race
     * @param {{maxValue: number, t: (key: string, params?: object) => string}} options
     */
    render(race, { maxValue, t }) {
      const ranks = new Map(race.rankings().map((entry) => [entry.id, entry.rank]));
      race.lanes.forEach((lane, index) => {
        const view = lanes[index];
        if (!view) return;
        const finished = race.isFinished(lane);
        const { state } = lane.player;
        view.chart.render(state, { done: finished, maxValue });
        view.card.classList.toggle('is-finished', finished);
        view.card.dataset.rank = finished ? String(ranks.get(lane.id)) : '';
        view.badge.textContent = finished ? t('race.rank', { rank: ranks.get(lane.id) }) : t('race.running');
        const used = Math.min(race.time, lane.totalOps);
        view.meter.firstChild.style.width = `${lane.totalOps === 0 ? 100 : (used / lane.totalOps) * 100}%`;
        const { comparisons, swaps, writes, auxWrites } = state.stats;
        view.numbers.textContent = [
          t('race.ops', { ops: comparisons + swaps + writes + auxWrites }),
          `${t('race.col.comparisons')} ${comparisons}`,
          `${t('race.col.swaps')} ${swaps}`,
          `${t('race.col.writes')} ${writes + auxWrites}`,
        ].join(' · ');
      });
      this.renderSummary(race, t);
    },

    /**
     * Fills the results table once the slowest lane has finished.
     * @param {import('../../../backend/engine/race.js').Race} race
     * @param {(key: string, params?: object) => string} t
     */
    renderSummary(race, t) {
      summaryRoot.hidden = !race.atEnd;
      if (!race.atEnd) return;
      const byId = new Map(race.lanes.map((lane) => [lane.id, lane]));
      const best = Math.max(1, ...race.lanes.map((lane) => lane.totalOps));
      const rows = race.rankings().map(({ id, rank, totalOps }) => {
        const { comparisons, swaps, writes, auxWrites } = byId.get(id).player.finalState.stats;
        const row = element('tr');
        const bar = element('span', 'summary-bar');
        bar.style.width = `${(totalOps / best) * 100}%`;
        const total = element('td', 'num');
        total.append(element('span', 'summary-value', String(totalOps)), bar);
        row.append(
          element('td', 'num', String(rank)),
          element('th', '', t(`algo.${id}.name`)),
          element('td', 'num', String(comparisons)),
          element('td', 'num', String(swaps)),
          element('td', 'num', String(writes + auxWrites)),
          total,
        );
        row.firstChild.nextSibling.scope = 'row';
        return row;
      });
      summaryRoot.querySelector('tbody').replaceChildren(...rows);
    },

    /** Re-labels lane titles after a language change. @param {(key: string) => string} t */
    retranslate(t) {
      for (const lane of lanes) {
        lane.title.textContent = t(`algo.${lane.id}.name`);
        lane.chart.setTranslator(t);
      }
    },
  };
}
