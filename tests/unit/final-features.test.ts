import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderStore } from '../../services/order-service/src/store.ts';

test('Abiruchi Hotel Final Features Unit Test Suite', async (suite) => {
  const store = new OrderStore(':memory:');
  const outletId = 'b0000000-0000-0000-0000-000000000001';

  // #11: AI photo enhance on upload
  await suite.test('#11 Unit: AI photo enhance with vision adjustments', () => {
    const rawUrl = 'https://images.unsplash.com/photo-1513104890138';
    const enhanced = store.enhanceMenuItemPhotoWithAI(rawUrl, { contrast: 1.2, brightness: 1.1 });
    assert.equal(enhanced.originalUrl, rawUrl);
    assert.ok(enhanced.enhancedImageUrl.includes('ai_enhanced=true'));
    assert.equal(enhanced.adjustments.contrast, 1.2);
    assert.equal(enhanced.aiModel, 'Abiruchi-Vision-Enhance-v3');
    assert.ok(enhanced.confidenceScore > 0.9);
  });

  // #37: Supplier price comparison
  await suite.test('#37 Unit: Multi-distributor supplier price comparison', () => {
    const comparison = store.compareSupplierPrices('ing_flour_01');
    assert.equal(comparison.ingredientId, 'ing_flour_01');
    assert.equal(comparison.quotations.length, 4);
    assert.ok(comparison.quotations.some((q) => q.isCheapest));
  });

  // #44: Approve supplier invoice from phone
  await suite.test('#44 Unit: Mobile supplier invoice approval workflow', () => {
    const approval = store.approveSupplierInvoice('inv_sysco_8899', 'Head Chef Marco', 'APPROVED');
    assert.equal(approval.invoiceId, 'inv_sysco_8899');
    assert.equal(approval.status, 'APPROVED');
    assert.equal(approval.approvedBy, 'Head Chef Marco');
  });

  // #68: WhatsApp receipt + reorder link
  await suite.test('#68 Unit: WhatsApp receipt and 1-click reorder payload', () => {
    const receipt = store.sendWhatsAppReceiptAndReorder('ord_demo_001', '+15551234567');
    assert.equal(receipt.orderId, 'ord_demo_001');
    assert.ok(receipt.oneClickReorderToken.startsWith('reorder_'));
    assert.ok(receipt.reorderUri.includes('token='));
  });

  // #75: Pre-order for pickup / takeaway
  await suite.test('#75 Unit: Scheduled takeaway pre-order intake', () => {
    const pickup = store.scheduleTakeawayPreOrder(
      outletId,
      'Jennifer Aniston',
      '+15559876543',
      [{ itemId: 'e0000000-0000-0000-0000-000000000002', name: 'Margherita Verace', quantity: 2, unitPriceCents: 1900 }],
      '2026-11-17T18:30:00Z',
      30
    );
    assert.equal(pickup.customerName, 'Jennifer Aniston');
    assert.equal(pickup.status, 'SCHEDULED');
    assert.equal(pickup.prepLeadMinutes, 30);
  });

  // #76: AOV per table analytics
  await suite.test('#76 Unit: Table segmented AOV analytics', () => {
    const aov = store.calculateTableAOV(outletId);
    assert.equal(aov.outletId, outletId);
    assert.ok(aov.averageAovCents > 0);
    assert.ok(aov.tableAovMap['T-02']);
  });

  // #77: Upsell prompt acceptance rate
  await suite.test('#77 Unit: AI upsell recommendation acceptance tracker', () => {
    const stats = store.recordUpsellImpression(outletId, true, 450);
    assert.ok(stats.impressionsCount > 0);
    assert.ok(stats.acceptedCount > 0);
    assert.ok(stats.acceptanceRatePercent > 0);
  });

  // #78: QR adoption rate percentage
  await suite.test('#78 Unit: QR digital vs counter order adoption rate', () => {
    const rate = store.calculateQrAdoptionRate(outletId);
    assert.ok(rate.qrOrdersCount >= 1);
    assert.ok(rate.totalOrders >= rate.qrOrdersCount);
    assert.ok(rate.qrAdoptionRatePercent > 0);
  });

  // #80: Top/bottom 5 by margin rank
  await suite.test('#80 Unit: Menu contribution margin rankings', () => {
    const rankings = store.getTopAndBottomMarginItems(outletId);
    assert.ok(rankings.top5ByMargin.length >= 1);
    assert.ok(rankings.bottom5ByMargin.length >= 1);
    assert.ok(rankings.top5ByMargin[0].grossMarginPercent >= rankings.bottom5ByMargin[0].grossMarginPercent);
  });

  // #81: Menu engineering BCG matrix
  await suite.test('#81 Unit: BCG matrix dish classification (Stars, Plowhorses, Puzzles, Dogs)', () => {
    const matrix = store.generateMenuEngineeringBCGMatrix(outletId);
    assert.equal(matrix.outletId, outletId);
    assert.ok(Object.keys(matrix.classificationMap).length >= 4);
    assert.ok(matrix.stars.length + matrix.plowhorses.length + matrix.puzzles.length + matrix.dogs.length >= 4);
  });

  // #82: Multi-outlet performance comparison
  await suite.test('#82 Unit: Multi-outlet revenue and ticket benchmark', () => {
    const benchmark = store.compareMultiOutletPerformance('a0000000-0000-0000-0000-000000000001');
    assert.ok(benchmark.outlets.length >= 1);
    assert.equal(benchmark.outlets[0].rank, 1);
  });

  // #83: Price-change volume elasticity impact
  await suite.test('#83 Unit: Price elasticity and demand volume impact', () => {
    const itemId = 'e0000000-0000-0000-0000-000000000002';
    const elasticity = store.calculatePriceElasticityImpact(itemId, 2200); // from 1900 to 2200
    assert.equal(elasticity.menuItemId, itemId);
    assert.ok(elasticity.priceChangePercent > 0);
    assert.ok(elasticity.volumeChangePercent < 0);
    assert.equal(elasticity.elasticityType, 'ELASTIC');
  });

  // #85: P&L-ready accounting export
  await suite.test('#85 Unit: QuickBooks/Xero double-entry journal entries', () => {
    const entries = store.exportAccountingJournalEntries(outletId, 'QUICKBOOKS');
    assert.equal(entries.length, 3);
    assert.equal(entries[0].syncFormat, 'QUICKBOOKS');
    assert.equal(entries[0].amountCents, entries[1].amountCents + entries[2].amountCents); // Balance check
  });

  // #89: Live labor cost % tracker
  await suite.test('#89 Unit: Real-time labor cost percentage vs revenue', () => {
    const labor = store.calculateLiveLaborCostPercentage(outletId, 40, 1800);
    assert.equal(labor.currentLaborHours, 40);
    assert.equal(labor.totalLaborCostCents, 72000);
    assert.ok(labor.laborCostPercentage > 0);
  });

  // #90: Kitchen behind SLA staff nudge
  await suite.test('#90 Unit: Kitchen SLA breach notification broadcast', () => {
    const nudge = store.sendKitchenSlaNudge(outletId, 5);
    assert.equal(nudge.outletId, outletId);
    assert.ok(nudge.recipientStaffRoles.includes('FLOOR_MANAGER'));
    assert.ok(nudge.message.includes('KITCHEN ALERT'));
  });

  // #92: Staff meal discount approval workflow
  await suite.test('#92 Unit: Staff meal discount request & manager approval', () => {
    const request = store.requestStaffDiscountApproval(outletId, 'emp_julian', 'Julian S.', 3500, 50);
    assert.equal(request.originalAmountCents, 3500);
    assert.equal(request.discountedAmountCents, 1750);
    assert.equal(request.status, 'PENDING');

    const approved = store.approveStaffDiscount(request.id, 'Manager Dave');
    assert.equal(approved.status, 'APPROVED');
    assert.equal(approved.managerApprovedBy, 'Manager Dave');
  });

  // #95: Lock POS on manager away timeout
  await suite.test('#95 Unit: POS terminal inactivity lock and PIN unlock', () => {
    const locked = store.lockPosTerminal(outletId, 'term_bar_01');
    assert.equal(locked.isLocked, true);

    assert.throws(() => store.unlockPosTerminalWithPin(outletId, 'term_bar_01', '0000'), /Invalid/);

    const unlocked = store.unlockPosTerminalWithPin(outletId, 'term_bar_01', '1234');
    assert.equal(unlocked.isLocked, false);
  });

  // #97: Google Business Profile menu sync
  await suite.test('#97 Unit: Google Food Ordering XML feed sync', () => {
    const sync = store.syncGoogleBusinessProfileMenu(outletId, 'gbp_downtown_01');
    assert.equal(sync.syncStatus, 'SUCCESS');
    assert.ok(sync.menuPayloadXml.startsWith('<?xml'));
    assert.ok(sync.syncedItemsCount >= 4);
  });

  // #99: Open API for delivery aggregators
  await suite.test('#99 Unit: UberEats / DoorDash aggregator order injection', () => {
    const injection = store.injectAggregatorOrder('UBEREATS', 'UE_ORDER_9912', 'UBER-COUNTER', [
      { menuItemId: 'e0000000-0000-0000-0000-000000000002', name: 'Margherita Verace D.O.P.', quantity: 1, unitPriceCents: 1900 },
    ]);
    assert.equal(injection.aggregator, 'UBEREATS');
    assert.equal(injection.status, 'INJECTED_TO_KDS');
    assert.ok(store.orders.has(injection.internalOrderId));
  });

  // Quantum Seating Optimizer
  await suite.test('Quantum & AI: Simulated annealing seating optimization', () => {
    const plan = store.optimizeSeatingWithQuantumAnnealing(outletId, 4);
    assert.equal(plan.outletId, outletId);
    assert.equal(plan.partySize, 4);
    assert.equal(plan.algorithm, 'SIMULATED_QUANTUM_ANNEALING');
    assert.ok(plan.assignedTableNumber);
  });
});
