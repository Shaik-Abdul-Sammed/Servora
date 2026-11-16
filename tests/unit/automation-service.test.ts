import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OrderCategorizationEngine,
  WaitTimeQueueEstimator,
  ContextualOfferEngine,
  ShiftPeakAutomationEngine,
  ObservableCronScheduler,
  AutomationEngine,
} from '../../services/automation-service/src/index.ts';
import type { Order } from '../../packages/shared-types/src/index.ts';

test('Order & Token Auto-Categorization Engine', async (t) => {
  const engine = new OrderCategorizationEngine();
  const tenantId = 'tenant_blr_01';

  await t.test('Generates sequential daily tokens starting at #001 per tenant', () => {
    engine.resetDailyTokens();
    const token1 = engine.generateDailyToken(tenantId, '2026-11-16');
    const token2 = engine.generateDailyToken(tenantId, '2026-11-16');
    const token3 = engine.generateDailyToken(tenantId, '2026-11-16');

    assert.equal(token1.displayToken, '#001');
    assert.equal(token2.displayToken, '#002');
    assert.equal(token3.displayToken, '#003');
    assert.ok(token1.uuid);
    assert.notEqual(token1.uuid, token2.uuid);
  });

  await t.test('Routes dish items to accurate kitchen stations', () => {
    assert.equal(engine.resolveKitchenStation({ name: 'Blood Orange Spritz' } as any), 'BEVERAGE');
    assert.equal(engine.resolveKitchenStation({ name: 'Truffle Burrata Pugliese' } as any), 'COLD');
    assert.equal(engine.resolveKitchenStation({ name: 'Tiramisu Tradizionale' } as any), 'DESSERT');
    assert.equal(engine.resolveKitchenStation({ name: 'Garlic Butter Naan' } as any), 'TANDOOR');
    assert.equal(engine.resolveKitchenStation({ name: 'Margherita Verace Pizza' } as any), 'GRILL');
  });

  await t.test('Splits single multi-dish order into station tickets with shared parentOrderId', () => {
    const sampleOrder: Order = {
      id: 'ord_parent_999',
      tenantId,
      outletId: 'outlet_01',
      tableId: 'tbl_01',
      tableNumber: 'T-04',
      status: 'CONFIRMED',
      items: [
        { id: '1', menuItemId: 'm1', name: 'Margherita Pizza', unitPriceCents: 1900, quantity: 1, selectedModifiers: [], itemTotalCents: 1900 },
        { id: '2', menuItemId: 'm2', name: 'Truffle Burrata', unitPriceCents: 1850, quantity: 1, selectedModifiers: [], itemTotalCents: 1850 },
        { id: '3', menuItemId: 'm3', name: 'Blood Orange Spritz', unitPriceCents: 1400, quantity: 2, selectedModifiers: [], itemTotalCents: 2800 },
      ],
      subtotalCents: 6550,
      taxCents: 540,
      tipCents: 1000,
      totalCents: 8090,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = engine.processAndSplitOrder(sampleOrder);
    assert.equal(result.category, 'DINE_IN');
    assert.ok(result.displayToken.startsWith('#'));
    // Should split into 3 distinct stations: GRILL, COLD, BEVERAGE
    assert.equal(result.stationTickets.length, 3);

    const grillTicket = result.stationTickets.find((t) => t.station === 'GRILL');
    const coldTicket = result.stationTickets.find((t) => t.station === 'COLD');
    const bevTicket = result.stationTickets.find((t) => t.station === 'BEVERAGE');

    assert.ok(grillTicket);
    assert.ok(coldTicket);
    assert.ok(bevTicket);

    assert.equal(grillTicket?.parentOrderId, 'ord_parent_999');
    assert.equal(coldTicket?.parentOrderId, 'ord_parent_999');
    assert.equal(bevTicket?.parentOrderId, 'ord_parent_999');
  });
});

test('Full-Restaurant Wait-Time Estimator & Queue Engine', async (t) => {
  const estimator = new WaitTimeQueueEstimator();

  await t.test('Returns zero wait when free tables exist', () => {
    const tables = [
      { tableId: 't1', tableNumber: 'T-01', capacity: 2, status: 'AVAILABLE' as const },
      { tableId: 't2', tableNumber: 'T-02', capacity: 4, status: 'OCCUPIED' as const },
    ];

    const result = estimator.estimateWaitTime(tables, 2);
    assert.equal(result.isFull, false);
    assert.equal(result.estimatedWaitMinutes, 0);
  });

  await t.test('Computes remaining dwell-time estimate on 3 fastest-clearing tables when fully occupied', () => {
    const now = Date.now();
    const tables = [
      { tableId: 't1', tableNumber: 'T-01', capacity: 2, status: 'OCCUPIED' as const, seatedAtMs: now - 1000 * 60 * 35 }, // 10m left
      { tableId: 't2', tableNumber: 'T-02', capacity: 2, status: 'BILL_REQUESTED' as const }, // 4m left
      { tableId: 't3', tableNumber: 'T-03', capacity: 4, status: 'OCCUPIED' as const, seatedAtMs: now - 1000 * 60 * 30 }, // 15m left
      { tableId: 't4', tableNumber: 'T-04', capacity: 4, status: 'OCCUPIED' as const, seatedAtMs: now - 1000 * 60 * 5 }, // 40m left
    ];

    const result = estimator.estimateWaitTime(tables, 2);
    assert.equal(result.isFull, true);
    assert.ok(result.estimatedWaitMinutes >= 5);
    assert.match(result.message, /min wait · join queue\?/);
  });

  await t.test('Walk-in guest joins virtual queue and receives queue token', () => {
    const tables = [{ tableId: 't1', tableNumber: 'T-01', capacity: 2, status: 'OCCUPIED' as const }];
    const entry = estimator.joinQueue({
      tenantId: 't1',
      outletId: 'o1',
      guestName: 'Arjun',
      guestPhone: '+919988776655',
      partySize: 2,
      tables,
    });

    assert.equal(entry.guestName, 'Arjun');
    assert.equal(entry.status, 'WAITING');
    assert.equal(entry.displayToken, 'Q-001');

    // Notify table ready
    const notified = estimator.notifyTableReady(entry.queueId, 't1');
    assert.equal(notified?.status, 'NOTIFIED');
    assert.equal(notified?.assignedTableId, 't1');
  });
});

test('Contextual Offer Engine & Single-Use Security', async (t) => {
  const engine = new ContextualOfferEngine();
  const tenantId = 't_blr_cafe';

  await t.test('Issues Welcome 10% coupon on first visit', () => {
    const coupon = engine.evaluateAndIssueOffer({
      tenantId,
      guestPhone: '+919876543210',
      visitHistory: undefined, // First visit
    });

    assert.equal(coupon.offerType, 'FIRST_VISIT');
    assert.equal(coupon.discountType, 'PERCENT');
    assert.equal(coupon.discountValue, 10);
    assert.equal(coupon.isRedeemed, false);
  });

  await t.test('Issues Loyalty Tier beverage credit for 3+ visits', () => {
    const coupon = engine.evaluateAndIssueOffer({
      tenantId,
      guestPhone: '+919876543211',
      visitHistory: {
        guestPhone: '+919876543211',
        visitCount: 4,
        lastVisitAtMs: Date.now() - 1000 * 60 * 60 * 24 * 3, // 3 days ago
      },
    });

    assert.equal(coupon.offerType, 'LOYALTY_TIER');
    assert.equal(coupon.discountValue, 500); // $5.00 / ₹50
  });

  await t.test('Validates and single-use redeems coupon against order', () => {
    const coupon = engine.evaluateAndIssueOffer({
      tenantId,
      guestPhone: '+919876543212',
    });

    // Subtotal $30.00 (3000 cents) -> 10% discount = $3.00 (300 cents)
    const val = engine.validateCoupon(coupon.code, tenantId, 3000);
    assert.equal(val.isValid, true);
    assert.equal(val.discountCents, 300);

    // Redeem
    const ok = engine.redeemCoupon(coupon.code, 'ord_123');
    assert.equal(ok, true);

    // Second redemption must be rejected!
    const secondTry = engine.validateCoupon(coupon.code, tenantId, 3000);
    assert.equal(secondTry.isValid, false);
    assert.equal(secondTry.error, 'COUPON_ALREADY_REDEEMED');
  });
});

test('Shift & Peak Automation Engine', async (t) => {
  const engine = new ShiftPeakAutomationEngine();
  const tenantId = 'a0000000-0000-0000-0000-000000000001';

  await t.test('Enables Happy Hour at 3 PM when occupancy is under 40%', () => {
    const state = engine.evaluateShiftState(tenantId, 25, { hour: 15, minute: 10 });
    assert.equal(state.isHappyHourActive, true);
    assert.equal(state.happyHourDiscountPercent, 20);
    assert.equal(state.isMenuLocked, false);
  });

  await t.test('Deactivates Happy Hour when occupancy recovers to >= 40%', () => {
    const state = engine.evaluateShiftState(tenantId, 55, { hour: 15, minute: 30 });
    assert.equal(state.isHappyHourActive, false);
  });

  await t.test('Auto-locks guest menu at last-order cutoff (10:30 PM)', () => {
    const state = engine.evaluateShiftState(tenantId, 20, { hour: 22, minute: 45 });
    assert.equal(state.isMenuLocked, true);
    assert.match(state.lockReason || '', /kitchen has completed final service/i);
  });
});

test('Observable Cron Scheduler & Job Registry', async (t) => {
  const scheduler = new ObservableCronScheduler();

  let executionCounter = 0;
  scheduler.registerJob({
    jobId: 'test_flushing_job',
    name: 'Flushing Stale Sessions',
    intervalMinutes: 5,
    scheduleDescription: 'Every 5m',
    handler: async () => {
      executionCounter += 1;
      return { flushed: 3 };
    },
  });

  await t.test('Executes job, records duration, details, and execution history', async () => {
    const log = await scheduler.executeJob('test_flushing_job');
    assert.equal(log.status, 'SUCCESS');
    assert.equal(log.retryCount, 0);
    assert.equal(log.details.flushed, 3);
    assert.equal(executionCounter, 1);

    const history = scheduler.getHistory();
    assert.equal(history.length, 1);
    assert.equal(history[0]?.jobId, 'test_flushing_job');
  });

  await t.test('Retries failed jobs and records status', async () => {
    let failAttempts = 0;
    scheduler.registerJob({
      jobId: 'flaky_job',
      name: 'Flaky Job',
      intervalMinutes: 1,
      scheduleDescription: '1m',
      handler: async () => {
        failAttempts += 1;
        if (failAttempts < 2) throw new Error('Transient network glitch');
        return { recovered: true };
      },
    });

    const result = await scheduler.executeJob('flaky_job', 2);
    assert.equal(result.status, 'RETRY_SUCCESS');
    assert.equal(result.retryCount, 1);
    assert.equal(result.details.recovered, true);
  });

  await t.test('Unified AutomationEngine initializes standard 5m, 1h, and 11 PM cron jobs', () => {
    const auto = new AutomationEngine();
    const jobs = auto.cron.getRegisteredJobs();
    assert.equal(jobs.length, 3);
    assert.ok(jobs.some((j) => j.jobId === 'recompute_wait_times'));
    assert.ok(jobs.some((j) => j.jobId === 'inventory_runway_check'));
    assert.ok(jobs.some((j) => j.jobId === 'nightly_winback'));
  });
});
