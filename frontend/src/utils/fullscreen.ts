/**
 * Gestionnaire universel Plein Écran (Desktop, Navigateurs Mobiles, Smart TV, WebOS, Tizen)
 * Inclut un anti-rebond (debounce) de 450ms pour empêcher les doubles bascules accidentelles
 * (ex: événement Enter natif + click synthétique d'accessibilité).
 */

let lastToggleTimestamp = 0;

export function isFullscreenActive(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as any;
  return Boolean(
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  );
}

export function toggleFullscreen(targetElement?: HTMLElement | null): boolean {
  if (typeof document === 'undefined') return false;

  const now = Date.now();
  if (now - lastToggleTimestamp < 450) {
    return isFullscreenActive();
  }
  lastToggleTimestamp = now;

  const doc = document as any;
  const isFs = isFullscreenActive();

  if (!isFs) {
    const el = (targetElement || document.documentElement) as any;
    const req =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.mozRequestFullScreen ||
      el.msRequestFullscreen;
    if (req) {
      try {
        const p = req.call(el);
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      } catch {}
      return true;
    }
  } else {
    const exit =
      doc.exitFullscreen ||
      doc.webkitExitFullscreen ||
      doc.mozCancelFullScreen ||
      doc.msExitFullscreen;
    if (exit) {
      try {
        const p = exit.call(doc);
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      } catch {}
      return false;
    }
  }
  return false;
}
