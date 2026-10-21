import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { mediaNodes, iptvSources, eavValues, eavAttributes, nodeEavLinks, epgPrograms } from '../db/schema/index.js';
import { eq, and, or, ilike, asc, not, inArray, gte, lte } from 'drizzle-orm';
import { requireAdmin, requireAuth } from '../middleware/access.js';
import { isMediaAllowedForUser } from '../auth/mediaAccess.js';
import { iptvSourcesRouter } from './iptvSources.js';
import { proxyLiveStream } from '../iptv/liveProxyService.js';
import { syncEpgForSource } from '../iptv/epgIngester.js';
import { getSafeOutboundUrl, safeFetch } from '../utils/safeUrl.js';
export const iptvRouter = new Hono();
// Toutes les routes IPTV exigent une session valide (y compris le proxy).
// Les sous-routes d'administration appliquent ensuite requireAdmin.
iptvRouter.use('*', requireAuth);
// Déléguer la gestion des sources IPTV (Admin)
iptvRouter.route('/sources', iptvSourcesRouter);
// Proxy de flux en direct universel (HLS manifest, audio, ts chunks) sans blocage d'en-tête XHR
iptvRouter.options('/proxy', (c) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    c.header('Access-Control-Allow-Headers', '*');
    return c.body(null, 204);
});
iptvRouter.get('/proxy', async (c) => {
    const url = c.req.query('url');
    if (!url) {
        return c.text('URL param required', 400);
    }
    // Anti-SSRF : on refuse les protocoles non HTTP(S), le loopback, le link-local
    // et les endpoints de métadonnées cloud. Les plages LAN restent autorisées
    // pour les installations IPTV domestiques.
    const safeUrl = getSafeOutboundUrl(url, { allowPrivate: true, allowHttp: true });
    if (!safeUrl) {
        return c.json({ error: 'URL de flux refusée par la politique de sécurité', code: 'UNSAFE_URL' }, 400);
    }
    return await proxyLiveStream(c, safeUrl.toString());
});
iptvRouter.get('/channels', async (c) => {
    const user = c.get('user');
    // Contrôle RBAC : si l'utilisateur n'a pas le droit de regarder l'IPTV
    if (user && user.canWatchIptv === false) {
        return c.json({ count: 0, channels: [] });
    }
    const q = c.req.query('q')?.trim();
    const category = c.req.query('category')?.trim();
    const limit = Math.min(parseInt(c.req.query('limit') || '300', 10), 500);
    const conditions = [
        eq(mediaNodes.nodeType, 'LIVE_CHANNEL'),
        not(ilike(mediaNodes.streamUrl, '%145.239.5.177%')),
    ];
    if (q) {
        conditions.push(or(ilike(mediaNodes.title, `%${q}%`), ilike(mediaNodes.searchVectorText, `%${q}%`)));
    }
    if (category && category !== 'ALL') {
        conditions.push(ilike(mediaNodes.searchVectorText, `%${category}%`));
    }
    const channels = await db
        .select()
        .from(mediaNodes)
        .where(and(...conditions))
        .orderBy(asc(mediaNodes.title))
        .limit(limit);
    // Filtrage strict ABAC sur les chaînes IPTV (tags bloqués / autorisés)
    const allowedChannels = channels.filter((ch) => isMediaAllowedForUser(user, ch));
    return c.json({ count: allowedChannels.length, channels: allowedChannels });
});
iptvRouter.get('/categories', async (c) => {
    const user = c.get('user');
    if (user && user.canWatchIptv === false) {
        return c.json({ categories: [] });
    }
    try {
        const rows = await db
            .selectDistinct({ name: eavValues.valueText })
            .from(eavValues)
            .innerJoin(eavAttributes, eq(eavValues.attributeId, eavAttributes.id))
            .innerJoin(nodeEavLinks, eq(eavValues.id, nodeEavLinks.valueId))
            .innerJoin(mediaNodes, eq(nodeEavLinks.nodeId, mediaNodes.id))
            .where(and(eq(eavAttributes.code, 'iptv_category'), eq(mediaNodes.nodeType, 'LIVE_CHANNEL')))
            .orderBy(asc(eavValues.valueText));
        const categories = rows
            .map((r) => r.name)
            .filter(Boolean)
            .filter((catName) => {
            if (!user || user.isAdmin)
                return true;
            if (user.blockedTags && user.blockedTags.some((bt) => catName?.toLowerCase().includes(bt.toLowerCase()))) {
                return false;
            }
            return true;
        });
        return c.json({ categories });
    }
    catch {
        return c.json({ categories: [] });
    }
});
iptvRouter.post('/sync-epg', requireAdmin, async (c) => {
    const sources = await db.query.iptvSources.findMany({
        where: (t, { eq }) => eq(t.isActive, true),
    });
    const results = [];
    let totalPrograms = 0;
    for (const src of sources) {
        if (!src.epgXmltvUrl)
            continue;
        const result = await syncEpgForSource({
            id: src.id,
            name: src.name,
            epgXmltvUrl: src.epgXmltvUrl,
        });
        totalPrograms += result.programs;
        results.push(result);
    }
    return c.json({
        success: true,
        syncedSources: results.filter((r) => !r.error).length,
        totalSources: sources.length,
        totalPrograms,
        results,
    });
});
/** Convertit un enregistrement EPG en objet JSON stable pour le frontend. */
function serializeProgram(program) {
    return {
        id: program.id,
        channelId: program.channelNodeId,
        title: program.title,
        subtitle: program.subtitle || null,
        description: program.description || null,
        category: program.category || null,
        iconUrl: program.iconUrl || null,
        startTime: program.startTime?.toISOString?.() ?? program.startTime,
        endTime: program.endTime?.toISOString?.() ?? program.endTime,
    };
}
/**
 * Retourne les programmes EPG d'une sélection de chaînes sur une fenêtre
 * temporelle. Les chaînes sont filtrées par les mêmes règles ABAC/PBAC que
 * `/channels` : un profil restreint ne peut pas déduire le contenu d'une
 * chaîne bloquée à travers le guide.
 */
iptvRouter.get('/epg', async (c) => {
    const user = c.get('user');
    if (user && user.canWatchIptv === false) {
        return c.json({ from: null, to: null, programs: {} });
    }
    const rawIds = (c.req.query('channelIds') || '')
        .split(',')
        .map((id) => id.trim())
        .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
        .slice(0, 300);
    if (rawIds.length === 0) {
        return c.json({ from: null, to: null, programs: {} });
    }
    const hours = Math.min(Math.max(parseInt(c.req.query('hours') || '6', 10) || 6, 1), 48);
    const fromParam = c.req.query('from');
    const from = fromParam && !Number.isNaN(Date.parse(fromParam)) ? new Date(fromParam) : new Date();
    const to = new Date(from.getTime() + hours * 60 * 60 * 1000);
    const channels = await db
        .select()
        .from(mediaNodes)
        .where(and(eq(mediaNodes.nodeType, 'LIVE_CHANNEL'), inArray(mediaNodes.id, rawIds)));
    const allowedIds = channels.filter((channel) => isMediaAllowedForUser(user, channel)).map((channel) => channel.id);
    if (allowedIds.length === 0) {
        return c.json({ from: from.toISOString(), to: to.toISOString(), programs: {} });
    }
    const rows = await db
        .select()
        .from(epgPrograms)
        .where(and(inArray(epgPrograms.channelNodeId, allowedIds), lte(epgPrograms.startTime, to), gte(epgPrograms.endTime, from)))
        .orderBy(asc(epgPrograms.startTime));
    const grouped = {};
    for (const row of rows) {
        if (!grouped[row.channelNodeId])
            grouped[row.channelNodeId] = [];
        grouped[row.channelNodeId].push(serializeProgram(row));
    }
    return c.json({ from: from.toISOString(), to: to.toISOString(), programs: grouped });
});
/**
 * Retourne uniquement l'émission en cours et la suivante pour chaque chaîne.
 * Utilisé par les cartes TV : la charge réseau reste minimale (deux programmes
 * par chaîne) quel que soit le nombre de chaînes affichées.
 */
iptvRouter.get('/epg/now-next', async (c) => {
    const user = c.get('user');
    if (user && user.canWatchIptv === false) {
        return c.json({ now: Date.now(), channels: {} });
    }
    const rawIds = (c.req.query('channelIds') || '')
        .split(',')
        .map((id) => id.trim())
        .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
        .slice(0, 300);
    if (rawIds.length === 0) {
        return c.json({ now: Date.now(), channels: {} });
    }
    const channels = await db
        .select()
        .from(mediaNodes)
        .where(and(eq(mediaNodes.nodeType, 'LIVE_CHANNEL'), inArray(mediaNodes.id, rawIds)));
    const allowedIds = channels.filter((channel) => isMediaAllowedForUser(user, channel)).map((channel) => channel.id);
    if (allowedIds.length === 0) {
        return c.json({ now: Date.now(), channels: {} });
    }
    const now = new Date();
    const horizon = new Date(now.getTime() + 12 * 60 * 60 * 1000);
    const rows = await db
        .select()
        .from(epgPrograms)
        .where(and(inArray(epgPrograms.channelNodeId, allowedIds), gte(epgPrograms.endTime, now), lte(epgPrograms.startTime, horizon)))
        .orderBy(asc(epgPrograms.startTime));
    const result = {};
    for (const id of allowedIds)
        result[id] = { now: null, next: null };
    for (const row of rows) {
        const entry = result[row.channelNodeId];
        if (!entry)
            continue;
        const start = new Date(row.startTime).getTime();
        const end = new Date(row.endTime).getTime();
        if (start <= now.getTime() && end > now.getTime()) {
            entry.now = serializeProgram(row);
        }
        else if (start > now.getTime() && !entry.next) {
            entry.next = serializeProgram(row);
        }
    }
    return c.json({ now: now.toISOString(), channels: result });
});
iptvRouter.get('/stream/:channelId/live.m3u8', async (c) => {
    const channelId = c.req.param('channelId');
    const user = c.get('user');
    if (user && user.canWatchIptv === false) {
        return c.text('Accès refusé : la télévision en direct n\'est pas autorisée pour votre profil', 403);
    }
    const channel = await db.query.mediaNodes.findFirst({
        where: (t, { eq }) => eq(t.id, channelId),
    });
    if (!channel || !channel.streamUrl) {
        return c.text('Channel or stream not found', 404);
    }
    if (!isMediaAllowedForUser(user, channel)) {
        return c.text('Accès refusé à cette chaîne', 403);
    }
    return await proxyLiveStream(c, channel.streamUrl);
});
