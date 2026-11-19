import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderApp } from '../../services/order-service/src/server.ts';
import type { AddressInfo } from 'node:net';

test('Abiruchi Hotel Black-Box Behavioral Contract Test Suite', async (suite) => {
  const server = createOrderApp();

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const outletId = 'b0000000-0000-0000-0000-000000000001';

  suite.after(() => {
    server.close();
  });

  // Black-Box 1: Unknown Route returns 404 JSON Contract
  await suite.test('Black-Box: Non-existent endpoint yields 404 with structured JSON', async () => {
    const res = await fetch(`${baseUrl}/api/v1/invalid/endpoint/route`);
    assert.equal(res.status, 404);
    assert.ok(res.headers.get('content-type')?.includes('application/json'));
    const body = await res.json();
    assert.ok(body.error);
  });

  // Black-Box 2: Missing required payload yields 400 Bad Request
  await suite.test('Black-Box: Missing mandatory request parameters yields 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/api/v1/ai/photo-enhance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes('imageUrl is required'));
  });

  // Black-Box 3: Security Challenge failure yields 403 Forbidden
  await suite.test('Black-Box: Security challenge PIN mismatch yields 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/v1/pos/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ terminalId: 'term_bb', pin: 'wrong_pin' }),
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.ok(body.error);
  });

  // Black-Box 4: CORS preflight / headers contract
  await suite.test('Black-Box: HTTP OPTIONS preflight returns proper CORS headers', async () => {
    const res = await fetch(`${baseUrl}/api/v1/menu`, {
      method: 'OPTIONS',
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
  });

  // Black-Box 5: Deterministic idempotency of GET resources
  await suite.test('Black-Box: Idempotency of repeated GET analytical requests', async () => {
    const res1 = await fetch(`${baseUrl}/api/v1/analytics/qr-adoption?outletId=${outletId}`);
    const res2 = await fetch(`${baseUrl}/api/v1/analytics/qr-adoption?outletId=${outletId}`);
    assert.equal(res1.status, 200);
    assert.equal(res2.status, 200);
    const data1 = await res1.json();
    const data2 = await res2.json();
    assert.deepEqual(data1, data2);
  });

  // Black-Box 6: Delivery aggregator black-box contract
  await suite.test('Black-Box: External UberEats order ingestion contract returns 201 Created', async () => {
    const res = await fetch(`${baseUrl}/api/v1/integrations/aggregators/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aggregator: 'UBEREATS',
        externalOrderId: 'UBER_BB_7711',
        items: [{ menuItemId: 'e0000000-0000-0000-0000-000000000002', name: 'Margherita Verace', quantity: 1, unitPriceCents: 1900 }],
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.status, 'INJECTED_TO_KDS');
    assert.equal(body.autoConfirmed, true);
    assert.ok(body.internalOrderId);
  });
});
