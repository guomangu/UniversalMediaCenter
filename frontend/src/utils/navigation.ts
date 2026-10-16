/**
 * Navigation arrière universelle :
 * Retourne TOUJOURS sur la page précédemment visitée par l'utilisateur
 * (via window.history.back() ou router.back()), avec fallback sur la page racine
 * si l'utilisateur est arrivé directement sur le lien.
 */
export function goBackOrFallback(router?: any, fallbackRoute: string = '/'): void {
  if (typeof window !== 'undefined' && window.history && window.history.length > 1) {
    window.history.back();
    return;
  }
  if (router?.canGoBack && router.canGoBack()) {
    router.back();
    return;
  }
  if (router?.push) {
    router.push(fallbackRoute as any);
  } else if (typeof window !== 'undefined') {
    window.location.href = fallbackRoute;
  }
}
