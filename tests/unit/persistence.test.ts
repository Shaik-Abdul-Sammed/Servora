import test from 'node:test';
import assert from 'node:assert/strict';
import { unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { OrderStore } from '../../services/order-service/src/store.ts';

test('Persistent SQLite Storage Engine', async (t) => {
  const testDbFile = join(process.cwd(), 'data/test_persistence.db');
  if (existsSync(testDbFile)) unlinkSync(testDbFile);

  await t.test('Initializes disk database and seeds initial records', () => {
    const store = new OrderStore(testDbFile);
    assert.equal(store.tenants.size, 1);
    assert.equal(store.tables.size, 5);
    assert.equal(store.orders.size, 1);
  });

  await t.test('Persists a newly created order and restores it after simulated restart', () => {
    // 1. First process / instance creates an order
    const store1 = new OrderStore(testDbFile);
    const newOrderId = 'ord_persisted_test_99';
    store1.orders.set(newOrderId, {
      id: newOrderId,
      tenantId: 'a0000000-0000-0000-0000-000000000001',
      outletId: 'b0000000-0000-0000-0000-000000000001',
      tableId: 'c0000000-0000-0000-0000-000000000001',
      tableNumber: 'T-01',
      status: 'CONFIRMED',
      items: [],
      subtotalCents: 2500,
      taxCents: 206,
      tipCents: 400,
      totalCents: 3106,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 2. Second instance simulates server restart and loads from the same database file
    const store2 = new OrderStore(testDbFile);
    const restoredOrder = store2.orders.get(newOrderId);
    assert.ok(restoredOrder);
    assert.equal(restoredOrder.tableNumber, 'T-01');
    assert.equal(restoredOrder.totalCents, 3106);

    // 3. Status updates survive restart as well
    store2.updateOrderStatus(newOrderId, 'SERVED');
    const store3 = new OrderStore(testDbFile);
    assert.equal(store3.orders.get(newOrderId)?.status, 'SERVED');
  });

  // Cleanup
  if (existsSync(testDbFile)) unlinkSync(testDbFile);
});
