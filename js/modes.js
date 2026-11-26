/* Shared navigation. Keep all three renderers mounted and their settings intact. */
(() => {
  'use strict';
  const tabs = [...document.querySelectorAll('.px-mode-tab')];
  const modes = ['original', 'stars', 'ascension'];
  function activate(index, focus = false) {
    tabs.forEach((tab, i) => {
      const active = i === index;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      tab.classList.toggle('is-active', active);
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
    });
    document.body.classList.toggle('px-stars-mode', modes[index] === 'stars');
    document.body.classList.toggle('px-ascension-mode', modes[index] === 'ascension');
    document.dispatchEvent(new CustomEvent('px:mode-changed', {detail: {mode: modes[index]}}));
    if (focus) tabs[index].focus();
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => activate(i));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (i + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (i + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      activate(next, true);
    });
  });
  activate(0);
})();
