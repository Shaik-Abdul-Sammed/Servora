import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderStore } from '../../services/order-service/src/store.ts';

test('Abiruchi Hotel Batch 3 (20 Missing Features) Unit Test Suite', async (suite) => {
  const store = new OrderStore(':memory:');
  const outletId = 'b0000000-0000-0000-0000-000000000001';

  // #5: Clone menu across outlets
  await suite.test('#5 Unit: Clone menu across outlets', () => {
    const targetOutletId = 'b0000000-0000-0000-0000-000000000099';
    const result = store.cloneMenuToOutlet(outletId, targetOutletId);

    assert.equal(result.sourceOutletId, outletId);
    assert.equal(result.targetOutletId, targetOutletId);
    assert.ok(result.categoriesCloned >= 4);
    assert.ok(result.itemsCloned >= 5);

    const targetCategories = Array.from(store.categories.values()).filter((c) => c.outletId === targetOutletId);
    const targetItems = Array.from(store.menuItems.values()).filter((i) => i.outletId === targetOutletId);
    assert.equal(targetCategories.length, result.categoriesCloned);
    assert.equal(targetItems.length, result.itemsCloned);
  });

  // #9: Reorder categories on mobile
  await suite.test('#9 Unit: Reorder categories on mobile', () => {
    const cats = Array.from(store.categories.values()).filter((c) => c.outletId === outletId);
    assert.ok(cats.length >= 2);

    const reordered = store.reorderCategories(outletId, [
      { id: cats[0].id, sortOrder: 99 },
      { id: cats[1].id, sortOrder: 1 },
    ]);

    assert.equal(reordered[0].id, cats[1].id);
    assert.equal(reordered[0].sortOrder, 1);
  });

  // #12: Bulk price edit
  await suite.test('#12 Unit: Bulk price edit percentage and fixed delta', () => {
    const item = Array.from(store.menuItems.values()).find((i) => i.outletId === outletId)!;
    const originalPrice = item.basePriceCents;

    // +10% bulk increase
    const percentResult = store.bulkUpdatePrices(outletId, { percentageDelta: 10 });
    assert.ok(percentResult.itemsUpdated > 0);
    const updatedItem = store.menuItems.get(item.id)!;
    assert.equal(updatedItem.basePriceCents, Math.round(originalPrice * 1.1));

    // +$2.00 (200 cents) fixed increase
    const fixedResult = store.bulkUpdatePrices(outletId, { fixedDeltaCents: 200 });
    assert.ok(fixedResult.itemsUpdated > 0);
    const finalItem = store.menuItems.get(item.id)!;
    assert.equal(finalItem.basePriceCents, Math.round(originalPrice * 1.1) + 200);
  });

  // #18: Split bill by item
  await suite.test('#18 Unit: Split bill by item assignment and tax proportion', () => {
    const orderId = 'ord_demo_001';
    const split = store.splitBillByItemAssignment(orderId, [
      { guestName: 'Alice', itemIds: ['item_01'] },
      { guestName: 'Bob', itemIds: ['item_02'] },
    ]);

    assert.equal(split.orderId, orderId);
    assert.equal(split.splits.length, 2);
    assert.equal(split.splits[0].guestName, 'Alice');
    assert.equal(split.splits[0].allocatedSubtotalCents, 1900);
    assert.ok(split.splits[0].allocatedTaxCents > 0);
    assert.equal(split.splits[1].guestName, 'Bob');
    assert.equal(split.splits[1].allocatedSubtotalCents, 2800);
    assert.equal(split.unallocatedItemCount, 0);
  });

  // #19: Partial payment by guest share
  await suite.test('#19 Unit: Partial payment by guest share and balance calculation', () => {
    const orderId = 'ord_demo_001';
    const payment = store.recordPartialPayment(orderId, 'Alice', 2000, 'CARD');

    assert.equal(payment.orderId, orderId);
    assert.equal(payment.guestName, 'Alice');
    assert.equal(payment.amountCents, 2000);
    assert.ok(payment.remainingBalanceCents < 5888);
  });

  // #23: Live cash vs digital view
  await suite.test('#23 Unit: Live cash vs digital view breakdown', () => {
    store.payments.set('pay_01', {
      id: 'pay_01',
      outletId,
      orderId: 'ord_demo_001',
      amountCents: 3000,
      method: 'CASH',
      status: 'VERIFIED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    store.payments.set('pay_02', {
      id: 'pay_02',
      outletId,
      orderId: 'ord_demo_001',
      amountCents: 5000,
      method: 'UPI',
      status: 'VERIFIED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const breakdown = store.getCashVsDigitalBreakdown(outletId);
    assert.equal(breakdown.cashTotalCents, 3000);
    assert.equal(breakdown.cashCount, 1);
    assert.equal(breakdown.digitalTotalCents, 5000);
    assert.equal(breakdown.digitalCount, 1);
    assert.equal(breakdown.upiTotalCents, 5000);
    assert.equal(breakdown.totalSalesCents, 8000);
  });

  // #31: Real-time stock per ingredient (BOM deduction)
  await suite.test('#31 Unit: Real-time stock per ingredient BOM deduction', () => {
    const initialFlour = store.ingredients.get('ing_flour_01')!.currentQuantity;
    const deductions = store.deductBOMStockForOrder('ord_demo_001');

    assert.ok(deductions.length > 0);
    const updatedFlour = store.ingredients.get('ing_flour_01')!.currentQuantity;
    assert.ok(updatedFlour < initialFlour);
  });

  // #33: Auto PO draft
  await suite.test('#33 Unit: Auto purchase order draft on par deficits', () => {
    const draft = store.generateAutoPurchaseOrder(outletId);
    assert.equal(draft.outletId, outletId);
    assert.equal(draft.status, 'DRAFT');
    assert.ok(draft.items.length >= 2); // Mozzarella and Prosecco are below par
    assert.ok(draft.totalEstimatedCostCents > 0);
  });

  // #35: Waste-per-item cost analytics
  await suite.test('#35 Unit: Waste-per-item cost analytics and reason grouping', () => {
    store.wasteRecords.set('w_01', {
      id: 'w_01',
      outletId,
      itemId: 'e0000000-0000-0000-0000-000000000002',
      quantity: 3,
      reason: 'BURNT',
      costCents: 1800,
      reportedBy: 'Chef Marco',
      createdAt: new Date().toISOString(),
    });

    const waste = store.getWasteCostAnalytics(outletId);
    assert.ok(waste.totalWasteCostCents >= 1800);
    assert.ok(waste.wasteCount >= 1);
    assert.ok(waste.wasteByReason['BURNT'] >= 1800);
  });

  // #41: Expiry tracking & FIFO alert
  await suite.test('#41 Unit: Expiry tracking and FIFO batch sorting', () => {
    const expiring = store.getExpiringBatches(outletId, 7);
    assert.ok(expiring.length >= 1);
    assert.equal(expiring[0].ingredientId, 'ing_mozz_01');
    assert.equal(expiring[0].isExpired, false);
    assert.ok(expiring[0].daysRemaining <= 7);
  });

  // #43: Par-level consumable alerts
  await suite.test('#43 Unit: Par-level consumable threshold alerts', () => {
    const alerts = store.checkParLevelAlerts(outletId);
    assert.ok(alerts.length >= 2);
    assert.ok(alerts.some((a) => a.ingredientId === 'ing_mozz_01' && a.severity === 'WARNING'));
  });

  // #45: Inventory valuation export
  await suite.test('#45 Unit: Inventory valuation export', () => {
    const val = store.calculateInventoryValuation(outletId);
    assert.equal(val.outletId, outletId);
    assert.ok(val.totalItems >= 3);
    assert.ok(val.totalValueCents > 0);
  });

  // #48: Route to bar vs kitchen stations
  await suite.test('#48 Unit: Route order items to bar vs kitchen stations', () => {
    const routing = store.routeOrderToStations('ord_demo_001');
    assert.equal(routing.orderId, 'ord_demo_001');
    assert.ok(routing.stations['PIZZA_OVEN']);
    assert.ok(routing.stations['BAR']);
    assert.equal(routing.stations['PIZZA_OVEN'][0].name, 'Margherita Verace D.O.P.');
    assert.equal(routing.stations['BAR'][0].name, 'Sicilian Blood Orange Spritz');
  });

  // #54: Ready-for-pickup customer notification
  await suite.test('#54 Unit: Ready-for-pickup customer notification dispatch', () => {
    const notification = store.notifyOrderReadyForPickup('ord_demo_001', 'WHATSAPP');
    assert.equal(notification.orderId, 'ord_demo_001');
    assert.equal(notification.channel, 'WHATSAPP');
    assert.equal(notification.status, 'SENT');
    assert.ok(notification.message.includes('ready for pickup'));

    const order = store.orders.get('ord_demo_001');
    assert.equal(order?.status, 'READY_FOR_PICKUP');
  });

  // #59: Shift average ticket preparation time analytics
  await suite.test('#59 Unit: Shift average ticket preparation time analytics', () => {
    const analytics = store.getShiftTicketTimeAnalytics(outletId);
    assert.equal(analytics.outletId, outletId);
    assert.ok(analytics.totalCompletedTickets >= 1);
    assert.ok(analytics.averagePrepMinutes >= 1);
  });

  // #63: Wrong-item dispute & auto-replace ticket
  await suite.test('#63 Unit: Wrong-item photo dispute and priority replacement ticket', () => {
    const dispute = store.submitWrongItemDispute(
      'ord_demo_001',
      'item_01',
      'https://cdn.abiruchi.com/disputes/disp_01.jpg',
      'Received Diavola instead of Margherita'
    );
    assert.equal(dispute.orderId, 'ord_demo_001');
    assert.equal(dispute.itemId, 'item_01');
    assert.equal(dispute.status, 'REPLACEMENT_FIRED');
    assert.ok(dispute.replacementTicketId);
  });

  // #65: Calorie + nutritional info
  await suite.test('#65 Unit: Calorie and nutritional info assignment', () => {
    const itemId = 'e0000000-0000-0000-0000-000000000002';
    const nutrition = {
      calories: 820,
      proteinGrams: 32,
      carbsGrams: 98,
      fatGrams: 28,
      fiberGrams: 6,
    };
    const updated = store.setItemNutrition(itemId, nutrition);
    assert.deepEqual(updated.nutrition, nutrition);

    const retrieved = store.getItemNutrition(itemId);
    assert.deepEqual(retrieved, nutrition);
  });

  // #67: Loyalty stamp card without app
  await suite.test('#67 Unit: Digital loyalty stamp card and reward voucher milestone', () => {
    const phoneHash = 'guest_hash_98765';
    // Stamp 1-4
    for (let i = 0; i < 4; i++) {
      store.recordLoyaltyStamp(phoneHash, outletId);
    }
    const card4 = store.recordLoyaltyStamp(phoneHash, outletId); // 5th stamp -> award!
    assert.equal(card4.totalStamps, 5);
    assert.equal(card4.rewardsEarned, 1);
    assert.ok(card4.rewardVoucherCode);
  });

  // #91: Shift handover digital logbook
  await suite.test('#91 Unit: Shift handover digital logbook', () => {
    const note = store.addShiftHandoverNote(
      outletId,
      'staff_lucas',
      'Lucas V.',
      'EVENING',
      'Fridge 2 temp sensor replaced; busy rush on pizza station',
      'Exact cash match $420.00',
      'Check dough yeast supply tomorrow morning'
    );

    assert.equal(note.outletId, outletId);
    assert.equal(note.shiftType, 'EVENING');

    const allNotes = store.getShiftHandoverNotes(outletId);
    assert.ok(allNotes.length >= 1);
    assert.equal(allNotes[0].id, note.id);
  });

  // #94: Service charge toggle by order type
  await suite.test('#94 Unit: Service charge toggle by order type', () => {
    const updated = store.setServiceChargeConfig(outletId, {
      outletId,
      dineInPercent: 12,
      qrTakeawayPercent: 2,
      enabled: true,
    });

    assert.equal(updated.dineInPercent, 12);
    assert.equal(updated.qrTakeawayPercent, 2);

    const config = store.getServiceChargeConfig(outletId);
    assert.equal(config.dineInPercent, 12);
  });
});
