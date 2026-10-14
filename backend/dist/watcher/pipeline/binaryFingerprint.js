import fs from 'node:fs/promises';
import path from 'node:path';
const CHUNK_SIZE = 64 * 1024; // 64 KB
/**
 * Calcule l'OpenSubtitles Hash (OSHash) en O(1) (~1 à 3 ms).
 * Somme binaire 64-bit de la taille totale + 64 Ko de début + 64 Ko de fin.
 */
export async function calculateOSHash(filePath) {
    try {
        const handle = await fs.open(filePath, 'r');
        const { size } = await handle.stat();
        if (size < CHUNK_SIZE) {
            await handle.close();
            return null;
        }
        let hash = BigInt(size);
        const startBuf = Buffer.alloc(CHUNK_SIZE);
        const endBuf = Buffer.alloc(CHUNK_SIZE);
        await handle.read(startBuf, 0, CHUNK_SIZE, 0);
        await handle.read(endBuf, 0, CHUNK_SIZE, size - CHUNK_SIZE);
        await handle.close();
        for (let i = 0; i < CHUNK_SIZE; i += 8) {
            hash = (hash + startBuf.readBigUInt64LE(i)) & 0xffffffffffffffffn;
        }
        for (let i = 0; i < CHUNK_SIZE; i += 8) {
            hash = (hash + endBuf.readBigUInt64LE(i)) & 0xffffffffffffffffn;
        }
        return hash.toString(16).padStart(16, '0');
    }
    catch (err) {
        return null;
    }
}
/**
 * Extrait les identifiants explicites [tmdbid-XXXX], [imdbid-ttXXXX], etc.
 */
export function extractExplicitIds(targetStr) {
    const res = {};
    const tmdb = /\[(?:tmdbid|tmdb)[-_:\s]*(\d+)\]/i.exec(targetStr);
    if (tmdb)
        res.tmdbId = parseInt(tmdb[1], 10);
    const imdb = /\[(?:imdbid|imdb)[-_:\s]*(tt\d+)\]/i.exec(targetStr);
    if (imdb)
        res.imdbId = imdb[1];
    const tvdb = /\[(?:tvdbid|tvdb)[-_:\s]*(\d+)\]/i.exec(targetStr);
    if (tvdb)
        res.tvdbId = parseInt(tvdb[1], 10);
    const anidb = /\[(?:anidbid|anidb)[-_:\s]*(\d+)\]/i.exec(targetStr);
    if (anidb)
        res.anidbId = parseInt(anidb[1], 10);
    return res;
}
/**
 * Extrait le CRC32 [A1B2C3D4] souvent présent dans les releases fansub anime
 */
export function extractCrc32(filename) {
    const match = /\[([0-9a-fA-F]{8})\]/.exec(filename);
    return match ? match[1].toUpperCase() : null;
}
