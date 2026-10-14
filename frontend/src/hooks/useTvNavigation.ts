import { useEffect } from 'react';
import { Platform } from 'react-native';

type Direction = 'up' | 'down' | 'left' | 'right';

function isVideoElement(el: Element | null): boolean {
  if (!el) return false;
  return (
    el.tagName === 'VIDEO' ||
    el.getAttribute('data-video-player') === 'true' ||
    !!el.closest('video, [data-video-player="true"]')
  );
}

function getActiveModal(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector<HTMLElement>(
    '[data-modal-container="true"], [role="dialog"], [aria-modal="true"]'
  );
}

function getCandidates(): HTMLElement[] {
  const modal = getActiveModal();
  const scope: HTMLElement = modal || document.body;
  const sel =
    'button, a, input, textarea, video, [role="button"], [tabindex="0"], [data-focusable="true"], [data-video-player="true"]';
  return Array.from(scope.querySelectorAll<HTMLElement>(sel)).filter((el) => {
    if (el.getAttribute('aria-hidden') === 'true' || el.style.display === 'none') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

function moveFocus(dir: Direction) {
  const candidates = getCandidates();
  if (candidates.length === 0) return;
  const current = document.activeElement as HTMLElement;

  if (!current || current === document.body || !candidates.includes(current)) {
    candidates[0]?.focus();
    return;
  }
  const cR = current.getBoundingClientRect();
  const cC = { x: cR.left + cR.width / 2, y: cR.top + cR.height / 2 };
  let best: HTMLElement | null = null;
  let bestDist = Infinity;

  for (const t of candidates) {
    if (t === current || t.contains(current) || current.contains(t)) continue;
    const tR = t.getBoundingClientRect();
    const tC = { x: tR.left + tR.width / 2, y: tR.top + tR.height / 2 };
    const dx = tC.x - cC.x;
    const dy = tC.y - cC.y;
    if (dir === 'right' && dx <= 5) continue;
    if (dir === 'left' && dx >= -5) continue;
    if (dir === 'down' && dy <= 5) continue;
    if (dir === 'up' && dy >= -5) continue;
    const dist =
      dir === 'left' || dir === 'right'
        ? Math.abs(dx) + Math.abs(dy) * 2.2
        : Math.abs(dy) + Math.abs(dx) * 1.8;
    if (dist < bestDist) {
      bestDist = dist;
      best = t;
    }
  }
  if (best) {
    best.focus();
    best.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }
}

export function useTvNavigation() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const isVideo = isVideoElement(active);
      const isInput = active ? ['INPUT', 'TEXTAREA'].includes(active.tagName) : false;
      const modal = getActiveModal();

      // Gestion touche Retour / Escape : libère immédiatement le focus du champ
      if (['Escape', 'BrowserBack', 'GoBack'].includes(e.key)) {
        if (isInput) {
          e.preventDefault();
          active?.blur();
          return;
        }
        if (modal) {
          e.preventDefault();
          const closeBtn = modal.querySelector<HTMLElement>('[data-modal-close="true"]');
          if (closeBtn) {
            closeBtn.click();
            return;
          }
        }
        window.history.back();
        return;
      }

      // Gestion des champs de saisie & formulaires :
      // Sur TV / télécommande, les flèches Haut/Bas/Gauche/Droite permettent de naviguer
      // directement hors du champ sans se retrouver piégé entre les lettres.
      // La touche Entrée ouvre/maintient le clavier virtuel de l'OS client.
      if (isInput) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          moveFocus('down');
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          moveFocus('up');
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          moveFocus('left');
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          moveFocus('right');
          return;
        }
        if (e.key === 'Enter') {
          // Laisser l'événement standard ouvrir le clavier virtuel de l'OS hôte
          return;
        }
        return;
      }

      if (['ArrowLeft', 'ArrowRight'].includes(e.key) && isVideo) return;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        moveFocus(e.key.replace('Arrow', '').toLowerCase() as Direction);
      } else if (e.key === 'Enter' || e.key === 'Select') {
        if (active) active.click?.();
      }
    };

    let lastPad = 0;
    let animId: number;
    const pollPad = () => {
      const gp = navigator.getGamepads?.()?.[0];
      if (gp && Date.now() - lastPad > 220) {
        const [ax, ay] = [gp.axes[0] || 0, gp.axes[1] || 0];
        const isVideo = isVideoElement(document.activeElement);
        const modal = getActiveModal();

        if (gp.buttons[12]?.pressed || ay < -0.5) {
          moveFocus('up');
          lastPad = Date.now();
        } else if (gp.buttons[13]?.pressed || ay > 0.5) {
          moveFocus('down');
          lastPad = Date.now();
        } else if (gp.buttons[14]?.pressed || ax < -0.5) {
          if (isVideo) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
          else moveFocus('left');
          lastPad = Date.now();
        } else if (gp.buttons[15]?.pressed || ax > 0.5) {
          if (isVideo) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
          else moveFocus('right');
          lastPad = Date.now();
        } else if (gp.buttons[0]?.pressed) {
          (document.activeElement as HTMLElement)?.click?.();
          lastPad = Date.now();
        } else if (gp.buttons[1]?.pressed) {
          if (modal) {
            const closeBtn = modal.querySelector<HTMLElement>('[data-modal-close="true"]');
            if (closeBtn) closeBtn.click();
            else window.history.back();
          } else {
            window.history.back();
          }
          lastPad = Date.now();
        }
      }
      animId = requestAnimationFrame(pollPad);
    };

    window.addEventListener('keydown', onKey);
    animId = requestAnimationFrame(pollPad);
    return () => {
      window.removeEventListener('keydown', onKey);
      cancelAnimationFrame(animId);
    };
  }, []);
}
