/* Ascension token: original border, restored empty background, separate portrait.
 * Coordinates use the reference's native 256px square, scaled for 500px export.
 */
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const canvas = el('px-ascension-canvas');
  const select = el('px-ascension-character-select');
  const source = el('px-stars-character-select');
  const status = el('px-ascension-status');
  const download = el('px-ascension-download');
  if (!canvas || !select || !source) return;
  const ctx = canvas.getContext('2d');
  const state = {frame: null, background: null, portrait: null, champion: '', loading: false, error: '', revision: 0};

  // Inner opening follows the two projecting gold corners. The supplied frame
  // is copied everywhere outside this opening, preserving its original pixels.
  const opening = new Path2D('M 94 40 L 208 43 L 208 161 L 195 164 L 192 188 L 169 192 L 162 207 L 47 207 L 47 93 L 61 89 L 65 65 L 87 60 Z');
  const border = new Path2D();
  border.rect(0, 0, 256, 256);
  border.addPath(opening);

  function loadImage(path) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('No se pudo cargar ' + path));
      image.setAttribute('src', path);
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const ready = state.frame && state.background;
    download.disabled = !ready || state.loading || !!state.error;
    el('px-ascension-clear').disabled = !select.value;
    if (!ready) return;
    ctx.save();
    ctx.scale(canvas.width / 256, canvas.height / 256);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.save();
    ctx.clip(opening);
    ctx.fillStyle = '#ded0f5';
    ctx.fillRect(0, 0, 256, 256);
    ctx.drawImage(state.background, 0, 0, 256, 256);
    if (state.portrait) ctx.drawImage(state.portrait, 45, 40, 166, 168);
    ctx.restore();
    ctx.save();
    ctx.clip(border, 'evenodd');
    ctx.drawImage(state.frame, 0, 0, 256, 256);
    ctx.restore();
    ctx.restore();
    const name = select.selectedOptions[0]?.textContent || '';
    canvas.setAttribute('aria-label', state.portrait ? `Ficha Ascensión+ de ${name}` : 'Ficha Ascensión+ vacía, con marco dorado y fondo violeta');
    status.textContent = state.error || (state.loading ? 'Cargando personaje…' : state.portrait ? `${name} · ficha lista para descargar.` : 'Marco vacío listo. Selecciona un personaje o descárgalo así.');
  }

  function copyCatalogue() {
    const options = window.PortrayerChampions?.length
      ? window.PortrayerChampions
      : [...source.options].filter(option => option.value).map(option => ({value: option.value, text: option.textContent}));
    if (!options.length) return;
    const value = select.value;
    select.replaceChildren(new Option('Sin personaje · marco vacío', ''), ...options.map(o => new Option(o.text, o.value)));
    select.value = value;
    select.disabled = false;
  }
  new MutationObserver(copyCatalogue).observe(source, {childList: true});
  copyCatalogue();
  document.addEventListener('px:catalogue-updated', () => { copyCatalogue(); syncChampion(); });

  async function chooseChampion() {
    const slug = select.value;
    if (slug === state.champion && !state.error) { draw(); return; }
    const revision = ++state.revision;
    state.champion = slug;
    state.portrait = null;
    state.error = '';
    state.loading = !!slug;
    draw();
    if (!slug) return;
    try {
      if (!/^[a-zA-Z0-9_-]+$/.test(slug)) throw new Error('Invalid portrait name');
      const image = await loadImage(window.PortrayerCatalogue.portraitURL(slug));
      if (revision !== state.revision) return;
      state.portrait = image;
    } catch (error) {
      if (revision !== state.revision) return;
      state.error = 'No se pudo cargar este personaje. Selecciona otro o vuelve a intentarlo.';
      console.warn('[Ascensión+]', error);
    }
    if (revision !== state.revision) return;
    state.loading = false;
    draw();
  }
  function syncChampion(value = window.PortrayerSelection?.value) {
    if (!value || ![...select.options].some(option => option.value === value)) return;
    select.value = value;
    chooseChampion();
  }
  select.addEventListener('change', () => {
    chooseChampion();
    if (select.value) document.dispatchEvent(new CustomEvent('px:champion-requested', {
      detail: {value: select.value}
    }));
  });
  document.addEventListener('px:champion-selected', event => syncChampion(event.detail?.value));
  el('px-ascension-clear').addEventListener('click', () => {
    select.value = '';
    select.dispatchEvent(new Event('change', {bubbles: true}));
  });
  document.addEventListener('px:mode-changed', event => {
    if (event.detail.mode === 'ascension') { syncChampion(); draw(); }
  });
  syncChampion();
  download.addEventListener('click', () => {
    draw();
    if (download.disabled) return;
    window.PortrayerPNG.saveCanvas(canvas, `mcoc-${select.value || 'marco-vacio'}-ascension-plus.png`);
  });
  Promise.all([
    loadImage('./assets/ascension-token-reference.png'),
    loadImage('./assets/ascension-token-empty.png')
  ]).then(([frame, background]) => {
    state.frame = frame;
    state.background = background;
    draw();
  }).catch(error => {
    status.textContent = 'No se pudo cargar el marco. Recarga la página para volver a intentarlo.';
    console.warn('[Ascensión+]', error);
  });
})();
