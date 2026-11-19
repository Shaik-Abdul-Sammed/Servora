import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderApp } from '../../services/order-service/src/server.ts';
import type { AddressInfo } from 'node:net';

test('Abiruchi Hotel Next 20 States Integration HTTP API Test Suite', async (suite) => {
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

  // #4: Schedule menu by day of week
  await suite.test('Integration #4: POST /api/v1/owner/categories/:id/schedule-days', async () => {
    const res = await fetch(`${baseUrl}/api/v1/owner/categories/d0000000-0000-0000-0000-000000000001/schedule-days`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ daysOfWeek: [0, 6] }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.deepEqual(data.category.daysOfWeek, [0, 6]);
  });

  // #6: Per-outlet pricing
  await suite.test('Integration #6: POST /api/v1/owner/menu/:id/outlet-price', async () => {
    const res = await fetch(`${baseUrl}/api/v1/owner/menu/e0000000-0000-0000-0000-000000000001/outlet-price`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outletId, priceCents: 2750 }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.item.outletPricing[outletId], 2750);
  });

  // #7: Today-only chef special
  await suite.test('Integration #7: POST /api/v1/owner/menu/:id/chef-special', async () => {
    const res = await fetch(`${baseUrl}/api/v1/owner/menu/e0000000-0000-0000-0000-000000000002/chef-special`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isSpecial: true, date: '2026-11-17' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.item.isChefSpecial, true);
  });

  // #10: Allergen tagging & filter
  await suite.test('Integration #10: POST /api/v1/menu/filter-allergens', async () => {
    const res = await fetch(`${baseUrl}/api/v1/menu/filter-allergens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outletId, excludedAllergens: ['gluten'] }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.items));
  });

  // #13: Minimum order value
  await suite.test('Integration #13: Minimum order value rejection on checkout', async () => {
    // Set min order value to $50.00 (5000 cents)
    const setRes = await fetch(`${baseUrl}/api/v1/outlets/${outletId}/min-order-value`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minOrderValueCents: 5000 }),
    });
    assert.equal(setRes.status, 200);

    // Attempt $19 order -> expect 400
    const orderRes = await fetch(`${baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        items: [{ menuItemId: 'e0000000-0000-0000-0000-000000000002', quantity: 1 }],
      }),
    });
    assert.equal(orderRes.status, 400);

    // Reset minimum order value to 0
    await fetch(`${baseUrl}/api/v1/outlets/${outletId}/min-order-value`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minOrderValueCents: 0 }),
    });
  });

  // #17: UPI dynamic QR code + payment deep-link
  await suite.test('Integration #17: POST /api/v1/payments/upi-intent', async () => {
    const res = await fetch(`${baseUrl}/api/v1/payments/upi-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: 'ord_demo_001', payeeVpa: 'restaurant@axis' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.upiUri.includes('upi://pay'));
  });

  // #20: Smart tip recommendation engine
  await suite.test('Integration #20: GET /api/v1/orders/:id/smart-tip', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders/ord_demo_001/smart-tip`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.tiers.length, 3);
  });

  // #25: Walkout risk detection flag
  await suite.test('Integration #25: GET /api/v1/tables/walkout-risk', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tables/walkout-risk?outletId=${outletId}&idleMinutes=0`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.riskTables));
  });

  // #26: WhatsApp payment checkout link
  await suite.test('Integration #26: POST /api/v1/payments/:id/whatsapp-link', async () => {
    const res = await fetch(`${baseUrl}/api/v1/payments/ord_demo_001/whatsapp-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+91 98765 43210' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.whatsAppUrl.includes('https://wa.me/919876543210'));
  });

  // #27: Minimum spend per head validation
  await suite.test('Integration #27: POST /api/v1/outlets/:id/min-spend-per-head', async () => {
    const res = await fetch(`${baseUrl}/api/v1/outlets/${outletId}/min-spend-per-head`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minSpendPerHeadCents: 1200 }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.settings.minSpendPerHeadCents, 1200);

    // Reset to 0
    await fetch(`${baseUrl}/api/v1/outlets/${outletId}/min-spend-per-head`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minSpendPerHeadCents: 0 }),
    });
  });

  // #36: Recipe costing & live gross margin
  await suite.test('Integration #36: GET /api/v1/menu/items/:id/margin', async () => {
    const res = await fetch(`${baseUrl}/api/v1/menu/items/e0000000-0000-0000-0000-000000000002/margin`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.grossMarginPercent > 0);
  });

  // #38: Delivery log -> stock update (GRN)
  await suite.test('Integration #38: POST /api/v1/inventory/grn', async () => {
    const res = await fetch(`${baseUrl}/api/v1/inventory/grn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        supplierName: 'Campania Produce Distributors',
        invoiceRef: 'GRN-2026-8812',
        items: [{ itemId: 'inv_burrata', quantityAdded: 15, costCents: 7500 }],
        receivedBy: 'chef_marco',
      }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.supplierName, 'Campania Produce Distributors');
  });

  // #42: Food cost % per item
  await suite.test('Integration #42: GET /api/v1/analytics/food-cost', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/food-cost?itemId=e0000000-0000-0000-0000-000000000002`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.foodCostPercent > 0);
  });

  // #49: Automated course timing rule
  await suite.test('Integration #49: POST /api/v1/orders/:id/schedule-course', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders/ord_demo_001/schedule-course`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ course: 'MAIN', delayMinutes: 15 }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.order.scheduledCourseFires?.['MAIN']);
  });

  // #55: Max prep time SLA alert watcher
  await suite.test('Integration #55: GET /api/v1/kds/sla-breaches', async () => {
    const res = await fetch(`${baseUrl}/api/v1/kds/sla-breaches?outletId=${outletId}&maxMinutes=0`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.breaches));
  });

  // #56: Recall last bumped orders on KDS
  await suite.test('Integration #56: POST /api/v1/kds/orders/:id/recall', async () => {
    const res = await fetch(`${baseUrl}/api/v1/kds/orders/ord_demo_001/recall`, {
      method: 'POST',
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.order.status, 'PREPARING');
  });

  // #64: Dynamic allergen query filter on menu endpoint
  await suite.test('Integration #64: GET /api/v1/menu?excludeAllergens=dairy', async () => {
    const res = await fetch(`${baseUrl}/api/v1/menu?outletId=${outletId}&excludeAllergens=dairy`);
    assert.equal(res.status, 200);
    const data = await res.json();
    for (const item of data.items) {
      assert.ok(!item.allergens.includes('dairy'));
    }
  });

  // #70: Welcome-back repeat visit past order recommendations
  await suite.test('Integration #70: GET /api/v1/guest/welcome-back', async () => {
    // Generate OTP & verify to register guest
    await fetch(`${baseUrl}/api/v1/guest/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+15554443322' }),
    });
    const verifyRes = await fetch(`${baseUrl}/api/v1/guest/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+15554443322', code: '1234' }),
    });
    const verifyData = await verifyRes.json();

    const res = await fetch(`${baseUrl}/api/v1/guest/welcome-back?phoneHash=${verifyData.phoneHash}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.recommendedDishes));
  });

  // #72: "N guests ordered today" social proof counter
  await suite.test('Integration #72: GET /api/v1/menu/items/:id/social-proof', async () => {
    const res = await fetch(`${baseUrl}/api/v1/menu/items/e0000000-0000-0000-0000-000000000002/social-proof?outletId=${outletId}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.orderCountToday >= 1);
    assert.ok(data.badgeText.includes('today!'));
  });

  // #87: Staff attribution per QR order
  await suite.test('Integration #87: POST /api/v1/orders/:id/assign-staff', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders/ord_demo_001/assign-staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId: 'staff_server_07', staffName: 'Giuseppe Rossi' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.order.assignedStaffId, 'staff_server_07');
    assert.equal(data.order.assignedStaffName, 'Giuseppe Rossi');
  });
});
