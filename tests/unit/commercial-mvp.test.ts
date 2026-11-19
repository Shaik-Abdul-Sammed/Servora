import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderApp } from '../../services/order-service/src/server.ts';
import type { AddressInfo } from 'node:net';

test('Abiruchi Hotel Commercial MVP (C1–C8) & Multi-Surface Split Test Suite', async (suite) => {
  const server = createOrderApp();

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const outletId = 'b0000000-0000-0000-0000-000000000001';
  const tenantId = 'a0000000-0000-0000-0000-000000000001';

  suite.after(() => {
    server.close();
  });

  // --------------------------------------------------------------------------
  // Phase A: Multi-Surface Page & Asset Routing
  // --------------------------------------------------------------------------
  await suite.test('Phase A: Multi-Surface Static Page & Asset Routes', async () => {
    // 1. Guest extracted assets
    const cssRes = await fetch(`${baseUrl}/guest/styles.css`);
    assert.equal(cssRes.status, 200);
    assert.equal(cssRes.headers.get('content-type'), 'text/css; charset=utf-8');

    const jsRes = await fetch(`${baseUrl}/guest/app.js`);
    assert.equal(jsRes.status, 200);
    assert.equal(jsRes.headers.get('content-type'), 'application/javascript; charset=utf-8');

    // 2. Owner multi-page routes
    const ownerOrders = await fetch(`${baseUrl}/owner/orders`);
    assert.equal(ownerOrders.status, 200);
    const ownerSettings = await fetch(`${baseUrl}/owner/settings`);
    assert.equal(ownerSettings.status, 200);

    // 3. Staff multi-page routes
    const staffConfirm = await fetch(`${baseUrl}/staff/confirm`);
    assert.equal(staffConfirm.status, 200);
    const staffTokens = await fetch(`${baseUrl}/staff/tokens`);
    assert.equal(staffTokens.status, 200);

    // 4. Marketing pages
    const mktHome = await fetch(`${baseUrl}/marketing`);
    assert.equal(mktHome.status, 200);
    const mktPricing = await fetch(`${baseUrl}/marketing/pricing`);
    assert.equal(mktPricing.status, 200);
  });

  // --------------------------------------------------------------------------
  // C1 & C2: Token & Queue Engine + Notification
  // --------------------------------------------------------------------------
  let createdTokenId = '';
  await suite.test('C1 & C2: Token Generation, Lifecycle Progression & Active Board', async () => {
    // 1. Create Token
    const res = await fetch(`${baseUrl}/api/v1/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outletId, bucket: 'FOOD' }),
    });
    assert.equal(res.status, 201);
    const token = await res.json();
    assert.ok(token.id);
    assert.match(token.code, /^[A-Z]-[0-9]{2}$/);
    assert.equal(token.state, 'QUEUED');
    createdTokenId = token.id;

    // 2. Advance to PREPARING
    const prepRes = await fetch(`${baseUrl}/api/v1/tokens/${createdTokenId}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'PREPARING' }),
    });
    assert.equal(prepRes.status, 200);
    const prepToken = await prepRes.json();
    assert.equal(prepToken.state, 'PREPARING');

    // 3. Advance to READY
    const readyRes = await fetch(`${baseUrl}/api/v1/tokens/${createdTokenId}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'READY' }),
    });
    assert.equal(readyRes.status, 200);

    // 4. Retrieve Active Tokens board
    const activeRes = await fetch(`${baseUrl}/api/v1/tokens/active?outletId=${outletId}`);
    assert.equal(activeRes.status, 200);
    const activeTokens = await activeRes.json();
    assert.ok(Array.isArray(activeTokens));
    assert.ok(activeTokens.some((t: any) => t.id === createdTokenId && t.state === 'READY'));
  });

  // --------------------------------------------------------------------------
  // C3: Payment Verification
  // --------------------------------------------------------------------------
  await suite.test('C3: Unverified Payment Queue & Manager Verification', async () => {
    // Create an order with cash to trigger unverified payment record
    const orderRes = await fetch(`${baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        outletId,
        tableId: 'c0000000-0000-0000-0000-000000000001',
        tableNumber: 'T-01',
        paymentMethod: 'CASH',
        items: [{ menuItemId: 'e0000000-0000-0000-0000-000000000001', quantity: 1, selectedModifiers: [] }],
      }),
    });
    assert.equal(orderRes.status, 201);

    // Check unverified payments list
    const unvRes = await fetch(`${baseUrl}/api/v1/payments/unverified?outletId=${outletId}`);
    assert.equal(unvRes.status, 200);
    const unvPayments = await unvRes.json();
    assert.ok(unvPayments.length > 0);
    const target = unvPayments[0];

    // Verify payment
    const verifyRes = await fetch(`${baseUrl}/api/v1/payments/${target.id}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verifiedBy: 'manager_sarah', notes: 'Cash bill received in till' }),
    });
    assert.equal(verifyRes.status, 200);
    const verifyData = await verifyRes.json();
    assert.equal(verifyData.success, true);
    assert.equal(verifyData.payment.status, 'VERIFIED');
  });

  // --------------------------------------------------------------------------
  // C4: Table Booking + Prepay
  // --------------------------------------------------------------------------
  let bookingId = '';
  await suite.test('C4: Table Reservation Scheduling & Check-In', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(`${baseUrl}/api/v1/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        guestName: 'Eleanor Vance',
        guestPhone: '+15550192834',
        partySize: 4,
        slotDate: today,
        slotTime: '19:30',
        prepayAmountCents: 2000,
        notes: 'Window booth preferred',
      }),
    });
    assert.equal(res.status, 201);
    const booking = await res.json();
    assert.ok(booking.id);
    assert.equal(booking.status, 'RESERVED');
    bookingId = booking.id;

    // Check in
    const checkInRes = await fetch(`${baseUrl}/api/v1/bookings/${bookingId}/check-in`, {
      method: 'POST',
    });
    assert.equal(checkInRes.status, 200);
    const checkInData = await checkInRes.json();
    assert.equal(checkInData.booking.status, 'CHECKED_IN');
  });

  // --------------------------------------------------------------------------
  // C5: Mobile Login & Guest Preferences
  // --------------------------------------------------------------------------
  let guestPhoneHash = '';
  await suite.test('C5: Guest OTP Phone Verification & Preferences Sync', async () => {
    const phone = '+15559876543';

    // 1. Request OTP
    const reqRes = await fetch(`${baseUrl}/api/v1/guest/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    assert.equal(reqRes.status, 200);
    const otpData = await reqRes.json();
    assert.ok(otpData.otpCode);

    // 2. Verify OTP
    const verifyRes = await fetch(`${baseUrl}/api/v1/guest/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code: otpData.otpCode }),
    });
    assert.equal(verifyRes.status, 200);
    const verifyData = await verifyRes.json();
    assert.equal(verifyData.success, true);
    assert.ok(verifyData.phoneHash);
    guestPhoneHash = verifyData.phoneHash;

    // 3. Update Preferences
    const patchRes = await fetch(`${baseUrl}/api/v1/guest/preferences`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${guestPhoneHash}`,
      },
      body: JSON.stringify({
        allergens: ['dairy', 'peanuts'],
        milkPref: 'OAT',
        spiceLevel: 'HOT',
      }),
    });
    assert.equal(patchRes.status, 200);
    const prefData = await patchRes.json();
    assert.deepEqual(prefData.allergens, ['dairy', 'peanuts']);
    assert.equal(prefData.milkPref, 'OAT');
  });

  // --------------------------------------------------------------------------
  // C6: Feedback + Recovery Loop
  // --------------------------------------------------------------------------
  await suite.test('C6: Unhappy Guest Feedback Generates Recovery Ticket', async () => {
    // Submit 2-star review
    const reviewRes = await fetch(`${baseUrl}/api/v1/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: 'ord_demo_001',
        rating: 2,
        comment: 'Steak was cooked rare instead of medium well',
        guestEmail: 'unhappy@guest.com',
      }),
    });
    assert.equal(reviewRes.status, 201);
    const reviewData = await reviewRes.json();
    assert.equal(reviewData.review.internalAlertSent, true);

    // Verify appears in recovery queue
    const queueRes = await fetch(`${baseUrl}/api/v1/reviews/recovery-queue`);
    assert.equal(queueRes.status, 200);
    const tickets = await queueRes.json();
    assert.ok(tickets.length > 0);
    const ticket = tickets[0];
    assert.equal(ticket.status, 'OPEN');

    // Acknowledge ticket
    const ackRes = await fetch(`${baseUrl}/api/v1/reviews/recovery/${ticket.id}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId: 'manager_sarah' }),
    });
    assert.equal(ackRes.status, 200);
    const ackData = await ackRes.json();
    assert.equal(ackData.ticket.status, 'ACKNOWLEDGED');
  });

  // --------------------------------------------------------------------------
  // C7: Unified QR Router
  // --------------------------------------------------------------------------
  await suite.test('C7: QR Generator Encodes Mode (TABLE, TOKEN, BOOKING)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/qr/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        outletId,
        tableId: 'c0000000-0000-0000-0000-000000000001',
        tableNumber: 'T-01',
        mode: 'TOKEN',
      }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.mode, 'TOKEN');

    // Verify session unpacks mode
    const sessionRes = await fetch(`${baseUrl}/api/v1/qr/session?token=${data.token}`);
    assert.equal(sessionRes.status, 200);
    const sessionData = await sessionRes.json();
    assert.equal(sessionData.mode, 'TOKEN');
  });

  // --------------------------------------------------------------------------
  // C8: Segment Presets
  // --------------------------------------------------------------------------
  await suite.test('C8: Segment Preset One-Click Applied to Venue Settings', async () => {
    // 1. Apply COFFEE preset
    const coffeeRes = await fetch(`${baseUrl}/api/v1/outlets/${outletId}/apply-preset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segment: 'COFFEE' }),
    });
    assert.equal(coffeeRes.status, 200);
    const coffeeData = await coffeeRes.json();
    assert.equal(coffeeData.settings.displayMode, 'TOKEN');
    assert.equal(coffeeData.settings.paymentMode, 'PAY_FIRST');
    assert.equal(coffeeData.settings.tokenPrefix, 'A');

    // 2. Apply RESTAURANT preset
    const restRes = await fetch(`${baseUrl}/api/v1/outlets/${outletId}/apply-preset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segment: 'RESTAURANT' }),
    });
    assert.equal(restRes.status, 200);
    const restData = await restRes.json();
    assert.equal(restData.settings.displayMode, 'TABLE');
    assert.equal(restData.settings.paymentMode, 'PAY_LATER');
    assert.equal(restData.settings.requireFirstOrderApproval, true);
  });

  // --------------------------------------------------------------------------
  // Audit Service & Structured Log Verification
  // --------------------------------------------------------------------------
  await suite.test('Audit Service & C-Feature Disk Log Persistence', async () => {
    const auditRes = await fetch(`${baseUrl}/api/v1/audit/logs`);
    assert.equal(auditRes.status, 200);
    const data = await auditRes.json();
    assert.ok(Array.isArray(data.logs));
    assert.ok(data.logs.length > 0, 'Audit logs should contain recorded C-feature actions');

    // Test feature filter
    const tokenLogsRes = await fetch(`${baseUrl}/api/v1/audit/logs?feature=C1_TOKEN`);
    assert.equal(tokenLogsRes.status, 200);
    const tokenLogs = await tokenLogsRes.json();
    assert.ok(tokenLogs.logs.every((l: any) => l.feature === 'C1_TOKEN'));
  });
});
