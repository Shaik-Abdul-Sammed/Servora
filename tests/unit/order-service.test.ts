import test from 'node:test';
import assert from 'node:assert/strict';
import { createSignedQRSession, verifyQRTableSession, calculateOrderTotals, formatCurrency } from '../../packages/utils/src/index.ts';
import { OrderStore } from '../../services/order-service/src/store.ts';

test('QR Session Cryptographic Validation', async (t) => {
  const secretKey = 'test-secret-salt-32-chars-long!!';
  const tableParams = {
    tenantId: 'a0000000-0000-0000-0000-000000000001',
    outletId: 'b0000000-0000-0000-0000-000000000001',
    tableId: 'c0000000-0000-0000-0000-000000000001',
    tableNumber: 'T-01',
    ttlMs: 60 * 1000, // 1 minute
  };

  await t.test('Successfully signs and verifies a legitimate QR token', () => {
    const session = createSignedQRSession(tableParams, secretKey);
    assert.ok(session.signature);
    assert.equal(session.tableNumber, 'T-01');

    const result = verifyQRTableSession(session, secretKey);
    assert.equal(result.isValid, true);
  });

  await t.test('Rejects token if forged table parameter', () => {
    const session = createSignedQRSession(tableParams, secretKey);
    const forgedSession = { ...session, tableNumber: 'T-99' };

    const result = verifyQRTableSession(forgedSession, secretKey);
    assert.equal(result.isValid, false);
    assert.equal(result.error, 'INVALID_SIGNATURE');
  });

  await t.test('Rejects token if expired', () => {
    const expiredSession = {
      ...tableParams,
      issuedAt: Date.now() - 20000,
      expiresAt: Date.now() - 10000,
      signature: 'dummy',
    };

    const result = verifyQRTableSession(expiredSession, secretKey);
    assert.equal(result.isValid, false);
    assert.equal(result.error, 'QR_SESSION_EXPIRED');
  });
});

test('Currency Formatting & Server-Side Price Calculation', async (t) => {
  await t.test('Correctly formats USD cents', () => {
    assert.equal(formatCurrency(1900, 'USD', 'en-US'), '$19.00');
    assert.equal(formatCurrency(350, 'USD', 'en-US'), '$3.50');
  });

  await t.test('Accurately computes subtotal, tax, and tips', () => {
    const items = [
      {
        unitPriceCents: 1900,
        quantity: 2,
        selectedModifiers: [{ priceDeltaCents: 350 }], // 1900 + 350 = 2250 * 2 = 4500
      },
      {
        unitPriceCents: 1400,
        quantity: 1,
        selectedModifiers: [], // 1400 * 1 = 1400
      },
    ];

    const totals = calculateOrderTotals(items, 8.25, 500);
    assert.equal(totals.subtotalCents, 5900); // 4500 + 1400
    assert.equal(totals.taxCents, 487); // 5900 * 0.0825 = 486.75 -> 487
    assert.equal(totals.tipCents, 500);
    assert.equal(totals.totalCents, 6887); // 5900 + 487 + 500
  });
});

test('Order Store & Lifecycle State Machine', async (t) => {
  const store = new OrderStore();
  const outletId = 'b0000000-0000-0000-0000-000000000001';

  await t.test('Loads demo restaurant, tables, and categorized menu', () => {
    const menu = store.getMenu(outletId);
    assert.ok(menu.categories.length >= 4);
    assert.ok(menu.items.length >= 5);

    const pizzaCategory = menu.categories.find((c) => c.name === 'Wood-Fired Pizzas');
    assert.ok(pizzaCategory);

    const margherita = menu.items.find((i) => i.name === 'Margherita Verace D.O.P.');
    assert.ok(margherita);
    assert.equal(margherita?.modifierGroups?.length, 2);
  });

  await t.test('Retrieves active KDS tickets in chronological order', () => {
    const kdsTickets = store.getKdsOrders(outletId);
    assert.ok(kdsTickets.length >= 1);
    assert.equal(kdsTickets[0]?.tableNumber, 'T-02');
  });

  await t.test('Transitions order status through lifecycle', () => {
    const orderId = 'ord_demo_001';
    
    // CONFIRMED -> PREPARING
    const preparing = store.updateOrderStatus(orderId, 'PREPARING');
    assert.equal(preparing?.status, 'PREPARING');

    // PREPARING -> READY_FOR_PICKUP
    const ready = store.updateOrderStatus(orderId, 'READY_FOR_PICKUP');
    assert.equal(ready?.status, 'READY_FOR_PICKUP');

    // READY_FOR_PICKUP -> SERVED
    const served = store.updateOrderStatus(orderId, 'SERVED');
    assert.equal(served?.status, 'SERVED');

    // Once SERVED, should not appear in active kitchen queue
    const activeTickets = store.getKdsOrders(outletId);
    assert.equal(activeTickets.some((t) => t.id === orderId), false);
  });
});
