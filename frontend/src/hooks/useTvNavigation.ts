import { useEffect } from 'react';
import { Platform } from 'react-native';
import { toggleFullscreen, isFullscreenActive } from '@/utils/fullscreen';

type Direction = 'up' | 'down' | 'left' | 'right';

function isPlayerScrubber(el: HTMLElement | null): boolean {
  return !!el && (el.getAttribute('data-player-scrubber') === 'true' || !!el.closest('[data-player-scrubber="true"]'));
}

function isPlayerExpanded(): boolean {
  if (typeof document === 'undefined') return false;
  return document.getElementById('player_div')?.getAttribute('data-expanded') === 'true';
}

function dispatchPlayerEvent(name: string, detail?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  let event: Event;
  if (typeof CustomEvent === 'function') {
    event = new CustomEvent(name, { detail });
  } else if (typeof document !== 'undefined' && (document as any).createEvent) {
    const legacy = (document as any).createEvent('CustomEvent');
    legacy.initCustomEvent(name, false, false, detail);
    event = legacy;
  } else {
    return;
  }
  window.dispatchEvent(event);
}

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

/**
 * Retire le focus de l'arrière-plan dès qu'une modale est visible. Le focus est
 * posé sur le conteneur (tabIndex -1) plutôt que sur un bouton : le premier
 * appui sur une flèche entre ainsi dans la modale sans activer un contrôle.
 */
function focusActiveModalIfNeeded() {
  if (typeof document === 'undefined') return;
  const modal = getActiveModal();
  if (!modal) return;

  const active = document.activeElement as HTMLElement | null;
  if (active && modal.contains(active)) return;

  if (!modal.hasAttribute('tabindex')) {
    modal.setAttribute('tabindex', '-1');
  }
  active?.blur?.();
  try {
    modal.focus({ preventScroll: true } as any);
  } catch {
    modal.focus?.();
  }
}

function isElementVisibleAndActive(el: HTMLElement): boolean {
  if (
    el.getAttribute('aria-hidden') === 'true' ||
    el.getAttribute('data-modal-backdrop') === 'true' ||
    el.getAttribute('data-focusable') === 'false' ||
    el.getAttribute('data-player-container') === 'true' ||
    el.getAttribute('aria-disabled') === 'true' ||
    (el as HTMLButtonElement).disabled === true ||
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
  let scope: HTMLElement = modal || document.body;

  // Lecteur déplié : confiner la navigation à son overlay. Sans cela, l'algorithme
  // spatial pouvait sélectionner des boutons de la page masquée derrière la vidéo.
  if (!modal) {
    const playerDiv = document.getElementById('player_div');
    if (playerDiv?.getAttribute('data-expanded') === 'true') {
      scope = playerDiv;
    }
  }

  const sel =
    'button, a, input, textarea, select, [role="button"], [role="link"], [role="slider"], [tabindex="0"], [data-focusable="true"], [data-skip-intro="true"]';
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

function focusWithScroll(el: HTMLElement) {
  el.focus();
  try {
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  } catch {}
}

/** Récupère les contrôles focalisables contenus dans un groupe (racine ou descendants). */
function queryFocusablesWithin(selector: string): HTMLElement[] {
  if (typeof document === 'undefined') return [];
  const result = new Set<HTMLElement>();
  for (const root of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
    if (root.tabIndex >= 0 && isElementVisibleAndActive(root)) result.add(root);
    root
      .querySelectorAll<HTMLElement>('button, a, [role="button"], [role="link"], [tabindex="0"], [data-skip-intro="true"]')
      .forEach((el) => {
        if (isElementVisibleAndActive(el)) result.add(el);
      });
  }
  return Array.from(result);
}

function getPlayerScrubber(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return (
    Array.from(document.querySelectorAll<HTMLElement>('[data-player-scrubber="true"]')).find((el) =>
      isElementVisibleAndActive(el)
    ) || null
  );
}

function centerOf(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  return { rect, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Déplacement horizontal naturel à l'intérieur d'une même rangée du lecteur. */
function moveWithinPlayerGroup(
  dir: 'left' | 'right',
  groupSelector: string,
  current: HTMLElement
): boolean {
  const origin = centerOf(current);
  let best: HTMLElement | null = null;
  let bestDist = Infinity;

  for (const target of queryFocusablesWithin(groupSelector)) {
    if (target === current || target.contains(current) || current.contains(target)) continue;
    const candidate = centerOf(target);
    if (candidate.rect.width <= 0 || candidate.rect.height <= 0) continue;

    const dy = Math.abs(candidate.y - origin.y);
    // Rester sur la même rangée visuelle.
    if (dy > Math.max(24, Math.min(origin.rect.height, candidate.rect.height) * 0.75 + 12)) continue;

    const dx = candidate.x - origin.x;
    if (dir === 'right' && dx <= 2) continue;
    if (dir === 'left' && dx >= -2) continue;

    const dist = Math.abs(dx) + dy * 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = target;
    }
  }

  if (best) focusWithScroll(best);
  // Toujours consommer le déplacement : on ne quitte pas une rangée horizontalement.
  return true;
}

/** Depuis le scrubber : ←/→ sont gérés par le seek, ↑/↓ sortent vers les autres zones. */
function moveFocusFromScrubber(dir: 'up' | 'down'): boolean {
  const scrubber = document.activeElement as HTMLElement | null;
  if (!scrubber || !isPlayerScrubber(scrubber)) return false;

  const rect = scrubber.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;

  const valueNow = parseFloat(scrubber.getAttribute('aria-valuenow') || '0');
  const valueMax = parseFloat(scrubber.getAttribute('aria-valuemax') || '0');
  const ratio = valueMax > 0 && Number.isFinite(valueNow) ? Math.max(0, Math.min(1, valueNow / valueMax)) : 0.5;

  // Ancre horizontale = position réelle du curseur de lecture dans la barre.
  const anchorX = rect.left + ratio * rect.width;
  const scrubberY = rect.top + rect.height / 2;

  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const target of getCandidates()) {
    if (target === scrubber || scrubber.contains(target) || target.contains(scrubber)) continue;
    const candidate = centerOf(target);
    if (candidate.rect.width <= 0 || candidate.rect.height <= 0) continue;

    if (dir === 'up' && candidate.y >= scrubberY - 6) continue;
    if (dir === 'down' && candidate.y <= scrubberY + 6) continue;

    const dx = Math.abs(candidate.x - anchorX);
    const gap = Math.abs(candidate.y - scrubberY);
    // La colonne visuelle prime : on rejoint le bouton le plus aligné au-dessus/en dessous.
    const score = dx * 3 + gap;
    if (score < bestScore) {
      bestScore = score;
      best = target;
    }
  }

  if (best) {
    focusWithScroll(best);
    return true;
  }
  return false;
}

/** Depuis la barre supérieure : descendre vers un bouton contextuel aligné, sinon le scrubber. */
function focusAlignedContext(current: HTMLElement, dir: 'up' | 'down'): boolean {
  const origin = centerOf(current);
  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const target of queryFocusablesWithin('[data-player-context="true"]')) {
    if (target === current || target.contains(current) || current.contains(target)) continue;
    const candidate = centerOf(target);
    if (candidate.rect.width <= 0 || candidate.rect.height <= 0) continue;
    if (dir === 'down' && candidate.y <= origin.y + 6) continue;
    if (dir === 'up' && candidate.y >= origin.y - 6) continue;

    const dx = Math.abs(candidate.x - origin.x);
    if (dx > 220) continue; // uniquement la colonne visuelle proche

    const gap = Math.abs(candidate.y - origin.y);
    const score = dx * 2 + gap;
    if (score < bestScore) {
      bestScore = score;
      best = target;
    }
  }

  if (best) {
    focusWithScroll(best);
    return true;
  }
  return false;
}

/** Monte d'un bouton contextuel vers la barre supérieure la plus alignée. */
function focusNearestInGroupByX(current: HTMLElement, groupSelector: string): boolean {
  const origin = centerOf(current);
  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const target of queryFocusablesWithin(groupSelector)) {
    if (target === current || target.contains(current) || current.contains(target)) continue;
    const candidate = centerOf(target);
    if (candidate.rect.width <= 0 || candidate.rect.height <= 0) continue;
    const score = Math.abs(candidate.x - origin.x) * 2 + Math.abs(candidate.y - origin.y);
    if (score < bestScore) {
      bestScore = score;
      best = target;
    }
  }

  if (best) {
    focusWithScroll(best);
    return true;
  }
  return false;
}

/**
 * Algorithme de navigation spatiale directionnelle TV :
 * - Zones visuelles du lecteur : barre supérieure ↔ scrubber ↔ contrôles du bas
 * - Sur le scrubber : ←/→ = progression, ↑/↓ = sortie vers les autres boutons
 * - Empêche strictement de sauter verticalement lors d'un déplacement horizontal
 * - Privilégie la colonne/rangée visuelle directe
 */
function moveFocus(dir: Direction): boolean {
  const current = document.activeElement as HTMLElement | null;

  // 1. Zones visuelles du lecteur autonome.
  if (current && isPlayerScrubber(current)) {
    if ((dir === 'up' || dir === 'down') && moveFocusFromScrubber(dir)) return true;
  }

  const inTopBar = !!current?.closest('[data-player-topbar="true"]');
  const inControls = !!current?.closest('[data-player-controls="true"]');
  const inContext = !!current?.closest('[data-player-context="true"]');

  // A. Déplacements horizontaux naturels, confinés à la rangée visuelle.
  if (inTopBar && (dir === 'left' || dir === 'right')) {
    return moveWithinPlayerGroup(dir, '[data-player-topbar="true"]', current!);
  }
  if (inControls && (dir === 'left' || dir === 'right')) {
    return moveWithinPlayerGroup(dir, '[data-player-controls="true"]', current!);
  }
  if (inContext && (dir === 'left' || dir === 'right')) {
    return moveWithinPlayerGroup(dir, '[data-player-context="true"]', current!);
  }

  // B. Transitions verticales entre les trois zones du lecteur.
  if (inTopBar && dir === 'down') {
    if (focusAlignedContext(current!, 'down')) return true;
    const scrubber = getPlayerScrubber();
    if (scrubber) {
      focusWithScroll(scrubber);
      return true;
    }
  }

  if (inControls && dir === 'up') {
    const scrubber = getPlayerScrubber();
    if (scrubber) {
      focusWithScroll(scrubber);
      return true;
    }
  }

  if (inContext && dir === 'down') {
    const scrubber = getPlayerScrubber();
    if (scrubber) {
      focusWithScroll(scrubber);
      return true;
    }
  }

  if (inContext && dir === 'up') {
    if (focusNearestInGroupByX(current!, '[data-player-topbar="true"]')) return true;
  }

  // C. Surface vidéo / conteneur du lecteur.
  if (isVideoElement(current)) {
    if (dir === 'down') {
      if (focusAlignedContext(current!, 'down')) return true;
      const scrubber = getPlayerScrubber();
      if (scrubber) {
        focusWithScroll(scrubber);
        return true;
      }
    } else {
      const topBarFirst = document.querySelector<HTMLElement>(
        '[data-player-topbar="true"] [role="button"], [data-player-topbar="true"] button, [data-player-topbar="true"] [tabindex="0"]'
      );
      if (topBarFirst && isElementVisibleAndActive(topBarFirst)) {
        focusWithScroll(topBarFirst);
        return true;
      }
    }
  }

  const candidates = getCandidates();
  if (candidates.length === 0) return false;

  // Si aucun focus initial actif ou focus sur le body / le conteneur du lecteur.
  if (!current || current === document.body || isVideoElement(current) || !candidates.includes(current)) {
    // Une modale ouverte reste prioritaire : ne jamais renvoyer le focus au lecteur
    // ou à la page situés derrière elle.
    if (getActiveModal()) {
      if (candidates[0]) {
        focusWithScroll(candidates[0]);
        return true;
      }
      return false;
    }

    const playerDiv = document.getElementById('player_div');
    const playerExpanded = playerDiv?.getAttribute('data-expanded') === 'true';

    if (playerExpanded) {
      // Depuis le centre de l'écran : ↓ rejoint la barre de progression,
      // les autres directions rejoignent la barre supérieure la plus alignée.
      if (dir === 'down') {
        const scrubber = getPlayerScrubber();
        if (scrubber) {
          focusWithScroll(scrubber);
          return true;
        }
      }

      const topBarButtons = queryFocusablesWithin('[data-player-topbar="true"]');
      if (topBarButtons.length > 0) {
        const viewportCenterX = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
        let bestTop = topBarButtons[0];
        let bestDist = Infinity;
        for (const button of topBarButtons) {
          const d = Math.abs(centerOf(button).x - viewportCenterX);
          if (d < bestDist) {
            bestDist = d;
            bestTop = button;
          }
        }
        focusWithScroll(bestTop);
        return true;
      }
    }

    // Hors lecteur déplié : conserver l'entrée de page habituelle.
    const topBarFirst = document.querySelector<HTMLElement>(
      '[data-player-topbar="true"] [role="button"], [data-player-topbar="true"] button'
    );
    if (topBarFirst && isElementVisibleAndActive(topBarFirst)) {
      focusWithScroll(topBarFirst);
      return true;
    }
    if (candidates[0]) {
      focusWithScroll(candidates[0]);
      return true;
    }
    return false;
  }

  const cR = current.getBoundingClientRect();
  const cC = { x: cR.left + cR.width / 2, y: cR.top + cR.height / 2 };
  let best: HTMLElement | null = null;
  let bestDist = Infinity;

  for (const t of candidates) {
    if (t === current || t.contains(current) || current.contains(t)) continue;
    // Une barre de progression est un contrôle vertical : elle ne doit jamais
    // être sélectionnée par un déplacement horizontal depuis un autre contrôle.
    if (
      (dir === 'left' || dir === 'right') &&
      (t.getAttribute('data-player-scrubber') === 'true' || !!t.closest('[data-player-scrubber="true"]'))
    ) {
      continue;
    }
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
    focusWithScroll(best);
    return true;
  }
  return false;
}

export function useTvNavigation() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const onKey = (e: KeyboardEvent) => {
      focusActiveModalIfNeeded();
      const active = document.activeElement as HTMLElement | null;
      const isVideo = isVideoElement(active);
      const isInput = active ? ['INPUT', 'TEXTAREA'].includes(active.tagName) : false;
      const modal = getActiveModal();
      const isScrubber = isPlayerScrubber(active);

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
        // Cibler le lecteur déplié (contrôles inclus) plutôt que la seule balise
        // <video> : sinon le plein écran natif masque la barre de progression et
        // rend la télécommande inutilisable. Hors lecteur, cibler le document.
        const playerDiv = document.getElementById('player_div');
        const fullscreenTarget =
          playerDiv?.getAttribute('data-expanded') === 'true'
            ? (playerDiv as HTMLElement)
            : document.documentElement;
        e.preventDefault();
        toggleFullscreen(fullscreenTarget);
        return;
      }

      // Raccourci d'accès direct à la barre de recherche (touche '/' ou touche Search télécommande)
      const isSearchShortcut =
        e.key === '/' ||
        e.key === 'Search' ||
        e.key === 'BrowserSearch' ||
        [84, 170].includes(e.keyCode);

      if (isSearchShortcut && !isInput) {
        // Utiliser les candidats filtrés (visibles, non masqués, dans la modale ou
        // le lecteur actif) pour ne jamais focaliser un input factice en arrière-plan.
        const candidates = getCandidates();
        const searchInput = (
          candidates.find((el) => el.getAttribute('data-search-input') === 'true') ||
          candidates.find((el) => el.tagName === 'INPUT')
        ) as HTMLInputElement | undefined;
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
          searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }

      // 1.bis. Scrubber du lecteur : ←/→ pilotent directement la progression,
      // ↑/↓ en sortent pour rejoindre les autres boutons. OK bascule lecture/pause.
      if (isScrubber && active && !modal) {
        // Ne pas couper la propagation : FloatingBottomPlayer doit pouvoir
        // réarmer l'affichage des contrôles (resetMouseActivity) avant de voir
        // `defaultPrevented` et de s'arrêter.
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          dispatchPlayerEvent('ums-player-seek', { offset: e.key === 'ArrowLeft' ? -10 : 10 });
          return;
        }

        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          moveFocus(e.key === 'ArrowUp' ? 'up' : 'down');
          return;
        }

        if (e.key === 'Enter' || e.key === 'Select') {
          e.preventDefault();
          dispatchPlayerEvent('ums-player-toggle-play');
          return;
        }
      }

      // 1. Sortie immédiate d'un champ ou formulaire textuel sur Échap / Touche Retour
      if (isInput && active) {
        const inputVal = (active as HTMLInputElement).value || '';
        const isEmpty = inputVal.trim().length === 0;
        const isMultiline = active.tagName === 'TEXTAREA';

        if (isEscape || isBackNav || (isBackspace && (isEmpty || e.altKey || e.ctrlKey))) {
          e.preventDefault();
          e.stopPropagation();
          exitInputFocus(active);
          return;
        }

        // Dans un TEXTAREA, ↑/↓ doivent déplacer le curseur entre les lignes,
        // pas quitter le champ (contrairement à un INPUT mono-ligne).
        if (e.key === 'ArrowDown' && !isMultiline) {
          e.preventDefault();
          const moved = moveFocus('down');
          if (!moved) exitInputFocus(active);
          return;
        }
        if (e.key === 'ArrowUp' && !isMultiline) {
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
        // Le bouton Retour d'une télécommande replie le lecteur avant toute navigation.
        if (isPlayerExpanded()) {
          e.preventDefault();
          e.stopPropagation();
          dispatchPlayerEvent('ums-player-collapse');
          return;
        }
        window.history.back();
        return;
      }

      // 3. Navigation spatiale générale télécommande / clavier.
      // Les flèches déplacent le focus (jamais de seek implicite hors scrubber).
      // Sur le scrubber, ←/→ pilotent la progression et ↑/↓ sortent vers les boutons.
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
        focusActiveModalIfNeeded();
        const [ax, ay] = [gp.axes[0] || 0, gp.axes[1] || 0];
        const active = document.activeElement as HTMLElement | null;
        const isVideo = isVideoElement(active);
        const isInput = active ? ['INPUT', 'TEXTAREA'].includes(active.tagName) : false;
        const modal = getActiveModal();
        const isScrubber = !modal && isPlayerScrubber(active);

        if (gp.buttons[12]?.pressed || ay < -0.5) {
          if (isInput && active) exitInputFocus(active);
          else moveFocus('up');
          lastPad = Date.now();
        } else if (gp.buttons[13]?.pressed || ay > 0.5) {
          if (isInput && active) exitInputFocus(active);
          else moveFocus('down');
          lastPad = Date.now();
        } else if (gp.buttons[14]?.pressed || ax < -0.5) {
          if (isScrubber) dispatchPlayerEvent('ums-player-seek', { offset: -10 });
          else if (isVideo) dispatchPlayerEvent('ums-player-seek', { offset: -10 });
          else if (isInput && active) exitInputFocus(active);
          else moveFocus('left');
          lastPad = Date.now();
        } else if (gp.buttons[15]?.pressed || ax > 0.5) {
          if (isScrubber) dispatchPlayerEvent('ums-player-seek', { offset: 10 });
          else if (isVideo) dispatchPlayerEvent('ums-player-seek', { offset: 10 });
          else if (isInput && active) exitInputFocus(active);
          else moveFocus('right');
          lastPad = Date.now();
        } else if (gp.buttons[0]?.pressed) {
          if (isScrubber) dispatchPlayerEvent('ums-player-toggle-play');
          else active?.click?.();
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
          } else if (isPlayerExpanded()) {
            dispatchPlayerEvent('ums-player-collapse');
          } else {
            window.history.back();
          }
          lastPad = Date.now();
        } else if (gp.buttons[9]?.pressed) {
          const playerDiv = document.getElementById('player_div');
          const fullscreenTarget =
            playerDiv?.getAttribute('data-expanded') === 'true'
              ? (playerDiv as HTMLElement)
              : document.documentElement;
          toggleFullscreen(fullscreenTarget);
          lastPad = Date.now();
        }
      }
      animId = requestAnimationFrame(pollPad);
    };

    // Détecte l'ouverture d'une modale pour y transférer immédiatement le focus.
    let lastDetectedModal: HTMLElement | null = null;
    let modalObserver: MutationObserver | null = null;
    if (typeof MutationObserver !== 'undefined') {
      modalObserver = new MutationObserver(() => {
        const modal = getActiveModal();
        if (modal === lastDetectedModal) return;
        lastDetectedModal = modal;
        if (modal) focusActiveModalIfNeeded();
      });
      if (typeof document !== 'undefined' && document.body) {
        modalObserver.observe(document.body, { childList: true, subtree: true });
      }
    }

    window.addEventListener('keydown', onKey, { capture: true });
    animId = requestAnimationFrame(pollPad);
    return () => {
      window.removeEventListener('keydown', onKey, { capture: true });
      modalObserver?.disconnect();
      cancelAnimationFrame(animId);
    };
  }, []);
}
