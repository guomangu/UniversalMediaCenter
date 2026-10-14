import { db } from '../db/connection.js';
import { mediaNodes } from '../db/schema/index.js';
import { eq, or, inArray } from 'drizzle-orm';
import { fetchExternalMetadata, cleanShowTitle } from './externalMetadata.js';
import { linkTagToNode } from './tagExtractor.js';
export async function enrichAllShowsAndMovies() {
    console.log('🌟 Démarrage de l’enrichissement complet des séries et films (Crew, Cast, Technique, Certification)...');
    const targets = await db.query.mediaNodes.findMany({
        where: (t, { inArray: inArr }) => inArr(t.nodeType, ['SHOW', 'MOVIE']),
    });
    console.log(`📋 ${targets.length} séries/films trouvés à enrichir.`);
    for (const node of targets) {
        const titleToSearch = cleanShowTitle(node.title);
        console.log(`🔍 Enrichissement de "${node.title}" (${node.nodeType})...`);
        try {
            const ext = await fetchExternalMetadata(titleToSearch, node.nodeType);
            if (!ext) {
                console.log(`⚠️ Pas de métadonnées externes trouvées pour "${node.title}".`);
                continue;
            }
            const updates = { updatedAt: new Date() };
            if (!node.overview && ext.overview)
                updates.overview = ext.overview;
            if (!node.tagline && ext.tagline)
                updates.tagline = ext.tagline;
            if (!node.releaseYear && ext.releaseYear)
                updates.releaseYear = ext.releaseYear;
            if (node.communityRating == null && ext.communityRating)
                updates.communityRating = ext.communityRating;
            if (ext.premiered && !node.premieredDate) {
                const d = new Date(ext.premiered);
                if (!isNaN(d.getTime()))
                    updates.premieredDate = d;
            }
            if (!node.posterPath && ext.posterUrl)
                updates.posterPath = ext.posterUrl;
            if (!node.fanartPath && ext.fanartUrl)
                updates.fanartPath = ext.fanartUrl;
            // 1. Tags thématiques et descriptifs
            for (const g of ext.genres)
                await linkTagToNode(node.id, 'genre', g).catch(() => null);
            for (const s of ext.tags)
                await linkTagToNode(node.id, 'subject', s).catch(() => null);
            for (const st of ext.studios)
                await linkTagToNode(node.id, 'studio', st).catch(() => null);
            for (const c of ext.countries)
                await linkTagToNode(node.id, 'country', c).catch(() => null);
            if (ext.certification)
                await linkTagToNode(node.id, 'certification', ext.certification).catch(() => null);
            // 2. Équipes humaines et artistiques (Réalisateurs, Scénaristes, Compositeurs, Producteurs, Acteurs)
            for (const d of ext.directors)
                await linkTagToNode(node.id, 'director', d).catch(() => null);
            for (const w of ext.writers)
                await linkTagToNode(node.id, 'writer', w).catch(() => null);
            for (const p of ext.producers)
                await linkTagToNode(node.id, 'producer', p).catch(() => null);
            for (const comp of ext.composers)
                await linkTagToNode(node.id, 'composer', comp).catch(() => null);
            for (const a of ext.actors) {
                await linkTagToNode(node.id, 'actor', a.name, a.role, a.thumb ? { thumbUrl: a.thumb } : {}).catch(() => null);
            }
            // 3. Mise à jour du vecteur de recherche plein texte
            const searchComponents = [
                node.title,
                node.originalTitle || ext.originalTitle || '',
                ...ext.genres,
                ...ext.tags,
                ...ext.directors,
                ...ext.writers,
                ...ext.composers,
                ...ext.actors.map((a) => `${a.name} ${a.role || ''}`),
            ];
            updates.searchVectorText = searchComponents.filter(Boolean).join(' ');
            await db.update(mediaNodes).set(updates).where(eq(mediaNodes.id, node.id));
            console.log(`✅ Enrichi avec succès : "${node.title}" (${ext.directors.length} réalisateurs, ${ext.writers.length} auteurs, ${ext.composers.length} compositeurs, ${ext.actors.length} acteurs).`);
            // Pause de 250ms pour respecter les rate limits TMDB
            await new Promise((r) => setTimeout(r, 250));
        }
        catch (err) {
            console.warn(`❌ Erreur enrichissement "${node.title}":`, err);
        }
    }
    console.log('🎉 Enrichissement complet terminé !');
}
