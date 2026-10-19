import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { iptvSources, mediaNodes, eavValues, nodeEavLinks, eavAttributes } from '../db/schema/index.js';
import { parseM3uContent } from '../iptv/m3uParser.js';
import { ingestIptvChannels } from '../iptv/channelIngester.js';
import { testSourceChannelsAvailability } from '../iptv/streamTester.js';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { requireAdmin } from '../middleware/access.js';
import { getSafeOutboundUrl, safeFetch } from '../utils/safeUrl.js';
export const iptvSourcesRouter = new Hono();
iptvSourcesRouter.use('*', requireAdmin);
// Lister toutes les sources IPTV
iptvSourcesRouter.get('/', async (c) => {
    const sources = await db.query.iptvSources.findMany({
        orderBy: [desc(iptvSources.lastSyncedAt)],
    });
    return c.json({ success: true, sources });
});
// Ajouter une nouvelle source IPTV
iptvSourcesRouter.post('/', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { name, m3uUrl, epgXmltvUrl } = body;
    if (!name || !m3uUrl) {
        return c.json({ error: 'Le nom et l’URL M3U sont obligatoires' }, 400);
    }
    const [source] = await db
        .insert(iptvSources)
        .values({ name, m3uUrl, epgXmltvUrl })
        .returning();
    try {
        const safeM3uUrl = getSafeOutboundUrl(m3uUrl, { allowPrivate: true, allowHttp: true });
        if (!safeM3uUrl)
            throw new Error('URL M3U refusée par la politique de sécurité');
        const res = await safeFetch(safeM3uUrl.toString(), { allowPrivate: true, allowHttp: true }, {
            headers: { 'User-Agent': source.userAgent || 'UniversalMediaStack/3.0' },
            signal: AbortSignal.timeout(20000),
        });
        if (!res.ok)
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const content = await res.text();
        const channels = parseM3uContent(content);
        const importedCount = await ingestIptvChannels(channels, source.id);
        // Test de disponibilité des flux en direct
        const testResults = await testSourceChannelsAvailability(source.id);
        await db
            .update(iptvSources)
            .set({ lastSyncedAt: new Date() })
            .where(eq(iptvSources.id, source.id));
        return c.json({
            success: true,
            source,
            importedCount,
            testedCount: testResults.testedCount,
            availableCount: testResults.availableCount,
            unavailableCount: testResults.unavailableCount,
            message: `${importedCount} canaux synchronisés : ${testResults.availableCount} opérationnels, ${testResults.unavailableCount} indisponibles (grisés)`,
        });
    }
    catch (err) {
        return c.json({ success: true, source, warning: `Source enregistrée mais synchronisation échouée: ${err.message}` });
    }
});
// Nettoyer les chaînes orphelines (qui n'appartiennent à aucune source active)
iptvSourcesRouter.post('/cleanup-orphans', async (c) => {
    const activeSources = await db.query.iptvSources.findMany({
        where: (t, { eq }) => eq(t.isActive, true),
    });
    const activeIds = activeSources.map((s) => s.id);
    let deletedChannelsCount = 0;
    if (activeIds.length === 0) {
        // Aucune source active : ne rien supprimer. Une désactivation temporaire de
        // toutes les sources ne doit pas détruire la bibliothèque de chaînes.
        return c.json({
            success: true,
            deletedChannelsCount: 0,
            message: 'Aucune source active : nettoyage ignoré pour préserver les chaînes.',
        });
    }
    else {
        // Supprimer les chaînes dont le sourceId est null ou n'est plus dans activeIds
        const allChannels = await db
            .select({ id: mediaNodes.id, iptvSourceId: mediaNodes.iptvSourceId })
            .from(mediaNodes)
            .where(eq(mediaNodes.nodeType, 'LIVE_CHANNEL'));
        const orphanIds = allChannels
            .filter((ch) => !ch.iptvSourceId || !activeIds.includes(ch.iptvSourceId))
            .map((ch) => ch.id);
        for (let i = 0; i < orphanIds.length; i += 200) {
            const batch = orphanIds.slice(i, i + 200);
            if (batch.length === 0)
                continue;
            const del = await db
                .delete(mediaNodes)
                .where(and(eq(mediaNodes.nodeType, 'LIVE_CHANNEL'), inArray(mediaNodes.id, batch)))
                .returning();
            deletedChannelsCount += del.length;
        }
    }
    return c.json({ success: true, deletedChannelsCount });
});
// Resynchroniser une source spécifique et tester la disponibilité de chaque chaîne
iptvSourcesRouter.post('/:id/sync', async (c) => {
    const id = c.req.param('id');
    const source = await db.query.iptvSources.findFirst({
        where: (t, { eq }) => eq(t.id, id),
    });
    if (!source)
        return c.json({ error: 'Source IPTV introuvable' }, 404);
    try {
        const safeM3uUrl = getSafeOutboundUrl(source.m3uUrl, { allowPrivate: true, allowHttp: true });
        if (!safeM3uUrl)
            throw new Error('URL M3U refusée par la politique de sécurité');
        const res = await safeFetch(safeM3uUrl.toString(), { allowPrivate: true, allowHttp: true }, {
            headers: { 'User-Agent': source.userAgent || 'UniversalMediaStack/3.0' },
            signal: AbortSignal.timeout(20000),
        });
        if (!res.ok)
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const content = await res.text();
        const channels = parseM3uContent(content);
        const importedCount = await ingestIptvChannels(channels, id);
        // Test de disponibilité en direct de chaque flux de la source
        const testResults = await testSourceChannelsAvailability(id);
        await db
            .update(iptvSources)
            .set({ lastSyncedAt: new Date() })
            .where(eq(iptvSources.id, id));
        return c.json({
            success: true,
            importedCount,
            testedCount: testResults.testedCount,
            availableCount: testResults.availableCount,
            unavailableCount: testResults.unavailableCount,
            message: `${importedCount} canaux synchronisés : ${testResults.availableCount} opérationnels, ${testResults.unavailableCount} indisponibles (grisés)`,
        });
    }
    catch (err) {
        return c.json({ error: `Erreur lors de la synchronisation: ${err.message}` }, 500);
    }
});
// Modifier une source (activer/désactiver, modifier URLs)
iptvSourcesRouter.patch('/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const { name, m3uUrl, epgXmltvUrl, isActive } = body;
    const updateData = {};
    if (name !== undefined)
        updateData.name = name;
    if (m3uUrl !== undefined)
        updateData.m3uUrl = m3uUrl;
    if (epgXmltvUrl !== undefined)
        updateData.epgXmltvUrl = epgXmltvUrl;
    if (isActive !== undefined)
        updateData.isActive = Boolean(isActive);
    const [updated] = await db
        .update(iptvSources)
        .set(updateData)
        .where(eq(iptvSources.id, id))
        .returning();
    if (!updated)
        return c.json({ error: 'Source introuvable' }, 404);
    return c.json({ success: true, source: updated });
});
// Supprimer une source IPTV et TOUTES ses chaînes associées
iptvSourcesRouter.delete('/:id', async (c) => {
    const id = c.req.param('id');
    // 1. Supprimer explicitement les chaînes LIVE_CHANNEL rattachées
    const deletedNodes = await db
        .delete(mediaNodes)
        .where(and(eq(mediaNodes.nodeType, 'LIVE_CHANNEL'), eq(mediaNodes.iptvSourceId, id)))
        .returning();
    // 2. Supprimer la source
    const deleted = await db.delete(iptvSources).where(eq(iptvSources.id, id)).returning();
    if (deleted.length === 0)
        return c.json({ error: 'Source introuvable' }, 404);
    return c.json({
        success: true,
        message: `Source IPTV supprimée (${deletedNodes.length} chaînes nettoyées)`,
    });
});
