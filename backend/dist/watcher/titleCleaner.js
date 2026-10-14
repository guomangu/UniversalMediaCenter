/**
 * titleCleaner.ts - Normalisation et nettoyage des titres de fichiers multimédias
 * Supprime les bruits de release (1080p, x264, MULTi...), pistes, et résout les épisodes.
 */
export function cleanMediaTitle(raw, original, showTitle, season, episode) {
    if (showTitle) {
        const s = season != null ? String(season).padStart(2, '0') : null;
        const e = episode != null ? String(episode).padStart(2, '0') : null;
        const epPrefix = s && e ? `S${s}E${e}` : e ? `E${e}` : '';
        return epPrefix ? `${showTitle} - ${epPrefix}` : showTitle;
    }
    // Préférer le titre original si propre et non pollué par des tags de release
    if (original && original.trim() && !/1080p|720p|bluray|x264|x265|bdrip/i.test(original)) {
        return original.trim();
    }
    let t = (raw || '').trim();
    t = t.replace(/^[0-9]{1,3}\s*[-–]\s*/, '');
    t = t.replace(/^\d{4}\./, '');
    t = t.replace(/^[0-9]{2}\s+/, '');
    t = t.replace(/[\s._]\d{3,4}x\d{3,4}.*$/i, '');
    t = t.replace(/\s*[-–]\s*(Action|Comedy|Drama|Aventure)?\s*\d{4}\s*.*$/i, '');
    t = t.replace(/\s*\(?\d{4}\)?\s*(VFF|VF|VOSTFR|MULTi|ENG|FRENCH|AC3|DTS|BluRay|BDRip|1080p|720p|x264|x265|WEB).*$/i, '');
    t = t.replace(/\b(MULTi|VFF|VF|VOSTFR|FRENCH|TRUEFRENCH|1080p|720p|2160p|4k|uhd|bluray|bdrip|brrip|dvdrip|web-dl|webrip|web|h264|h265|x264|x265|hevc|dts-hd|dts|truehd|ac3|aac|proper|repack|remastered|extended|1920x\d+|1280x\d+)\b.*$/i, '');
    t = t.replace(/(?<=[a-zA-Z0-9]{2,})\.|\.(?=[a-zA-Z0-9]{2,})/g, ' ');
    t = t.replace(/_/g, ' ');
    t = t.replace(/\[.*?\]/g, '');
    t = t.replace(/\s*\(\d{4}\)\s*$/, '');
    const cleaned = t.replace(/\s{2,}/g, ' ').trim();
    return cleaned || raw || 'Média sans titre';
}
