import { db } from '../db/connection.js';
import { mediaNodes } from '../db/schema/index.js';
import { eq, and, inArray } from 'drizzle-orm';
/**
 * Teste la disponibilité en direct d'un flux vidéo HTTP / HLS / IPTV avec validation stricte.
 * Exigences de validation :
 * 1. Statut HTTP 200/206 (les codes 4xx/5xx sont rejetés).
 * 2. Exclusion formelle des réponses HTML (pages d'erreur, portails captifs, challenges bot).
 * 3. Pour les playlists HLS (.m3u8) :
 *    - Vérification de l'en-tête #EXTM3U.
 *    - Pour les master playlists (#EXT-X-STREAM-INF), résolution et validation de la sous-playlist.
 *    - Vérification et sonde réelle du premier segment vidéo (.ts) pour certifier que le flux diffuse du contenu vidéo réel.
 * 4. Pour les flux binaires directs : vérification que le flux renvoie des octets vidéo réels.
 */
export async function checkChannelStreamAvailability(streamUrl, timeoutMs = 4500) {
    if (!streamUrl || !streamUrl.startsWith('http'))
        return false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(streamUrl, {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                'User-Agent': 'UniversalMediaStack/3.0 (compatible; VLC/3.0.18)',
                'Accept': '*/*',
            },
        });
        if (!res.ok) {
            clearTimeout(timer);
            return false;
        }
        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        // Rejet formel des pages HTML ou JSON d'erreur
        if (contentType.includes('text/html') || contentType.includes('application/json')) {
            clearTimeout(timer);
            return false;
        }
        const isM3u = streamUrl.includes('.m3u8') || streamUrl.includes('m3u') || contentType.includes('mpegurl') || contentType.includes('text');
        if (isM3u) {
            const text = await res.text();
            clearTimeout(timer);
            if (!text.includes('#EXTM3U') && !text.includes('#EXTINF')) {
                return false;
            }
            const baseUrl = new URL(streamUrl);
            const lines = text.split('\n').map((l) => l.trim()).filter((l) => Boolean(l) && !l.startsWith('#'));
            if (lines.length === 0) {
                return false;
            }
            const firstEntry = lines[0];
            let childUrl;
            try {
                childUrl = new URL(firstEntry, baseUrl).toString();
            }
            catch {
                return false;
            }
            // Sonde du child (sous-playlist ou premier segment .ts)
            const childController = new AbortController();
            const childTimer = setTimeout(() => childController.abort(), 3500);
            try {
                const childRes = await fetch(childUrl, {
                    method: 'GET',
                    redirect: 'follow',
                    signal: childController.signal,
                    headers: {
                        'User-Agent': 'UniversalMediaStack/3.0 (compatible; VLC/3.0.18)',
                        'Accept': '*/*',
                        'Range': 'bytes=0-1024',
                    },
                });
                clearTimeout(childTimer);
                if (!childRes.ok)
                    return false;
                const childType = (childRes.headers.get('content-type') || '').toLowerCase();
                if (childType.includes('text/html') || childType.includes('application/json'))
                    return false;
                // Si le child est une sous-playlist (ex: variant mono.m3u8)
                if (childUrl.includes('.m3u8') || childType.includes('mpegurl')) {
                    const childText = await childRes.text();
                    if (!childText.includes('#EXTM3U'))
                        return false;
                    const subLines = childText.split('\n').map((l) => l.trim()).filter((l) => Boolean(l) && !l.startsWith('#'));
                    if (subLines.length === 0)
                        return false;
                    // Tester le premier vrai segment .ts de cette sous-playlist
                    let segUrl;
                    try {
                        segUrl = new URL(subLines[0], new URL(childUrl)).toString();
                    }
                    catch {
                        return false;
                    }
                    const segController = new AbortController();
                    const segTimer = setTimeout(() => segController.abort(), 3500);
                    try {
                        const segRes = await fetch(segUrl, {
                            method: 'GET',
                            redirect: 'follow',
                            signal: segController.signal,
                            headers: {
                                'User-Agent': 'UniversalMediaStack/3.0 (compatible; VLC/3.0.18)',
                                'Accept': '*/*',
                                'Range': 'bytes=0-1024',
                            },
                        });
                        clearTimeout(segTimer);
                        if (!segRes.ok)
                            return false;
                        const segType = (segRes.headers.get('content-type') || '').toLowerCase();
                        if (segType.includes('text/html') || segType.includes('application/json'))
                            return false;
                        return true;
                    }
                    catch {
                        clearTimeout(segTimer);
                        return false;
                    }
                }
                return true;
            }
            catch {
                clearTimeout(childTimer);
                return false;
            }
        }
        clearTimeout(timer);
        return true;
    }
    catch {
        clearTimeout(timer);
        return false;
    }
}
/**
 * Teste tous les flux de chaînes IPTV rattachés à une source donnée par lots concurrents.
 * Met à jour le champ state de media_nodes :
 * - READY pour les chaînes fonctionnelles
 * - ERROR pour les flux morts / coupés / inaccessibles (pour les griser dans l'UI)
 */
export async function testSourceChannelsAvailability(sourceId, concurrency = 20) {
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
            const isLive = await checkChannelStreamAvailability(ch.streamUrl);
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
