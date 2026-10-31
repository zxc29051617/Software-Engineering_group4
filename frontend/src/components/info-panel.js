/**
 * Algorithm facts: description, complexity table, properties, what to watch.
 * @module components/info-panel
 */

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
 * Yes / no / not applicable label for a property.
 * @param {boolean|null} value
 */
export function propertyKey(value) {
  if (value === null) return 'info.na';
  return value ? 'info.yes' : 'info.no';
}

/**
 * @param {HTMLElement} root
 */
export function createInfoPanel(root) {
  return {
    /**
     * @param {import('../../../backend/algorithms/index.js').Algorithm} algorithm
     * @param {(key: string, params?: object) => string} t
     */
    render(algorithm, t) {
      const description = element('p', 'info-description', t(`algo.${algorithm.id}.desc`));

      const table = element('table', 'complexity');
      const caption = element('caption', '', t('info.time'));
      const head = element('tr');
      const body = element('tr');
      for (const key of ['best', 'average', 'worst', 'space']) {
        const th = element('th', '', t(`info.${key}`));
        th.scope = 'col';
        head.append(th);
        body.append(element('td', '', algorithm.complexity[key]));
      }
      table.append(caption, element('thead'), element('tbody'));
      table.tHead.append(head);
      table.tBodies[0].append(body);

      const properties = element('ul', 'properties');
      properties.setAttribute('aria-label', t('info.properties'));
      const facts = [
        ['stable', algorithm.stable, algorithm.stable === null ? 'info.stableNaHint' : 'info.stableHint'],
        ['inPlace', algorithm.inPlace, 'info.inPlaceHint'],
        ['adaptive', algorithm.adaptive, 'info.adaptiveHint'],
        ['comparison', algorithm.comparison, 'info.comparisonHint'],
      ];
      for (const [name, value, hintKey] of facts) {
        const item = element('li', 'property');
        item.dataset.value = value === null ? 'na' : String(value);
        item.title = t(hintKey);
        item.append(element('span', 'property-name', t(`info.${name}`)), element('span', 'property-value', t(propertyKey(value))));
        properties.append(item);
      }

      const tip = element('div', 'info-tip');
      tip.append(element('h3', '', t('info.tip')), element('p', '', t(`algo.${algorithm.id}.tip`)));

      root.replaceChildren(description, table, properties, tip);
    },
  };
}
