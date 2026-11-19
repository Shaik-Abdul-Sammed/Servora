import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderApp } from '../../services/order-service/src/server.ts';
import type { AddressInfo } from 'node:net';

test('Order Service REST & KDS API Integration', async (t) => {
  const server = createOrderApp();

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  t.after(() => {
    server.close();
  });

  let signedTokenB64: string = '';
  let createdOrderId: string = '';

  await t.test('GET /health returns healthy status', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'healthy');
  });

  await t.test('GET / serves Guest QR Ordering PWA', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Abiruchi Hotel/);
  });

  await t.test('GET /kds serves Kitchen Display System app', async () => {
    const res = await fetch(`${baseUrl}/kds`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Kitchen Display System/);
    assert.match(html, /Abiruchi Hotel/);
  });

  await t.test('POST /api/v1/qr/generate creates signed QR payload', async () => {
    const res = await fetch(`${baseUrl}/api/v1/qr/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'a0000000-0000-0000-0000-000000000001',
        outletId: 'b0000000-0000-0000-0000-000000000001',
        tableId: 'c0000000-0000-0000-0000-000000000001',
        tableNumber: 'T-01',
      }),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.signature);
    assert.equal(data.tableNumber, 'T-01');

    signedTokenB64 = Buffer.from(JSON.stringify(data)).toString('base64url');
  });

  await t.test('GET /api/v1/qr/session resolves signed token correctly', async () => {
    const res = await fetch(`${baseUrl}/api/v1/qr/session?token=${signedTokenB64}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.verified, true);
    assert.equal(data.table.tableNumber, 'T-01');
    assert.equal(data.tenant.name, 'Abiruchi Hotel');
  });

  await t.test('GET /api/v1/menu retrieves categories and dishes', async () => {
    const res = await fetch(`${baseUrl}/api/v1/menu?outletId=b0000000-0000-0000-0000-000000000001`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.categories.length >= 4);
    assert.ok(data.items.length >= 5);
  });

  await t.test('POST /api/v1/orders validates items and submits order', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'a0000000-0000-0000-0000-000000000001',
        outletId: 'b0000000-0000-0000-0000-000000000001',
        tableId: 'c0000000-0000-0000-0000-000000000001',
        tableNumber: 'T-01',
        items: [
          {
            menuItemId: 'e0000000-0000-0000-0000-000000000002', // Margherita $19.00
            quantity: 1,
            selectedModifiers: [
              {
                modifierGroupId: 'f0000000-0000-0000-0000-000000000001',
                modifierGroupName: 'Crust Preference',
                optionId: 'g0000000-0000-0000-0000-000000000002',
                optionName: 'Gluten-Free Artisan Crust',
                priceDeltaCents: 350, // +$3.50
              },
            ],
            notes: 'Well done',
          },
        ],
        guestNotes: 'Extra napkins please',
        tipCents: 400,
      }),
    });

    assert.equal(res.status, 201);
    const order = await res.json();
    assert.ok(order.id);
    createdOrderId = order.id;
    assert.equal(order.status, 'CONFIRMED');
    assert.equal(order.subtotalCents, 2250); // 1900 + 350
    assert.equal(order.taxCents, 186); // 2250 * 0.0825 = 185.625 -> 186
    assert.equal(order.tipCents, 400);
    assert.equal(order.totalCents, 2836); // 2250 + 186 + 400
  });

  await t.test('GET /api/v1/orders/:id retrieves created order status', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders/${createdOrderId}`);
    assert.equal(res.status, 200);
    const order = await res.json();
    assert.equal(order.id, createdOrderId);
    assert.equal(order.status, 'CONFIRMED');
  });

  await t.test('GET /api/v1/kds/orders includes the new order', async () => {
    const res = await fetch(`${baseUrl}/api/v1/kds/orders`);
    assert.equal(res.status, 200);
    const orders = await res.json();
    const found = orders.find((o: { id: string }) => o.id === createdOrderId);
    assert.ok(found);
    assert.equal(found.tableNumber, 'T-01');
  });

  await t.test('PATCH /api/v1/kds/orders/:id/status updates status to PREPARING', async () => {
    const res = await fetch(`${baseUrl}/api/v1/kds/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PREPARING' }),
    });

    assert.equal(res.status, 200);
    const order = await res.json();
    assert.equal(order.status, 'PREPARING');
  });

  await t.test('POST /api/v1/orders rejects invalid item IDs', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableId: 'c0000000-0000-0000-0000-000000000001',
        tableNumber: 'T-01',
        items: [{ menuItemId: 'non_existent_item_id', quantity: 1 }],
      }),
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /Menu item not found/);
  });
});
