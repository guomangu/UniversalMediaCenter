import fs from 'node:fs/promises';
import path from 'node:path';
const VIDEO_EXTENSIONS = new Set([
    '.mkv', '.mp4', '.avi', '.mov', '.m4v', '.webm', '.ts', '.wmv', '.flv',
]);
export async function detectAdjacentFiles(nfoPath) {
    const dir = path.dirname(nfoPath);
    const nfoBase = path.basename(nfoPath, path.extname(nfoPath)).toLowerCase();
    const result = {};
    // Les NFOs de série (tvshow.nfo) et de saison (season.nfo) ne sont JAMAIS des vidéos jouables
    const isShowOrSeasonNfo = nfoBase === 'tvshow' || nfoBase === 'season';
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        // 1. Détection du fichier vidéo principal adjacent (sans déplacement)
        if (!isShowOrSeasonNfo) {
            // Chercher d'abord un fichier vidéo avec exactement le même nom de base
            for (const entry of entries) {
                if (!entry.isFile())
                    continue;
                const ext = path.extname(entry.name).toLowerCase();
                if (!VIDEO_EXTENSIONS.has(ext))
                    continue;
                const base = path.basename(entry.name, ext).toLowerCase();
                if (base === nfoBase) {
                    result.videoFilePath = path.join(dir, entry.name);
                    break;
                }
            }
            // Si pas de match exact, et si c'est un film unique dans son dossier (movie.nfo ou unique vidéo)
            if (!result.videoFilePath) {
                const videoFiles = entries.filter((e) => e.isFile() && VIDEO_EXTENSIONS.has(path.extname(e.name).toLowerCase()));
                if (videoFiles.length === 1) {
                    result.videoFilePath = path.join(dir, videoFiles[0].name);
                }
            }
        }
        // 2. Détection des artworks locaux
        for (const entry of entries) {
            if (!entry.isFile())
                continue;
            const ext = path.extname(entry.name).toLowerCase();
            if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext))
                continue;
            const base = path.basename(entry.name, ext).toLowerCase();
            const fullPath = path.join(dir, entry.name);
            if (base === 'poster' || base === 'cover' || base === 'folder' || base === `${nfoBase}-poster`) {
                result.posterPath = fullPath;
            }
            else if (base === 'fanart' || base === 'backdrop' || base === `${nfoBase}-fanart`) {
                result.fanartPath = fullPath;
            }
            else if (base === 'clearlogo' || base === 'logo') {
                result.clearlogoPath = fullPath;
            }
            else if (base === 'thumb' || base === `${nfoBase}-thumb`) {
                result.thumbPath = fullPath;
            }
        }
    }
    catch (err) {
        console.warn(`Could not inspect adjacent files in ${dir}:`, err);
    }
    return result;
}
