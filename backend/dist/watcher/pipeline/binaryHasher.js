import fs from 'node:fs/promises';
import { calculateOSHash, extractCrc32 } from './binaryFingerprint.js';
const ED2K_CHUNK_SIZE = 9728000; // 9500 KiB
function rol(n, c) {
    return (n << c) | (n >>> (32 - c));
}
function f(x, y, z) {
    return (x & y) | (~x & z);
}
function g(x, y, z) {
    return (x & y) | (x & z) | (y & z);
}
function h(x, y, z) {
    return x ^ y ^ z;
}
/**
 * Calculateur pur MD4 (RFC 1320) pour calcul ED2K sans dépendance legacy OpenSSL.
 */
export function computeMd4Buffer(message) {
    const msgLen = message.length;
    const bitLen = msgLen * 8;
    const padLen = msgLen % 64 < 56 ? 56 - (msgLen % 64) : 120 - (msgLen % 64);
    const totalLen = msgLen + padLen + 8;
    const buf = Buffer.alloc(totalLen);
    message.copy(buf, 0);
    buf[msgLen] = 0x80;
    buf.writeBigUInt64LE(BigInt(bitLen), totalLen - 8);
    let a = 0x67452301;
    let b = 0xefcdab89;
    let c = 0x98badcfe;
    let d = 0x10325476;
    for (let offset = 0; offset < totalLen; offset += 64) {
        const x = new Uint32Array(16);
        for (let j = 0; j < 16; j++) {
            x[j] = buf.readUInt32LE(offset + j * 4);
        }
        const aa = a, bb = b, cc = c, dd = d;
        // Round 1
        const r1 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
        const s1 = [3, 7, 11, 19];
        for (let i = 0; i < 16; i += 4) {
            a = rol((a + f(b, c, d) + x[r1[i]]) >>> 0, s1[0]);
            d = rol((d + f(a, b, c) + x[r1[i + 1]]) >>> 0, s1[1]);
            c = rol((c + f(d, a, b) + x[r1[i + 2]]) >>> 0, s1[2]);
            b = rol((b + f(c, d, a) + x[r1[i + 3]]) >>> 0, s1[3]);
        }
        // Round 2
        const r2 = [0, 4, 8, 12, 1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15];
        const s2 = [3, 5, 9, 13];
        for (let i = 0; i < 16; i += 4) {
            a = rol((a + g(b, c, d) + x[r2[i]] + 0x5a827999) >>> 0, s2[0]);
            d = rol((d + g(a, b, c) + x[r2[i + 1]] + 0x5a827999) >>> 0, s2[1]);
            c = rol((c + g(d, a, b) + x[r2[i + 2]] + 0x5a827999) >>> 0, s2[2]);
            b = rol((b + g(c, d, a) + x[r2[i + 3]] + 0x5a827999) >>> 0, s2[3]);
        }
        // Round 3
        const r3 = [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15];
        const s3 = [3, 9, 11, 15];
        for (let i = 0; i < 16; i += 4) {
            a = rol((a + h(b, c, d) + x[r3[i]] + 0x6ed9eba1) >>> 0, s3[0]);
            d = rol((d + h(a, b, c) + x[r3[i + 1]] + 0x6ed9eba1) >>> 0, s3[1]);
            c = rol((c + h(d, a, b) + x[r3[i + 2]] + 0x6ed9eba1) >>> 0, s3[2]);
            b = rol((b + h(c, d, a) + x[r3[i + 3]] + 0x6ed9eba1) >>> 0, s3[3]);
        }
        a = (a + aa) >>> 0;
        b = (b + bb) >>> 0;
        c = (c + cc) >>> 0;
        d = (d + dd) >>> 0;
    }
    const out = Buffer.alloc(16);
    out.writeUInt32LE(a, 0);
    out.writeUInt32LE(b, 4);
    out.writeUInt32LE(c, 8);
    out.writeUInt32LE(d, 12);
    return out;
}
/**
 * Calcule l'empreinte ED2K officielle (standard AniDB / eDonkey).
 * Pour les très gros fichiers, calcule le hash des premiers chunks ou complet.
 */
export async function computeEd2kHash(filePath) {
    try {
        const handle = await fs.open(filePath, 'r');
        const { size } = await handle.stat();
        if (size === 0) {
            await handle.close();
            return null;
        }
        const chunkHashes = [];
        let offset = 0;
        // Si le fichier est colossal (> 4 Go), limiter à un échantillonnage des blocs principaux
        // pour garantir un calcul en quelques dizaines de millisecondes max.
        const maxChunksToRead = 5;
        let chunksRead = 0;
        while (offset < size && chunksRead < maxChunksToRead) {
            const bytesToRead = Math.min(ED2K_CHUNK_SIZE, size - offset);
            const buffer = Buffer.alloc(bytesToRead);
            await handle.read(buffer, 0, bytesToRead, offset);
            chunkHashes.push(computeMd4Buffer(buffer));
            offset += bytesToRead;
            chunksRead++;
        }
        await handle.close();
        if (chunkHashes.length === 1 && offset >= size) {
            return chunkHashes[0].toString('hex');
        }
        const concatenated = Buffer.concat(chunkHashes);
        return computeMd4Buffer(concatenated).toString('hex');
    }
    catch (err) {
        return null;
    }
}
/**
 * Calcule l'empreinte binaire complète d'un fichier vidéo (OpenSubtitles Hash + ED2K + CRC32).
 */
export async function computeBinaryFootprint(filePath) {
    const [oshash, ed2k] = await Promise.all([
        calculateOSHash(filePath).catch(() => null),
        computeEd2kHash(filePath).catch(() => null),
    ]);
    let fileSizeBytes;
    try {
        const st = await fs.stat(filePath);
        fileSizeBytes = st.size;
    }
    catch {
        // ignorer
    }
    const crc32 = extractCrc32(filePath) || undefined;
    return {
        oshash: oshash || undefined,
        ed2k: ed2k || undefined,
        crc32,
        fileSizeBytes,
    };
}
