import fs from 'node:fs/promises';
import path from 'node:path';
const VIDEO_EXTENSIONS = new Set([
    '.mkv', '.mp4', '.avi', '.mov', '.m4v', '.webm', '.ts', '.wmv', '.flv',
]);
export async function detectAdjacentFiles(nfoPath) {
    const dir = path.dirname(nfoPath);
    const nfoBase = path.basename(nfoPath, path.extname(nfoPath)).toLowerCase();
    const result = {};
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isFile())
                continue;
            const ext = path.extname(entry.name).toLowerCase();
            const base = path.basename(entry.name, ext).toLowerCase();
            const fullPath = path.join(dir, entry.name);
            // Détection du fichier vidéo principal adjacent (sans déplacement)
            if (VIDEO_EXTENSIONS.has(ext)) {
                if (!result.videoFilePath || base === nfoBase || base === 'movie' || base === 'video') {
                    result.videoFilePath = fullPath;
                }
            }
            // Détection des artworks locaux
            if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
                if (base === 'poster' || base === 'cover' || base === 'folder' || base === `${nfoBase}-poster`) {
                    result.posterPath = fullPath;
                }
                else if (base === 'fanart' || base === 'backdrop' || base === `${nfoBase}-fanart`) {
                    result.fanartPath = fullPath;
                }
                else if (base === 'clearlogo' || base === 'logo') {
                    result.clearlogoPath = fullPath;
                }
            }
        }
    }
    catch (err) {
        console.warn(`Could not inspect adjacent files in ${dir}:`, err);
    }
    return result;
}
