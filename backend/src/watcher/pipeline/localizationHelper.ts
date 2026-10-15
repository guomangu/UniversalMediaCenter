/**
 * localizationHelper.ts - Agrégation multilingue et mise en cache (Kyoo Native Multilingual)
 * Permet à deux utilisateurs de voir les titres et résumés dans leur langue respective
 * sans rescanner la bibliothèque.
 */

export function localizeMediaNode<T extends Record<string, any>>(node: T, requestedLang = 'fr'): T {
  if (!node) return node;

  const trs = (node as any).translationsJson || (node as any).translations_json;
  if (!trs || typeof trs !== 'object') return node;

  const langKey = (requestedLang || 'fr').toLowerCase().slice(0, 2);
  const localized = trs[langKey] || trs['fr'] || trs['en'];

  if (localized) {
    return {
      ...node,
      title: localized.title || node.title,
      overview: localized.overview || node.overview,
      tagline: localized.tagline || node.tagline,
    };
  }

  return node;
}

export function extractRequestLanguage(c: any): string {
  try {
    const qLang = c.req.query('lang');
    if (qLang) return qLang.slice(0, 2).toLowerCase();

    const accept = c.req.header('Accept-Language');
    if (accept) {
      const match = accept.match(/^([a-z]{2})/i);
      if (match) return match[1].toLowerCase();
    }
  } catch {}

  return 'fr';
}
