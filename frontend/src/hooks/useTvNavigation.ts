import { useEffect } from 'react';
import { Platform } from 'react-native';
import { toggleFullscreen, isFullscreenActive } from '@/utils/fullscreen';

type Direction = 'up' | 'down' | 'left' | 'right';

function isVideoElement(el: Element | null): boolean {
  if (!el) return false;
  if (el.getAttribute('data-skip-intro') === 'true' || el.closest('[data-skip-intro="true"]')) {
    return false;
  }
  if (el.getAttribute('data-player-topbar') === 'true' || el.closest('[data-player-topbar="true"]')) {
    return false;
  }
  return (
    el.tagName === 'VIDEO' ||
    el.getAttribute('data-video-player') === 'true' ||
    el.getAttribute('data-player-container') === 'true' ||
    !!el.closest('video, [data-video-player="true"], [data-player-container="true"]')
  );
}

function getActiveModal(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const modals = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-modal-container="true"], [role="dialog"], [aria-modal="true"]'
    )
  ).filter((m) => {
    if (
      m.getAttribute('aria-hidden') === 'true' ||
      m.style.display === 'none' ||
      m.hasAttribute('inert')
    ) {
      return false;
    }
    const r = m.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  return modals.length > 0 ? modals[modals.length - 1] : null;
}

function isElementVisibleAndActive(el: HTMLElement): boolean {
  if (
    el.getAttribute('aria-hidden') === 'true' ||
    el.getAttribute('data-modal-backdrop') === 'true' ||
    el.getAttribute('data-focusable') === 'false' ||
    el.tabIndex < 0 ||
    el.style.display === 'none' ||
    el.hasAttribute('inert')
  ) {
    return false;
  }
  if (el.closest('[aria-hidden="true"], [inert]')) {
    return false;
  }
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;

  // Filtrer les conteneurs d'arriere-plan accidentels plein écran
  if (
    typeof window !== 'undefined' &&
    r.width >= window.innerWidth * 0.95 &&
    r.height >= window.innerHeight * 0.95 &&
    el.tagName !== 'BODY' &&
    !isVideoElement(el)
  ) {
    return false;
  }

  return true;
}

function getCandidates(): HTMLElement[] {
  const modal = getActiveModal();
  const scope: HTMLElement = modal || document.body;
  const sel =
    'button, a, input, textarea, [role="button"], [role="link"], [tabindex="0"], [data-focusable="true"], [data-skip-intro="true"]';
  return Array.from(scope.querySelectorAll<HTMLElement>(sel)).filter(isElementVisibleAndActive);
}

function exitInputFocus(activeInput: HTMLElement) {
  const candidates = getCandidates();
  const eligible = candidates.filter(
    (c) => c !== activeInput && !activeInput.contains(c) && !c.contains(activeInput)
  );

  let nextTarget: HTMLElement | null = null;

  if (eligible.length > 0) {
    const aR = activeInput.getBoundingClientRect();
    const aC = { x: aR.left + aR.width / 2, y: aR.top + aR.height / 2 };

    const nonInputs = eligible.filter((c) => !['INPUT', 'TEXTAREA'].includes(c.tagName));
    const pool = nonInputs.length > 0 ? nonInputs : eligible;

    let bestForward: HTMLElement | null = null;
    let minForwardDist = Infinity;
    for (const c of pool) {
      const cR = c.getBoundingClientRect();
      const cC = { x: cR.left + cR.width / 2, y: cR.top + cR.height / 2 };
      const dy = cC.y - aC.y;
      const dx = cC.x - aC.x;
      if (dy > 5 || (Math.abs(dy) <= 20 && dx > 5)) {
        const dist = Math.hypot(dx, dy);
        if (dist < minForwardDist) {
          minForwardDist = dist;
          bestForward = c;
        }
      }
    }

    if (bestForward) {
      nextTarget = bestForward;
    } else {
      let minDist = Infinity;
      for (const c of pool) {
        const cR = c.getBoundingClientRect();
        const cC = { x: cR.left + cR.width / 2, y: cR.top + cR.height / 2 };
        const dist = Math.hypot(cC.x - aC.x, cC.y - aC.y);
        if (dist < minDist) {
          minDist = dist;
          nextTarget = c;
        }
      }
    }
  }

  activeInput.blur();

  if (nextTarget) {
    nextTarget.focus();
    nextTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }
}

/**
 * Algorithme de navigation spatiale directionnelle TV :
 * - Gestion directe des transitions écran lecteur /player (barre supérieure, bouton passer l'intro)
 * - Empêche strictement de sauter verticalement lors d'un déplacement horizontal
 * - Privilégie la rangée ou colonne visuelle directe
 */
function moveFocus(dir: Direction): boolean {
  const current = document.activeElement as HTMLElement | null;

  // 1. Gestion spécifique pour la page /player :
  // A. Si l'élément actif est le bouton "Passer l'intro"
  const isSkipIntroBtn =
    current &&
    (current.getAttribute('data-skip-intro') === 'true' || !!current.closest('[data-skip-intro="true"]'));

  if (isSkipIntroBtn) {
    if (dir === 'up') {
      const topBarButtons = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-player-topbar="true"] [role="button"], [data-player-topbar="true"] button, [data-player-topbar="true"] [tabindex="0"]'
        )
      ).filter(isElementVisibleAndActive);
      if (topBarButtons.length > 0) {
        // Cibler le bouton du haut le plus proche (le dernier, ex: Plein Écran)
        topBarButtons[topBarButtons.length - 1].focus();
        return true;
      }
    }
  }

  // B. Si l'élément actif est dans la topBar du player
  const isTopBar =
    current &&
    (current.getAttribute('data-player-topbar') === 'true' || !!current.closest('[data-player-topbar="true"]'));

  if (isTopBar && dir === 'down') {
    const skipBtn = document.querySelector<HTMLElement>('[data-skip-intro="true"]');
    if (skipBtn && isElementVisibleAndActive(skipBtn)) {
      skipBtn.focus();
      return true;
    }
  }

  // C. Si l'élément actif est la vidéo ou le lecteur
  if (isVideoElement(current)) {
    if (dir === 'up') {
      const topBarFirst = document.querySelector<HTMLElement>(
        '[data-player-topbar="true"] [role="button"], [data-player-topbar="true"] button, [data-player-topbar="true"] [tabindex="0"]'
      );
      if (topBarFirst && isElementVisibleAndActive(topBarFirst)) {
        topBarFirst.focus();
        return true;
      }
    } else if (dir === 'down') {
      const skipBtn = document.querySelector<HTMLElement>('[data-skip-intro="true"]');
      if (skipBtn && isElementVisibleAndActive(skipBtn)) {
        skipBtn.focus();
        return true;
      }
    }
  }

  const candidates = getCandidates();
  if (candidates.length === 0) return false;

  // Si aucun focus initial actif ou focus sur le body
  if (!current || current === document.body || !candidates.includes(current)) {
    // Si on est sur la page /player, favoriser en premier le premier bouton de la topBar
    const topBarFirst = document.querySelector<HTMLElement>(
      '[data-player-topbar="true"] [role="button"], [data-player-topbar="true"] button'
    );
    if (topBarFirst && isElementVisibleAndActive(topBarFirst)) {
      topBarFirst.focus();
      return true;
    }
    candidates[0]?.focus();
    return true;
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

    if (dir === 'right') {
      if (dx <= 2 || tR.right <= cR.right + 2) continue;
      const hasVOverlap = Math.max(cR.top, tR.top) < Math.min(cR.bottom, tR.bottom) + 12;
      if (!hasVOverlap && Math.abs(dy) > Math.abs(dx) * 1.2 && Math.abs(dy) > 35) continue;
      const dist = Math.abs(dx) + Math.abs(dy) * (hasVOverlap ? 0.8 : 5.0) + (hasVOverlap ? 0 : 500);
      if (dist < bestDist) {
        bestDist = dist;
        best = t;
      }
    } else if (dir === 'left') {
      if (dx >= -2 || tR.left >= cR.left - 2) continue;
      const hasVOverlap = Math.max(cR.top, tR.top) < Math.min(cR.bottom, tR.bottom) + 12;
      if (!hasVOverlap && Math.abs(dy) > Math.abs(dx) * 1.2 && Math.abs(dy) > 35) continue;
      const dist = Math.abs(dx) + Math.abs(dy) * (hasVOverlap ? 0.8 : 5.0) + (hasVOverlap ? 0 : 500);
      if (dist < bestDist) {
        bestDist = dist;
        best = t;
      }
    } else if (dir === 'up') {
      if (dy >= -2 || tR.top >= cR.top - 2) continue;
      const hasHOverlap = Math.max(cR.left, tR.left) < Math.min(cR.right, tR.right) + 20;
      const dist = Math.abs(dy) + Math.abs(dx) * (hasHOverlap ? 0.8 : 2.5) + (hasHOverlap ? 0 : 200);
      if (dist < bestDist) {
        bestDist = dist;
        best = t;
      }
    } else if (dir === 'down') {
      if (dy <= 2 || tR.bottom <= cR.bottom + 2) continue;
      const hasHOverlap = Math.max(cR.left, tR.left) < Math.min(cR.right, tR.right) + 20;
      const dist = Math.abs(dy) + Math.abs(dx) * (hasHOverlap ? 0.8 : 2.5) + (hasHOverlap ? 0 : 200);
      if (dist < bestDist) {
        bestDist = dist;
        best = t;
      }
    }
  }

  if (best) {
    best.focus();
    best.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    return true;
  }
  return false;
}

export function useTvNavigation() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const isVideo = isVideoElement(active);
      const isInput = active ? ['INPUT', 'TEXTAREA'].includes(active.tagName) : false;
      const modal = getActiveModal();

      const isEscape = e.key === 'Escape' || e.keyCode === 27;
      const isBackNav =
        ['BrowserBack', 'GoBack', 'Back'].includes(e.key) ||
        [10009, 461, 4].includes(e.keyCode);
      const isBackspace = e.key === 'Backspace' || e.keyCode === 8;

      // Touche plein écran universelle télécommande & clavier ('F', 'FullScreen', ou codes TV)
      const isFullscreenKey =
        e.key === 'f' ||
        e.key === 'F' ||
        e.key === 'FullScreen' ||
        e.key === 'F11' ||
        [10071, 10072, 184, 261].includes(e.keyCode);

      if (isFullscreenKey && !isInput) {
        const videoTarget = document.querySelector('video') || document.documentElement;
        if (videoTarget) {
          e.preventDefault();
          toggleFullscreen(videoTarget as HTMLElement);
          return;
        }
      }

      // Raccourci d'accès direct à la barre de recherche (touche '/' ou touche Search télécommande)
      const isSearchShortcut =
        e.key === '/' ||
        e.key === 'Search' ||
        e.key === 'BrowserSearch' ||
        [84, 170].includes(e.keyCode);

      if (isSearchShortcut && !isInput) {
        const searchInput =
          document.querySelector<HTMLInputElement>('[data-search-input="true"]') ||
          document.querySelector<HTMLInputElement>('input[type="text"], input:not([type="hidden"])');
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
          searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }

      // 1. Sortie immédiate d'un champ ou formulaire textuel sur Échap / Touche Retour
      if (isInput && active) {
        const inputVal = (active as HTMLInputElement).value || '';
        const isEmpty = inputVal.trim().length === 0;

        if (isEscape || isBackNav || (isBackspace && (isEmpty || e.altKey || e.ctrlKey))) {
          e.preventDefault();
          e.stopPropagation();
          exitInputFocus(active);
          return;
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const moved = moveFocus('down');
          if (!moved) exitInputFocus(active);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          const moved = moveFocus('up');
          if (!moved) exitInputFocus(active);
          return;
        }
        if (e.key === 'ArrowLeft') {
          const inputEl = active as HTMLInputElement;
          const atStart = inputEl.selectionStart === 0 && inputEl.selectionEnd === 0;
          if (atStart) {
            e.preventDefault();
            moveFocus('left');
            return;
          }
          return;
        }
        if (e.key === 'ArrowRight') {
          const inputEl = active as HTMLInputElement;
          const atEnd =
            inputEl.selectionStart === inputVal.length && inputEl.selectionEnd === inputVal.length;
          if (atEnd) {
            e.preventDefault();
            moveFocus('right');
            return;
          }
          return;
        }
        if (e.key === 'Enter') {
          return;
        }
        return;
      }

      // 2. Gestion de la touche Retour / Escape hors des champs de saisie
      if (isEscape || isBackNav) {
        if (isFullscreenActive()) {
          e.preventDefault();
          e.stopPropagation();
          toggleFullscreen();
          return;
        }
        if (modal) {
          e.preventDefault();
          e.stopPropagation();
          const closeBtn =
            modal.querySelector<HTMLElement>('[data-modal-close="true"]') ||
            modal.querySelector<HTMLElement>('[aria-label="Fermer"], [aria-label="Close"]');
          if (closeBtn) {
            closeBtn.click();
            return;
          }
          return;
        }
        window.history.back();
        return;
      }

      // 3. Navigation sur lecteur vidéo : laisser usePlayerControls gérer le seek
      // si le focus est sur le lecteur vidéo ou body
      const isTopBarActive = active && (active.getAttribute('data-player-topbar') === 'true' || !!active.closest('[data-player-topbar="true"]'));
      const isSkipIntroActive = active && (active.getAttribute('data-skip-intro') === 'true' || !!active.closest('[data-skip-intro="true"]'));

      if (['ArrowLeft', 'ArrowRight'].includes(e.key) && (isVideo || (!isTopBarActive && !isSkipIntroActive && active === document.body))) {
        return;
      }

      // 4. Navigation spatiale générale télécommande / clavier
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        moveFocus(e.key.replace('Arrow', '').toLowerCase() as Direction);
      } else if (e.key === 'Enter' || e.key === 'Select') {
        if (!active) return;
        const isNativeClickable =
          active.tagName === 'BUTTON' ||
          active.tagName === 'A' ||
          active.getAttribute('role') === 'button' ||
          active.getAttribute('role') === 'link';

        if (e.key === 'Enter') {
          // Les boutons et liens (HTML ou React Native Web) déclenchent déjà nativement
          // leur onClick / onPress lors de la frappe Enter. N'appeler active.click() que
          // s'il ne s'agit pas déjà d'un élément cliquable natif pour éviter la double bascule !
          if (!isNativeClickable) {
            active.click?.();
          }
        } else if (e.key === 'Select') {
          // La touche 'Select' spécifique aux télécommandes n'est pas toujours interceptée par le navigateur
          active.click?.();
        }
      }
    };

    let lastPad = 0;
    let animId: number;
    const pollPad = () => {
      const gp = navigator.getGamepads?.()?.[0];
      if (gp && Date.now() - lastPad > 220) {
        const [ax, ay] = [gp.axes[0] || 0, gp.axes[1] || 0];
        const active = document.activeElement as HTMLElement | null;
        const isVideo = isVideoElement(active);
        const isInput = active ? ['INPUT', 'TEXTAREA'].includes(active.tagName) : false;
        const modal = getActiveModal();

        if (gp.buttons[12]?.pressed || ay < -0.5) {
          if (isInput && active) exitInputFocus(active);
          else moveFocus('up');
          lastPad = Date.now();
        } else if (gp.buttons[13]?.pressed || ay > 0.5) {
          if (isInput && active) exitInputFocus(active);
          else moveFocus('down');
          lastPad = Date.now();
        } else if (gp.buttons[14]?.pressed || ax < -0.5) {
          if (isVideo) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
          else if (isInput && active) exitInputFocus(active);
          else moveFocus('left');
          lastPad = Date.now();
        } else if (gp.buttons[15]?.pressed || ax > 0.5) {
          if (isVideo) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
          else if (isInput && active) exitInputFocus(active);
          else moveFocus('right');
          lastPad = Date.now();
        } else if (gp.buttons[0]?.pressed) {
          active?.click?.();
          lastPad = Date.now();
        } else if (gp.buttons[1]?.pressed) {
          if (isFullscreenActive()) {
            toggleFullscreen();
          } else if (isInput && active) {
            exitInputFocus(active);
          } else if (modal) {
            const closeBtn =
              modal.querySelector<HTMLElement>('[data-modal-close="true"]') ||
              modal.querySelector<HTMLElement>('[aria-label="Fermer"], [aria-label="Close"]');
            if (closeBtn) closeBtn.click();
          } else {
            window.history.back();
          }
          lastPad = Date.now();
        } else if (gp.buttons[9]?.pressed) {
          const videoTarget = document.querySelector('video') || document.documentElement;
          toggleFullscreen(videoTarget as HTMLElement);
          lastPad = Date.now();
        }
      }
      animId = requestAnimationFrame(pollPad);
    };

    window.addEventListener('keydown', onKey, { capture: true });
    animId = requestAnimationFrame(pollPad);
    return () => {
      window.removeEventListener('keydown', onKey, { capture: true });
      cancelAnimationFrame(animId);
    };
  }, []);
}
