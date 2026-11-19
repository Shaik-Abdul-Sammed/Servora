import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderApp } from '../../services/order-service/src/server.ts';
import type { AddressInfo } from 'node:net';

test('Abiruchi Hotel 20 Missing States Operational Test Suite', async (suite) => {
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

  // #2: Auto-86 threshold
  await suite.test('#2: Auto-86 threshold triggered when stock depleted', async () => {
    const res = await fetch(`${baseUrl}/api/v1/inventory/auto-86-check?outletId=${outletId}`, {
      method: 'POST',
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.success);
    // Truffle oil is 0 stock in seed data -> linked item auto-86'd
    assert.ok(data.count >= 1);
  });

  // #8: Hide category without deleting
  await suite.test('#8: Hide category without deleting (1-tap toggle)', async () => {
    const catId = 'd0000000-0000-0000-0000-000000000001';
    const res = await fetch(`${baseUrl}/api/v1/owner/categories/${catId}/toggle-visibility`, {
      method: 'POST',
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.category.isActive, false);

    // Toggle back
    const res2 = await fetch(`${baseUrl}/api/v1/owner/categories/${catId}/toggle-visibility`, {
      method: 'POST',
    });
    const data2 = await res2.json();
    assert.equal(data2.category.isActive, true);
  });

  // #14: Preview QR menu as guest
  await suite.test('#14: Preview QR menu as guest simulator', async () => {
    const res = await fetch(`${baseUrl}/api/v1/owner/qr/preview?outletId=${outletId}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.url.includes('mode=PREVIEW'));
    assert.equal(data.previewMode, 'GUEST_MOBILE_SIMULATOR');
  });

  // #15: Rollback menu change
  await suite.test('#15: Rollback menu item change from audit history', async () => {
    const itemId = 'e0000000-0000-0000-0000-000000000001';
    // 1. Toggle sold out first to generate audit log
    await fetch(`${baseUrl}/api/v1/owner/menu/${itemId}/toggle-sold-out`, { method: 'POST' });

    // 2. Rollback
    const res = await fetch(`${baseUrl}/api/v1/owner/menu/${itemId}/rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.item.isAvailable, true);
  });

  // #21: Refund in <30s
  await suite.test('#21: Refund payment in <30s updating order status', async () => {
    // Submit order & payment first
    const orderRes = await fetch(`${baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        items: [{ menuItemId: 'e0000000-0000-0000-0000-000000000001', quantity: 1, course: 'STARTER' }],
        paymentMethod: 'CARD',
      }),
    });
    const order = await orderRes.json();

    // Verify payment record exists
    const paymentsRes = await fetch(`${baseUrl}/api/v1/payments?outletId=${outletId}`);
    const payments = await paymentsRes.json();
    const payment = payments.find((p: any) => p.orderId === order.id);
    assert.ok(payment);

    // Execute refund
    const refundRes = await fetch(`${baseUrl}/api/v1/payments/${payment.id}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Accidental charge', actor: 'manager_sarah' }),
    });
    assert.equal(refundRes.status, 200);
    const refundData = await refundRes.json();
    assert.equal(refundData.payment.status, 'DISPUTED');
    assert.equal(refundData.orderStatus, 'CANCELLED');
  });

  // #24: Auto till close at shift end
  await suite.test('#24: Auto till close at shift end with discrepancy', async () => {
    const res = await fetch(`${baseUrl}/api/v1/owner/till/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        actualCashCountCents: 20000, // Matches $200 float
        closedBy: 'shift_lead_mike',
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.record.id.startsWith('till_'));
    assert.equal(typeof data.record.discrepancyCents, 'number');
  });

  // #28: Promo code at checkout
  await suite.test('#28: Promo code validation with percentage discount', async () => {
    const res = await fetch(`${baseUrl}/api/v1/promo/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'WELCOME10', outletId, subtotalCents: 2000 }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.valid, true);
    assert.equal(data.discountCents, 200); // 10% of 2000 = 200

    // Test minimum spend rejection
    const lowRes = await fetch(`${baseUrl}/api/v1/promo/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'WELCOME10', outletId, subtotalCents: 1000 }),
    });
    assert.equal(lowRes.status, 400);
  });

  // #29: GST invoice auto-generate
  await suite.test('#29: GST invoice auto-generation with tax breakdown', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders/ord_demo_001/invoice`);
    assert.equal(res.status, 200);
    const invoice = await res.json();
    assert.ok(invoice.invoiceNumber.startsWith('INV-'));
    assert.equal(invoice.cgstCents > 0, true);
    assert.equal(invoice.sgstCents > 0, true);
    assert.equal(invoice.totalCents, invoice.subtotalCents + invoice.cgstCents + invoice.sgstCents);
  });

  // #30: Daily payment summary export
  await suite.test('#30: Daily payment summary CSV export', async () => {
    const res = await fetch(`${baseUrl}/api/v1/payments/export?outletId=${outletId}`);
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-type')?.includes('text/csv'));
    const csv = await res.text();
    assert.ok(csv.includes('id,outletId,orderId,amountCents,method,status'));
  });

  // #32: Reorder-point alert
  await suite.test('#32: Reorder-point alerts for low-stock consumables', async () => {
    const res = await fetch(`${baseUrl}/api/v1/inventory/reorder-alerts?outletId=${outletId}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.count >= 1);
    const lowItem = data.items.find((i: any) => i.currentStock <= i.reorderPoint);
    assert.ok(lowItem);
  });

  // #34: Waste tracking with reason codes
  await suite.test('#34: Waste tracking with reason codes & inventory deduction', async () => {
    const res = await fetch(`${baseUrl}/api/v1/inventory/waste`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        itemId: 'inv_burrata',
        quantity: 2,
        reason: 'SPOILAGE',
        costCents: 1200,
        reportedBy: 'chef_marco',
      }),
    });
    assert.equal(res.status, 201);
    const record = await res.json();
    assert.equal(record.reason, 'SPOILAGE');
    assert.equal(record.quantity, 2);
  });

  // #40: Out-of-stock → menu hide suggestion
  await suite.test('#40: Out-of-stock menu 86 suggestions', async () => {
    const res = await fetch(`${baseUrl}/api/v1/inventory/out-of-stock-suggestions?outletId=${outletId}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.suggestions));
  });

  // #51: Merge QR + verbal order
  await suite.test('#51: Merge verbal order into active QR order', async () => {
    const mergeRes = await fetch(`${baseUrl}/api/v1/orders/ord_demo_001/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          {
            id: 'extra_wine',
            menuItemId: 'e0000000-0000-0000-0000-000000000004',
            name: 'Chianti Classico Riserva',
            unitPriceCents: 1800,
            quantity: 1,
            itemTotalCents: 1800,
          },
        ],
        actor: 'waiter_alex',
      }),
    });
    assert.equal(mergeRes.status, 200);
    const data = await mergeRes.json();
    assert.ok(data.order.items.some((i: any) => i.name === 'Chianti Classico Riserva'));
  });

  // #52: Transfer bill between tables
  await suite.test('#52: Transfer bill tab to new table', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders/ord_demo_001/transfer-table`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newTableId: 'c0000000-0000-0000-0000-000000000004',
        newTableNumber: 'T-04',
        actor: 'host_sarah',
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.order.tableNumber, 'T-04');
  });

  // #57: Add kitchen note from manager
  await suite.test('#57: Broadcast kitchen banner note to KDS', async () => {
    const postRes = await fetch(`${baseUrl}/api/v1/kds/broadcast-note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        note: 'VIP Guest on Table 4 - Priority Service',
        author: 'manager_sarah',
      }),
    });
    assert.equal(postRes.status, 200);

    const getRes = await fetch(`${baseUrl}/api/v1/kds/broadcast-note?outletId=${outletId}`);
    assert.equal(getRes.status, 200);
    const data = await getRes.json();
    assert.equal(data.broadcast.note, 'VIP Guest on Table 4 - Priority Service');
  });

  // #58: Block station if oven/grill not ready
  await suite.test('#58: Freeze kitchen station with ETA countdown', async () => {
    const freezeRes = await fetch(`${baseUrl}/api/v1/stations/PIZZA_OVEN/freeze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frozen: true,
        reason: 'Oven heating to 900F',
        etaMinutes: 20,
      }),
    });
    assert.equal(freezeRes.status, 200);
    const data = await freezeRes.json();
    assert.equal(data.station.frozen, true);
    assert.equal(data.station.etaMinutes, 20);

    // Check list
    const listRes = await fetch(`${baseUrl}/api/v1/stations/freezes`);
    assert.equal(listRes.status, 200);
    const freezes = await listRes.json();
    assert.ok(freezes.some((f: any) => f.station === 'PIZZA_OVEN' && f.frozen));
  });

  // #60: Export kitchen log
  await suite.test('#60: Kitchen prep log CSV export', async () => {
    const res = await fetch(`${baseUrl}/api/v1/kds/export-log?outletId=${outletId}`);
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-type')?.includes('text/csv'));
    const csv = await res.text();
    assert.ok(csv.includes('orderId,tableNumber,status,itemCount'));
  });

  // #71: Scarcity cue
  await suite.test('#71: Scarcity badge for low-inventory dishes', async () => {
    const res = await fetch(`${baseUrl}/api/v1/menu/items/e0000000-0000-0000-0000-000000000002/scarcity`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.hasBadge, true);
    assert.ok(data.label.includes('Only 4 left!'));
  });

  // #84: Daily shift summary
  await suite.test('#84: Daily shift revenue and top items summary', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/daily-summary?outletId=${outletId}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.totalOrders >= 1);
    assert.ok(data.totalRevenueCents >= 0);
    assert.ok(data.paymentBreakdown !== undefined);
  });

  // #88: Manager override threshold PIN challenge
  await suite.test('#88: Manager PIN override authorization challenge', async () => {
    const validRes = await fetch(`${baseUrl}/api/v1/manager/override-auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '9999', action: 'COMP_BOTTLE' }),
    });
    assert.equal(validRes.status, 200);
    const validData = await validRes.json();
    assert.equal(validData.authorized, true);

    const invalidRes = await fetch(`${baseUrl}/api/v1/manager/override-auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '0000', action: 'COMP_BOTTLE' }),
    });
    assert.equal(invalidRes.status, 403);
    const invalidData = await invalidRes.json();
    assert.equal(invalidData.authorized, false);
  });
});
