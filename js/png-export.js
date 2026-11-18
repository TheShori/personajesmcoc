/**
 * Portrayer: exportación PNG preparada durante el gesto del usuario.
 * No hay esperas (toBlob, fetch, fuentes) entre el toque y share/download.
 * iOS/iPadOS: menú nativo Compartir con archivo PNG + vista para guardar manualmente.
 * Escritorio/Android: descarga directa mediante enlace data:image/png.
 */
(() => {
  'use strict';
  if (window.PortrayerPNG) return;
  const onAppleTouch = () => /iP(?:ad|hone|od)/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let preview = null;
  let current = null;

  function pngData(canvas) {
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('No se encontró el lienzo del retrato.');
    const data = canvas.toDataURL('image/png');
    if (!data.startsWith('data:image/png;base64,')) throw new Error('No se pudo generar el PNG.');
    return data;
  }

  // Toda la conversión de base64 a File es síncrona para conservar la activación de Safari.
  function asFile(data, name) {
    const decoded = atob(data.slice(data.indexOf(',') + 1));
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
    return new File([bytes], name, {type: 'image/png'});
  }

  function ensurePreview() {
    if (preview) return preview;
    preview = document.createElement('dialog');
    preview.id = 'px-png-save-dialog';
    preview.className = 'px-png-save-dialog';
    preview.setAttribute('aria-label', 'Guardar retrato PNG');
    preview.innerHTML = `
      <div class="px-png-save-header">
        <div><strong>Tu retrato está listo</strong><small>PNG · imagen original con transparencia</small></div>
        <button class="px-png-close" type="button" aria-label="Cerrar">×</button>
      </div>
      <div class="px-png-save-image"><img alt="Retrato PNG para guardar en el dispositivo"></div>
      <p class="px-png-save-hint">En iPhone, mantén pulsada la imagen y elige <b>Guardar en Fotos</b>, o usa <b>Compartir PNG</b> para guardarla en Archivos.</p>
      <div class="px-png-save-actions">
        <button class="px-png-share" type="button">Compartir PNG</button>
        <a class="px-png-download-link" download="retrato.png">Descargar PNG</a>
      </div>`;
    document.body.appendChild(preview);
    preview.querySelector('.px-png-close').addEventListener('click', () => preview.close());
    preview.addEventListener('click', (e) => { if (e.target === preview) preview.close(); });
    preview.querySelector('.px-png-share').addEventListener('click', () => {
      if (!current) return;
      shareOrPreview(current.data, current.filename, true);
    });
    return preview;
  }

  function showPreview(data, filename) {
    current = {data, filename};
    const dialog = ensurePreview();
    dialog.querySelector('img').src = data;
    const link = dialog.querySelector('.px-png-download-link');
    link.href = data;
    link.download = filename;
    if (!dialog.open) dialog.showModal();
  }

  function shareOrPreview(data, filename, fromPreview = false) {
    try {
      if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
        showPreview(data, filename);
        return;
      }
      const file = asFile(data, filename);
      if (!navigator.canShare({files:[file]})) {
        showPreview(data, filename);
        return;
      }
      // Esta llamada sucede sin await, directamente en el click real.
      navigator.share({files:[file], title:'Retrato MCoC', text:'PNG de Portrayer Studio'})
        .catch(error => {
          if (error?.name !== 'AbortError') {
            console.warn('[Portrayer] Compartir no disponible', error);
            showPreview(data, filename);
          }
        });
    } catch (error) {
      console.warn('[Portrayer] No se pudo usar Compartir', error);
      showPreview(data, filename);
    }
  }

  function saveCanvas(canvas, filename = 'portrayer.png', { previewOnly = false } = {}) {
    let data;
    try {
      data = pngData(canvas);
    } catch (error) {
      console.error('[Portrayer] Error de exportación', error);
      window.alert('No se pudo generar el PNG. Revisa que el retrato haya terminado de cargar y vuelve a intentarlo.');
      return false;
    }
    if (previewOnly) {
      showPreview(data, filename);
      return true;
    }
    if (onAppleTouch()) {
      shareOrPreview(data, filename);
      return true;
    }
    const anchor = document.createElement('a');
    anchor.href = data;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click(); // Sigue estando dentro de la activación del usuario.
    anchor.remove();
    return true;
  }

  window.PortrayerPNG = Object.freeze({saveCanvas, showPreview, isAppleTouch: onAppleTouch});
})();
