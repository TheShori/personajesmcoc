/**
 * PORTRAYER STUDIO — selector de personajes sencillo (TEST).
 *
 * No abre ventanas, no mueve el editor original, no hace consultas a GitHub.
 * En Retrato clásico se usa directamente el selector del motor original.
 * En Ficha de estrellas se muestra un segundo <select> sincronizado con aquel.
 */
(() => {
  'use strict';
  const app = document.getElementById('app');
  const mirror = document.getElementById('px-stars-character-select');
  if (!app || !mirror) return;

  let nativeControl = null;
  let observer = null;
  let refreshQueued = false;
  let currentOptionsKey = '';
  let proxy = null;

  function normalise(text) {
    return String(text ?? '').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim().toLowerCase();
  }

  function getNativeControl() {
    const label = [...app.querySelectorAll('label')].find(item =>
      /personaje\s+a\s+elegir|champion\s+to\s+choose|select\s+champion|selecciona\s+personaje/i.test(item.textContent || '')
    );
    if (label) {
      const inLabel = label.querySelector('select, input[list]');
      if (inLabel) return inLabel;
      const group = label.closest('.input-group') || label.parentElement;
      const inGroup = group?.querySelector('select, input[list]');
      if (inGroup) return inGroup;
      const next = label.nextElementSibling;
      if (next?.matches?.('select,input[list]')) return next;
    }
    return app.querySelector('select:not(#ascensionLevel):not([id^="px-"]), input[list]');
  }

  function getOptions(control) {
    if (!control) return [];
    const options = control.tagName === 'SELECT'
      ? Array.from(control.options)
      : Array.from(control.list?.options || app.querySelector('datalist')?.options || []);
    return options.map(option => ({
      value: String(option.value || ''),
      label: String(option.label || option.textContent || option.value || '').trim()
    })).filter(option => option.value || option.label);
  }

  function dispatchSelection(value) {
    document.dispatchEvent(new CustomEvent('px:champion-selected', {
      detail: { name: value, value }
    }));
  }

  function writeNativeValue(control, value) {
    const prototype = control.tagName === 'SELECT'
      ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter) setter.call(control, value);
    else control.value = value;
    control.dispatchEvent(new Event('input', {bubbles: true}));
    control.dispatchEvent(new Event('change', {bubbles: true}));
  }

  function rebuildOptions(control) {
    const options = getOptions(control);
    if (!options.length) return;
    const key = options.map(o => o.value + '\u0000' + o.label).join('\u0001');
    if (key !== currentOptionsKey) {
      function makeOptions() {
        const fragment = document.createDocumentFragment();
        for (const {value,label} of options) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = label || value;
          fragment.append(option);
        }
        return fragment;
      }
      mirror.replaceChildren(makeOptions());
      mirror.disabled = false;
      if (proxy) proxy.replaceChildren(makeOptions());
      currentOptionsKey = key;
    }
  }

  function syncFromNative() {
    const control = nativeControl;
    if (!control) return;
    rebuildOptions(control);
    if (control.value && mirror.value !== control.value) mirror.value = control.value;
    if (proxy && proxy.value !== control.value) proxy.value = control.value;
    dispatchSelection(control.value || '');
  }

  function bindNative(control) {
    if (!control || nativeControl === control) return;
    if (nativeControl) {
      nativeControl.removeEventListener('change', syncFromNative);
      nativeControl.removeEventListener('input', syncFromNative);
    }
    proxy?.remove();
    proxy = null;
    nativeControl = control;
    nativeControl.addEventListener('change', syncFromNative);
    nativeControl.addEventListener('input', syncFromNative);
    currentOptionsKey = '';

    // Algunas versiones del motor usan <input list=…> en vez de <select>.
    // En ese caso lo conservamos para Vue pero mostramos un desplegable real.
    if (control.tagName === 'INPUT' && getOptions(control).length) {
      proxy = document.createElement('select');
      proxy.className = 'px-champion-native-proxy';
      proxy.setAttribute('aria-label', 'Personaje a elegir');
      proxy.addEventListener('change', () => {
        if (proxy.value !== control.value) writeNativeValue(control, proxy.value);
        else dispatchSelection(proxy.value);
      });
      control.insertAdjacentElement('afterend', proxy);
      control.classList.add('px-champion-native-hidden');
    }
  }

  function refresh() {
    refreshQueued = false;
    const control = getNativeControl();
    if (!control) return;
    bindNative(control);
    syncFromNative();
  }

  function queueRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(refresh);
  }

  mirror.addEventListener('change', () => {
    const control = nativeControl || getNativeControl();
    if (!control) return;
    const value = mirror.value;
    if (value !== control.value) writeNativeValue(control,value);
    else dispatchSelection(value);
  });

  // Vue monta el selector de forma asíncrona y en ocasiones reconstruye las options.
  // Observar SOLO sus cambios de DOM mantiene la lista actualizada sin duplicar botones.
  observer = new MutationObserver(queueRefresh);
  observer.observe(app, {childList: true, subtree: true, characterData: true});
  queueRefresh();
  window.addEventListener('pageshow', queueRefresh);
})();
