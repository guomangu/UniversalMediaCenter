import { db } from '../db/connection.js';
import { mediaNodes } from '../db/schema/index.js';
import { eq, and, inArray } from 'drizzle-orm';

/**
 * Teste la disponibilité en direct d'un flux vidéo HTTP / HLS / IPTV.
 * Effectue une requête GET minimale avec Range header et timeout strict.
 * Dès réception du code de statut HTTP (200-399), la requête est immédiatement avortée
 * afin de vérifier l'état du flux sans saturer la bande passante ni télécharger le segment vidéo.
 */
export async function checkChannelStreamAvailability(streamUrl: string, timeoutMs = 3500): Promise<boolean> {
  if (!streamUrl || !streamUrl.startsWith('http')) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(streamUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) UniversalMediaStack/3.0',
        'Accept': '*/*',
        'Range': 'bytes=0-1024',
      },
    });

    clearTimeout(timer);
    const isSuccess = res.status >= 200 && res.status < 400;
    // Interrompre la lecture du corps immédiatement
    try {
      controller.abort();
    } catch {}

    return isSuccess;
  } catch {
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
export async function testSourceChannelsAvailability(
  sourceId: string,
  concurrency = 20
): Promise<{
  testedCount: number;
  availableCount: number;
  unavailableCount: number;
}> {
  const channels = await db
    .select({ id: mediaNodes.id, streamUrl: mediaNodes.streamUrl })
    .from(mediaNodes)
    .where(and(eq(mediaNodes.nodeType, 'LIVE_CHANNEL'), eq(mediaNodes.iptvSourceId, sourceId)));

  const readyIds: string[] = [];
  const errorIds: string[] = [];

  for (let i = 0; i < channels.length; i += concurrency) {
    const chunk = channels.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (ch) => {
        if (!ch.streamUrl) {
          errorIds.push(ch.id);
          return;
        }
        const isLive = await checkChannelStreamAvailability(ch.streamUrl);
        if (isLive) {
          readyIds.push(ch.id);
        } else {
          errorIds.push(ch.id);
        }
      })
    );
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
