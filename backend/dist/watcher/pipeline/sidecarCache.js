import fs from 'node:fs/promises';
import path from 'node:path';
/**
 * Lit le cache local sidecar .ums.json s'il existe
 */
export async function readSidecarCache(videoPath) {
    const dir = path.dirname(videoPath);
    const base = path.basename(videoPath, path.extname(videoPath));
    const cachePath = path.join(dir, `.${base}.ums.json`);
    try {
        const raw = await fs.readFile(cachePath, 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
/**
 * Écrit silencieusement le cache local sidecar .ums.json
 */
export async function writeSidecarCache(videoPath, data) {
    const dir = path.dirname(videoPath);
    const base = path.basename(videoPath, path.extname(videoPath));
    const cachePath = path.join(dir, `.${base}.ums.json`);
    const payload = {
        version: 1,
        confidenceScore: data.confidenceScore ?? 1.0,
        oshash: data.oshash,
        crc32: data.crc32,
        durationSeconds: data.durationSeconds,
        edition: data.edition,
        isExtra: Boolean(data.isExtra),
        extraType: data.extraType,
        chapters: data.chapters || [],
        updatedAt: new Date().toISOString(),
    };
    try {
        await fs.writeFile(cachePath, JSON.stringify(payload, null, 2), 'utf-8');
    }
    catch {
        // Si le dossier est en lecture seule (ro bind), ne bloque pas l'exécution
    }
}
