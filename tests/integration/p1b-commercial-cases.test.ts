import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderApp } from '../../services/order-service/src/server.ts';
import type { AddressInfo } from 'node:net';

test('Abiruchi Hotel P1-B Commercial Cases (Groups O, P, Q) Integration Test Suite', async (suite) => {
  const server = createOrderApp();

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  suite.after(() => {
    server.close();
  });

  let testOrderId = '';
  let testBookingId = '';
  const testSessionId = `sess_p1b_${Date.now()}`;

  // =========================================================================
  // GROUP O: PAYMENT DEPTH (Cases 91-106)
  // =========================================================================

  await suite.test('Setup: Create active order for payment depth testing', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-guest-session': testSessionId,
      },
      body: JSON.stringify({
        tableNumber: 'Table 7',
        items: [
          { menuItemId: 'e0000000-0000-0000-0000-000000000010', quantity: 2 }, // Plain Idli
          { menuItemId: 'e0000000-0000-0000-0000-000000000012', quantity: 2 }, // Masala Dosa
        ],
        paymentMethod: 'UPI',
      }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.id);
    testOrderId = data.id;
  });

  await suite.test('Group O: POST /api/v1/payments/split creates equal shares with exact remainder guarantee', async () => {
    const res = await fetch(`${baseUrl}/api/v1/payments/split`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: testOrderId,
        splitType: 'EQUAL',
        sharesCount: 3,
      }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.orderId, testOrderId);
    assert.equal(data.shares.length, 3);

    // Sum of shares must strictly equal total cents
    const sumCents = data.shares.reduce((acc: number, s: any) => acc + s.amountCents, 0);
    assert.equal(sumCents, data.totalCents);

    // Verify deep links generated for each share
    for (const share of data.shares) {
      assert.ok(share.upiUri.startsWith('upi://pay?pa=9010150809%40ybl'));
      assert.ok(share.gpayUri.startsWith('gpay://upi/pay?pa='));
      assert.ok(share.phonepeUri.startsWith('phonepe://pay?pa='));
      assert.ok(share.paytmUri.startsWith('paytmmp://pay?pa='));
      assert.ok(share.whatsAppUrl.startsWith('https://wa.me/'));
    }
  });

  await suite.test('Group O: POST /api/v1/payments/tip updates order tip and total', async () => {
    const res = await fetch(`${baseUrl}/api/v1/payments/tip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: testOrderId,
        tipCents: 2500, // ₹25 tip
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.tipCents, 2500);
    assert.equal(data.tipINR, '25.00');
  });

  await suite.test('Group O: POST /api/v1/payments/upi/intent generates valid app deep-links', async () => {
    const res = await fetch(`${baseUrl}/api/v1/payments/upi/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: testOrderId,
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.payeeName, 'Abiruchi Hotel');
    assert.equal(data.payeeVpa, '9010150809@ybl');
    assert.ok(data.upiUri.includes('Abiruchi%20Hotel'));
    assert.ok(data.gpayUri);
    assert.ok(data.phonepeUri);
    assert.ok(data.paytmUri);
    assert.ok(data.whatsAppUrl);
  });

  await suite.test('Group O: POST /api/v1/payments/cash records till payment and change', async () => {
    const res = await fetch(`${baseUrl}/api/v1/payments/cash`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: testOrderId,
        receivedCents: 50000, // ₹500 handed over
        notes: 'Counter 1 register cash',
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.status, 'PAID');
    assert.equal(data.method, 'CASH');
    assert.ok(data.paymentId);
    assert.ok(data.changeCents >= 0);
  });

  await suite.test('Group O: POST /api/v1/payments/card records POS transaction', async () => {
    // Create a new order for card test
    const oRes = await fetch(`${baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableNumber: 'Table 9',
        items: [{ menuItemId: 'e0000000-0000-0000-0000-000000000010', quantity: 1 }],
      }),
    });
    const orderData = await oRes.json();

    const res = await fetch(`${baseUrl}/api/v1/payments/card`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: orderData.id,
        cardLast4: '4242',
        txnRef: 'TXN-HDFC-99182',
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.status, 'PAID');
    assert.equal(data.method, 'CARD');
    assert.equal(data.cardLast4, '4242');
  });

  await suite.test('Group O: POST /api/v1/payments/refund processes refund and prevents double refund', async () => {
    const res = await fetch(`${baseUrl}/api/v1/payments/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: testOrderId,
        reason: 'Customer billing correction',
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.status, 'REFUNDED');
    assert.ok(data.refundId);

    // Double refund attempt must be rejected
    const retryRes = await fetch(`${baseUrl}/api/v1/payments/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: testOrderId,
        reason: 'Duplicate refund attempt',
      }),
    });
    const retryData = await retryRes.json();
    assert.equal(retryData.success, false);
  });

  await suite.test('Group O: GET /api/v1/payments/reconciliation returns cash, upi, card breakdown', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(`${baseUrl}/api/v1/payments/reconciliation?date=${today}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.cash);
    assert.ok(data.upi);
    assert.ok(data.card);
    assert.ok(data.refunds);
    assert.ok(typeof data.netTotalINR === 'string');
  });

  await suite.test('Group O: POST /api/v1/payments/reject rejects fake screenshot and keeps order unpaid', async () => {
    // Create new order
    const oRes = await fetch(`${baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableNumber: 'Table 11',
        items: [{ menuItemId: 'e0000000-0000-0000-0000-000000000010', quantity: 1 }],
      }),
    });
    const orderData = await oRes.json();

    const res = await fetch(`${baseUrl}/api/v1/payments/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: orderData.id,
        reason: 'Screenshot lacks valid bank reference UTR',
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.status, 'REJECTED');
    assert.equal(data.orderPaymentStatus, 'UNPAID');
  });

  await suite.test('Group O: GET /api/v1/payments/duplicates & walkout-risk return operational alerts', async () => {
    const dupRes = await fetch(`${baseUrl}/api/v1/payments/duplicates`);
    assert.equal(dupRes.status, 200);
    const dupData = await dupRes.json();
    assert.equal(dupData.success, true);
    assert.ok(Array.isArray(dupData.duplicates));

    const walkRes = await fetch(`${baseUrl}/api/v1/payments/walkout-risk?maxMinutes=0`);
    assert.equal(walkRes.status, 200);
    const walkData = await walkRes.json();
    assert.equal(walkData.success, true);
    assert.ok(Array.isArray(walkData.orders));
  });

  // =========================================================================
  // GROUP P: BOOKING POLISH (Cases 16, 19-28)
  // =========================================================================

  await suite.test('Group P: GET /api/v1/bookings/slots returns capacity-filtered slots', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(`${baseUrl}/api/v1/bookings/slots?date=${today}&party_size=4`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.slots));
    assert.ok(data.slots.length >= 7);
    assert.equal(typeof data.slots[0].available, 'boolean');
  });

  await suite.test('Group P: Setup: Create standard booking for reschedule and override testing', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(`${baseUrl}/api/v1/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guestName: 'Anil Kumar',
        phone: '9848022338',
        bookingDate: today,
        timeSlot: '07:00 PM',
        partySize: 4,
      }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.id || data.booking?.id);
    testBookingId = data.id || data.booking.id;
  });

  await suite.test('Group P: PATCH /api/v1/bookings/:id/reschedule updates booking slot', async () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const res = await fetch(`${baseUrl}/api/v1/bookings/${testBookingId}/reschedule`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: tomorrow,
        slot: '08:00 PM',
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.booking.booking_date, tomorrow);
    assert.equal(data.booking.time_slot, '08:00 PM');
  });

  await suite.test('Group P: PATCH /api/v1/bookings/:id/override handles walk-in table override', async () => {
    const res = await fetch(`${baseUrl}/api/v1/bookings/${testBookingId}/override`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guestName: 'Suresh (Walk-in)',
        partySize: 2,
        tableNumber: 'Table 5',
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.bumpedBooking.status, 'BUMPED');
    assert.equal(data.walkInBooking.status, 'CHECKED_IN');
    assert.equal(data.walkInBooking.guest_name, 'Suresh (Walk-in)');
  });

  await suite.test('Group P: POST /api/v1/bookings/:id/whatsapp generates confirmed WhatsApp reminder link', async () => {
    const res = await fetch(`${baseUrl}/api/v1/bookings/${testBookingId}/whatsapp`, {
      method: 'POST',
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.waLink.startsWith('https://wa.me/'));
    assert.ok(data.message.includes('Abiruchi Hotel'));
    assert.ok(data.dispatched, true);
  });

  await suite.test('Group P: POST /api/v1/bookings/events enforces party size >= 8 and deposit', async () => {
    const today = new Date().toISOString().slice(0, 10);

    // Rejection when party size < 8
    const failRes = await fetch(`${baseUrl}/api/v1/bookings/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guestName: 'Small Party',
        phone: '9000000000',
        date: today,
        timeSlot: '08:00 PM',
        partySize: 5,
        eventType: 'BIRTHDAY',
      }),
    });
    assert.equal(failRes.status, 400);

    // Success when party size >= 8
    const okRes = await fetch(`${baseUrl}/api/v1/bookings/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guestName: 'Hyderabad Tech Team',
        phone: '9123456789',
        date: today,
        timeSlot: '08:00 PM',
        partySize: 12,
        eventType: 'CORPORATE',
        notes: 'Project success celebration dinner',
      }),
    });
    assert.equal(okRes.status, 201);
    const data = await okRes.json();
    assert.equal(data.success, true);
    assert.equal(data.partySize, 12);
    assert.equal(data.eventType, 'CORPORATE');
    assert.equal(data.status, 'DEPOSIT_PENDING');
    assert.ok(data.depositRequiredCents > 0);
  });

  await suite.test('Group P: POST & GET /api/v1/bookings/:id/recurring caps occurrences at 52', async () => {
    const res = await fetch(`${baseUrl}/api/v1/bookings/${testBookingId}/recurring`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recurrencePattern: 'WEEKLY',
        occurrencesCount: 100, // Attempt 100
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.occurrences, 52); // Strict cap!

    const listRes = await fetch(`${baseUrl}/api/v1/bookings/recurring`);
    assert.equal(listRes.status, 200);
    const listData = await listRes.json();
    assert.equal(listData.success, true);
    assert.ok(listData.count >= 1);
  });

  await suite.test('Group P: GET /api/v1/bookings/no-shows & POST /refund handle no-show and cancellation', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const nsRes = await fetch(`${baseUrl}/api/v1/bookings/no-shows?date=${today}`);
    assert.equal(nsRes.status, 200);
    const nsData = await nsRes.json();
    assert.equal(nsData.success, true);
    assert.ok(Array.isArray(nsData.noShows));

    const refRes = await fetch(`${baseUrl}/api/v1/bookings/${testBookingId}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Deposit refunded on cancellation' }),
    });
    assert.equal(refRes.status, 200);
    const refData = await refRes.json();
    assert.equal(refData.success, true);
    assert.equal(refData.refundStatus, 'REFUNDED');
  });

  // =========================================================================
  // GROUP Q: RETENTION BASICS (Cases 136-142)
  // =========================================================================

  await suite.test('Group Q: GET /api/v1/orders/past returns recent orders for session without saving PII', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders/past?session=${encodeURIComponent(testSessionId)}&limit=3`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.orders));
    assert.ok(data.orders.length >= 1);
  });

  await suite.test('Group Q: POST /api/v1/orders/:id/request-bill dispatches waiter call with BILL type', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders/${testOrderId}/request-bill`, {
      method: 'POST',
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.type, 'BILL');
    assert.ok(data.callId);
  });

  await suite.test('Group Q: GET /api/v1/customers/loyalty-status returns optedIn: false for anonymous session', async () => {
    const res = await fetch(`${baseUrl}/api/v1/customers/loyalty-status?session=${encodeURIComponent(testSessionId)}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.optedIn, false);
    assert.equal(data.stamps, 0);
  });

  await suite.test('Group Q: POST /api/v1/customers/opt-in registers loyalty and awards stamp', async () => {
    const res = await fetch(`${baseUrl}/api/v1/customers/opt-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session: testSessionId,
        phone: '9849012345',
        name: 'Venkata Rao',
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.customer.name, 'Venkata Rao');
    assert.ok(data.stamps >= 1);
  });

  await suite.test('Group Q: GET /api/v1/customers/lookup retrieves opted-in customer by phone', async () => {
    const res = await fetch(`${baseUrl}/api/v1/customers/lookup?phone=9849012345`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.customer.name, 'Venkata Rao');
    assert.ok(data.customer.stamps >= 1);
  });

  await suite.test('Group Q: POST /api/v1/customers/opt-out purges all personal data (nulls phone/name)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/customers/opt-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '9849012345',
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);

    // Follow-up lookup must fail with 404 / not found because PII is purged
    const checkRes = await fetch(`${baseUrl}/api/v1/customers/lookup?phone=9849012345`);
    assert.equal(checkRes.status, 404);
  });
});
