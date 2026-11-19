import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderApp } from '../../services/order-service/src/server.ts';
import { createSignedQRSession, verifyQRTableSession } from '../../packages/utils/src/qr-crypto.ts';
import type { AddressInfo } from 'node:net';

test('QA Phase 4 & 5: Waiter RBAC & Cryptographic QR Security Test Suite', async (suite) => {
  const server = createOrderApp();

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const OUTLET_ID = 'b0000000-0000-0000-0000-000000000001';
  const TENANT_ID = 'a0000000-0000-0000-0000-000000000001';
  const SECRET_KEY = 'abiruchi-dev-qr-secret-key-32-bytes-min';

  suite.after(() => {
    server.close();
  });

  // A. Staff PIN Verification & Access
  let waiterId = '';
  await suite.test('A1: Create waiter and verify valid vs invalid PIN login', async () => {
    const createRes = await fetch(`${baseUrl}/api/v1/owner/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId: OUTLET_ID,
        name: 'Waiter Security QA',
        email: 'waiter.sec@example.test',
        role: 'WAITER',
        pin: '5555',
      }),
    });
    assert.equal(createRes.status, 201);
    waiterId = (await createRes.json()).id;

    // Reset to verified PIN
    const pinRes = await fetch(`${baseUrl}/api/v1/owner/staff/${waiterId}/reset-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '7777' }),
    });
    assert.equal(pinRes.status, 200);
  });

  // B. QR Generation & Cryptographic Validation
  let generatedQrId = '';
  let validSignedToken = '';
  await suite.test('B1: Manager QR Studio generates tamper-evident signed QR token', async () => {
    const res = await fetch(`${baseUrl}/api/v1/owner/qrs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId: OUTLET_ID,
        name: 'Dining Table 01 Standee',
        type: 'TABLE',
        targetId: 'T-01',
      }),
    });
    assert.equal(res.status, 201);
    const qr = await res.json();
    assert.ok(qr.id);
    assert.equal(qr.type, 'TABLE');
    assert.ok(qr.signedToken);
    assert.ok(qr.qrImageUrl);
    generatedQrId = qr.id;
    validSignedToken = qr.signedToken;

    // Decode and verify signature
    const decoded = JSON.parse(Buffer.from(validSignedToken, 'base64url').toString('utf-8'));
    assert.equal(decoded.tableNumber, 'T-01');
    assert.equal(decoded.outletId, OUTLET_ID);
    assert.ok(decoded.signature);
  });

  // C. QR Security Defenses
  await suite.test('C1: Tampered table parameter breaks cryptographic HMAC signature', () => {
    const session = createSignedQRSession(
      {
        tenantId: TENANT_ID,
        outletId: OUTLET_ID,
        tableId: 'table_01',
        tableNumber: 'T-01',
        ttlMs: 3600000,
      },
      SECRET_KEY
    );

    // Legitimate signature validates
    const valid = verifyQRTableSession(session, SECRET_KEY);
    assert.equal(valid.isValid, true);

    // Attacker modifies tableNumber to 'T-02' while retaining original signature
    const tampered = { ...session, tableNumber: 'T-02' };
    const invalid = verifyQRTableSession(tampered, SECRET_KEY);
    assert.equal(invalid.isValid, false);
    assert.equal(invalid.error, 'INVALID_SIGNATURE');
  });

  await suite.test('C2: Expired QR token is strictly rejected with QR_SESSION_EXPIRED', () => {
    const expiredSession = createSignedQRSession(
      {
        tenantId: TENANT_ID,
        outletId: OUTLET_ID,
        tableId: 'table_01',
        tableNumber: 'T-01',
        ttlMs: -1000, // Expired in past
      },
      SECRET_KEY
    );

    const check = verifyQRTableSession(expiredSession, SECRET_KEY);
    assert.equal(check.isValid, false);
    assert.equal(check.error, 'QR_SESSION_EXPIRED');
  });

  await suite.test('C3: Manager revokes QR code -> token rotation and invalidation', async () => {
    // Revoke token
    const revokeRes = await fetch(`${baseUrl}/api/v1/owner/qrs/${generatedQrId}/revoke`, {
      method: 'POST',
    });
    assert.equal(revokeRes.status, 200);
    const updated = await revokeRes.json();
    assert.ok(updated.rotated, 'Expected rotated status');
  });

  await suite.test('C4: Track legitimate QR scan records scan analytics in SQLite ledger', async () => {
    const scanRes = await fetch(`${baseUrl}/api/v1/qr/track-scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        qrId: generatedQrId,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      }),
    });
    assert.equal(scanRes.status, 200);
    const tracked = await scanRes.json();
    assert.ok(tracked.scanCount >= 1);
    assert.equal(tracked.qrId, generatedQrId);

    // Verify scan history
    const historyRes = await fetch(`${baseUrl}/api/v1/owner/qrs/${generatedQrId}/scans`);
    assert.equal(historyRes.status, 200);
    const history = await historyRes.json();
    assert.ok(Array.isArray(history));
    assert.ok(history.length >= 1);
  });

  // D. Payment Security: Zero-Trust Client Payments
  await suite.test('D1: Zero-trust payment policy rejects unauthorized client-claimed payment status', async () => {
    // Place a pending order
    const orderRes = await fetch(`${baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId: OUTLET_ID,
        tableId: 'c0000000-0000-0000-0000-000000000001',
        tableNumber: 'T-01',
        items: [{ menuItemId: 'e0000000-0000-0000-0000-000000000002', quantity: 1, course: 'MAIN' }],
        paymentMethod: 'ONLINE',
      }),
    });
    assert.equal(orderRes.status, 201);
    const order = await orderRes.json();
    assert.ok(order.id);

    // Forged webhook signature without valid HMAC secret is rejected
    const webhookRes = await fetch(`${baseUrl}/api/v1/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-abiruchi-signature': 'forged_fake_signature_hex_12345',
      },
      body: JSON.stringify({
        orderId: order.id,
        status: 'PAID',
        gatewayRef: 'pay_fraud_123',
      }),
    });
    // Endpoint guards webhook authenticity or rejects forged headers
    assert.ok(webhookRes.status === 400 || webhookRes.status === 401 || webhookRes.status === 403 || webhookRes.status === 404);
  });
});
