import { db } from '../db/connection.js';
import { mediaNodes } from '../db/schema/index.js';
import { eq, and, inArray } from 'drizzle-orm';
const PROBE_UA = 'UniversalMediaStack/3.0 (compatible; VLC/3.0.18)';
const MAX_PROBE_BYTES = 8192;
/**
 * Récupère uniquement les premiers octets d'un flux, puis coupe la connexion.
 * Indispensable pour les directs : lire tout le corps (`res.text()` /
 * `arrayBuffer()`) ne se terminerait jamais sur un flux MPEG-TS continu.
 */
async function probeStream(url, timeoutMs) {
    if (!url || !url.startsWith('http'))
        return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                'User-Agent': PROBE_UA,
                'Accept': '*/*',
                'Range': `bytes=0-${MAX_PROBE_BYTES - 1}`,
            },
        });
        if (!res.ok || res.status === 204 || res.status === 304)
            return null;
        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        // Une page d'erreur, un JSON ou un XML ne sont jamais un flux vidéo.
        if (/(text\/html|application\/json|text\/xml|application\/xml|javascript)/.test(contentType)) {
            return null;
        }
        let bytes = new Uint8Array(0);
        if (res.body) {
            const reader = res.body.getReader();
            const chunks = [];
            let total = 0;
            try {
                while (total < MAX_PROBE_BYTES) {
                    const { value, done } = await reader.read();
                    if (done)
                        break;
                    if (value && value.length > 0) {
                        chunks.push(value);
                        total += value.length;
                    }
                }
            }
            finally {
                try {
                    await reader.cancel();
                }
                catch { }
            }
            if (total > 0) {
                const merged = Buffer.concat(chunks.map((c) => Buffer.from(c)));
                bytes = new Uint8Array(merged.subarray(0, MAX_PROBE_BYTES));
            }
        }
        return { contentType, bytes, finalUrl: res.url || url };
    }
    catch {
        return null;
    }
    finally {
        clearTimeout(timer);
        // Libère immédiatement la socket d'un direct infini.
        try {
            controller.abort();
        }
        catch { }
    }
}
function decodeHead(bytes) {
    try {
        return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
    }
    catch {
        return '';
    }
}
function isHlsManifest(bytes) {
    return decodeHead(bytes).trimStart().startsWith('#EXTM3U');
}
function resolvePlaylistEntries(text, baseUrl) {
    return text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => Boolean(line) && !line.startsWith('#'))
        .map((line) => {
        try {
            return new URL(line, baseUrl).toString();
        }
        catch {
            return '';
        }
    })
        .filter(Boolean);
}
/** Détecte le début d'une page d'erreur texte même servie en octet-stream. */
function looksLikeTextOrError(bytes) {
    const head = Buffer.from(bytes.subarray(0, Math.min(bytes.length, 256)))
        .toString('latin1')
        .trim();
    if (!head)
        return true;
    if (/^[<[{]/.test(head))
        return true;
    if (/^(error|erreur|not\s*found|forbidden|unauthorized|no\s+such|invalid|denied)\b/i.test(head))
        return true;
    let printable = 0;
    for (let i = 0; i < head.length; i++) {
        const code = head.charCodeAt(i);
        if (code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126))
            printable++;
    }
    return printable / head.length > 0.95;
}
function hasVideoMagic(bytes) {
    if (bytes.length >= 8) {
        // MKV / WebM
        if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3)
            return true;
        // MP4 / fMP4 (ftyp)
        if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70)
            return true;
        // MPEG-PS (pack / system header)
        if (bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && (bytes[3] === 0xba || bytes[3] === 0xb3))
            return true;
        // FLV / OggS / RIFF (AVI)
        if (bytes[0] === 0x46 && bytes[1] === 0x4c && bytes[2] === 0x56)
            return true;
        if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53)
            return true;
        if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46)
            return true;
        // MP3 (ID3 ou trame de synchronisation)
        if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33)
            return true;
        if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
            return true;
    }
    // MPEG-TS : octet de synchronisation 0x47 puis tous les 188 octets.
    if (bytes[0] === 0x47) {
        if (bytes.length < 189)
            return true;
        if (bytes.length < 377 || bytes[188] === 0x47 || bytes[376] === 0x47)
            return true;
    }
    return false;
}
function isPlausibleMediaPayload(bytes, contentType) {
    if (bytes.length === 0)
        return false;
    if (looksLikeTextOrError(bytes))
        return false;
    if (hasVideoMagic(bytes))
        return true;
    const mediaContentType = /^(video|audio)\//.test(contentType) ||
        contentType.includes('mp2t') ||
        contentType.includes('octet-stream');
    // Segments HLS chiffrés (AES-128) : aucune signature reconnaissable, mais
    // une charge binaire suffisante et un type média restent acceptables.
    return bytes.length >= 1024 && mediaContentType;
}
/**
 * Valide récursivement un manifeste HLS :
 * master playlist → sous-playlist variante → premier segment réellement servi.
 */
async function validateHlsManifest(url, depth = 0, timeoutMs = 6000) {
    if (depth > 2)
        return false;
    const probe = await probeStream(url, timeoutMs);
    if (!probe || !isHlsManifest(probe.bytes))
        return false;
    const text = decodeHead(probe.bytes);
    const entries = resolvePlaylistEntries(text, probe.finalUrl);
    if (entries.length === 0)
        return false;
    const isMasterPlaylist = /#EXT-X-STREAM-INF/i.test(text) || entries.some((entry) => /\.m3u8(\?|$)/i.test(entry));
    if (isMasterPlaylist) {
        // Tester au moins deux variantes : certains serveurs exposent une piste
        // morte en première position alors qu'une autre fonctionne.
        const variants = entries.slice(0, 2);
        for (const variant of variants) {
            if (await validateHlsManifest(variant, depth + 1, timeoutMs))
                return true;
        }
        return false;
    }
    const segment = await probeStream(entries[0], timeoutMs);
    if (!segment)
        return false;
    return isPlausibleMediaPayload(segment.bytes, segment.contentType);
}
/**
 * Teste la disponibilité RÉELLE d'un flux IPTV.
 *
 * Le lecteur UMS force HLS.js pour tous les directs (`isLive`). Un flux
 * MPEG-TS brut (`http://host:8800/udp/...`) répond souvent `200` avec un
 * `content-type: application/octet-stream`, mais hls.js ne peut pas le lire :
 * la chaîne doit donc être considérée indisponible et grisée.
 *
 * Seuls les manifestes HLS valides (`#EXTM3U`) dont le premier segment
 * renvoie une charge média réelle sont déclarés disponibles.
 */
export async function checkChannelStreamAvailability(streamUrl, timeoutMs = 6000) {
    if (!streamUrl || !streamUrl.startsWith('http'))
        return false;
    return validateHlsManifest(streamUrl, 0, timeoutMs);
}
/**
 * Teste tous les flux de chaînes IPTV rattachés à une source donnée par lots concurrents.
 * Met à jour le champ state de media_nodes :
 * - READY pour les chaînes réellement lisibles
 * - ERROR pour les flux morts / non-HLS / inaccessibles (pour les griser dans l'UI)
 */
export async function testSourceChannelsAvailability(sourceId, concurrency = 8) {
    const channels = await db
        .select({ id: mediaNodes.id, streamUrl: mediaNodes.streamUrl })
        .from(mediaNodes)
        .where(and(eq(mediaNodes.nodeType, 'LIVE_CHANNEL'), eq(mediaNodes.iptvSourceId, sourceId)));
    const readyIds = [];
    const errorIds = [];
    for (let i = 0; i < channels.length; i += concurrency) {
        const chunk = channels.slice(i, i + concurrency);
        await Promise.all(chunk.map(async (ch) => {
            if (!ch.streamUrl) {
                errorIds.push(ch.id);
                return;
            }
            let isLive = await checkChannelStreamAvailability(ch.streamUrl);
            if (!isLive) {
                // Une seule relance : un timeout réseau transitoire ou une limitation
                // du CDN ne doit pas griser définitivement une chaîne qui fonctionne.
                await new Promise((resolve) => setTimeout(resolve, 500));
                isLive = await checkChannelStreamAvailability(ch.streamUrl, 8000);
            }
            if (isLive) {
                readyIds.push(ch.id);
            }
            else {
                errorIds.push(ch.id);
            }
        }));
    }
    // Mise à jour groupée en base par batch
    if (readyIds.length > 0) {
        for (let i = 0; i < readyIds.length; i += 200) {
            const slice = readyIds.slice(i, i + 200);
            await db
                .update(mediaNodes)
                .set({ state: 'READY', updatedAt: new Date() })
                .where(inArray(mediaNodes.id, slice));
        }
    }
    if (errorIds.length > 0) {
        for (let i = 0; i < errorIds.length; i += 200) {
            const slice = errorIds.slice(i, i + 200);
            await db
                .update(mediaNodes)
                .set({ state: 'ERROR', updatedAt: new Date() })
                .where(inArray(mediaNodes.id, slice));
        }
    }
    return {
        testedCount: channels.length,
        availableCount: readyIds.length,
        unavailableCount: errorIds.length,
    };
}
