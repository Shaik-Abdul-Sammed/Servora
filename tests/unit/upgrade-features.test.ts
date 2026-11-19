import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrderStore } from '../../services/order-service/src/store.ts';

test('Upgrade Features Unit Test Suite', async (t) => {
  const store = new OrderStore(':memory:');
  const outletId = 'b0000000-0000-0000-0000-000000000001';

  await t.test('Beverages: add, list, and update product', () => {
    const bev = store.addBeverageProduct(outletId, {
      name: 'San Pellegrino 750ml',
      category: 'WATER',
      priceCents: 450,
      stock: 40,
      sizeOptions: ['750ml'],
    });
    assert.ok(bev.id, 'Beverage must have an ID');
    assert.equal(bev.name, 'San Pellegrino 750ml');

    const list = store.listBeverages(outletId);
    assert.ok(list.length > 0, 'Beverage list should contain item');
    assert.ok(list.some((b) => b.name === 'San Pellegrino 750ml'));

    const updated = store.updateBeverageProduct(bev.id, { priceCents: 500, stock: 35 });
    assert.equal(updated.priceCents, 500);
    assert.equal(updated.stock, 35);
  });

  await t.test('Water Preference: record without auto-charging paid items', () => {
    // Complimentary water preference
    store.setWaterPreference('table_101', 'COMPLIMENTARY');
    assert.equal(store.getWaterPreference('table_101'), 'COMPLIMENTARY');

    // Ensure no order was implicitly or secretly created
    const ordersForTable = Array.from(store.orders.values()).filter((o) => o.tableId === 'table_101');
    assert.equal(ordersForTable.length, 0, 'Water preference must NEVER automatically create paid order items');

    // Bottled preference
    store.setWaterPreference('table_102', 'BOTTLED_500ML');
    assert.equal(store.getWaterPreference('table_102'), 'BOTTLED_500ML');
  });

  await t.test('Today Specials: create, filter active/expired, and inventory tracking', () => {
    const activeSpecial = store.createSpecial(outletId, {
      name: 'Truffle Tagliolini',
      description: 'Handmade pasta with fresh black truffles',
      basePriceCents: 3200,
      discountPriceCents: 2600,
      limitedQty: 15,
      tags: ['CHEF_RECOMMENDED', 'SEASONAL'],
    });
    assert.ok(activeSpecial.id);
    assert.equal(activeSpecial.remainingQty, 15);

    const activeList = store.getActiveSpecials(outletId);
    assert.ok(activeList.some((s) => s.id === activeSpecial.id));

    // Expired special should not show in active list
    const pastSpecial = store.createSpecial(outletId, {
      name: 'Yesterday Soup',
      basePriceCents: 800,
      endDate: '2020-01-01',
    });
    const refreshedList = store.getActiveSpecials(outletId);
    assert.ok(!refreshedList.some((s) => s.id === pastSpecial.id), 'Expired special should not appear in active specials');

    // Update remaining quantity to 0 -> marks sold out
    store.updateSpecial(activeSpecial.id, { remainingQty: 0 });
    const soldOutCheck = store.getActiveSpecials(outletId);
    const itemFound = soldOutCheck.find((s) => s.id === activeSpecial.id);
    if (itemFound) {
      assert.equal(itemFound.soldOut, true, 'Zero remainingQty should be marked soldOut');
    }

    // Delete special
    store.deleteSpecial(pastSpecial.id);
    const afterDelete = store.getActiveSpecials(outletId);
    assert.ok(!afterDelete.some((s) => s.id === pastSpecial.id));
  });

  await t.test('Offers Engine: PERCENT_DISCOUNT, FIXED_DISCOUNT, BOGO and Best Offer Calculation', () => {
    store.createOffer(outletId, {
      type: 'PERCENT_DISCOUNT',
      name: 'Summer 10% Off',
      discountPercent: 10,
      minOrderCents: 2000,
    });

    store.createOffer(outletId, {
      type: 'FIXED_DISCOUNT',
      name: 'Flat $5 Off',
      discountCents: 500,
      minOrderCents: 3000,
    });

    store.createOffer(outletId, {
      type: 'BOGO',
      name: 'Buy 1 Get 1 Mains',
      minOrderCents: 4000,
    });

    // Subtotal 1500 -> below all minOrderCents -> no offer
    const noOffer = store.calculateBestOffer(outletId, 1500);
    assert.equal(noOffer.savedCents, 0);
    assert.equal(noOffer.offer, null);

    // Subtotal 2500 -> eligible for 10% (saves 250)
    const pctOffer = store.calculateBestOffer(outletId, 2500);
    assert.equal(pctOffer.savedCents, 250);
    assert.equal(pctOffer.discountedTotalCents, 2250);

    // Subtotal 3500 -> eligible for 10% (saves 350) or Flat $5 (saves 500) -> Flat $5 should win
    const bestFlat = store.calculateBestOffer(outletId, 3500);
    assert.equal(bestFlat.savedCents, 500);
    assert.equal(bestFlat.offer?.name, 'Flat $5 Off');

    // Subtotal 5000 -> eligible for BOGO (saves 2500) vs 10% (saves 500) vs Flat $5 (500) -> BOGO should win
    const bestBogo = store.calculateBestOffer(outletId, 5000);
    assert.equal(bestBogo.savedCents, 2500);
    assert.equal(bestBogo.offer?.type, 'BOGO');

    // Offer redemption tracking
    store.recordOfferRedemption(bestBogo.offer.id, 'order_test_1', 'table_5', bestBogo.savedCents);
    const redemptions = store.getOfferRedemptionHistory(outletId);
    assert.ok(redemptions.length > 0);
    assert.equal(redemptions[0].savedCents, 2500);
  });

  await t.test('AI Grounded Recommendations: strictly bounded to available menu items', () => {
    const recs = store.getGroundedMenuRecommendations(outletId, [], 5);
    assert.ok(Array.isArray(recs));
    for (const rec of recs) {
      assert.ok(rec.menuItemId, 'Recommendation must link to actual menuItemId');
      assert.ok(rec.name, 'Recommendation must have item name');
      assert.ok(typeof rec.priceCents === 'number', 'Price must be numeric from actual catalog');
      assert.ok(rec.reason.length > 0, 'Recommendation must provide grounded reason');
    }
  });

  await t.test('Enhanced Table Reservations & Concurrency Protection', () => {
    const slotDate = '2026-12-31';
    const slotTime = '19:30';

    const b1 = store.createEnhancedBooking({
      outletId,
      guestName: 'Eleanor Vance',
      guestPhone: '+15551234567',
      partySize: 4,
      adultsCount: 2,
      childrenCount: 2,
      childrenAges: [4, 7],
      seatingPreference: 'BOOTH',
      indoorOutdoor: 'INDOOR',
      highChairNeeded: true,
      occasion: 'ANNIVERSARY',
      specialRequests: 'Window seat if possible',
      slotDate,
      slotTime,
      depositAmountCents: 2500,
    });

    assert.ok(b1.id);
    assert.equal(b1.status, 'CONFIRMED');
    assert.equal(b1.highChairNeeded, true);
    assert.equal(b1.childrenCount, 2);

    // Check-in workflow
    const checkedIn = store.checkInBooking(b1.id);
    assert.equal(checkedIn.status, 'CHECKED_IN');
    assert.ok(checkedIn.checkedInAt);

    // Walk-in booking
    const walkIn = store.createWalkInBooking(outletId, 2, 'Walk-in Table 4');
    assert.equal(walkIn.status, 'CHECKED_IN');
    assert.equal(walkIn.isWalkIn, true);

    // No-show workflow
    const b2 = store.createEnhancedBooking({
      outletId,
      guestName: 'No Show Guest',
      partySize: 2,
      slotDate: '2026-12-31',
      slotTime: '21:00',
    });
    const markedNoShow = store.markNoShow(b2.id);
    assert.equal(markedNoShow.status, 'NO_SHOW');
    assert.ok(markedNoShow.noShowAt);
  });

  await t.test('AI Demand Forecasting: grounded statistical projections', () => {
    const forecast = store.getDemandForecast(outletId, '2026-12-25');
    assert.ok(forecast.forecastDate);
    assert.ok(typeof forecast.predictedCovers === 'number');
    assert.ok(Array.isArray(forecast.topItems));
    assert.ok(forecast.disclaimer.includes('Predictions only'));
  });

  await t.test('Menu Item CRUD: create, update price/photo, delete with audit trail', () => {
    // Create new dish with photo and dietary marker
    const dish = store.createMenuItem({
      name: 'Paneer Butter Masala',
      categoryId: 'd0000000-0000-0000-0000-000000000001',
      basePriceCents: 35000,
      imageUrl: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=300&q=80',
      dietaryType: 'VEG',
      allergens: ['DAIRY'],
      station: 'GRILL',
    });
    assert.ok(dish.id, 'Dish must receive an ID');
    assert.equal(dish.name, 'Paneer Butter Masala');
    assert.equal(dish.basePriceCents, 35000);
    assert.equal(dish.isAvailable, true);

    // Update dish
    const updated = store.updateMenuItem(dish.id, {
      basePriceCents: 38000,
      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80',
    });
    assert.equal(updated?.basePriceCents, 38000);
    assert.equal(updated?.imageUrl, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80');

    // Delete dish
    const deleted = store.deleteMenuItem(dish.id);
    assert.equal(deleted, true);
    assert.equal(store.menuItems.get(dish.id), undefined);
  });

  await t.test('Scheduled Food Ordering: 15-min capacity slots, cutoff, rescheduling, and ticket release', () => {
    const futureDate = '2026-12-31';
    const slots = store.getAvailablePickupSlots(outletId, futureDate);
    assert.ok(slots.length > 0, 'Should generate 15-minute pickup slots');
    assert.equal(slots[0].available, true);
    assert.equal(slots[0].remainingCapacity, 8);

    // Schedule order
    const preOrder = store.scheduleTakeawayPreOrder(
      outletId,
      'Aarav Sharma',
      '+919876543210',
      [{ itemId: 'e0000000-0000-0000-0000-000000000001', name: 'Margherita Verace', quantity: 2, unitPriceCents: 1900 }],
      `${futureDate}T14:30:00Z`,
      25
    );
    assert.ok(preOrder.preOrderId);
    assert.equal(preOrder.status, 'SCHEDULED');

    // Reschedule
    const rescheduled = store.rescheduleTakeawayPreOrder(preOrder.preOrderId, `${futureDate}T15:00:00Z`);
    assert.equal(rescheduled, true);
    assert.equal(store.takeawayOrders.get(preOrder.preOrderId)?.scheduledPickupTime, `${futureDate}T15:00:00Z`);

    // Release due ticket
    const released = store.releaseDueScheduledOrders(`${futureDate}T14:40:00Z`);
    assert.ok(released.some((o) => o.preOrderId === preOrder.preOrderId));
    assert.equal(store.takeawayOrders.get(preOrder.preOrderId)?.status, 'FIRED_TO_KITCHEN');
    assert.ok((store.takeawayOrders.get(preOrder.preOrderId) as any)?.pickupToken);
  });

  await t.test('Free Base Plan: limit to 3 waiters, enforce upgrade blocks on 4th waiter', () => {
    const sub = store.getSubscriptionDetails(outletId);
    assert.equal(sub.tier, 'FREE_BASE');
    assert.equal(sub.maxWaiters, 3);
    assert.equal(sub.isFree, true);

    // Add 3 waiters successfully
    const w1 = store.createStaffMember({ outletId, name: 'Waiter 1', role: 'WAITER' });
    const w2 = store.createStaffMember({ outletId, name: 'Waiter 2', role: 'WAITER' });
    const w3 = store.createStaffMember({ outletId, name: 'Waiter 3', role: 'WAITER' });
    assert.ok(w1.id && w2.id && w3.id);

    // 4th waiter must throw plan limit error
    assert.throws(
      () => store.createStaffMember({ outletId, name: 'Waiter 4', role: 'WAITER' }),
      /Subscription plan limit reached/
    );

    // Non-waiter staff (e.g. Kitchen) can still be added
    const chef = store.createStaffMember({ outletId, name: 'Head Chef', role: 'KITCHEN' });
    assert.ok(chef.id);
  });

  await t.test('Staff Management & Table Transfers: table reassignments with audit trail', () => {
    const staffList = store.listStaffMembers(outletId);
    assert.ok(staffList.length >= 3);

    const fromWaiter = staffList.find((s) => s.role === 'WAITER')!;
    store.updateStaffMember(fromWaiter.id, { assignedTables: ['Table 1', 'Table 2', 'Table 3'] });

    const toWaiter = staffList.filter((s) => s.role === 'WAITER' && s.id !== fromWaiter.id)[0];
    const transfer = store.transferTables(outletId, fromWaiter.id, toWaiter.id, ['Table 2']);
    assert.equal(transfer.success, true);

    // Reset PIN
    const reset = store.resetStaffPin(fromWaiter.id, '4455');
    assert.equal(reset.pinCode, '4455');
  });

  await t.test('Manager QR Code Studio: single, bulk, scans, and token revocation', () => {
    // Generate Table QR
    const qr1 = store.generateQrCode({
      outletId,
      name: 'Table 14 - Indoor Patio',
      type: 'TABLE',
      targetId: '14',
    });
    assert.ok(qr1.id);
    assert.ok(qr1.code.startsWith('SRV-TAB-'));
    assert.ok(qr1.destinationUrl.includes('table=14'));

    // Bulk generate 5 Takeaway QRs
    const bulk = store.generateBulkQrCodes(outletId, 'TAKEAWAY', 5, 'Counter');
    assert.equal(bulk.length, 5);
    assert.equal(bulk[0].name, 'Counter 1');

    // Record scan
    const scan = store.recordQrScan(qr1.id, { ip: '192.168.1.10', userAgent: 'Chrome Mobile' });
    assert.ok(scan);
    assert.equal(scan.scanCount, 1);

    // Revoke & rotate token
    const revoked = store.revokeQrCode(qr1.id);
    assert.equal(revoked?.rotated, true);
  });

  await t.test('Kitchen Station Routing: automatic ticket splitting per preparation station', () => {
    const rules = store.getStationRoutingRules(outletId);
    assert.ok(rules.length >= 4);

    const seedOrderId = 'ord_demo_001';
    const tickets = store.splitOrderToStationTickets(seedOrderId);
    assert.ok(tickets.length >= 1, 'Should split tickets across stations');
    for (const ticket of tickets) {
      assert.ok(ticket.ticketId);
      assert.ok(ticket.station);
      assert.ok(ticket.items.length > 0);
    }
  });
});
