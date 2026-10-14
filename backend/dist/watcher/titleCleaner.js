/**
 * titleCleaner.ts - Normalisation et nettoyage des titres de fichiers multimédias
 * Supprime les bruits de release (1080p, x264, MULTi...), préserve le titre réel des épisodes,
 * et extrait les noms propres de médias sans perte d'information.
 */
export function cleanMediaTitle(raw, original, showTitle, season, episode) {
    let t = (raw || '').trim();
    // Si c'est un épisode d'une série ou animé (ex: "Bleach - 02 - Le travail d`un Shinigami")
    if (showTitle) {
        const showEscaped = showTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // 1. Extraire le titre d'épisode s'il est préfixé par le nom du show et le numéro
        // ex: "Bleach - 102 - Le dernier Quincy ! L`explosion du pouvoir" -> "Le dernier Quincy ! L`explosion du pouvoir"
        const prefixRegex = new RegExp(`^(?:${showEscaped}\\s*[-_ ]+)?(?:S\\d+E\\d+|\\d+x\\d+|EP\\s*\\d+|E\\d+|0*\\d{1,4})\\s*[-_ ]+(.+)$`, 'i');
        const match = t.match(prefixRegex);
        if (match && match[1]?.trim()) {
            const candidateTitle = match[1].trim();
            // Si le reste n'est pas juste un tag de release ou une extension
            if (!/^(mkv|mp4|avi|1080p|720p|vff|vostfr)$/i.test(candidateTitle)) {
                return sanitizeReleaseTags(candidateTitle);
            }
        }
        // 2. Si le titre brut n'est pas préfixé par le show et n'est pas un code SxxExx
        if (!new RegExp(`^${showEscaped}\\b`, 'i').test(t) && !/^S\d+E\d+$/i.test(t)) {
            const sanitized = sanitizeReleaseTags(t);
            if (sanitized && sanitized !== showTitle && sanitized.length > 2) {
                return sanitized;
            }
        }
        // 3. Fallback élégant si aucun titre spécifique d'épisode n'a pu être identifié
        if (episode != null) {
            return `Épisode ${episode}`;
        }
        return showTitle;
    }
    // Préférer le titre original si propre et non pollué par des tags de release
    if (original && original.trim() && !/1080p|720p|bluray|x264|x265|bdrip/i.test(original)) {
        return sanitizeReleaseTags(original.trim());
    }
    return sanitizeReleaseTags(t) || raw || 'Média sans titre';
}
/**
 * Nettoie les balises techniques, releases de scènes, résolutions et artefacts
 */
export function sanitizeReleaseTags(raw) {
    let t = (raw || '').trim();
    // Nettoyage des suffixes de release
    t = t.replace(/\.(mkv|mp4|avi|mov|ts|m4v|webm)$/i, '');
    t = t.replace(/^[0-9]{1,3}\s*[-–]\s*/, '');
    t = t.replace(/^\d{4}\./, '');
    t = t.replace(/[\s._]\d{3,4}x\d{3,4}.*$/i, '');
    t = t.replace(/\s*[-–]\s*(Action|Comedy|Drama|Aventure)?\s*\d{4}\s*.*$/i, '');
    t = t.replace(/\s*\(?\d{4}\)?\s*(VFF|VF|VOSTFR|MULTi|ENG|FRENCH|AC3|DTS|BluRay|BDRip|1080p|720p|x264|x265|WEB).*$/i, '');
    t = t.replace(/\b(MULTi|VFF|VF|VOSTFR|FRENCH|TRUEFRENCH|1080p|720p|2160p|4k|uhd|bluray|bdrip|brrip|dvdrip|web-dl|webrip|web|h264|h265|x264|x265|hevc|dts-hd|dts|truehd|ac3|aac|proper|repack|remastered|extended|1920x\d+|1280x\d+)\b.*$/i, '');
    t = t.replace(/(?<=[a-zA-Z0-9]{2,})\.|\.(?=[a-zA-Z0-9]{2,})/g, ' ');
    t = t.replace(/_/g, ' ');
    t = t.replace(/\[.*?\]/g, '');
    t = t.replace(/\s*\(\d{4}\)\s*$/, '');
    t = t.replace(/`/g, "'");
    const cleaned = t.replace(/\s{2,}/g, ' ').trim();
    return cleaned || raw || '';
}
