import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { epgPrograms, iptvSources, mediaNodes } from '../db/schema/index.js';
import { parseXmltvChannels, parseXmltvContent } from './xmltvParser.js';
import { getSafeOutboundUrl, safeFetch } from '../utils/safeUrl.js';

export interface EpgSyncResult {
  sourceId: string;
  sourceName: string;
  programs: number;
  channelsMatched: number;
  error?: string;
}

/**
 * Normalise un libellé de chaîne pour rapprocher les `tvg-id`/noms XMLTV des
 * titres de la playlist M3U lorsque le fournisseur n'expose pas d'identifiant
 * commun. Les accents, la casse et la ponctuation sont neutralisés.
 */
function normalizeChannelKey(value?: string | null): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(hd|fhd|uhd|sd|4k)\b/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

/** Insère les programmes par lots pour rester sous la limite de paramètres PostgreSQL. */
async function insertProgramBatch(rows: Array<typeof epgPrograms.$inferInsert>): Promise<void> {
  const BATCH_SIZE = 400;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    if (batch.length > 0) {
      await db.insert(epgPrograms).values(batch);
    }
  }
}

/**
 * Ingère un document XMLTV pour une source IPTV donnée.
 *
 * Les `tvg-id` sont désormais persistés sur les nœuds chaînes (colonne
 * `tvg_id`), ce qui permet un rapprochement fiable avec les identifiants de
 * chaînes XMLTV. Un repli sur le nom normalisé est conservé pour les
 * playlists qui n'exposent pas de `tvg-id`.
 */
export async function ingestEpgPrograms(
  sourceId: string,
  xmlContent: string
): Promise<{ programs: number; channelsMatched: number }> {
  const parsedPrograms = parseXmltvContent(xmlContent);
  if (parsedPrograms.length === 0) {
    return { programs: 0, channelsMatched: 0 };
  }

  const xmltvChannels = parseXmltvChannels(xmlContent);
  const channelDisplayNames = new Map<string, string>();
  for (const channel of xmltvChannels) {
    const key = normalizeChannelKey(channel.displayName || channel.id);
    if (key) channelDisplayNames.set(key, channel.id);
  }

  const channels = await db
    .select({
      id: mediaNodes.id,
      title: mediaNodes.title,
      tvgId: mediaNodes.tvgId,
    })
    .from(mediaNodes)
    .where(and(eq(mediaNodes.nodeType, 'LIVE_CHANNEL'), eq(mediaNodes.iptvSourceId, sourceId)));

  if (channels.length === 0) {
    return { programs: 0, channelsMatched: 0 };
  }

  const byTvgId = new Map<string, string>();
  const byTitle = new Map<string, string>();
  for (const channel of channels) {
    if (channel.tvgId) byTvgId.set(channel.tvgId.trim().toLowerCase(), channel.id);
    const key = normalizeChannelKey(channel.title);
    if (key) byTitle.set(key, channel.id);
  }

  const rows: Array<typeof epgPrograms.$inferInsert> = [];
  const matchedChannelIds = new Set<string>();

  for (const program of parsedPrograms) {
    let channelNodeId = byTvgId.get(program.channelId.trim().toLowerCase());

    if (!channelNodeId) {
      const normalized = normalizeChannelKey(program.channelId);
      channelNodeId = byTitle.get(normalized) || (channelDisplayNames.get(normalized) ? byTvgId.get(channelDisplayNames.get(normalized)!.trim().toLowerCase()) : undefined);
    }

    if (!channelNodeId) continue;

    matchedChannelIds.add(channelNodeId);
    rows.push({
      channelNodeId,
      title: program.title,
      subtitle: program.subtitle || null,
      description: program.description || null,
      category: program.category || null,
      iconUrl: program.iconUrl || null,
      startTime: program.start,
      endTime: program.stop,
    });
  }

  if (matchedChannelIds.size === 0) {
    return { programs: 0, channelsMatched: 0 };
  }

  // Remplacement atomique par chaîne : une nouvelle synchronisation ne doit
  // jamais dupliquer les programmes déjà présents (ni conserver un guide
  // obsolète si le fournisseur a changé sa grille).
  const channelIds = Array.from(matchedChannelIds);
  await db.delete(epgPrograms).where(inArray(epgPrograms.channelNodeId, channelIds));
  await insertProgramBatch(rows);

  return { programs: rows.length, channelsMatched: matchedChannelIds.size };
}

/** Télécharge et ingère le guide XMLTV d'une source. */
export async function syncEpgForSource(source: {
  id: string;
  name: string;
  epgXmltvUrl: string | null;
}): Promise<EpgSyncResult> {
  if (!source.epgXmltvUrl) {
    return {
      sourceId: source.id,
      sourceName: source.name,
      programs: 0,
      channelsMatched: 0,
      error: "Aucune URL EPG n'est configurée pour cette source",
    };
  }

  const safeUrl = getSafeOutboundUrl(source.epgXmltvUrl, { allowPrivate: true, allowHttp: true });
  if (!safeUrl) {
    return {
      sourceId: source.id,
      sourceName: source.name,
      programs: 0,
      channelsMatched: 0,
      error: 'URL EPG refusée par la politique de sécurité',
    };
  }

  try {
    const res = await safeFetch(
      safeUrl.toString(),
      { allowPrivate: true, allowHttp: true },
      { signal: AbortSignal.timeout(30_000) }
    );

    if (!res.ok) {
      return {
        sourceId: source.id,
        sourceName: source.name,
        programs: 0,
        channelsMatched: 0,
        error: `HTTP ${res.status} lors du téléchargement du guide EPG`,
      };
    }

    const xmlContent = await res.text();
    const result = await ingestEpgPrograms(source.id, xmlContent);
    await db.update(iptvSources).set({ lastSyncedAt: new Date() }).where(eq(iptvSources.id, source.id));

    return {
      sourceId: source.id,
      sourceName: source.name,
      programs: result.programs,
      channelsMatched: result.channelsMatched,
    };
  } catch (err: any) {
    return {
      sourceId: source.id,
      sourceName: source.name,
      programs: 0,
      channelsMatched: 0,
      error: err?.message || 'Échec de la synchronisation EPG',
    };
  }
}
