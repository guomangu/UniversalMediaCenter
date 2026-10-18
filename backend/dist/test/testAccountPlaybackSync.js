import assert from 'node:assert';
import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { authMiddleware } from '../middleware/access.js';
import { createSessionToken } from '../auth/token.js';
import { playbackSyncRouter } from '../routes/userPlaybackSync.js';
async function runPlaybackSyncTests() {
    console.log('🧪 Testing Account Playback Synchronization & Leader/Follower Architecture...');
    // Récupérer un utilisateur existant pour l'authentification
    const existingUser = await db.query.users.findFirst();
    assert(existingUser, 'A user must exist in database for testing');
    const userId = existingUser.id;
    const token = createSessionToken(userId);
    const devAId = 'dev_laptop_' + Math.random().toString(36).substring(2, 9);
    const devBId = 'dev_mobile_' + Math.random().toString(36).substring(2, 9);
    const devCId = 'dev_solo_' + Math.random().toString(36).substring(2, 9);
    const testApp = new Hono();
    testApp.use('*', authMiddleware);
    testApp.route('/api/playback', playbackSyncRouter);
    // Helper pour appeler l'application testApp
    const callRouter = async (path, method, headers, body) => {
        const reqInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...headers,
            },
            body: body ? JSON.stringify(body) : undefined,
        };
        const req = new Request(`http://localhost/api/playback${path}`, reqInit);
        const res = await testApp.fetch(req);
        return res;
    };
    // 1. Appareil A démarre la lecture (Action explicite)
    console.log('  1. Device A starts playback as Leader...');
    const startRes = await callRouter('/sync', 'POST', { 'x-device-id': devAId }, {
        deviceId: devAId,
        syncGroupId: 'default',
        mediaId: 'media_ratatouille_1080p',
        mediaTitle: 'Ratatouille',
        positionSeconds: 45,
        durationSeconds: 6660,
        isPlaying: true,
        activeAudio: 'fra',
        activeSubtitle: 'off',
        isAction: true,
    });
    if (startRes.status !== 200) {
        const errText = await startRes.text();
        console.error('Debug 401 startRes:', startRes.status, errText);
    }
    assert.strictEqual(startRes.status, 200);
    const startData = await startRes.json();
    assert(startData.success);
    assert.strictEqual(startData.playback.leaderDeviceId, devAId, 'Device A should be the leader');
    assert.strictEqual(startData.playback.positionSeconds, 45);
    assert.strictEqual(startData.playback.isPlaying, true);
    console.log('  ✅ Device A registered as Leader with position 45s');
    // 2. Appareil B interroge l'état synchronisé du groupe
    console.log('  2. Device B queries synchronized group playback...');
    const syncBRes = await callRouter(`/sync?syncGroupId=default&deviceId=${devBId}`, 'GET', { 'x-device-id': devBId });
    assert.strictEqual(syncBRes.status, 200);
    const syncBData = await syncBRes.json();
    assert(syncBData.playback, 'Playback should exist for group default');
    assert.strictEqual(syncBData.playback.leaderDeviceId, devAId, 'Leader should be Device A');
    assert.strictEqual(syncBData.playback.deviceId, devAId, 'Playback device should be Device A');
    assert.strictEqual(syncBData.playback.mediaId, 'media_ratatouille_1080p');
    assert.strictEqual(syncBData.playback.positionSeconds, 45);
    assert.strictEqual(syncBData.playback.isPlaying, true);
    console.log('  ✅ Device B received Device A state accurately with zero undefined fields');
    // 3. Heartbeat périodique de l'Appareil A qui avance (Leader)
    console.log('  3. Device A sends regular progression heartbeat...');
    const progressRes = await callRouter('/sync', 'POST', { 'x-device-id': devAId }, {
        deviceId: devAId,
        syncGroupId: 'default',
        mediaId: 'media_ratatouille_1080p',
        mediaTitle: 'Ratatouille',
        positionSeconds: 85,
        durationSeconds: 6660,
        isPlaying: true,
        activeAudio: 'fra',
        activeSubtitle: 'off',
        isAction: false,
    });
    assert.strictEqual(progressRes.status, 200);
    const progressData = await progressRes.json();
    assert.strictEqual(progressData.playback.leaderDeviceId, devAId);
    assert.strictEqual(progressData.playback.positionSeconds, 85);
    console.log('  ✅ Device A progression updated to 85s');
    // 4. L'utilisateur sur Appareil B clique sur Pause (Action explicite qui prend le contrôle)
    console.log('  4. User on Device B presses Pause (explicit action takeover)...');
    const pauseBRes = await callRouter('/sync', 'POST', { 'x-device-id': devBId }, {
        deviceId: devBId,
        syncGroupId: 'default',
        mediaId: 'media_ratatouille_1080p',
        mediaTitle: 'Ratatouille',
        positionSeconds: 85,
        durationSeconds: 6660,
        isPlaying: false, // PAUSE
        activeAudio: 'fra',
        activeSubtitle: 'off',
        isAction: true, // Action explicite
    });
    assert.strictEqual(pauseBRes.status, 200);
    const pauseBData = await pauseBRes.json();
    assert.strictEqual(pauseBData.playback.leaderDeviceId, devBId, 'Device B should now be the leader');
    assert.strictEqual(pauseBData.playback.isPlaying, false, 'Playback should now be paused');
    console.log('  ✅ Device B took leadership and paused playback');
    // 5. Appareil A interroge l'état synchronisé et reçoit la pause de Device B
    console.log('  5. Device A receives Device B pause command...');
    const syncARes = await callRouter(`/sync?syncGroupId=default&deviceId=${devAId}`, 'GET', { 'x-device-id': devAId });
    assert.strictEqual(syncARes.status, 200);
    const syncAData = await syncARes.json();
    assert.strictEqual(syncAData.playback.leaderDeviceId, devBId);
    assert.strictEqual(syncAData.playback.isPlaying, false);
    console.log('  ✅ Device A synchronized with Device B pause');
    // 6. Appareil C en mode autonome (standalone) reste complètement isolé
    console.log('  6. Testing standalone device isolation...');
    const soloRes = await callRouter(`/sync?syncGroupId=standalone&deviceId=${devCId}`, 'GET', { 'x-device-id': devCId });
    assert.strictEqual(soloRes.status, 200);
    const soloData = await soloRes.json();
    assert.strictEqual(soloData.playback, null, 'Standalone device must not receive group playback');
    console.log('  ✅ Standalone device verified fully isolated');
    // 7. Arrêt de la lecture
    console.log('  7. Stopping playback session...');
    const stopRes = await callRouter('/stop', 'POST', { 'x-device-id': devBId }, {
        deviceId: devBId,
        syncGroupId: 'default',
    });
    assert.strictEqual(stopRes.status, 200);
    const afterStopRes = await callRouter(`/sync?syncGroupId=default&deviceId=${devAId}`, 'GET', { 'x-device-id': devAId });
    const afterStopData = await afterStopRes.json();
    assert.strictEqual(afterStopData.playback, null, 'Playback should be cleared after stop');
    console.log('  ✅ Group playback successfully stopped and cleared');
    console.log('🎉 ALL ACCOUNT PLAYBACK SYNC TESTS PASSED! Seamless multi-screen mirroring verified.');
    process.exit(0);
}
runPlaybackSyncTests().catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
