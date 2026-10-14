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
    'button, a, input, textarea, video, [role="button"], [tabindex="0"], [data-focusable="true"], [data-video-player="true"]';
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

    // 1. Chercher en priorité l'action immédiatement suivante (en dessous ou à droite)
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
      // 2. Sinon choisir le candidat le plus proche spatialement
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

  // Libérer le champ de saisie
  activeInput.blur();

  // Attribuer immédiatement le focus au candidat extérieur
  if (nextTarget) {
    nextTarget.focus();
    nextTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }
}

function moveFocus(dir: Direction): boolean {
  const candidates = getCandidates();
  if (candidates.length === 0) return false;
  const current = document.activeElement as HTMLElement;

  if (!current || current === document.body || !candidates.includes(current)) {
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

      // 1. Sortie immédiate d'un champ ou formulaire textuel sur Échap / Touche Retour
      if (isInput && active) {
        const inputVal = (active as HTMLInputElement).value || '';
        const isEmpty = inputVal.trim().length === 0;

        // Échap : sortie inconditionnelle immédiate
        // Touche retour navigateur/télécommande : sortie immédiate
        // Touche Backspace / Retour arrière : sortie si le champ est vide ou avec Alt/Ctrl
        if (isEscape || isBackNav || (isBackspace && (isEmpty || e.altKey || e.ctrlKey))) {
          e.preventDefault();
          e.stopPropagation();
          exitInputFocus(active);
          return;
        }

        // Flèches directionnelles depuis l'intérieur d'un formulaire
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
          return; // Laisser le curseur se déplacer dans le texte
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
          return; // Laisser le curseur se déplacer dans le texte
        }
        if (e.key === 'Enter') {
          return;
        }
        return;
      }

      // 2. Gestion de la touche Retour / Escape hors des champs de saisie
      if (isEscape || isBackNav) {
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
          // Confinement : ne pas quitter la page si une modale est affichée
          return;
        }
        window.history.back();
        return;
      }

      // 3. Navigation sur lecteur vidéo
      if (['ArrowLeft', 'ArrowRight'].includes(e.key) && isVideo) return;

      // 4. Navigation spatiale générale télécommande / clavier
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
          // Bouton B / Cercle (Retour) sur manette
          if (isInput && active) {
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
        }
      }
      animId = requestAnimationFrame(pollPad);
    };

    // Capture = true pour intercepter Escape et Retour avant toute capture locale de composant
    window.addEventListener('keydown', onKey, { capture: true });
    animId = requestAnimationFrame(pollPad);
    return () => {
      window.removeEventListener('keydown', onKey, { capture: true });
      cancelAnimationFrame(animId);
    };
  }, []);
}
