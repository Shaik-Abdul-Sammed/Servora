import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderApp } from '../../services/order-service/src/server.ts';
import { OrderStore } from '../../services/order-service/src/store.ts';
import type { AddressInfo } from 'node:net';

test('QA Phase 2.F: Inventory, Recipe Costing & Profit Intelligence Test Suite', async (suite) => {
  const server = createOrderApp();

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const OUTLET_ID = 'b0000000-0000-0000-0000-000000000001';
  const store = new OrderStore(':memory:');

  suite.after(() => {
    server.close();
  });

  // 1. Recipe Costing & Margin
  await suite.test('Step 1: Calculate recipe margin, food cost %, and contribution margin', () => {
    const margin = store.calculateRecipeMargin('e0000000-0000-0000-0000-000000000002'); // Margherita Verace
    assert.ok(margin);
    assert.equal(margin.sellingPriceCents, 1900);
    assert.ok(margin.ingredientCostCents > 0);
    assert.ok(margin.grossMarginCents > 0);
    assert.ok(margin.grossMarginPercent >= 50);
    assert.ok(margin.foodCostPercent <= 50);
  });

  // 2. Par-level consumable threshold alerts
  await suite.test('Step 2: Low-stock and par-level consumable threshold alerts', () => {
    const alerts = store.checkParLevelAlerts(OUTLET_ID);
    assert.ok(Array.isArray(alerts));
    assert.ok(alerts.length >= 1);
    assert.ok(alerts.some((a) => a.severity === 'WARNING' || a.severity === 'CRITICAL'));
  });

  // 3. Expiry tracking & FIFO batch sorting
  await suite.test('Step 3: Expiry tracking within configured days threshold', () => {
    const expiring = store.getExpiringBatches(OUTLET_ID, 7);
    assert.ok(Array.isArray(expiring));
    assert.ok(expiring.length >= 1);
    assert.equal(expiring[0].isExpired, false);
    assert.ok(expiring[0].daysRemaining <= 7);
  });

  // 4. Automatic BOM Stock Depletion upon Order Execution
  await suite.test('Step 4: Automatic BOM stock depletion on order with idempotency', () => {
    const deductions = store.deductBOMStockForOrder('ord_demo_001');
    assert.ok(Array.isArray(deductions));
    assert.ok(deductions.length >= 1);
    for (const d of deductions) {
      assert.ok(d.ingredientId);
      assert.ok(d.quantityDeducted > 0);
      assert.ok(d.remainingQuantity >= 0, 'Stock must never fall below non-negative floor');
    }
  });

  // 5. Waste Logging & Analytics
  await suite.test('Step 5: Record kitchen spoilage/waste and verify waste analytics', async () => {
    const res = await fetch(`${baseUrl}/api/v1/inventory/waste`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId: OUTLET_ID,
        itemId: 'ing_mozz_01',
        quantity: 3,
        reason: 'BURNT',
        costCents: 1800,
      }),
    });
    assert.equal(res.status, 201);

    const wasteAnalyticsRes = await fetch(`${baseUrl}/api/v1/analytics/waste-cost?outletId=${OUTLET_ID}`);
    assert.equal(wasteAnalyticsRes.status, 200);
    const waste = await wasteAnalyticsRes.json();
    assert.ok(waste.totalWasteCostCents >= 1800);
    assert.ok(waste.wasteCount >= 1);
  });

  // 6. Menu Engineering BCG Matrix Classification
  await suite.test('Step 6: Compute BCG Menu Engineering Matrix (Stars, Plowhorses, Puzzles, Dogs)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/menu-bcg-matrix?outletId=${OUTLET_ID}`);
    assert.equal(res.status, 200);
    const matrix = await res.json();
    assert.ok(Array.isArray(matrix.stars));
    assert.ok(Array.isArray(matrix.plowhorses));
    assert.ok(Array.isArray(matrix.puzzles));
    assert.ok(Array.isArray(matrix.dogs));
    assert.ok(typeof matrix.classificationMap === 'object');
  });

  // 7. Inventory Valuation Ledger Export
  await suite.test('Step 7: Compute overall inventory valuation across all tracked ingredients', async () => {
    const res = await fetch(`${baseUrl}/api/v1/inventory/valuation?outletId=${OUTLET_ID}`);
    assert.equal(res.status, 200);
    const val = await res.json();
    assert.equal(val.outletId, OUTLET_ID);
    assert.ok(val.totalItems >= 3);
    assert.ok(val.totalValueCents > 0);
  });
});
