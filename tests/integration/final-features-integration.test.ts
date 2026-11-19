import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderApp } from '../../services/order-service/src/server.ts';
import type { AddressInfo } from 'node:net';

test('Abiruchi Hotel Final Features Integration HTTP API Test Suite', async (suite) => {
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

  // #11: AI photo enhance
  await suite.test('Integration #11: POST /api/v1/ai/photo-enhance', async () => {
    const res = await fetch(`${baseUrl}/api/v1/ai/photo-enhance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: 'https://images.unsplash.com/pizza.jpg' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.aiModel, 'Abiruchi-Vision-Enhance-v3');
  });

  // #37: Supplier price comparison
  await suite.test('Integration #37: GET /api/v1/inventory/supplier-compare', async () => {
    const res = await fetch(`${baseUrl}/api/v1/inventory/supplier-compare?ingredientId=ing_flour_01`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.quotations.length, 4);
  });

  // #44: Approve supplier invoice from phone
  await suite.test('Integration #44: POST /api/v1/inventory/supplier-invoices/:id/approve', async () => {
    const res = await fetch(`${baseUrl}/api/v1/inventory/supplier-invoices/inv_402/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvedBy: 'Owner Tony' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.invoice.status, 'APPROVED');
  });

  // #68: WhatsApp receipt + reorder link
  await suite.test('Integration #68: POST /api/v1/orders/:id/whatsapp-receipt', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders/ord_demo_001/whatsapp-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+1234567890' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.reorderUri.includes('token='));
  });

  // #75: Pre-order for pickup / takeaway
  await suite.test('Integration #75: POST /api/v1/orders/takeaway-preorder', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders/takeaway-preorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        customerName: 'George Clooney',
        customerPhone: '+15554321098',
        items: [{ itemId: 'item_01', name: 'Margherita Verace', quantity: 1, unitPriceCents: 1900 }],
        scheduledPickupTime: '2026-11-17T20:00:00Z',
      }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.customerName, 'George Clooney');
  });

  // #76: AOV per table analytics
  await suite.test('Integration #76: GET /api/v1/analytics/table-aov', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/table-aov?outletId=${outletId}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.averageAovCents > 0);
  });

  // #77: Upsell stats & impression
  await suite.test('Integration #77: GET & POST /api/v1/analytics/upsell', async () => {
    const postRes = await fetch(`${baseUrl}/api/v1/analytics/upsell-impression`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outletId, accepted: true, revenueCents: 500 }),
    });
    assert.equal(postRes.status, 200);

    const getRes = await fetch(`${baseUrl}/api/v1/analytics/upsell-stats?outletId=${outletId}`);
    assert.equal(getRes.status, 200);
    const getData = await getRes.json();
    assert.ok(getData.acceptedCount > 0);
  });

  // #78: QR adoption rate
  await suite.test('Integration #78: GET /api/v1/analytics/qr-adoption', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/qr-adoption?outletId=${outletId}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.qrAdoptionRatePercent > 0);
  });

  // #80: Margin rankings
  await suite.test('Integration #80: GET /api/v1/analytics/margin-rankings', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/margin-rankings?outletId=${outletId}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.top5ByMargin.length >= 1);
  });

  // #81: Menu BCG Matrix
  await suite.test('Integration #81: GET /api/v1/analytics/menu-bcg-matrix', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/menu-bcg-matrix?outletId=${outletId}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Object.keys(data.classificationMap).length >= 4);
  });

  // #82: Multi-outlet benchmark
  await suite.test('Integration #82: GET /api/v1/analytics/multi-outlet-benchmark', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/multi-outlet-benchmark`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.outlets.length >= 1);
  });

  // #83: Price elasticity
  await suite.test('Integration #83: POST /api/v1/analytics/price-elasticity', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/price-elasticity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ menuItemId: 'e0000000-0000-0000-0000-000000000002', postPriceCents: 2100 }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.elasticityCoefficient > 0);
  });

  // #85: Accounting export
  await suite.test('Integration #85: GET /api/v1/analytics/accounting-export', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/accounting-export?outletId=${outletId}&format=QUICKBOOKS`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.count, 3);
  });

  // #89: Live labor report
  await suite.test('Integration #89: GET /api/v1/analytics/live-labor', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/live-labor?outletId=${outletId}&hours=35&rate=2000`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.currentLaborHours, 35);
  });

  // #90: Kitchen SLA nudge
  await suite.test('Integration #90: POST /api/v1/kds/sla-nudge', async () => {
    const res = await fetch(`${baseUrl}/api/v1/kds/sla-nudge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outletId, maxWaitMinutes: 5 }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.message.includes('KITCHEN ALERT'));
  });

  // #92: Staff meal discount
  await suite.test('Integration #92: POST /api/v1/staff/discount', async () => {
    const reqRes = await fetch(`${baseUrl}/api/v1/staff/discount/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        staffId: 'staff_99',
        staffName: 'Chef Gordon',
        originalAmountCents: 4000,
        discountPercent: 50,
      }),
    });
    assert.equal(reqRes.status, 201);
    const reqData = await reqRes.json();

    const appRes = await fetch(`${baseUrl}/api/v1/staff/discount/${reqData.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ managerApprovedBy: 'Manager Dave' }),
    });
    assert.equal(appRes.status, 200);
  });

  // #95: POS terminal lock
  await suite.test('Integration #95: POST /api/v1/pos/lock and unlock', async () => {
    const lockRes = await fetch(`${baseUrl}/api/v1/pos/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ terminalId: 'term_01' }),
    });
    assert.equal(lockRes.status, 200);

    const unlockRes = await fetch(`${baseUrl}/api/v1/pos/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ terminalId: 'term_01', pin: '1234' }),
    });
    assert.equal(unlockRes.status, 200);
  });

  // #97: Google Business Profile sync
  await suite.test('Integration #97: GET /api/v1/integrations/google-business-menu', async () => {
    const res = await fetch(`${baseUrl}/api/v1/integrations/google-business-menu?outletId=${outletId}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.syncStatus, 'SUCCESS');
  });

  // #99: Aggregator order injection
  await suite.test('Integration #99: POST /api/v1/integrations/aggregators/order', async () => {
    const res = await fetch(`${baseUrl}/api/v1/integrations/aggregators/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aggregator: 'DOORDASH',
        externalOrderId: 'DD_987654',
        items: [{ menuItemId: 'e0000000-0000-0000-0000-000000000002', name: 'Margherita Verace', quantity: 1, unitPriceCents: 1900 }],
      }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.aggregator, 'DOORDASH');
  });

  // Quantum Seating
  await suite.test('Quantum & AI: POST /api/v1/ai/quantum-seating', async () => {
    const res = await fetch(`${baseUrl}/api/v1/ai/quantum-seating`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outletId, partySize: 2 }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.algorithm, 'SIMULATED_QUANTUM_ANNEALING');
  });
});
