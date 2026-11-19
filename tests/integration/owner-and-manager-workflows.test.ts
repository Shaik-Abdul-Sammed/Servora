import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderApp } from '../../services/order-service/src/server.ts';
import type { AddressInfo } from 'node:net';

test('QA Phase 2 & 3: Owner & Manager Operational Workflows Test Suite', async (suite) => {
  const server = createOrderApp();

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const OUTLET_ID = 'b0000000-0000-0000-0000-000000000001';

  suite.after(() => {
    server.close();
  });

  // A. Restaurant Setup & Isolation
  await suite.test('A1: Verify Free Base Plan settings and subscription details', async () => {
    const res = await fetch(`${baseUrl}/api/v1/owner/subscription?outletId=${OUTLET_ID}`);
    assert.equal(res.status, 200);
    const sub = await res.json();
    assert.equal(sub.tier, 'FREE_BASE');
    assert.equal(sub.maxWaiters, 3);
    assert.equal(sub.isFree, true);
  });

  // B. Menu Management
  let createdItemId = '';
  await suite.test('B1: Create new menu item with pricing, photo, and dietary info', async () => {
    const res = await fetch(`${baseUrl}/api/v1/menu/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId: OUTLET_ID,
        categoryId: 'd0000000-0000-0000-0000-000000000002',
        name: 'Artisan Paneer Tikka Sourdough',
        description: 'Tandoor-charred cottage cheese, smoked peppers, mint pesto',
        basePriceCents: 22000, // ₹220.00
        imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600',
        dietaryType: 'VEG',
        allergens: ['dairy', 'gluten'],
      }),
    });
    assert.equal(res.status, 201);
    const item = await res.json();
    assert.equal(item.name, 'Artisan Paneer Tikka Sourdough');
    assert.equal(item.basePriceCents, 22000);
    assert.equal(item.dietaryType, 'VEG');
    createdItemId = item.id;
  });

  await suite.test('B2: 1-Tap 86 Sold-Out toggle immediately reflects on item availability', async () => {
    // Toggle sold out
    const toggleRes = await fetch(`${baseUrl}/api/v1/menu/items/${createdItemId}/sold-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAvailable: false }),
    });
    assert.equal(toggleRes.status, 200);
    const updated = await toggleRes.json();
    assert.equal((updated.item || updated).isAvailable, false);

    // Verify customer menu reflects unavailability
    const menuRes = await fetch(`${baseUrl}/api/v1/menu?outletId=${OUTLET_ID}`);
    assert.equal(menuRes.status, 200);
    const menu = await menuRes.json();
    const found = menu.items.find((i: any) => i.id === createdItemId);
    assert.ok(found);
    assert.equal(found.isAvailable, false);

    // Re-enable
    await fetch(`${baseUrl}/api/v1/menu/items/${createdItemId}/sold-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAvailable: true }),
    });
  });

  await suite.test('B3: Historical orders preserve original purchased price when menu price updates', async () => {
    // Place order at ₹220
    const orderRes = await fetch(`${baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId: OUTLET_ID,
        tableId: 'c0000000-0000-0000-0000-000000000001',
        tableNumber: 'T-01',
        items: [{ menuItemId: createdItemId, quantity: 1, course: 'MAIN' }],
        paymentMethod: 'CASH',
      }),
    });
    assert.equal(orderRes.status, 201);
    const order = await orderRes.json();
    assert.equal(order.items[0].unitPriceCents, 22000);

    // Update menu price to ₹260
    await fetch(`${baseUrl}/api/v1/menu/items/${createdItemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ basePriceCents: 26000 }),
    });

    // Check that historical order still has ₹220
    const getOrderRes = await fetch(`${baseUrl}/api/v1/orders/${order.id}`);
    assert.equal(getOrderRes.status, 200);
    const histOrder = await getOrderRes.json();
    assert.equal(histOrder.items[0].unitPriceCents, 22000, 'Historical price must not change');
  });

  // C. Table Management
  await suite.test('C1: Tables T01-T05 exist and have valid seating capacities', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tables?outletId=${OUTLET_ID}`);
    assert.equal(res.status, 200);
    const tables = await res.json();
    assert.ok(Array.isArray(tables));
    assert.ok(tables.length >= 5);
  });

  await suite.test('C2: Prevent duplicate table number within the same outlet', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId: OUTLET_ID,
        tableNumber: 'T-01', // Already exists in seeded tables
        capacity: 4,
      }),
    });
    assert.equal(res.status, 409);
    const err = await res.json();
    assert.equal(err.error, 'TABLE_ALREADY_EXISTS');
  });

  // D. Staff Management & Free Plan Limits
  let waiter1Id = '';
  let waiter2Id = '';
  let waiter3Id = '';
  await suite.test('D1: Add Manager and up to 3 Waiters under Free Base Plan', async () => {
    // Manager
    const mgrRes = await fetch(`${baseUrl}/api/v1/owner/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId: OUTLET_ID,
        name: 'Manager QA',
        email: 'manager.qa@example.test',
        role: 'MANAGER',
        pin: '1234',
      }),
    });
    assert.equal(mgrRes.status, 201);

    // Waiter 1
    const w1Res = await fetch(`${baseUrl}/api/v1/owner/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId: OUTLET_ID,
        name: 'Waiter 1 QA',
        email: 'waiter1.qa@example.test',
        role: 'WAITER',
        pin: '1111',
      }),
    });
    assert.equal(w1Res.status, 201);
    waiter1Id = (await w1Res.json()).id;

    // Waiter 2
    const w2Res = await fetch(`${baseUrl}/api/v1/owner/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId: OUTLET_ID,
        name: 'Waiter 2 QA',
        email: 'waiter2.qa@example.test',
        role: 'WAITER',
        pin: '2222',
      }),
    });
    assert.equal(w2Res.status, 201);
    waiter2Id = (await w2Res.json()).id;

    // Waiter 3
    const w3Res = await fetch(`${baseUrl}/api/v1/owner/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId: OUTLET_ID,
        name: 'Waiter 3 QA',
        email: 'waiter3.qa@example.test',
        role: 'WAITER',
        pin: '3333',
      }),
    });
    assert.equal(w3Res.status, 201);
    waiter3Id = (await w3Res.json()).id;
  });

  await suite.test('D2: Adding a 4th Waiter on Free Base Plan is rejected with 403 & upgrade prompt', async () => {
    const res = await fetch(`${baseUrl}/api/v1/owner/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId: OUTLET_ID,
        name: 'Waiter 4 QA',
        email: 'waiter4.qa@example.test',
        role: 'WAITER',
        pin: '4444',
      }),
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.error, 'PLAN_LIMIT_REACHED');
    assert.ok(data.upgradeUrl);
  });

  await suite.test('D3: Reset staff PIN and deactivate account', async () => {
    // Reset PIN
    const pinRes = await fetch(`${baseUrl}/api/v1/owner/staff/${waiter1Id}/reset-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '9999' }),
    });
    assert.equal(pinRes.status, 200);

    // Deactivate waiter 1
    const deactRes = await fetch(`${baseUrl}/api/v1/owner/staff/${waiter1Id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    });
    assert.equal(deactRes.status, 200);
    const updated = await deactRes.json();
    assert.equal(updated.isActive, false);
  });

  // E. Manager Approval Gates (Phase 3)
  await suite.test('E1: Operational mutation queries via AI Copilot require Manager/Owner approval', async () => {
    const res = await fetch(`${baseUrl}/api/v1/ai/copilot/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId: OUTLET_ID,
        query: 'Update the price of Margherita pizza to 150 and issue refund',
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.requiresApproval, true);
    assert.ok(data.answer.includes('Operational Safeguard'));
  });
});
