import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderApp } from '../../services/order-service/src/server.ts';
import type { AddressInfo } from 'node:net';

test('Abiruchi Hotel Completed Partials Integration HTTP API Test Suite', async (suite) => {
  const server = createOrderApp();

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const outletId = 'b0000000-0000-0000-0000-000000000001';

  suite.after(() => {
    server.close();
  });

  // #22: Room folio charge
  await suite.test('Integration #22: POST /api/v1/payments/room-folio', async () => {
    const res = await fetch(`${baseUrl}/api/v1/payments/room-folio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        roomNumber: '502',
        guestLastName: 'Rockefeller',
        amountCents: 11200,
        orderId: 'ord_demo_001',
      }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.roomNumber, '502');
    assert.equal(data.status, 'POSTED_TO_FOLIO');
  });

  // #39: Prep list forecast
  await suite.test('Integration #39: GET /api/v1/kitchen/prep-forecast', async () => {
    const res = await fetch(`${baseUrl}/api/v1/kitchen/prep-forecast?outletId=${outletId}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.outletId, outletId);
    assert.ok(data.items.length >= 4);
  });

  // #53: Live ticket rail with status
  await suite.test('Integration #53: GET & POST /api/v1/kds/ticket-rail', async () => {
    const postRes = await fetch(`${baseUrl}/api/v1/kds/orders/ord_demo_001/rail-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'EXPEDITED' }),
    });
    assert.equal(postRes.status, 200);

    const getRes = await fetch(`${baseUrl}/api/v1/kds/ticket-rail?outletId=${outletId}`);
    assert.equal(getRes.status, 200);
    const getData = await getRes.json();
    assert.ok(getData.count >= 1);
  });

  // #66: Guest language auto-detection
  await suite.test('Integration #66: GET /api/v1/menu/translate', async () => {
    const res = await fetch(`${baseUrl}/api/v1/menu/translate?outletId=${outletId}`, {
      headers: { 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8' },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.detectedLocale, 'fr');
    assert.ok(data.categories[0].name.startsWith('[FR]'));
  });

  // #69: Post-payment rating + recovery alert
  await suite.test('Integration #69: POST /api/v1/reviews/rating-alert', async () => {
    const res = await fetch(`${baseUrl}/api/v1/reviews/rating-alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: 'ord_demo_001',
        rating: 2,
        comment: 'Too salty',
        outletId,
      }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.isFlaggedForManager, true);
    assert.equal(data.smsAlertSent, true);
  });

  // #73: Request digital bill from phone
  await suite.test('Integration #73: GET /api/v1/tables/:id/digital-bill', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tables/c0000000-0000-0000-0000-000000000002/digital-bill?outletId=${outletId}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.outletId, outletId);
    assert.equal(data.isReadyForPayment, true);
  });

  // #74: Split bill from one session
  await suite.test('Integration #74: POST /api/v1/tables/:id/session-split', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tables/c0000000-0000-0000-0000-000000000002/session-split`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ splitType: 'EQUAL', partySize: 4 }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.partySize, 4);
    assert.equal(data.breakdown.length, 4);
  });

  // #79: Peak-hour heatmaps
  await suite.test('Integration #79: GET /api/v1/analytics/peak-heatmap', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/peak-heatmap?outletId=${outletId}&day=5`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.hourlyData.length, 24);
    assert.equal(data.peakHour, 20);
  });

  // #86: Role-based access control (RBAC)
  await suite.test('Integration #86: POST /api/v1/auth/check-permission', async () => {
    const allowRes = await fetch(`${baseUrl}/api/v1/auth/check-permission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'MANAGER', permission: 'menu:edit' }),
    });
    assert.equal(allowRes.status, 200);
    const allowData = await allowRes.json();
    assert.equal(allowData.allowed, true);

    const denyRes = await fetch(`${baseUrl}/api/v1/auth/check-permission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'GUEST', permission: 'till:close' }),
    });
    assert.equal(denyRes.status, 200);
    const denyData = await denyRes.json();
    assert.equal(denyData.allowed, false);
  });

  // #93: Tip distribution / pool ledger
  await suite.test('Integration #93: POST /api/v1/staff/tip-pool/distribute', async () => {
    const res = await fetch(`${baseUrl}/api/v1/staff/tip-pool/distribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        shiftId: 'shift_night_01',
        staffIds: ['staff_1', 'staff_2'],
        totalTipCents: 15000,
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.totalTipPoolCents, 15000);
    assert.equal(data.tipPerStaffCents, 7500);
  });

  // #96: POS connector
  await suite.test('Integration #96: POST /api/v1/orders/:id/pos-sync', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders/ord_demo_001/pos-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ posType: 'POSTER' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'SYNCED');
    assert.ok(data.externalOrderId.startsWith('POSTER_EXT_'));
  });

  // #98: PMS connector
  await suite.test('Integration #98: POST /api/v1/hotel/pms-sync', async () => {
    const res = await fetch(`${baseUrl}/api/v1/hotel/pms-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folioId: 'fol_888',
        pmsType: 'MEWS',
        roomNumber: '305',
        guestName: 'Sir Arthur Conan',
        amountCents: 4500,
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'POSTED');
    assert.equal(data.pmsType, 'MEWS');
  });

  // #100: White-label guest experience
  await suite.test('Integration #100: POST & GET /api/v1/brand/white-label', async () => {
    const postRes = await fetch(`${baseUrl}/api/v1/brand/white-label?outletId=${outletId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandName: 'Pizzeria Romana',
        primaryColor: '#047857',
        accentColor: '#fbbf24',
        logoUrl: 'https://cdn.abiruchi.com/brands/romana.svg',
      }),
    });
    assert.equal(postRes.status, 200);

    const getRes = await fetch(`${baseUrl}/api/v1/brand/white-label?outletId=${outletId}`);
    assert.equal(getRes.status, 200);
    const getData = await getRes.json();
    assert.equal(getData.brandName, 'Pizzeria Romana');
    assert.equal(getData.primaryColor, '#047857');
  });
});
