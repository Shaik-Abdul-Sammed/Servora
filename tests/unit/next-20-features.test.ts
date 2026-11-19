import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderStore } from '../../services/order-service/src/store.ts';

test('Abiruchi Hotel Next 20 States Unit Test Suite', async (suite) => {
  const store = new OrderStore(':memory:');
  const outletId = 'b0000000-0000-0000-0000-000000000001';

  // #4: Schedule menu by day of week
  await suite.test('#4 Unit: Schedule menu by day of week', () => {
    const catId = 'd0000000-0000-0000-0000-000000000001';
    const updated = store.scheduleCategoryDays(catId, [0, 6]); // Weekend only
    assert.ok(updated);
    assert.deepEqual(updated.daysOfWeek, [0, 6]);

    // Check on weekday (Wednesday = 3) -> category excluded
    const weekdayMenu = store.getMenu(outletId, undefined, 3);
    assert.ok(!weekdayMenu.categories.some((c) => c.id === catId));

    // Check on Sunday (0) -> category included
    const sundayMenu = store.getMenu(outletId, undefined, 0);
    assert.ok(sundayMenu.categories.some((c) => c.id === catId));
  });

  // #6: Per-outlet pricing
  await suite.test('#6 Unit: Per-outlet pricing override', () => {
    const itemId = 'e0000000-0000-0000-0000-000000000001';
    const updated = store.setOutletPricing(itemId, outletId, 2500);
    assert.ok(updated);
    assert.equal(updated.outletPricing?.[outletId], 2500);

    const menu = store.getMenu(outletId);
    const item = menu.items.find((i) => i.id === itemId);
    assert.equal(item?.basePriceCents, 2500);
  });

  // #7: Today-only chef special
  await suite.test('#7 Unit: Today-only chef special tagging', () => {
    const itemId = 'e0000000-0000-0000-0000-000000000002';
    const updated = store.setChefSpecial(itemId, true, '2026-11-17');
    assert.ok(updated);
    assert.equal(updated.isChefSpecial, true);
    assert.equal(updated.specialDate, '2026-11-17');
  });

  // #10 & #64: Allergen filtering
  await suite.test('#10 & #64 Unit: Allergen tagging & multi-allergen exclusion', () => {
    const filtered = store.filterMenuByAllergens(outletId, ['dairy']);
    // Dishes with dairy should be excluded
    for (const item of filtered) {
      assert.ok(!item.allergens.map((a) => a.toLowerCase()).includes('dairy'));
    }

    const menuWithExclude = store.getMenu(outletId, undefined, undefined, ['gluten']);
    for (const item of menuWithExclude.items) {
      assert.ok(!item.allergens.map((a) => a.toLowerCase()).includes('gluten'));
    }
  });

  // #13: Minimum order value
  await suite.test('#13 Unit: Minimum order value configuration', () => {
    const settings = store.setMinOrderValue(outletId, 2500);
    assert.equal(settings.minOrderValueCents, 2500);
  });

  // #17: UPI dynamic QR code + payment deep-link
  await suite.test('#17 Unit: UPI payment intent URI generation', () => {
    const upi = store.generateUpiIntent('ord_demo_001', 'custom@hdfc');
    assert.ok(upi);
    assert.ok(upi.upiUri.startsWith('upi://pay?pa=custom%40hdfc'));
    assert.equal(upi.payeeName, 'AbiruchiHotel');
  });

  // #20: Smart tip recommendation engine
  await suite.test('#20 Unit: Smart tip recommendation engine tiers', () => {
    const tips = store.getSmartTipRecommendation('ord_demo_001');
    assert.ok(tips);
    assert.equal(tips.tiers.length, 3);
    const defaultTier = tips.tiers.find((t) => t.isDefault);
    assert.ok(defaultTier);
    assert.equal(defaultTier.percent, 18);
  });

  // #25: Walkout risk detection flag
  await suite.test('#25 Unit: Walkout risk flag identification', () => {
    const riskTables = store.getWalkoutRiskTables(outletId, 0); // 0 threshold for immediate check
    assert.ok(Array.isArray(riskTables));
    // ord_demo_001 is unbilled
    assert.ok(riskTables.length >= 1);
  });

  // #26: WhatsApp payment checkout link
  await suite.test('#26 Unit: WhatsApp payment link formatting', () => {
    const link = store.generateWhatsAppPaymentLink('ord_demo_001', '+1 (555) 019-2834');
    assert.ok(link);
    assert.ok(link.whatsAppUrl.includes('https://wa.me/15550192834'));
    assert.ok(link.whatsAppUrl.includes('pay%2Ford_demo_001'));
  });

  // #27: Minimum spend per head validation
  await suite.test('#27 Unit: Minimum spend per head setting', () => {
    const settings = store.setMinSpendPerHead(outletId, 1500);
    assert.equal(settings.minSpendPerHeadCents, 1500);
  });

  // #36 & #42: Recipe costing, live gross margin & food cost %
  await suite.test('#36 & #42 Unit: Recipe costing, gross margin & food cost %', () => {
    const margin = store.calculateRecipeMargin('e0000000-0000-0000-0000-000000000001');
    assert.ok(margin);
    assert.ok(margin.grossMarginPercent > 50);
    assert.ok(margin.foodCostPercent < 50);

    const cost = store.calculateFoodCostPercentage('e0000000-0000-0000-0000-000000000001');
    assert.ok(cost);
    assert.equal(cost.foodCostPercent, margin.foodCostPercent);
  });

  // #38: Delivery log -> stock update (GRN)
  await suite.test('#38 Unit: Goods received note stock increment', () => {
    const beforeStock = store.inventory.get('inv_burrata')?.currentStock || 0;
    const grn = store.processGoodsReceivedNote({
      outletId,
      supplierName: 'Artisan Dairy Co.',
      invoiceRef: 'INV-GRN-9901',
      items: [{ itemId: 'inv_burrata', quantityAdded: 10, costCents: 4500 }],
    });
    assert.ok(grn.id.startsWith('grn_'));
    const afterStock = store.inventory.get('inv_burrata')?.currentStock || 0;
    assert.equal(afterStock, beforeStock + 10);
  });

  // #49: Automated course timing rule
  await suite.test('#49 Unit: Scheduled course firing timestamp', () => {
    const scheduled = store.scheduleCourseFiring('ord_demo_001', 'DESSERT', 25);
    assert.ok(scheduled);
    assert.ok(scheduled.scheduledCourseFires?.['DESSERT']);
  });

  // #55: Max prep time SLA alert watcher
  await suite.test('#55 Unit: KDS prep SLA breach calculation', () => {
    const breaches = store.getKdsSlaBreaches(outletId, 0);
    assert.ok(Array.isArray(breaches));
    assert.ok(breaches.length >= 1);
    assert.ok(breaches[0].urgency);
  });

  // #56: Recall last bumped orders on KDS
  await suite.test('#56 Unit: Recall bumped order back to PREPARING', () => {
    // First transition to SERVED
    const order = store.orders.get('ord_demo_001');
    if (order) order.status = 'SERVED';
    const recalled = store.recallBumpedOrder('ord_demo_001');
    assert.ok(recalled);
    assert.equal(recalled.status, 'PREPARING');
  });

  // #70: Welcome-back repeat visit past order recommendations
  await suite.test('#70 Unit: Welcome back guest favorites recommendation', () => {
    const fakeHash = 'hash_repeat_guest_01';
    store.updateGuestPrefs(fakeHash, {
      favoriteItemIds: ['e0000000-0000-0000-0000-000000000001'],
    });
    const welcome = store.getGuestWelcomeBack(fakeHash);
    assert.ok(welcome);
    assert.ok(welcome.recommendedDishes.some((d) => d.id === 'e0000000-0000-0000-0000-000000000001'));
  });

  // #72: "N guests ordered today" social proof counter
  await suite.test('#72 Unit: Social proof counter generation', () => {
    const proof = store.getItemDailyOrderCount('e0000000-0000-0000-0000-000000000002', outletId);
    assert.ok(proof);
    assert.ok(proof.orderCountToday >= 1);
    assert.ok(proof.badgeText.includes('times today!'));
  });

  // #87: Staff attribution per QR order
  await suite.test('#87 Unit: Staff attribution on active order', () => {
    const assigned = store.assignStaffToOrder('ord_demo_001', 'staff_99', 'Waiter Marco');
    assert.ok(assigned);
    assert.equal(assigned.assignedStaffId, 'staff_99');
    assert.equal(assigned.assignedStaffName, 'Waiter Marco');
  });
});
