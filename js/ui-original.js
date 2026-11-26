/**
 * Portrayer — selectores originales, sin biblioteca emergente.
 * MODO CLÁSICO: respeta el selector real de Vue.
 * Si Vue usa input+datalist, muestra UN <select> y deja el input oculto
 * únicamente como fuente de datos para el motor original.
 * MODO ESTRELLAS: sincroniza su lista con el mismo selector.
 */
(() => {
  'use strict';
  const app = document.getElementById('app');
  const stars = document.getElementById('px-stars-character-select');
  if (!app || !stars) return;

  let original = null;
  let originalType = '';
  let classicSelect = null;
  let classicWrapper = null;
  let optionsHash = '';
  let syncing = false;
  const choiceOptions = new Map();

  const selectorLabel = /personaje\s+a\s+elegir|champion\s+to\s+choose|select champion|selecciona personaje/i;

  function locate() {
    const labels = [...app.querySelectorAll('label')];
    const label = labels.find(l => selectorLabel.test(l.textContent || ''));
    if (label) {
      const group = label.closest('.input-group') || label.parentElement;
      return label.querySelector('select:not(.px-champion-proxy),input[list]') ||
        group?.querySelector('select:not(.px-champion-proxy),input[list]') ||
        label.nextElementSibling?.matches('select,input[list]') && label.nextElementSibling;
    }
    return app.querySelector('input[list],select:not(#ascensionLevel):not(.px-champion-proxy)');
  }

  function getOptions(control) {
    if (!control) return [];
    // Choices keeps only the active option in its native select. Read its
    // rendered catalogue and retain entries while the search filters the list.
    const picker = control.closest('.choices');
    if (picker) {
      for (const item of picker.querySelectorAll('[data-choice][data-value]')) {
        choiceOptions.set(item.dataset.value, {
          value: item.dataset.value, text: item.textContent.trim()
        });
      }
      if (choiceOptions.size) return [...choiceOptions.values()];
    }
    const list = control.tagName === 'SELECT'
      ? control.options
      : (control.list?.options || app.querySelector('datalist')?.options);
    if (!list) return [];
    return Array.from(list, o => ({
      value: String(o.value || ''),
      text: String(o.label || o.textContent || o.value || '').trim()
    })).filter(o => o.value !== '');
  }

  function setModel(control, value) {
    if (!control || value === control.value) return;
    const picker = control.closest('.choices');
    if (picker) {
      // Let Choices update its own selection and emit the original Vue event.
      // Restore all choices first if the previous search filtered the target out.
      const search = picker.querySelector('input[type="search"]');
      if (search && search.value) {
        search.value = '';
        search.dispatchEvent(new KeyboardEvent('keyup', {bubbles:true, key:'Backspace', keyCode:8}));
      }
      const item = [...picker.querySelectorAll('[data-choice][data-value]')]
        .find(node => node.dataset.value === value);
      if (item) {
        item.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true}));
        return;
      }
    }
    const proto = control.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(control, value);
    if (control.value !== value) control.value = value;
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function announce(value) {
    document.dispatchEvent(new CustomEvent('px:champion-selected',
      {detail: { name: value, value }}));
  }

  function buildProxy(control) {
    if (control.tagName !== 'INPUT') return;
    classicSelect?.remove();
    classicSelect = document.createElement('select');
    classicSelect.className = 'px-champion-proxy';
    classicSelect.setAttribute('aria-label','Personaje a elegir');
    classicSelect.addEventListener('change', () => {
      setModel(control, classicSelect.value);
      announce(classicSelect.value);
    });

    // Un único desplegable visible: se oculta la entrada antigua, pero
    // permanece conectada a Vue y sigue recibiendo input/change.
    const group = control.closest('.input-group') || control.closest('label') || control.parentElement;
    const parent = control.parentElement;
    control.classList.add('px-original-champion-input');
    if (group) group.classList.add('px-champion-source-group');
    if (parent && parent !== group) {
      parent.classList.add('px-champion-native-container');
    } else if (group) {
      group.classList.add('px-champion-native-container');
    }
    (group || parent || app).appendChild(classicSelect);
  }

  function ensureControl(control) {
    if (!control || original === control) return;
    if (original) {
      original.removeEventListener('change', fromOriginal);
      original.removeEventListener('input', fromOriginal);
      original.classList.remove('px-original-champion-input');
    }
    classicWrapper?.classList.remove('px-champion-native-container');
    classicSelect?.remove();
    classicSelect = null;
    original = control;
    originalType = control.tagName;
    optionsHash = '';
    classicWrapper = original.parentElement;
    original.addEventListener('change', fromOriginal);
    original.addEventListener('input', fromOriginal);
    if (control.tagName === 'INPUT') buildProxy(control);
  }

  function renderOptions(control) {
    const options = getOptions(control);
    if (!options.length) return;
    const hash = options.map(o=>o.value+'\u0001'+o.text).join('\u0002');
    if (hash !== optionsHash) {
      optionsHash = hash;
      for (const select of [stars, classicSelect].filter(Boolean)) {
        const f = document.createDocumentFragment();
        for (const opt of options) {
          const node = document.createElement('option');
          node.value = opt.value;
          node.textContent = opt.text || opt.value;
          f.appendChild(node);
        }
        select.replaceChildren(f);
        select.disabled = false;
      }
    }
  }

  function fromOriginal() {
    if (!original || syncing) return;
    syncing = true;
    try {
      renderOptions(original);
      if (stars.value !== original.value) stars.value = original.value;
      if (classicSelect && classicSelect.value !== original.value) classicSelect.value = original.value;
    } finally { syncing = false; }
    announce(original.value);
  }

  stars.addEventListener('change', () => {
    if (!original) refresh();
    if (!original) return;
    setModel(original, stars.value);
    fromOriginal();
  });

  function refresh() {
    const download = app.querySelector('button.button-contest');
    if (download && download.textContent.trim() === 'DOWNLOAD') download.textContent = '↓ Descargar retrato PNG';
    const search = app.querySelector('.choices input[type="search"]');
    if (search && search.getAttribute('aria-label') !== 'Buscar campeón') {
      search.setAttribute('aria-label', 'Buscar campeón');
      search.placeholder = 'Buscar campeón…';
    }
    const c = locate();
    if (c) {
      ensureControl(c);
      renderOptions(c);
      if (stars.value !== c.value && c.value) stars.value = c.value;
      if (classicSelect && classicSelect.value !== c.value && c.value) classicSelect.value = c.value;
    }
  }

  // Vue monta la aplicación después del DOM principal. Revisión de opciones
  // a intervalo moderado, sin observar los cambios de los canvas.
  const timer = setInterval(refresh, 900);
  refresh();
  window.addEventListener('pageshow', refresh);
  window.addEventListener('load', refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();
