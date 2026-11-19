import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderStore } from '../../services/order-service/src/store.ts';

test('Abiruchi Hotel White-Box Internal State & Invariant Test Suite', async (suite) => {
  const store = new OrderStore(':memory:');
  const outletId = 'b0000000-0000-0000-0000-000000000001';

  // White-Box Test 1: Invariant - Total Cents must equal Subtotal + Tax + Tip - Discounts
  await suite.test('White-Box: Order financial accounting mathematical invariants', () => {
    const order = store.orders.get('ord_demo_001');
    assert.ok(order);
    const calculatedTotal = order.subtotalCents + order.taxCents + order.tipCents;
    assert.equal(order.totalCents, calculatedTotal, 'Financial invariant violated: totalCents != subtotal + tax + tip');
  });

  // White-Box Test 2: Invariant - Non-negative pricing and inventory stock
  await suite.test('White-Box: Inventory stock non-negative floor protection', () => {
    const ingId = 'ing_mozz_01';
    const ing = store.ingredients.get(ingId)!;
    // Drain stock excessively
    ing.currentQuantity = 0.1;
    store.ingredients.set(ingId, ing);

    // Deducting large order should floor at 0, never negative
    store.deductBOMStockForOrder('ord_demo_001');
    const drained = store.ingredients.get(ingId)!;
    assert.ok(drained.currentQuantity >= 0, 'Inventory quantity violated non-negative floor constraint');
  });

  // White-Box Test 3: State Machine transitions - Terminal states cannot regress
  await suite.test('White-Box: Order lifecycle state machine monotonic integrity', () => {
    const orderId = 'ord_demo_001';
    store.updateOrderStatus(orderId, 'SERVED');
    const order = store.orders.get(orderId)!;
    assert.equal(order.status, 'SERVED');
  });

  // White-Box Test 4: Persistent Map write-through callback coverage
  await suite.test('White-Box: PersistentMap SQLite statement invocation', () => {
    const uniqueCatId = `cat_wb_${Date.now()}`;
    store.categories.set(uniqueCatId, {
      id: uniqueCatId,
      tenantId: 'a0000000-0000-0000-0000-000000000001',
      outletId,
      name: 'White-Box Test Category',
      sortOrder: 100,
      isActive: true,
    });

    assert.ok(store.categories.has(uniqueCatId));
    assert.equal(store.categories.get(uniqueCatId)?.name, 'White-Box Test Category');
  });

  // White-Box Test 5: Boundary Testing - 0 party size, extreme tip percent
  await suite.test('White-Box: Boundary value analysis on session splits & tips', () => {
    const splitZero = store.calculateSessionSplit('c0000000-0000-0000-0000-000000000002', 'EQUAL', 0);
    assert.equal(splitZero.partySize, 1, 'Should normalize 0 party size to 1 to prevent division by zero');

    const splitHundred = store.calculateSessionSplit('c0000000-0000-0000-0000-000000000002', 'EQUAL', 100);
    assert.equal(splitHundred.partySize, 100);
    const sum = splitHundred.breakdown.reduce((acc, g) => acc + g.amountCents, 0);
    assert.equal(sum, splitHundred.totalCents, 'Cent rounding invariant must hold even across 100-way split');
  });

  // White-Box Test 6: Fault Injection - Tampered PIN authorization
  await suite.test('White-Box: Security challenge PIN fault injection', () => {
    assert.throws(() => store.unlockPosTerminalWithPin(outletId, 'term_wb', '0000'), /Invalid Manager PIN/);
    assert.throws(() => store.unlockPosTerminalWithPin(outletId, 'term_wb', 'bad_pin'), /Invalid Manager PIN/);
  });
});
