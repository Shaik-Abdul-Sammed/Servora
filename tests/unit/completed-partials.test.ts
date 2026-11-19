import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderStore } from '../../services/order-service/src/store.ts';

test('Abiruchi Hotel Completed Partials Unit Test Suite', async (suite) => {
  const store = new OrderStore(':memory:');
  const outletId = 'b0000000-0000-0000-0000-000000000001';

  // #22: Room folio charge
  await suite.test('#22 Unit: Room folio charge with PMS confirmation', () => {
    const charge = store.chargeRoomFolio(outletId, '404', 'Vanderbilt', 8500, 'ord_demo_001');
    assert.equal(charge.roomNumber, '404');
    assert.equal(charge.guestLastName, 'Vanderbilt');
    assert.equal(charge.amountCents, 8500);
    assert.equal(charge.status, 'POSTED_TO_FOLIO');
    assert.ok(charge.pmsConfirmationCode.includes('404'));
  });

  // #39: Daily prep list forecast
  await suite.test('#39 Unit: Daily prep list forecast calculation', () => {
    const forecast = store.getDailyPrepListForecast(outletId);
    assert.equal(forecast.outletId, outletId);
    assert.ok(forecast.items.length >= 4);
    assert.ok(forecast.items[0].recommendedPrepUnits >= forecast.items[0].projectedOrders);
  });

  // #53: Live ticket rail with status
  await suite.test('#53 Unit: Ticket rail transition and elapsed duration', () => {
    const ticket = store.transitionTicketRailStatus('ord_demo_001', 'EXPEDITED');
    assert.equal(ticket.orderId, 'ord_demo_001');
    assert.equal(ticket.railStatus, 'EXPEDITED');
    assert.ok(ticket.elapsedMinutes >= 0);

    const rail = store.getTicketRail(outletId);
    assert.ok(rail.some((t) => t.orderId === 'ord_demo_001' && t.railStatus === 'EXPEDITED'));
  });

  // #66: Guest language auto-detection
  await suite.test('#66 Unit: Guest language detection and translated menu', () => {
    const translated = store.detectAndTranslateMenu(outletId, 'es-ES,es;q=0.9,en;q=0.8');
    assert.equal(translated.detectedLocale, 'es');
    assert.ok(translated.categories[0].name.startsWith('[ES]'));
    assert.ok(translated.items[0].name.startsWith('[ES]'));
  });

  // #69: Post-payment rating + recovery alert
  await suite.test('#69 Unit: Low rating triggers manager recovery alert', () => {
    const alert = store.submitGuestRatingAndAlert('ord_demo_001', 1, 'Cold soup and slow service', outletId);
    assert.equal(alert.rating, 1);
    assert.equal(alert.isFlaggedForManager, true);
    assert.equal(alert.smsAlertSent, true);

    const highAlert = store.submitGuestRatingAndAlert('ord_demo_001', 5, 'Exceptional experience!', outletId);
    assert.equal(highAlert.isFlaggedForManager, false);
    assert.equal(highAlert.smsAlertSent, false);
  });

  // #73: Request digital bill from phone
  await suite.test('#73 Unit: Request digital bill aggregation', () => {
    const bill = store.requestDigitalBill('c0000000-0000-0000-0000-000000000002', outletId);
    assert.equal(bill.outletId, outletId);
    assert.equal(bill.isReadyForPayment, true);
    assert.ok(bill.totalDueCents > 0);
  });

  // #74: Split bill from one session
  await suite.test('#74 Unit: Multi-party equal session split', () => {
    const split = store.calculateSessionSplit('c0000000-0000-0000-0000-000000000002', 'EQUAL', 3);
    assert.equal(split.partySize, 3);
    assert.equal(split.breakdown.length, 3);
    const sum = split.breakdown.reduce((acc, g) => acc + g.amountCents, 0);
    assert.equal(sum, split.totalCents);
  });

  // #79: Peak-hour heatmaps
  await suite.test('#79 Unit: Peak-hour 24-hour revenue heatmap', () => {
    const heatmap = store.getHourlyRevenueHeatmap(outletId);
    assert.equal(heatmap.hourlyData.length, 24);
    assert.equal(heatmap.peakHour, 20);
    assert.ok(heatmap.totalDayRevenueCents > 0);
  });

  // #86: Role-based access control (RBAC)
  await suite.test('#86 Unit: RBAC permission check enforcement', () => {
    assert.equal(store.checkRbacPermission('OWNER', 'any:permission').allowed, true);
    assert.equal(store.checkRbacPermission('CHEF', 'kds:bump').allowed, true);
    assert.equal(store.checkRbacPermission('CHEF', 'discounts:apply').allowed, false);
    assert.equal(store.checkRbacPermission('WAITER', 'orders:create').allowed, true);
    assert.equal(store.checkRbacPermission('GUEST', 'reports:view').allowed, false);
  });

  // #93: Tip distribution / pool ledger
  await suite.test('#93 Unit: Tip pool equal distribution ledger', () => {
    const dist = store.distributeTipPool(outletId, 'shift_am_01', ['emp_1', 'emp_2', 'emp_3'], 30000);
    assert.equal(dist.totalTipPoolCents, 30000);
    assert.equal(dist.tipPerStaffCents, 10000);
    assert.equal(dist.staffAllocations.length, 3);
    assert.equal(dist.staffAllocations[0].amountCents, 10000);
  });

  // #96: POS connector
  await suite.test('#96 Unit: POS connector sync result', () => {
    const sync = store.syncOrderToExternalPOS('ord_demo_001', 'LIGHTSPEED');
    assert.equal(sync.orderId, 'ord_demo_001');
    assert.equal(sync.status, 'SYNCED');
    assert.ok(sync.externalOrderId.startsWith('LIGHTSPEED_EXT_'));
  });

  // #98: PMS connector
  await suite.test('#98 Unit: PMS connector Opera/Mews folio sync', () => {
    const sync = store.syncHotelFolioWithPMS('folio_99', 'OPERA', '501', 'Duchess Kate', 9200);
    assert.equal(sync.folioId, 'folio_99');
    assert.equal(sync.pmsType, 'OPERA');
    assert.equal(sync.status, 'POSTED');
  });

  // #100: White-label guest experience
  await suite.test('#100 Unit: White-label guest brand configuration', () => {
    const brand = store.setWhiteLabelBrand(outletId, {
      brandName: 'Caffè Bellissimo',
      primaryColor: '#b91c1c',
      accentColor: '#f59e0b',
      logoUrl: 'https://cdn.abiruchi.com/brands/bellissimo.png',
    });
    assert.equal(brand.brandName, 'Caffè Bellissimo');
    assert.equal(brand.primaryColor, '#b91c1c');

    const retrieved = store.getWhiteLabelBrand(outletId);
    assert.equal(retrieved.brandName, 'Caffè Bellissimo');
  });
});
