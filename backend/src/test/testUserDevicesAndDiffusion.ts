import assert from 'node:assert';
import { userDeviceRegistry } from '../devices/userDeviceRegistry.js';
import type { DevicePlaybackState } from '../devices/userDeviceRegistry.js';

async function runTests() {
  console.log('🧪 Testing User Devices Management & Flexible Media Diffusion...');

  const userId = 'user_test_' + Math.random().toString(36).substring(2, 9);
  const dev1Id = 'dev_phone_' + Math.random().toString(36).substring(2, 9);
  const dev2Id = 'dev_tv_' + Math.random().toString(36).substring(2, 9);
  const dev3Id = 'dev_pc_' + Math.random().toString(36).substring(2, 9);

  // 1. Enregistrement des appareils
  console.log('  1. Testing device registration & heartbeat...');
  const reg1 = userDeviceRegistry.registerOrHeartbeat({
    deviceId: dev1Id,
    userId,
    name: 'iPhone 15 Pro',
    deviceType: 'MOBILE',
    currentRoute: '/explore',
    pageTitle: 'Exploration',
    syncGroupId: 'default',
  });
  assert(!reg1.isRevoked, 'Device 1 should not be revoked');
  assert.strictEqual(reg1.device.name, 'iPhone 15 Pro');
  assert.strictEqual(reg1.device.currentRoute, '/explore');

  const reg2 = userDeviceRegistry.registerOrHeartbeat({
    deviceId: dev2Id,
    userId,
    name: 'TV Salon',
    deviceType: 'TV',
    currentRoute: '/player/media_123',
    pageTitle: 'Ratatouille',
    syncGroupId: 'default',
  });
  assert(!reg2.isRevoked);

  const reg3 = userDeviceRegistry.registerOrHeartbeat({
    deviceId: dev3Id,
    userId,
    name: 'PC Bureau',
    deviceType: 'BROWSER',
    currentRoute: '/',
    pageTitle: 'Accueil',
    syncGroupId: 'standalone', // Mode indépendant
  });
  assert(!reg3.isRevoked);
  console.log('  ✅ 3 devices registered successfully across different platforms');

  // 2. Listing des appareils de l'utilisateur
  console.log('  2. Testing listUserDevices...');
  const list = userDeviceRegistry.listUserDevices(userId);
  assert.strictEqual(list.length, 3, 'User should have 3 active devices');
  assert(list.every((d) => d.isOnline), 'All devices should be online');
  console.log('  ✅ listUserDevices returned all active devices');

  // 3. Renommage d'un appareil
  console.log('  3. Testing renameDevice...');
  const renamed = userDeviceRegistry.renameDevice(userId, dev1Id, 'iPhone de Voyage');
  assert(renamed, 'Rename should succeed');
  const updatedDev1 = userDeviceRegistry.getDevice(dev1Id);
  assert.strictEqual(updatedDev1?.name, 'iPhone de Voyage');
  console.log('  ✅ Device successfully renamed');

  // 4. File d'attente de commandes à distance
  console.log('  4. Testing remote command queueing & execution...');
  userDeviceRegistry.queueCommand({
    targetDeviceId: dev2Id,
    userId,
    action: 'LOAD_MEDIA',
    payload: { mediaId: 'media_456', title: 'Inception', positionSeconds: 120 },
  });
  userDeviceRegistry.queueCommand({
    targetDeviceId: dev2Id,
    userId,
    action: 'PAUSE',
  });

  const commands = userDeviceRegistry.popCommands(dev2Id);
  assert.strictEqual(commands.length, 2, 'Device 2 should have 2 queued commands');
  assert.strictEqual(commands[0].action, 'LOAD_MEDIA');
  assert.strictEqual(commands[0].payload.mediaId, 'media_456');
  assert.strictEqual(commands[1].action, 'PAUSE');

  const emptyCommands = userDeviceRegistry.popCommands(dev2Id);
  assert.strictEqual(emptyCommands.length, 0, 'Queue should be empty after pop');
  console.log('  ✅ Commands successfully queued, delivered, and cleared');

  // 5. Synchronisation flexible des lectures (Flexible Sync Groups)
  console.log('  5. Testing flexible playback synchronization & standalone isolation...');
  const tvPlayback: DevicePlaybackState = {
    mediaId: 'media_456',
    mediaTitle: 'Inception',
    positionSeconds: 145,
    durationSeconds: 8880,
    isPlaying: true,
    activeAudio: 'fra',
    activeSubtitle: 'off',
    volume: 1,
    isMuted: false,
    updatedAt: Date.now(),
  };
  userDeviceRegistry.updatePlayback(userId, dev2Id, tvPlayback, 'default');

  const pcPlayback: DevicePlaybackState = {
    mediaId: 'media_789',
    mediaTitle: 'Mushishi',
    positionSeconds: 50,
    durationSeconds: 1400,
    isPlaying: true,
    activeAudio: 'jpn',
    activeSubtitle: 'fra',
    volume: 0.8,
    isMuted: false,
    updatedAt: Date.now(),
  };
  userDeviceRegistry.updatePlayback(userId, dev3Id, pcPlayback, 'standalone');

  // Dev 1 (iPhone dans groupe 'default') cherche la lecture synchronisée
  const groupSync = userDeviceRegistry.getGroupPlayback(userId, 'default', dev1Id);
  assert(groupSync, 'Group default should have active playback from TV');
  assert.strictEqual(groupSync?.mediaId, 'media_456');
  assert.strictEqual(groupSync?.mediaTitle, 'Inception');

  // Dev 3 (PC dans groupe 'standalone') ne doit pas écraser le groupe default
  assert.notStrictEqual(groupSync?.mediaId, 'media_789');

  // Demande de synchronisation pour groupe 'standalone' doit renvoyer null (isolation)
  const soloSync = userDeviceRegistry.getGroupPlayback(userId, 'standalone');
  assert.strictEqual(soloSync, null, 'Standalone mode must not synchronize');
  console.log('  ✅ Flexible sync verified: default group mirrors TV while PC standalone remains isolated');

  // 6. Déconnexion à distance d'un appareil spécifique
  console.log('  6. Testing remote device revocation (disconnect)...');
  const revoked = userDeviceRegistry.revokeDevice(userId, dev1Id);
  assert(revoked, 'Revocation should succeed');
  assert(userDeviceRegistry.isRevoked(userId, dev1Id), 'dev1Id must be recorded as revoked');

  // Vérifier qu'une commande REVOKE_SESSION a été placée pour cet appareil
  const revokeCmds = userDeviceRegistry.popCommands(dev1Id);
  assert(revokeCmds.some((c) => c.action === 'REVOKE_SESSION'), 'Device 1 must receive REVOKE_SESSION command');

  // Heartbeat ultérieur de dev1Id doit être rejeté
  const hbRevoked = userDeviceRegistry.registerOrHeartbeat({
    deviceId: dev1Id,
    userId,
    name: 'iPhone Piraté',
  });
  assert(hbRevoked.isRevoked, 'Heartbeat from revoked device must be marked isRevoked');

  // Liste des appareils ne doit plus contenir dev1Id
  const listAfterRevoke = userDeviceRegistry.listUserDevices(userId);
  assert(!listAfterRevoke.some((d) => d.deviceId === dev1Id), 'Revoked device must not appear in list');
  assert.strictEqual(listAfterRevoke.length, 2, 'Only 2 devices remaining');
  console.log('  ✅ Remote disconnection and revocation verified');

  // 7. Déconnexion de tous les autres appareils (1-clic)
  console.log('  7. Testing disconnectAllOtherDevices...');
  const count = userDeviceRegistry.revokeAllOtherDevices(userId, dev2Id); // On garde dev2Id (TV)
  assert.strictEqual(count, 1, 'Should have revoked dev3Id (the other device)');
  assert(userDeviceRegistry.isRevoked(userId, dev3Id), 'dev3Id must now be revoked');
  assert(!userDeviceRegistry.isRevoked(userId, dev2Id), 'dev2Id must NOT be revoked');

  const finalList = userDeviceRegistry.listUserDevices(userId);
  assert.strictEqual(finalList.length, 1, 'Only dev2Id should remain active');
  assert.strictEqual(finalList[0].deviceId, dev2Id);
  console.log('  ✅ Bulk revocation of all other devices verified');

  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! Device management & flexible media diffusion verified.');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
