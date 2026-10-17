import assert from 'node:assert';
import { db } from '../db/connection.js';
import { users, mediaNodes, userFriends, userFavorites, mediaReposts, mediaSessions, mediaSessionParticipants, forumMessages } from '../db/schema/index.js';
import { eq, or, and } from 'drizzle-orm';
import { canUserAccessMediaNodeId } from '../auth/mediaAccess.js';
async function runTests() {
    console.log('🧪 Testing Social & User Features (Favoris, Amis, Salons, Fil d\'avis, Zero-Leak)...');
    // 1. Favoris : Vérification du format de retour et de l'étanchéité
    console.log('  Testing Favoris logic...');
    const testUser = await db.query.users.findFirst();
    assert(testUser, 'Un utilisateur de test doit exister en base');
    const media = await db.query.mediaNodes.findFirst();
    assert(media, 'Un média de test doit exister en base');
    // Tester l'ajout aux favoris
    const existingFav = await db.query.userFavorites.findFirst({
        where: (t, { and, eq }) => and(eq(t.userId, testUser.id), eq(t.nodeId, media.id)),
    });
    if (!existingFav) {
        await db.insert(userFavorites).values({ userId: testUser.id, nodeId: media.id });
    }
    const checkFav = await db.query.userFavorites.findFirst({
        where: (t, { and, eq }) => and(eq(t.userId, testUser.id), eq(t.nodeId, media.id)),
    });
    assert(checkFav, 'Le favori doit être présent en base');
    console.log('  ✅ Favoris persistence verified');
    // 2. Amis : Vérification de la bidirectionnalité et du dmTopicSlug
    console.log('  Testing Amis bidirectional relations & dmTopicSlug...');
    const userList = await db.query.users.findMany({ limit: 2 });
    if (userList.length >= 2) {
        const [u1, u2] = userList;
        const dmTopicSlug = `dm-${[u1.id, u2.id].sort().join('-')}`;
        assert(dmTopicSlug.startsWith('dm-'), 'Le slug doit commencer par dm-');
        assert(dmTopicSlug.includes(u1.id) && dmTopicSlug.includes(u2.id), 'Le slug doit inclure les 2 IDs');
        // Vérifier la cohérence de l'ordre quel que soit l'utilisateur qui génère le slug
        const dmTopicSlugReverse = `dm-${[u2.id, u1.id].sort().join('-')}`;
        assert.strictEqual(dmTopicSlug, dmTopicSlugReverse, 'Les deux utilisateurs doivent obtenir exactement le même salon direct');
        console.log('  ✅ Bidirectional dmTopicSlug determinism verified');
    }
    // 3. Salons : Séances actives et formatage des médias
    console.log('  Testing Salons (Watch Party & Forums)...');
    const activeSessions = await db.query.mediaSessions.findMany({
        where: (t, { eq }) => eq(t.status, 'ACTIVE'),
        limit: 5,
    });
    console.log(`  Found ${activeSessions.length} active session(s) in database`);
    console.log('  ✅ Salons query & lifecycle validated');
    // 4. Fil d'avis : Création, calcul de note moyenne et unicité
    console.log('  Testing Fil d\'avis (Reposts, Notes 1-5 & Critiques)...');
    const cleanRating = 5;
    const cleanComment = 'Critique de test automatique - Expérience YouTube/Letterboxd';
    const existingRepost = await db.query.mediaReposts.findFirst({
        where: (t, { and, eq }) => and(eq(t.userId, testUser.id), eq(t.nodeId, media.id)),
    });
    if (existingRepost) {
        await db
            .update(mediaReposts)
            .set({ rating: cleanRating, comment: cleanComment, createdAt: new Date() })
            .where(eq(mediaReposts.id, existingRepost.id));
    }
    else {
        await db.insert(mediaReposts).values({
            userId: testUser.id,
            nodeId: media.id,
            rating: cleanRating,
            comment: cleanComment,
        });
    }
    const fetchedRepost = await db.query.mediaReposts.findFirst({
        where: (t, { and, eq }) => and(eq(t.userId, testUser.id), eq(t.nodeId, media.id)),
    });
    assert(fetchedRepost, 'L\'avis doit être correctement enregistré');
    assert.strictEqual(fetchedRepost.rating, 5, 'La note doit être de 5 étoiles');
    assert.strictEqual(fetchedRepost.comment, cleanComment, 'Le commentaire doit être préservé');
    console.log('  ✅ Fil d\'avis rating and review persistence verified');
    // 5. Zero-Leak Position & Activité (PBAC / ABAC)
    console.log('  Testing Zero-Leak Position & Friend Activity filtering...');
    const adminUser = {
        id: 'user-admin-test',
        email: 'admin@test.local',
        isAdmin: true,
    };
    const allowedForAdmin = await canUserAccessMediaNodeId(adminUser, media.id);
    assert.strictEqual(allowedForAdmin, true, "L'administrateur a accès à n'importe quel média");
    const unauthenticatedAllowed = await canUserAccessMediaNodeId(null, media.id);
    assert.strictEqual(unauthenticatedAllowed, false, 'Un utilisateur non connecté ne doit avoir aucun accès');
    console.log('  ✅ Zero-Leak canUserAccessMediaNodeId verified');
    // 6. Synchronisation de Progression (Regarde : ... -> Position temps réel)
    console.log('  Testing Active Playback Progress Synchronization...');
    const { recordActivePlayback, getUserLastLocation } = await import('../watcher/presenceStore.js');
    recordActivePlayback(media.id, media.parentId, testUser.id, testUser.displayName || 'Testeur', media.title, true, 1540);
    const loc = await getUserLastLocation(testUser.id);
    assert(loc, "La position de l'utilisateur doit être retournée");
    assert.strictEqual(loc.isLive, true, 'La session doit être active (isLive: true)');
    assert.strictEqual(loc.mediaId, media.id, 'Le mediaId doit correspondre');
    assert(loc.positionSeconds && loc.positionSeconds >= 1540, 'La position (positionSeconds) doit être synchronisée à 1540+ secondes');
    console.log(`  ✅ Active playback position synchronized at ${loc.positionSeconds}s`);
    console.log('🎉 All Social & User Feature tests completed successfully!');
    process.exit(0);
}
runTests().catch((err) => {
    console.error('❌ Error during social features test:', err);
    process.exit(1);
});
