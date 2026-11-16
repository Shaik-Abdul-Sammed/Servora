import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../../services/auth-service/src/auth.ts';

test('Auth Service Multi-Tenant Identity & JWT Engine', async (t) => {
  const auth = new AuthService('test-auth-jwt-secret-key-32-chars-min!!');

  await t.test('Securely hashes and verifies passwords using PBKDF2', () => {
    const password = 'SuperSecretRestaurantPassword#2026';
    const { salt, hash } = auth.hashPassword(password);
    assert.ok(salt);
    assert.ok(hash);

    const isMatch = auth.verifyPassword(password, salt, hash);
    assert.equal(isMatch, true);

    const isWrong = auth.verifyPassword('WrongPassword', salt, hash);
    assert.equal(isWrong, false);
  });

  await t.test('Issues valid JWT token with tenant and role scopes', () => {
    const token = auth.generateToken({
      userId: 'usr_owner_01',
      email: 'owner@servora.com',
      role: 'OWNER',
      tenantId: 'a0000000-0000-0000-0000-000000000001',
      outletId: 'b0000000-0000-0000-0000-000000000001',
      expiresInSeconds: 3600,
    });

    assert.ok(token);
    const verified = auth.verifyToken(token);
    assert.equal(verified.valid, true);
    assert.equal(verified.payload?.userId, 'usr_owner_01');
    assert.equal(verified.payload?.role, 'OWNER');
    assert.equal(verified.payload?.tenantId, 'a0000000-0000-0000-0000-000000000001');
  });

  await t.test('Rejects forged or tampered JWT signatures', () => {
    const token = auth.generateToken({
      userId: 'usr_staff_01',
      email: 'staff@servora.com',
      role: 'KITCHEN_STAFF',
      tenantId: 'a0000000-0000-0000-0000-000000000001',
    });

    const parts = token.split('.');
    // Tamper payload to elevate role to SUPER_ADMIN
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf-8'));
    payload.role = 'SUPER_ADMIN';
    const tamperedPayloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const forgedToken = `${parts[0]}.${tamperedPayloadB64}.${parts[2]}`;

    const verified = auth.verifyToken(forgedToken);
    assert.equal(verified.valid, false);
    assert.equal(verified.error, 'INVALID_SIGNATURE');
  });

  await t.test('Rejects expired JWT tokens', () => {
    const expiredToken = auth.generateToken({
      userId: 'usr_old',
      email: 'old@servora.com',
      role: 'WAITER',
      tenantId: 'a0000000-0000-0000-0000-000000000001',
      expiresInSeconds: -10, // Already expired
    });

    const verified = auth.verifyToken(expiredToken);
    assert.equal(verified.valid, false);
    assert.equal(verified.error, 'TOKEN_EXPIRED');
  });
});
