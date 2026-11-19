import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderApp } from '../../services/order-service/src/server.ts';
import type { AddressInfo } from 'node:net';

test('Abiruchi Hotel Batch 3 (20 Missing Features) Integration HTTP API Test Suite', async (suite) => {
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

  // #5: Clone menu across outlets
  await suite.test('Integration #5: POST /api/v1/owner/menu/clone', async () => {
    const res = await fetch(`${baseUrl}/api/v1/owner/menu/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceOutletId: outletId,
        targetOutletId: 'b0000000-0000-0000-0000-000000000088',
      }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.sourceOutletId, outletId);
    assert.ok(data.categoriesCloned >= 4);
    assert.ok(data.itemsCloned >= 5);
  });

  // #9: Reorder categories on mobile
  await suite.test('Integration #9: POST /api/v1/owner/categories/reorder', async () => {
    const res = await fetch(`${baseUrl}/api/v1/owner/categories/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        categoryOrders: [
          { id: 'd0000000-0000-0000-0000-000000000001', sortOrder: 10 },
          { id: 'd0000000-0000-0000-0000-000000000002', sortOrder: 1 },
        ],
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.categories.length >= 2);
  });

  // #12: Bulk price edit
  await suite.test('Integration #12: POST /api/v1/owner/menu/bulk-prices', async () => {
    const res = await fetch(`${baseUrl}/api/v1/owner/menu/bulk-prices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        percentageDelta: 5,
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.outletId, outletId);
    assert.ok(data.itemsUpdated >= 4);
  });

  // #18: Split bill by item
  await suite.test('Integration #18: POST /api/v1/orders/:id/split-by-items', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders/ord_demo_001/split-by-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignments: [
          { guestName: 'Guest 1', itemIds: ['item_01'] },
          { guestName: 'Guest 2', itemIds: ['item_02'] },
        ],
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.orderId, 'ord_demo_001');
    assert.equal(data.splits.length, 2);
    assert.equal(data.splits[0].guestName, 'Guest 1');
  });

  // #19: Partial payment by guest share
  await suite.test('Integration #19: POST /api/v1/orders/:id/partial-payment', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders/ord_demo_001/partial-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guestName: 'Sarah',
        amountCents: 2500,
        method: 'UPI',
      }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.orderId, 'ord_demo_001');
    assert.equal(data.amountCents, 2500);
    assert.ok(data.remainingBalanceCents >= 0);
  });

  // #23: Live cash vs digital view
  await suite.test('Integration #23: GET /api/v1/analytics/cash-vs-digital', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/cash-vs-digital?outletId=${outletId}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.outletId, outletId);
    assert.ok(data.totalSalesCents !== undefined);
  });

  // #31: Real-time stock per ingredient (BOM deduction)
  await suite.test('Integration #31: POST /api/v1/orders/:id/deduct-bom', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders/ord_demo_001/deduct-bom`, {
      method: 'POST',
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.deductions));
  });

  // #33: Auto PO draft
  await suite.test('Integration #33: POST /api/v1/inventory/auto-po', async () => {
    const res = await fetch(`${baseUrl}/api/v1/inventory/auto-po`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outletId }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.outletId, outletId);
    assert.equal(data.status, 'DRAFT');
    assert.ok(data.items.length >= 1);
  });

  // #35: Waste-per-item analytics
  await suite.test('Integration #35: GET /api/v1/analytics/waste-cost', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/waste-cost?outletId=${outletId}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.outletId, outletId);
    assert.ok(data.totalWasteCostCents !== undefined);
  });

  // #41: Expiry tracking & FIFO alert
  await suite.test('Integration #41: GET /api/v1/inventory/expiring', async () => {
    const res = await fetch(`${baseUrl}/api/v1/inventory/expiring?outletId=${outletId}&days=14`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.count >= 1);
    assert.ok(Array.isArray(data.lots));
  });

  // #43: Par-level consumable alerts
  await suite.test('Integration #43: GET /api/v1/inventory/par-alerts', async () => {
    const res = await fetch(`${baseUrl}/api/v1/inventory/par-alerts?outletId=${outletId}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.count >= 1);
    assert.ok(Array.isArray(data.alerts));
  });

  // #45: Inventory valuation export
  await suite.test('Integration #45: GET /api/v1/inventory/valuation', async () => {
    const res = await fetch(`${baseUrl}/api/v1/inventory/valuation?outletId=${outletId}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.outletId, outletId);
    assert.ok(data.totalValueCents > 0);
  });

  // #48: Route to bar vs kitchen stations
  await suite.test('Integration #48: GET /api/v1/kds/orders/:id/station-routing', async () => {
    const res = await fetch(`${baseUrl}/api/v1/kds/orders/ord_demo_001/station-routing`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.orderId, 'ord_demo_001');
    assert.ok(data.stations['BAR']);
  });

  // #54: Ready-for-pickup customer notification
  await suite.test('Integration #54: POST /api/v1/orders/:id/ready-pickup', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders/ord_demo_001/ready-pickup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'WHATSAPP' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.orderId, 'ord_demo_001');
    assert.equal(data.status, 'SENT');
  });

  // #59: Average ticket time per shift
  await suite.test('Integration #59: GET /api/v1/analytics/ticket-times', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/ticket-times?outletId=${outletId}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.outletId, outletId);
    assert.ok(data.averagePrepMinutes >= 1);
  });

  // #63: Wrong-item dispute & auto-replace ticket
  await suite.test('Integration #63: POST /api/v1/orders/:id/dispute', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders/ord_demo_001/dispute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId: 'item_01',
        photoUrl: 'https://cdn.abiruchi.com/photo.jpg',
        reason: 'Cold food delivered',
      }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.orderId, 'ord_demo_001');
    assert.equal(data.status, 'REPLACEMENT_FIRED');
  });

  // #65: Calorie + nutritional info
  await suite.test('Integration #65: POST & GET /api/v1/menu/items/:id/nutrition', async () => {
    const itemId = 'e0000000-0000-0000-0000-000000000002';
    const postRes = await fetch(`${baseUrl}/api/v1/menu/items/${itemId}/nutrition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        calories: 850,
        proteinGrams: 35,
        carbsGrams: 90,
        fatGrams: 30,
      }),
    });
    assert.equal(postRes.status, 200);

    const getRes = await fetch(`${baseUrl}/api/v1/menu/items/${itemId}/nutrition`);
    assert.equal(getRes.status, 200);
    const getData = await getRes.json();
    assert.equal(getData.nutrition.calories, 850);
  });

  // #67: Loyalty stamp card without app
  await suite.test('Integration #67: POST /api/v1/loyalty/stamp', async () => {
    const res = await fetch(`${baseUrl}/api/v1/loyalty/stamp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneHash: 'hash_test_user_777',
        outletId,
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.phoneHash, 'hash_test_user_777');
    assert.ok(data.totalStamps >= 1);
  });

  // #91: Shift handover digital logbook
  await suite.test('Integration #91: POST & GET /api/v1/staff/shift-handover', async () => {
    const postRes = await fetch(`${baseUrl}/api/v1/staff/shift-handover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        authorId: 'emp_007',
        authorName: 'Elena Rostova',
        shiftType: 'NIGHT',
        note: 'End of night till closed cleanly, no leaks',
      }),
    });
    assert.equal(postRes.status, 201);

    const getRes = await fetch(`${baseUrl}/api/v1/staff/shift-handover?outletId=${outletId}`);
    assert.equal(getRes.status, 200);
    const getData = await getRes.json();
    assert.ok(getData.count >= 1);
  });

  // #94: Service charge toggle by order type
  await suite.test('Integration #94: POST & GET /api/v1/outlets/:id/service-charge', async () => {
    const postRes = await fetch(`${baseUrl}/api/v1/outlets/${outletId}/service-charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dineInPercent: 15,
        qrTakeawayPercent: 0,
      }),
    });
    assert.equal(postRes.status, 200);

    const getRes = await fetch(`${baseUrl}/api/v1/outlets/${outletId}/service-charge`);
    assert.equal(getRes.status, 200);
    const getData = await getRes.json();
    assert.equal(getData.dineInPercent, 15);
  });
});
