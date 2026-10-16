// Mapping Chiffres Romains <-> Arabes (jusqu'à 30)
const ROMAN_TO_ARABIC: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
  XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15, XVI: 16, XVII: 17, XVIII: 18, XIX: 19, XX: 20,
  XXI: 21, XXII: 22, XXIII: 23, XXIV: 24, XXV: 25, XXVI: 26, XXVII: 27, XXVIII: 28, XXIX: 29, XXX: 30,
};

/**
 * Normalisation Unicode (NFKC), décomposition des ligatures et standardisation des caractères pleines chasses.
 */
export function normalizeUnicodeAndLigatures(raw: string): string {
  if (!raw) return '';
  let s = String(raw).normalize('NFKC');
  // Ligatures françaises et latines
  s = s.replace(/œ/g, 'oe').replace(/Œ/g, 'Oe');
  s = s.replace(/æ/g, 'ae').replace(/Æ/g, 'Ae');
  // Deux-points pleine chasse Windows/NTFS (： U+FF1A) et tirets cadratins
  s = s.replace(/：/g, ':');
  s = s.replace(/[—–]/g, '-');
  // Apostrophes courbes
  s = s.replace(/[`'’]/g, "'");
  return s;
}

/**
 * Convertit les chiffres romains terminaux ou isolés en chiffres arabes
 * Ex: "Rocky III" -> "Rocky 3", "Star Wars Episode IV" -> "Star Wars Episode 4"
 */
export function normalizeRomanNumerals(title: string): string {
  if (!title) return '';
  return title.replace(/\b(X{0,3}(?:IX|IV|V?I{1,3}))\b$/i, (match) => {
    const upper = match.toUpperCase();
    return ROMAN_TO_ARABIC[upper] ? String(ROMAN_TO_ARABIC[upper]) : match;
  });
}

/**
 * titleCleaner.ts - Normalisation et nettoyage des titres de fichiers multimédias
 * Supprime les bruits de release (1080p, x264, MULTi...), préserve le titre réel des épisodes,
 * élimine les préfixes de pistes (01 , 02 -) et réconcilie les dates de cinéma.
 */

export function cleanMediaTitle(
  raw: string | number,
  original?: string | number,
  showTitle?: string,
  season?: number,
  episode?: number
): string {
  let t = String(raw ?? '').trim();
  const origStr = original != null ? String(original).trim() : '';

  // Si c'est un épisode d'une série ou animé (ex: "Bleach - 02 - Le travail d`un Shinigami")
  if (showTitle) {
    const showEscaped = showTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 1. Extraire le titre d'épisode s'il est préfixé par le nom du show et le numéro
    const prefixRegex = new RegExp(
      `^(?:${showEscaped}\\s*[-_ ]+)?(?:S\\d+E\\d+|\\b\\d{1,2}x\\d{1,3}\\b|EP\\s*\\d+|E\\d+|0*\\d{1,4})\\s*[-_ ]+(.+)$`,
      'i'
    );
    const match = t.match(prefixRegex);
    if (match && match[1]?.trim()) {
      const candidateTitle = match[1].trim();
      if (!/^(mkv|mp4|avi|1080p|720p|vff|vostfr)$/i.test(candidateTitle)) {
        return sanitizeReleaseTags(candidateTitle);
      }
    }

    // 2. Si le titre brut n'est pas préfixé par le show et n'est pas un code SxxExx
    if (!new RegExp(`^${showEscaped}\\b`, 'i').test(t) && !/^S\\d+E\\d+$/i.test(t)) {
      const sanitized = sanitizeReleaseTags(t);
      if (sanitized && sanitized !== showTitle && sanitized.length > 2) {
        return sanitized;
      }
    }

    // 3. Fallback élégant si aucun titre spécifique d'épisode n'a pu être identifié (strictement > 0)
    if (episode != null && episode > 0) {
      return `Épisode ${episode}`;
    }
    return showTitle;
  }

  // 1. Préférer le titre brut propre (titre localisé français, ex: "Le Seigneur des anneaux")
  const sanitized = sanitizeReleaseTags(t);
  if (sanitized && sanitized.length > 1 && !/^(mkv|mp4|avi|1080p|720p|bluray|x264|x265|bdrip)$/i.test(sanitized)) {
    return sanitized;
  }

  // 2. Fallback sur le titre original si le titre brut était vide ou uniquement technique
  if (origStr && !/1080p|720p|bluray|x264|x265|bdrip/i.test(origStr)) {
    return sanitizeReleaseTags(origStr);
  }

  return sanitized || t || 'Média sans titre';
}

/**
 * Nettoie les balises techniques, releases de scènes, résolutions, préfixes de pistes et années redondantes
 */
export function sanitizeReleaseTags(raw: string | number): string {
  let t = String(raw ?? '').trim();

  // Nettoyage des suffixes de release
  t = t.replace(/\.(mkv|mp4|avi|mov|ts|m4v|webm)$/i, '');
  // Nettoyage des années préfixées (ex: "1962 Dr. No", "1995 - Goldeneye", "2012.Skyfall")
  t = t.replace(/^(?:19|20)\d{2}\s*[-._– ]\s*/, '');
  // Nettoyage des préfixes ordonnés (ex: "01 Iron Man", "03 Iron Man 2", "07 - Iron Man 3", "1a. ")
  t = t.replace(/^(?:[0-9]{1,3}[a-z]?|[a-z])\s*[-._– ]\s*/i, '');
  t = t.replace(/[\s._]\d{3,4}x\d{3,4}.*$/i, '');
  t = t.replace(/\s*[–-]\s*(Action|Comedy|Drama|Aventure)?\s*\d{4}\s*.*$/i, '');
  t = t.replace(/\s*\(?\d{4}\)?\s*(VFF|VF|VOSTFR|MULTi|ENG|FRENCH|AC3|DTS|BluRay|BDRip|1080p|720p|x264|x265|WEB).*$/i, '');
  t = t.replace(/\b(MULTi|VFF|VF|VOSTFR|FRENCH|TRUEFRENCH|FASTSUB|SUBITA|LD|FiNAL|1080p|720p|480p|576p|360p|2160p|4k|uhd|bluray|bdrip|brrip|dvdrip|hdtv|web-dl|webrip|web|h264|h265|x264|x265|xvid|divx|hevc|dts-hd|dts|truehd|ac3|aac|flac|mp3|proper|repack|remastered|extended|1920x\d+|1280x\d+)\b.*$/i, '');
  t = t.replace(/(?<=[a-zA-Z0-9]{2,})\.|\.(?=[a-zA-Z0-9]{2,})/g, ' ');
  t = t.replace(/_/g, ' ');
  t = t.replace(/\[.*?\]/g, '');
  // Suppression systématique de l'année entre parenthèses en fin de titre (ex: "Django Unchained (2012)" -> "Django Unchained")
  t = t.replace(/\s*\((?:19|20)\d{2}\)\s*$/i, '');
  t = t.replace(/`/g, "'");

  const cleaned = t.replace(/\s{2,}/g, ' ').trim();
  return cleaned || t || '';
}

/**
 * Extrait le titre canonique pur d'une série télévisée ou anime en éliminant :
 * - Les mentions d'intégrale (ex: "Soul Eater - iNTEGRALE" -> "Soul Eater")
 * - Les mentions de saison (ex: " - Saison 4 (2017)", " - Saison 1 360p", " Season 2", " S02")
 * - Les résolutions (360p, 720p, 1080p...) et formats (HDTV, WEBRip, XviD...)
 * - Les équipes et domaines de téléchargement (Zone-Telechargement, Cpasbien...)
 * - Les fautes de frappe courantes (ex: "peacky blinders" -> "Peaky Blinders")
 */
export function extractCanonicalShowTitle(raw: string | number): string {
  let s = normalizeUnicodeAndLigatures(String(raw ?? '')).trim();
  if (!s) return '';

  // 1. Extraire le nom de base si c'est un chemin complet
  if (s.includes('/') || s.includes('\\')) {
    s = s.replace(/\\/g, '/').split('/').filter(Boolean).pop() || s;
  }

  // 2. Nettoyer les extensions de fichiers
  s = s.replace(/\.(mkv|mp4|avi|mov|ts|m4v|webm|nfo)$/i, '');

  // 3. Nettoyer les tags entre crochets ou domaines web
  s = s.replace(/^\s*\[.*?\]\s*/g, '');
  s = s.replace(/\s*\[.*?\]/g, '');
  s = s.replace(/\b(?:w+w\.)?[a-zA-Z0-9-]+\.(?:ws|com|pw|cm|org|to|me|cx|net)\b/gi, '');

  // 4. Nettoyer les préfixes ordonnés (ex: "01 ", "1a. ", "1. ", "7. ", "b. ")
  s = s.replace(/^(?:[0-9]{1,3}[a-z]?|[a-z])[\s._–-]+\s*/i, '');

  // 5. Nettoyer les mentions d'intégrale / boxset AVANT les saisons et résolutions
  s = s.replace(/\s*[-_–]\s*(?:iNTEGRALE|int[ée]grale|complete|intégral|integrale|boxset)\b.*$/i, '');
  s = s.replace(/\b(?:iNTEGRALE|int[ée]grale|complete|intégral|integrale)\b.*$/i, '');

  // 6. Nettoyer les codes d'épisodes s'ils sont dans le nom
  s = s.replace(/\s*[-_–]\s*S\d+.*$/i, '');
  s = s.replace(/\s+S\d+E\d+.*$/i, '');
  s = s.replace(/\s+S\d+\b.*$/i, '');
  s = s.replace(/\b\d{1,2}x\d{1,3}\b.*$/i, '');

  // 7. Supprimer les mentions de saison françaises et anglaises ou arcs anime
  s = s.replace(/\s*[-_–]\s*(?:saison|season|séries?|series?|part|partie|cour|vol|volume|\d+(?:st|nd|rd|th)?\s*gig)\s*0*\d*.*$/i, '');
  s = s.replace(/\s+\b(?:saison|season|séries?|series?|part|partie|cour|vol|volume|\d+(?:st|nd|rd|th)?\s*gig)\s*0*\d*.*$/i, '');

  // 8. Supprimer les résolutions, formats, qualités, langues
  s = s.replace(/\b(360p|480p|576p|720p|1080p|2160p|4k|uhd|bluray|bdrip|brrip|dvdrip|hdtv|web-dl|webrip|web|xvid|divx|x264|x265|hevc|h264|h265|vostfr|vff|vf|french|truefrench|multi|fastsub|subita|ld|final|repack|proper|remastered|extended)\b.*$/i, '');

  // 9. Supprimer les années résiduelles (2017) ou (1990)
  s = s.replace(/\s*\(?(?:19|20)\d{2}\)?\s*$/i, '');
  s = s.replace(/\s+-\s+(?:19|20)\d{2}\s*$/i, '');
  s = s.replace(/[\s-_–()]+\s*$/i, '');

  // 10. Remplacer les points et underscores par des espaces
  s = s.replace(/[._]/g, ' ');
  s = s.replace(/`/g, "'");
  s = s.replace(/\s{2,}/g, ' ').trim();

  // 11. Cas canoniques connus pour Ghost In The Shell & Kai / Pace Animes
  if (/^stand\s*alone\s*complex/i.test(s) || /ghost\s*in\s*the\s*shell.*(?:s[\s.]*a[\s.]*c|stand\s*alone\s*complex)/i.test(s)) {
    return 'Ghost in the Shell: Stand Alone Complex';
  }
  if (/^ghost\s*in\s*the\s*shell.*arise/i.test(s)) {
    return 'Ghost in the Shell: Arise';
  }
  if (/^(?:one\s*piece\s*kai|one_piece_kai|one\s*pace)$/i.test(s.trim())) {
    return 'One Piece Kai';
  }
  if (/^(?:dragon\s*ball\s*z\s*kai|dbz\s*kai|dragon\s*ball\s*kai)$/i.test(s.trim())) {
    return 'Dragon Ball Z Kai';
  }

  // 12. Capitalisation soignée si tout est en minuscules
  if (s === s.toLowerCase() && s.length > 2) {
    s = s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
  }

  // 13. Normalisation des chiffres romains terminaux (Rocky III -> Rocky 3)
  s = normalizeRomanNumerals(s);

  return s;
}

/**
 * Extrait l'année cinématographique d'une chaîne ou d'un nom de fichier
 * Protégé contre la pollution par les dossiers parents (ex: "saga (1962 - 2015)")
 */
export function extractYearFromText(text?: string | null): number | undefined {
  if (!text) return undefined;
  let target = text;
  if (target.includes('/') || target.includes('\\')) {
    target = target.replace(/\\/g, '/').split('/').filter(Boolean).pop() || target;
  }
  const match = target.match(/\b((?:19|20)\d{2})\b/);
  if (match) {
    const yr = parseInt(match[1], 10);
    if (yr >= 1890 && yr <= 2099) return yr;
  }
  return undefined;
}

/**
 * Normalisation phonétique et réduction des diphtongues/consonnes redoublées.
 * Permet de rapprocher automatiquement des orthographes alternatives ou fautives
 * (ex: "peacky blinders" -> "peaky blinders", "vikinggs" -> "vikings") sans dictionnaire en dur.
 */
export function normalizePhoneticSpelling(raw: string): string {
  if (!raw) return '';
  let s = raw.trim();
  // 1. Équivalence ck -> k (ex: peacky -> peaky)
  s = s.replace(/ck/gi, 'k');
  // 2. Équivalence ph -> f (ex: telephon -> telefon)
  s = s.replace(/ph/gi, 'f');
  // 3. Dédoublement des consonnes répétées (ex: 'vikinggs' -> 'vikings', 'stopp' -> 'stop')
  s = s.replace(/([b-df-hj-np-tv-z])\1+/gi, '$1');
  // 4. Normalisation des apostrophes
  s = s.replace(/[`'’]/g, "'");
  return s.replace(/\s{2,}/g, ' ').trim();
}
