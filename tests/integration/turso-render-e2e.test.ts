import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync } from 'node:fs';
import { createOrderApp } from '../../services/order-service/src/server.ts';
import { OrderStore } from '../../services/order-service/src/store.ts';
import { createSignedQRSession } from '../../packages/utils/src/qr-crypto.ts';

const QR_SIGNING_SECRET = process.env.QR_SIGNING_SECRET || process.env.QR_SIGNING_SALT || 'abiruchi-dev-qr-secret-key-32-bytes-min';

describe('Turso & Render Blueprint E2E Integration Suite', () => {
  let server: any;
  let baseUrl: string;
  let ownerToken: string;
  let waiterToken: string;
  let firstMenuItemId: string;
  let coffeeMenuItemId: string;

  const tenantId = 'a0000000-0000-0000-0000-000000000001';
  const outletId = 'b0000000-0000-0000-0000-000000000001';

  async function api(path: string, options: RequestInit = {}) {
    const url = `${baseUrl}${path}`;
    return fetch(url, options);
  }

  before(async () => {
    // 1. Start application on random ephemeral port
    server = createOrderApp();
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;

    // 2. Obtain Owner JWT
    const ownerLoginRes = await api('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@abiruchi.local', password: 'abiruchi123' }),
    });
    assert.strictEqual(ownerLoginRes.status, 200, 'Owner login must succeed');
    const ownerData = await ownerLoginRes.json();
    ownerToken = ownerData.token;

    // 3. Obtain Waiter JWT
    const waiterLoginRes = await api('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'waiter@abiruchi.local', password: 'abiruchi123' }),
    });
    assert.strictEqual(waiterLoginRes.status, 200, 'Waiter login must succeed');
    const waiterData = await waiterLoginRes.json();
    waiterToken = waiterData.token;

    // 4. Fetch menu to obtain real seeded item IDs
    const menuRes = await api('/api/v1/menu');
    assert.strictEqual(menuRes.status, 200);
    const menu = await menuRes.json();
    const allItems = menu.items || [];
    assert.ok(allItems.length >= 50, 'Must have at least 50 seeded items');
    firstMenuItemId = allItems[0].id;

    // Find coffee/tea beverage item or fallback
    const beverageItem = allItems.find((i: any) =>
      i.name.toLowerCase().includes('coffee') || i.name.toLowerCase().includes('tea')
    ) || allItems[1];
    coffeeMenuItemId = beverageItem.id;
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(resolve));
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 12: Database Health Check
  // --------------------------------------------------------------------------
  test('Scenario 12: GET /health returns 200 with status, database type, and no leaked secrets', async () => {
    const res = await api('/health');
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'healthy');
    assert.ok(body.database === 'turso' || body.database === 'sqlite');
    assert.strictEqual(typeof body.latencyMs, 'number');
    assert.ok(body.timestamp);
    // Ensure zero secrets or auth tokens leaked
    const stringified = JSON.stringify(body);
    assert.ok(!stringified.includes('eyJ'), 'No JWT/Turso token leaked');
    assert.ok(!stringified.includes('turso.io'), 'No connection URL leaked');
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Table QR Flow
  // --------------------------------------------------------------------------
  test('Scenario 1: Table Mode QR Flow — Guest scans QR, verifies crypto session, and places dine-in order', async () => {
    // 1. Generate cryptographic QR session for Table 14
    const qrSession = createSignedQRSession(
      {
        tenantId,
        outletId,
        tableId: 'c0000000-0000-0000-0000-000000000001',
        tableNumber: '14',
        mode: 'TABLE',
      },
      QR_SIGNING_SECRET
    );

    // 2. Verify QR session via GET /api/v1/qr/session
    const tokenB64 = Buffer.from(JSON.stringify(qrSession)).toString('base64url');
    const verifyRes = await api(`/api/v1/qr/session?token=${tokenB64}`);
    assert.strictEqual(verifyRes.status, 200, 'QR session verification should succeed');
    const verifyBody = await verifyRes.json();
    assert.strictEqual(verifyBody.verified, true);

    // 3. Place dine-in order
    const orderRes = await api('/api/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        tableNumber: '14',
        items: [
          {
            menuItemId: firstMenuItemId,
            quantity: 2,
          },
        ],
      }),
    });
    assert.strictEqual(orderRes.status, 201, 'Order submission should return 201 Created');
    const orderData = await orderRes.json();
    assert.ok(orderData.id, 'Order must have an ID');
    assert.strictEqual(orderData.tableNumber, '14');
    assert.ok(orderData.status === 'CONFIRMED' || orderData.status === 'SUBMITTED');
    assert.ok(orderData.subtotalCents > 0);
    assert.ok(orderData.taxCents > 0);
    assert.strictEqual(orderData.totalCents, orderData.subtotalCents + orderData.taxCents);
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Token Mode Flow (Parcel / Counter / QSR)
  // --------------------------------------------------------------------------
  test('Scenario 2: Token Mode Flow — Switch mode, allocate sequential station token, advance token lifecycle', async () => {
    // 1. Switch tenant order mode to token
    const modeRes = await api('/api/v1/tenant/order-mode', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ mode: 'token' }),
    });
    assert.strictEqual(modeRes.status, 200);

    // 2. Submit order in token mode
    const tokenOrderRes = await api('/api/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        tableNumber: 'TOKEN',
        items: [
          {
            menuItemId: firstMenuItemId,
            quantity: 1,
          },
        ],
      }),
    });
    assert.strictEqual(tokenOrderRes.status, 201);
    const tokenOrder = await tokenOrderRes.json();
    assert.ok(tokenOrder.token, 'Order must return an allocated token in token mode');
    assert.match(tokenOrder.token, /^[A-Z]-[0-9]+$/, 'Token code format must be Prefix-Number (e.g. A-47)');

    // 3. Query active tokens queue
    const activeRes = await api('/api/v1/tokens/active');
    assert.strictEqual(activeRes.status, 200);
    const activeTokens = await activeRes.json();
    assert.ok(Array.isArray(activeTokens));
    const createdToken = activeTokens.find((t: any) => t.token_code === tokenOrder.token || t.code === tokenOrder.token);
    assert.ok(createdToken, 'Allocated token must appear in active tokens queue');
    assert.strictEqual(createdToken.state, 'QUEUED');

    // 4. Advance token lifecycle: QUEUED -> PREPARING -> READY -> SERVED
    const prepRes = await api(`/api/v1/tokens/${createdToken.id}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${waiterToken}` },
      body: JSON.stringify({ state: 'PREPARING' }),
    });
    assert.strictEqual(prepRes.status, 200);

    const readyRes = await api(`/api/v1/tokens/${createdToken.id}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${waiterToken}` },
      body: JSON.stringify({ state: 'READY' }),
    });
    assert.strictEqual(readyRes.status, 200);

    const servedRes = await api(`/api/v1/tokens/${createdToken.id}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${waiterToken}` },
      body: JSON.stringify({ state: 'SERVED' }),
    });
    assert.strictEqual(servedRes.status, 200);

    // 5. Verify token is no longer in active queue
    const postActiveRes = await api('/api/v1/tokens/active');
    const postActiveTokens = await postActiveRes.json();
    const servedToken = postActiveTokens.find((t: any) => t.id === createdToken.id);
    assert.strictEqual(servedToken, undefined, 'SERVED token must be removed from active queue');

    // Revert mode to table
    await api('/api/v1/tenant/order-mode', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ mode: 'table' }),
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Cafe / Coffee Shop Mode
  // --------------------------------------------------------------------------
  test('Scenario 3: Cafe Mode — Guest orders custom beverage with milk, roast, and sweetness preferences', async () => {
    const cafeOrderRes = await api('/api/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        tableNumber: 'CAFE-01',
        items: [
          {
            menuItemId: coffeeMenuItemId,
            quantity: 2,
            notes: 'Oat milk, dark roast, half sugar',
          },
        ],
      }),
    });
    assert.strictEqual(cafeOrderRes.status, 201);
    const cafeOrder = await cafeOrderRes.json();
    assert.strictEqual(cafeOrder.items[0].notes, 'Oat milk, dark roast, half sugar');
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Table Generation & Lifecycle
  // --------------------------------------------------------------------------
  test('Scenario 4: Table Management — Create table, update name/zone, and soft delete', async () => {
    // 1. Create new table
    const createRes = await api('/api/v1/qr/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Table 99',
        zone: 'Rooftop Lounge',
      }),
    });
    assert.strictEqual(createRes.status, 201);
    const tableData = await createRes.json();
    assert.ok(tableData.id);
    assert.strictEqual(tableData.name, 'Table 99');
    assert.strictEqual(tableData.zone, 'Rooftop Lounge');
    assert.ok(tableData.qr_token);

    // 2. Update table
    const updateRes = await api(`/api/v1/qr/tables/${tableData.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Table 99 VIP',
        zone: 'Rooftop VIP Gazebo',
      }),
    });
    assert.strictEqual(updateRes.status, 200);
    const updatedData = await updateRes.json();
    assert.strictEqual(updatedData.name, 'Table 99 VIP');
    assert.strictEqual(updatedData.zone, 'Rooftop VIP Gazebo');

    // 3. Soft delete table
    const deleteRes = await api(`/api/v1/qr/tables/${tableData.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.strictEqual(deleteRes.status, 200);
    const deletedData = await deleteRes.json();
    assert.ok(deletedData.table.deleted_at);
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Manual Counter Order with Cash Payment
  // --------------------------------------------------------------------------
  test('Scenario 5: Manual Counter Order — Staff creates walk-in order and records cash at till', async () => {
    // 1. Create order
    const orderRes = await api('/api/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        tableNumber: 'COUNTER',
        items: [
          {
            menuItemId: firstMenuItemId,
            quantity: 1,
          },
        ],
      }),
    });
    assert.strictEqual(orderRes.status, 201);
    const order = await orderRes.json();

    // 2. Record cash payment at till: tendered ₹200.00 (20000 cents)
    const tenderedCents = 20000;
    const cashRes = await api('/api/v1/payments/cash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${waiterToken}` },
      body: JSON.stringify({
        orderId: order.id,
        receivedCents: tenderedCents,
        amountCents: order.totalCents,
      }),
    });
    assert.strictEqual(cashRes.status, 200);
    const cashData = await cashRes.json();
    assert.strictEqual(cashData.status, 'PAID');
    assert.strictEqual(cashData.receivedCents, tenderedCents);
    assert.strictEqual(cashData.changeCents, tenderedCents - order.totalCents);
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Payment Failure & Fraud Handling
  // --------------------------------------------------------------------------
  test('Scenario 6: Payment Rejection — Manager rejects invalid payment screenshot; order remains UNPAID', async () => {
    // 1. Create order
    const orderRes = await api('/api/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        tableNumber: 'Table 7',
        items: [
          {
            menuItemId: firstMenuItemId,
            quantity: 1,
          },
        ],
      }),
    });
    assert.strictEqual(orderRes.status, 201);
    const order = await orderRes.json();

    // 2. Reject fake / unverified payment
    const rejectRes = await api('/api/v1/payments/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        orderId: order.id,
        reason: 'Payment screenshot unverified or tampered transaction reference',
      }),
    });
    assert.strictEqual(rejectRes.status, 200);
    const rejectData = await rejectRes.json();
    assert.strictEqual(rejectData.status, 'REJECTED');
    assert.strictEqual(rejectData.orderPaymentStatus, 'UNPAID');
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Duplicate Webhook Idempotency
  // --------------------------------------------------------------------------
  test('Scenario 7: Webhook Idempotency — Re-submitting payment reconciliation is completely idempotent', async () => {
    // 1. Create order
    const orderRes = await api('/api/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        tableNumber: 'Table 8',
        items: [
          {
            menuItemId: firstMenuItemId,
            quantity: 1,
          },
        ],
      }),
    });
    assert.strictEqual(orderRes.status, 201);
    const order = await orderRes.json();

    // 2. First reconciliation callback
    const firstRes = await api('/api/v1/payments/upi/verify-reconciliation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        orderId: order.id,
        transactionRef: 'UPI-TXN-1234567890',
        amountCents: order.totalCents,
      }),
    });
    assert.strictEqual(firstRes.status, 200);
    const firstData = await firstRes.json();
    assert.strictEqual(firstData.paymentStatus, 'PAID');

    // 3. Second identical reconciliation callback (simulated webhook retry)
    const secondRes = await api('/api/v1/payments/upi/verify-reconciliation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        orderId: order.id,
        transactionRef: 'UPI-TXN-1234567890',
        amountCents: order.totalCents,
      }),
    });
    assert.strictEqual(secondRes.status, 200, 'Duplicate webhook must return 200 OK');
    const secondData = await secondRes.json();
    assert.strictEqual(secondData.paymentStatus, 'PAID', 'State remains PAID without corrupting');
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Persistence Across Restarts
  // --------------------------------------------------------------------------
  test('Scenario 8: Persistence Durability — Database writes persist and survive in-memory restart', async () => {
    // Test persistence across separate store instances sharing disk storage
    const testDbPath = join(tmpdir(), `persist-test-${Date.now()}.db`);
    const s1 = new OrderStore(testDbPath);
    s1.orders.set('ord_persist_test_1', {
      id: 'ord_persist_test_1',
      tenantId,
      outletId,
      tableNumber: 'Table 99',
      status: 'CONFIRMED',
      items: [{ menuItemId: firstMenuItemId, name: 'Item', unitPriceCents: 5000, quantity: 2, totalCents: 10000 }],
      subtotalCents: 10000,
      cgstCents: 250,
      sgstCents: 250,
      totalCents: 10500,
      paymentStatus: 'UNPAID',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Instantiate fresh store instance loading from the same database file
    const s2 = new OrderStore(testDbPath);
    const persistedOrder = s2.orders.get('ord_persist_test_1');
    assert.ok(persistedOrder, 'Order must exist in freshly loaded store instance');
    assert.strictEqual(persistedOrder?.tableNumber, 'Table 99');
    assert.strictEqual(persistedOrder?.subtotalCents, 10000);
    try { unlinkSync(testDbPath); } catch {}
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Unauthorized Access Rejection (RBAC)
  // --------------------------------------------------------------------------
  test('Scenario 9: RBAC Security — Unauthenticated and unauthorized requests are rejected', async () => {
    // 1. Missing Authorization header on protected route
    const unauthRes = await api('/api/v1/auth/me');
    assert.strictEqual(unauthRes.status, 401, 'Must reject unauthenticated call with 401');

    // 2. Invalid JWT token
    const invalidTokenRes = await api('/api/v1/auth/me', {
      headers: { Authorization: 'Bearer forged.invalid.jwt' },
    });
    assert.strictEqual(invalidTokenRes.status, 401, 'Must reject invalid JWT with 401');

    // 3. Invalid manager override PIN
    const wrongPinRes = await api('/api/v1/manager/override-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '0000', action: 'VOID_ORDER' }),
    });
    assert.strictEqual(wrongPinRes.status, 403, 'Must reject incorrect PIN with 403 Forbidden');
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Concurrency Handling
  // --------------------------------------------------------------------------
  test('Scenario 10: Concurrency — 10 concurrent orders execute cleanly without race conditions', async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      api('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outletId,
          tableNumber: `CONCUR-${i + 1}`,
          items: [
            {
              menuItemId: firstMenuItemId,
              quantity: 1,
            },
          ],
        }),
      }).then(async (r) => {
        assert.strictEqual(r.status, 201);
        return r.json();
      })
    );

    const results = await Promise.all(promises);
    assert.strictEqual(results.length, 10);
    const orderIds = new Set(results.map((r) => r.id));
    assert.strictEqual(orderIds.size, 10, 'All 10 orders must have unique IDs');
  });

  // --------------------------------------------------------------------------
  // Scenario 11: Tampered / Expired QR Token Rejection
  // --------------------------------------------------------------------------
  test('Scenario 11: QR Security — Expired or forged QR tokens are rejected', async () => {
    // 1. Expired QR session
    const expiredPayload = {
      tenantId,
      outletId,
      tableId: 'tbl_table_1',
      tableNumber: '1',
      issuedAt: Date.now() - 1000 * 60 * 60 * 24, // 24 hours ago
      expiresAt: Date.now() - 1000 * 60 * 60 * 12, // expired 12 hours ago
      mode: 'TABLE' as const,
      signature: '0000000000000000000000000000000000000000000000000000000000000000',
    };
    const expiredB64 = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
    const expiredRes = await api(`/api/v1/qr/session?token=${expiredB64}`);
    assert.strictEqual(expiredRes.status, 401, 'Expired QR session must be rejected with 401');

    // 2. Forged signature
    const validSession = createSignedQRSession(
      { tenantId, outletId, tableId: 'tbl_table_1', tableNumber: '1' },
      QR_SIGNING_SECRET
    );
    const forgedSession = { ...validSession, signature: validSession.signature.replace(/[0-9a-f]/g, 'a') };
    const forgedB64 = Buffer.from(JSON.stringify(forgedSession)).toString('base64url');

    const forgedRes = await api(`/api/v1/qr/session?token=${forgedB64}`);
    assert.strictEqual(forgedRes.status, 401, 'Forged QR session must be rejected with 401');
  });
});
