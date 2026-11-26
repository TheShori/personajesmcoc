/* Searchable dropdowns over the existing native selects. Keep every option in
 * the source catalogue so filtering never changes either renderer's selection.
 */
(() => {
  'use strict';
  const normalize = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
  const pickers = [];

  for (const id of ['px-stars-character-select', 'px-ascension-character-select']) {
    const select = document.getElementById(id);
    if (!select) continue;
    const wrapper = document.createElement('div');
    wrapper.className = 'px-champion-picker';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.id = `${id}-trigger`;
    trigger.className = 'px-champion-picker__trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const popup = document.createElement('div');
    popup.className = 'px-champion-picker__popup';
    popup.hidden = true;
    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'Buscar campeón…';
    search.autocomplete = 'off';
    search.spellcheck = false;
    search.setAttribute('role', 'combobox');
    search.setAttribute('aria-label', 'Buscar campeón');
    search.setAttribute('aria-autocomplete', 'list');
    search.setAttribute('aria-expanded', 'false');
    const list = document.createElement('div');
    list.id = `${id}-results`;
    list.className = 'px-champion-picker__list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Personajes');
    search.setAttribute('aria-controls', list.id);
    trigger.setAttribute('aria-controls', list.id);
    const notice = document.createElement('p');
    notice.className = 'px-champion-picker__notice';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    popup.append(search, list, notice);
    wrapper.append(trigger, popup);
    select.after(wrapper);
    select.hidden = true;
    const label = document.querySelector(`label[for="${id}"]`);
    if (label) label.htmlFor = trigger.id;

    let matches = [], active = -1;
    function sync() {
      trigger.textContent = select.selectedOptions[0]?.textContent || 'Elige un personaje…';
      trigger.disabled = select.disabled || !select.options.length;
    }
    function highlight(index, scroll = false) {
      active = index;
      [...list.children].forEach((node, i) => node.classList.toggle('is-highlighted', i === active));
      const node = list.children[active];
      if (node) {
        search.setAttribute('aria-activedescendant', node.id);
        if (scroll) node.scrollIntoView({block: 'nearest'});
      } else search.removeAttribute('aria-activedescendant');
    }
    function render() {
      const tokens = normalize(search.value).trim().split(/\s+/).filter(Boolean);
      matches = [...select.options].filter(option => !option.disabled && tokens.every(token => normalize(option.textContent).includes(token)));
      list.replaceChildren(...matches.map((option, i) => {
        const item = document.createElement('div');
        item.id = `${id}-option-${i}`;
        item.className = 'px-champion-picker__option';
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', String(option.value === select.value));
        item.textContent = option.textContent;
        item.addEventListener('mousedown', event => event.preventDefault());
        item.addEventListener('click', () => choose(i));
        return item;
      }));
      notice.textContent = matches.length ? `${matches.length} personajes disponibles` : 'No se encontraron personajes.';
      highlight(matches.length ? Math.max(0, matches.findIndex(o => o.value === select.value)) : -1);
    }
    function close(focus = false) {
      popup.hidden = true;
      wrapper.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      search.setAttribute('aria-expanded', 'false');
      search.removeAttribute('aria-activedescendant');
      if (focus) trigger.focus();
    }
    function open() {
      pickers.forEach(picker => picker.close());
      sync();
      if (trigger.disabled) return;
      search.value = '';
      render();
      popup.hidden = false;
      wrapper.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      search.setAttribute('aria-expanded', 'true');
      list.scrollTop = 0;
      search.focus();
    }
    function choose(index) {
      if (!matches[index]) return;
      select.value = matches[index].value;
      select.dispatchEvent(new Event('input', {bubbles: true}));
      select.dispatchEvent(new Event('change', {bubbles: true}));
      sync();
      close(true);
    }
    trigger.addEventListener('click', () => popup.hidden ? open() : close());
    trigger.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); open(); }
    });
    search.addEventListener('input', render);
    search.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); close(true); }
      if (event.key === 'Enter') { event.preventDefault(); choose(active); }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (matches.length) highlight((active + (event.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length, true);
      }
    });
    wrapper.addEventListener('focusout', () => queueMicrotask(() => {
      if (!wrapper.contains(document.activeElement)) close();
    }));
    document.addEventListener('pointerdown', event => { if (!wrapper.contains(event.target)) close(); });
    select.addEventListener('change', sync);
    document.addEventListener('px:champion-selected', sync);
    document.addEventListener('px:mode-changed', () => { close(); sync(); });
    new MutationObserver(() => { sync(); if (!popup.hidden) render(); })
      .observe(select, {childList: true, attributes: true, attributeFilter: ['disabled']});
    pickers.push({close});
    sync();
  }
})();
