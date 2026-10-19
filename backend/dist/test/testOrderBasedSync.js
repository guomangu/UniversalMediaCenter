import assert from 'node:assert';
import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { authMiddleware } from '../middleware/access.js';
import { createSessionToken } from '../auth/token.js';
import { playbackSyncRouter } from '../routes/userPlaybackSync.js';
async function runOrderBasedSyncTests() {
    console.log('🧪 Testing Order-Based Multi-Screen Synchronization (Device 1/2 -> Server -> Devices 1/2)...');
    const existingUser = await db.query.users.findFirst();
    assert(existingUser, 'A user must exist in database for testing');
    const userId = existingUser.id;
    const token = createSessionToken(userId);
    const dev1Id = 'dev_laptop_' + Math.random().toString(36).substring(2, 8) + '_tab_a';
    const dev2Id = 'dev_mobile_' + Math.random().toString(36).substring(2, 8) + '_tab_b';
    const testApp = new Hono();
    testApp.use('*', authMiddleware);
    testApp.route('/api/playback', playbackSyncRouter);
    const callApi = async (path, method, headers, body) => {
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
        return await testApp.fetch(req);
    };
    // 1. Appareil 1 lance la lecture d'un film (Ordre 1 émis par Appareil 1)
    console.log('  1. Device 1 initiates playback: Action "OPEN/PLAY"...');
    const res1 = await callApi('/sync', 'POST', { 'x-device-id': dev1Id }, {
        deviceId: dev1Id,
        syncGroupId: 'default',
        mediaId: 'media_test_order_sync',
        mediaTitle: 'Test Synchronisation',
        positionSeconds: 0,
        durationSeconds: 5400,
        isPlaying: true,
        activeAudio: 'fra',
        activeSubtitle: 'off',
        isAction: true,
        actionType: 'PLAY',
    });
    assert.strictEqual(res1.status, 200);
    const data1 = await res1.json();
    assert(data1.success);
    assert.strictEqual(data1.playback.orderSeq, 1, 'First order must have orderSeq = 1');
    assert.strictEqual(data1.playback.originDeviceId, dev1Id, 'Origin must be Device 1');
    assert.strictEqual(data1.playback.isPlaying, true);
    console.log('  ✅ Server accepted Order 1 from Device 1 (PLAY at 0s)');
    // 2. Appareil 2 interroge le serveur et reçoit l'Ordre 1
    console.log('  2. Device 2 polls server and receives Order 1...');
    const poll2Res = await callApi(`/sync?syncGroupId=default&deviceId=${dev2Id}`, 'GET', { 'x-device-id': dev2Id });
    assert.strictEqual(poll2Res.status, 200);
    const poll2Data = await poll2Res.json();
    assert(poll2Data.playback);
    assert.strictEqual(poll2Data.playback.orderSeq, 1);
    assert.strictEqual(poll2Data.playback.originDeviceId, dev1Id);
    assert.strictEqual(poll2Data.playback.isPlaying, true);
    console.log('  ✅ Device 2 accurately received Order 1 from Device 1 via Server');
    // 3. Appareil 2 émet un battement passif suiveur : ne doit PAS corrompre l'ordre
    console.log('  3. Device 2 sends passive follower heartbeat (isAction: false)...');
    const hbRes = await callApi('/sync', 'POST', { 'x-device-id': dev2Id }, {
        deviceId: dev2Id,
        syncGroupId: 'default',
        mediaId: 'media_test_order_sync',
        mediaTitle: 'Test Synchronisation',
        positionSeconds: 0,
        durationSeconds: 5400,
        isPlaying: false, // Navigateur passif en buffer
        isAction: false,
    });
    assert.strictEqual(hbRes.status, 200);
    const hbData = await hbRes.json();
    assert.strictEqual(hbData.isFollower, true, 'Server must flag Device 2 as follower');
    assert.strictEqual(hbData.playback.orderSeq, 1, 'Order must remain 1 without corruption');
    assert.strictEqual(hbData.playback.isPlaying, true, 'Official order must remain PLAY');
    console.log('  ✅ Server successfully blocked passive follower from overriding active order');
    // 4. L'utilisateur interagit avec l'Appareil 2 et clique sur "PAUSE" (Ordre 2 émis par Appareil 2)
    console.log('  4. User touches Device 2 and clicks PAUSE (Order 2)...');
    const pauseRes = await callApi('/sync', 'POST', { 'x-device-id': dev2Id }, {
        deviceId: dev2Id,
        syncGroupId: 'default',
        mediaId: 'media_test_order_sync',
        mediaTitle: 'Test Synchronisation',
        positionSeconds: 42,
        durationSeconds: 5400,
        isPlaying: false,
        isAction: true,
        actionType: 'PAUSE',
    });
    assert.strictEqual(pauseRes.status, 200);
    const pauseData = await pauseRes.json();
    assert.strictEqual(pauseData.playback.orderSeq, 2, 'OrderSeq must increment to 2');
    assert.strictEqual(pauseData.playback.originDeviceId, dev2Id, 'Origin must now be Device 2');
    assert.strictEqual(pauseData.playback.isPlaying, false, 'Playback must now be paused');
    console.log('  ✅ Server accepted Order 2 from Device 2 (PAUSE at 42s)');
    // 5. Appareil 1 interroge le serveur et reçoit l'Ordre 2 de Pause émis par Appareil 2
    console.log('  5. Device 1 polls server and receives Order 2...');
    const poll1Res = await callApi(`/sync?syncGroupId=default&deviceId=${dev1Id}`, 'GET', { 'x-device-id': dev1Id });
    assert.strictEqual(poll1Res.status, 200);
    const poll1Data = await poll1Res.json();
    assert.strictEqual(poll1Data.playback.orderSeq, 2);
    assert.strictEqual(poll1Data.playback.originDeviceId, dev2Id);
    assert.strictEqual(poll1Data.playback.isPlaying, false);
    assert.strictEqual(poll1Data.playback.positionSeconds, 42);
    console.log('  ✅ Device 1 received Device 2 PAUSE order without blocking or conflicts');
    // 6. L'utilisateur interagit avec l'Appareil 1 et fait un SEEK à 180s (Ordre 3 émis par Appareil 1)
    console.log('  6. User touches Device 1 and performs SEEK to 180s (Order 3)...');
    const seekRes = await callApi('/sync', 'POST', { 'x-device-id': dev1Id }, {
        deviceId: dev1Id,
        syncGroupId: 'default',
        mediaId: 'media_test_order_sync',
        mediaTitle: 'Test Synchronisation',
        positionSeconds: 180,
        durationSeconds: 5400,
        isPlaying: false,
        isAction: true,
        actionType: 'SEEK',
    });
    assert.strictEqual(seekRes.status, 200);
    const seekData = await seekRes.json();
    assert.strictEqual(seekData.playback.orderSeq, 3);
    assert.strictEqual(seekData.playback.originDeviceId, dev1Id);
    assert.strictEqual(seekData.playback.positionSeconds, 180);
    console.log('  ✅ Server accepted Order 3 from Device 1 (SEEK to 180s)');
    // 7. Appareil 2 interroge le serveur et reçoit l'Ordre 3
    console.log('  7. Device 2 polls server and receives Order 3 (SEEK)...');
    const poll2SeekRes = await callApi(`/sync?syncGroupId=default&deviceId=${dev2Id}`, 'GET', { 'x-device-id': dev2Id });
    const poll2SeekData = await poll2SeekRes.json();
    assert.strictEqual(poll2SeekData.playback.orderSeq, 3);
    assert.strictEqual(poll2SeekData.playback.positionSeconds, 180);
    console.log('  ✅ Device 2 synchronized to 180s accurately');
    // 8. L'utilisateur clique sur PLAY sur Appareil 2 (Ordre 4 émis par Appareil 2)
    console.log('  8. User on Device 2 clicks PLAY (Order 4)...');
    const playRes = await callApi('/sync', 'POST', { 'x-device-id': dev2Id }, {
        deviceId: dev2Id,
        syncGroupId: 'default',
        mediaId: 'media_test_order_sync',
        mediaTitle: 'Test Synchronisation',
        positionSeconds: 180,
        durationSeconds: 5400,
        isPlaying: true,
        isAction: true,
        actionType: 'PLAY',
    });
    assert.strictEqual(playRes.status, 200);
    const playData = await playRes.json();
    assert.strictEqual(playData.playback.orderSeq, 4);
    assert.strictEqual(playData.playback.originDeviceId, dev2Id);
    assert.strictEqual(playData.playback.isPlaying, true);
    console.log('  ✅ Server accepted Order 4 from Device 2 (PLAY at 180s)');
    // 9. Appareil 1 interroge le serveur et reçoit l'Ordre 4
    console.log('  9. Device 1 receives Order 4 (PLAY) from Device 2...');
    const poll1PlayRes = await callApi(`/sync?syncGroupId=default&deviceId=${dev1Id}`, 'GET', { 'x-device-id': dev1Id });
    const poll1PlayData = await poll1PlayRes.json();
    assert.strictEqual(poll1PlayData.playback.orderSeq, 4);
    assert.strictEqual(poll1PlayData.playback.isPlaying, true);
    console.log('  ✅ Device 1 aligned with Device 2 PLAY seamlessly');
    // 10. Nettoyage
    await callApi('/stop', 'POST', { 'x-device-id': dev1Id }, {
        deviceId: dev1Id,
        syncGroupId: 'default',
    });
    console.log('  ✅ Playback session stopped cleanly');
    console.log('🎉 ALL ORDER-BASED MULTI-SCREEN SYNCHRONIZATION TESTS PASSED!');
    process.exit(0);
}
runOrderBasedSyncTests().catch((err) => {
    console.error('❌ Order-based sync test failed:', err);
    process.exit(1);
});
