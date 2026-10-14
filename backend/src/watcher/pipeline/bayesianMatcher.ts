export interface MatchCandidate {
  title: string;
  year?: number;
  runtimeMinutes?: number;
  hasExplicitId?: boolean;
}

export interface MatchInput {
  extractedTitle: string;
  extractedYear?: number;
  actualDurationSeconds?: number;
  hasHashOrIdMatch?: boolean;
  siblingContextAvailable?: boolean;
}

/**
 * Similarité textuelle par trigrammes normalisés (Jaccard)
 */
function computeTrigramSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase().replace(/[^a-z0-9]/g, '');
  const s2 = b.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;

  const getTrigrams = (s: string) => {
    const t = new Set<string>();
    for (let i = 0; i <= s.length - 3; i++) t.add(s.slice(i, i + 3));
    return t;
  };

  const t1 = getTrigrams(s1);
  const t2 = getTrigrams(s2);
  if (t1.size === 0 || t2.size === 0) return s1.includes(s2) || s2.includes(s1) ? 0.7 : 0;

  let intersection = 0;
  for (const tri of t1) {
    if (t2.has(tri)) intersection++;
  }
  return (2 * intersection) / (t1.size + t2.size);
}

/**
 * Calcul du Score de Confiance Global Stotal selon le modèle Bayesian Matcher (Kyoo++)
 */
export function computeConfidenceScore(input: MatchInput, candidate?: MatchCandidate): number {
  if (input.hasHashOrIdMatch || candidate?.hasExplicitId) {
    return 1.0; // Court-circuit Niveau 1 (100% confiance)
  }

  if (!candidate) {
    // Évaluation heuristique intrinsèque
    let base = 0.5;
    if (input.extractedTitle.length > 2) base += 0.2;
    if (input.extractedYear) base += 0.15;
    if (input.siblingContextAvailable) base += 0.1;
    return Math.min(0.95, base);
  }

  const sTitle = computeTrigramSimilarity(input.extractedTitle, candidate.title);

  let sYear = 0;
  if (input.extractedYear && candidate.year) {
    const diff = Math.abs(input.extractedYear - candidate.year);
    if (diff === 0) sYear = 1.0;
    else if (diff === 1) sYear = 0.8;
  } else if (!input.extractedYear) {
    sYear = 0.5;
  }

  let sDuration = 1.0;
  if (input.actualDurationSeconds && candidate.runtimeMinutes) {
    const diffSec = Math.abs(input.actualDurationSeconds - candidate.runtimeMinutes * 60);
    const sigma = 300; // 5 minutes de tolérance
    sDuration = Math.exp(-Math.pow(diffSec, 2) / (2 * Math.pow(sigma, 2)));
  }

  const sSibling = input.siblingContextAvailable ? 0.1 : 0.0;
  const weighted = 0.5 * sTitle + 0.25 * sYear + 0.15 * sDuration + sSibling;

  return Math.round(Math.min(1.0, Math.max(0, weighted)) * 100) / 100;
}
