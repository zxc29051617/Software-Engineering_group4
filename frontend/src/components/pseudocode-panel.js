/**
 * Pseudocode listing with the current line highlighted.
 * @module components/pseudocode-panel
 */

/**
 * @param {HTMLOListElement} list
 */
export function createPseudocodePanel(list) {
  /** @type {HTMLLIElement[]} */
  let items = [];
  let active = 0;

  /** Scrolls the panel (not the page) so the active line is visible. */
  function keepVisible(item) {
    const top = item.offsetTop - list.offsetTop;
    const bottom = top + item.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }

  return {
    /** @param {string[]} lines */
    setLines(lines) {
      items = lines.map((text) => {
        const item = document.createElement('li');
        const code = document.createElement('code');
        code.textContent = text;
        item.append(code);
        return item;
      });
      list.replaceChildren(...items);
      list.scrollTop = 0;
      active = 0;
    },

    /** @param {number} line  1-based; 0 clears the highlight */
    highlight(line) {
      if (line === active) return;
      items[active - 1]?.classList.remove('is-active');
      items[active - 1]?.removeAttribute('aria-current');
      active = line;
      const item = items[line - 1];
      if (!item) return;
      item.classList.add('is-active');
      item.setAttribute('aria-current', 'step');
      keepVisible(item);
    },
  };
}
