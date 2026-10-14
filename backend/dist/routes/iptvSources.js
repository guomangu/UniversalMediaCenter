import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { iptvSources } from '../db/schema/index.js';
import { parseM3uContent } from '../iptv/m3uParser.js';
import { ingestIptvChannels } from '../iptv/channelIngester.js';
import { eq, desc } from 'drizzle-orm';
import { requireAdmin } from '../middleware/access.js';
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
        const res = await fetch(m3uUrl);
        const content = await res.text();
        const channels = parseM3uContent(content);
        const importedCount = await ingestIptvChannels(channels);
        await db
            .update(iptvSources)
            .set({ lastSyncedAt: new Date() })
            .where(eq(iptvSources.id, source.id));
        return c.json({ success: true, source, importedCount });
    }
    catch (err) {
        return c.json({ success: true, source, warning: `Source enregistrée mais synchronisation échouée: ${err.message}` });
    }
});
// Resynchroniser une source spécifique
iptvSourcesRouter.post('/:id/sync', async (c) => {
    const id = c.req.param('id');
    const source = await db.query.iptvSources.findFirst({
        where: (t, { eq }) => eq(t.id, id),
    });
    if (!source)
        return c.json({ error: 'Source IPTV introuvable' }, 404);
    try {
        const res = await fetch(source.m3uUrl);
        if (!res.ok)
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const content = await res.text();
        const channels = parseM3uContent(content);
        const importedCount = await ingestIptvChannels(channels);
        await db
            .update(iptvSources)
            .set({ lastSyncedAt: new Date() })
            .where(eq(iptvSources.id, id));
        return c.json({ success: true, importedCount, message: `${importedCount} canaux synchronisés` });
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
// Supprimer une source IPTV
iptvSourcesRouter.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const deleted = await db.delete(iptvSources).where(eq(iptvSources.id, id)).returning();
    if (deleted.length === 0)
        return c.json({ error: 'Source introuvable' }, 404);
    return c.json({ success: true, message: 'Source IPTV supprimée' });
});
