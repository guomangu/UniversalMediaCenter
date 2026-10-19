import assert from 'node:assert/strict';
import { createSessionToken, verifySessionTokenDetails } from '../auth/token.js';
import { hashPassword, verifyPassword, verifyPin } from '../auth/password.js';
import { isSafeOutboundUrl } from '../utils/safeUrl.js';

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}`);
    throw err;
  }
}

console.log('🧪 Security hardening tests...');

test('Session token v2 binds the device id', () => {
  const userId = '11111111-1111-1111-1111-111111111111';
  const token = createSessionToken(userId, 'dev_secure_123');
  const details = verifySessionTokenDetails(token);
  assert.equal(details?.userId, userId);
  assert.equal(details?.deviceId, 'dev_secure_123');
});

test('Legacy session token remains accepted', () => {
  const userId = '22222222-2222-2222-2222-222222222222';
  const token = createSessionToken(userId);
  const details = verifySessionTokenDetails(token);
  assert.equal(details?.userId, userId);
  assert.equal(details?.deviceId, undefined);
});

test('Tampered session token is rejected', () => {
  const token = createSessionToken('33333333-3333-3333-3333-333333333333', 'dev_x');
  const tampered = `${token.slice(0, -2)}zz`;
  assert.equal(verifySessionTokenDetails(tampered), null);
});

test('Password hash verifies only the correct secret', () => {
  const hash = hashPassword('correct horse battery staple');
  assert.equal(verifyPassword('correct horse battery staple', hash), true);
  assert.equal(verifyPassword('wrong', hash), false);
});

test('PIN supports scrypt and legacy plaintext storage', () => {
  const scryptPin = hashPassword('1234');
  assert.equal(verifyPin('1234', scryptPin), true);
  assert.equal(verifyPin('0000', scryptPin), false);

  // Compatibilité avec les anciennes bases où le PIN était stocké en clair.
  assert.equal(verifyPin('4321', '4321'), true);
  assert.equal(verifyPin('0000', '4321'), false);
});

test('Public HTTPS URLs are allowed', () => {
  assert.equal(isSafeOutboundUrl('https://image.tmdb.org/t/p/w500/poster.jpg'), true);
});

test('Loopback, link-local, metadata and non-HTTP are blocked', () => {
  assert.equal(isSafeOutboundUrl('http://127.0.0.1:3000/api'), false);
  assert.equal(isSafeOutboundUrl('http://localhost./'), false);
  assert.equal(isSafeOutboundUrl('http://169.254.169.254/latest/meta-data'), false);
  assert.equal(isSafeOutboundUrl('http://2130706433/'), false);
  assert.equal(isSafeOutboundUrl('http://[::1]/'), false);
  assert.equal(isSafeOutboundUrl('file:///etc/passwd'), false);
});

test('LAN addresses are allowed only when explicitly requested', () => {
  assert.equal(isSafeOutboundUrl('http://192.168.1.20/live.m3u8'), false);
  assert.equal(isSafeOutboundUrl('http://192.168.1.20/live.m3u8', { allowPrivate: true }), true);
});

console.log('🎉 All security hardening tests passed.');
