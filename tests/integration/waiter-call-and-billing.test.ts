import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderApp } from '../../services/order-service/src/server.ts';
import type { AddressInfo } from 'node:net';

test('Waiter Assistance, Billing Breakdown, Zero-Trust UPI & Bookings Integration', async (t) => {
  const server = createOrderApp();

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  t.after(() => {
    server.close();
  });

  const outletId = 'b0000000-0000-0000-0000-000000000001';
  const tableId = 'c0000000-0000-0000-0000-000000000002'; // Table 14

  let createdCallId = '';
  let testOrderId = '';
  let testBookingId = '';

  // 1. Table Assistance Call Ticket Lifecycle
  await t.test('POST /api/v1/tables/calls creates a waiter ticket with PENDING status', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tables/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        tableId,
        category: 'WATER',
        reason: 'Please bring 2 glasses of warm drinking water'
      })
    });

    assert.equal(res.status, 200);
    const call = await res.json();
    assert.ok(call.id);
    assert.equal(call.tableId, tableId);
    assert.equal(call.category, 'WATER');
    assert.equal(call.status, 'PENDING');
    createdCallId = call.id;
  });

  await t.test('POST /api/v1/tables/calls debounces duplicate calls within 30 seconds', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tables/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        tableId,
        category: 'WATER',
        reason: 'Duplicate call within 30 seconds'
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.debounced, true);
    assert.equal(data.call.id, createdCallId);
  });

  await t.test('GET /api/v1/tables/calls/:id fetches call ticket', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tables/calls/${createdCallId}`);
    assert.equal(res.status, 200);
    const call = await res.json();
    assert.equal(call.id, createdCallId);
    assert.equal(call.status, 'PENDING');
  });

  await t.test('PATCH /api/v1/tables/calls/:id/status updates lifecycle (ACCEPTED -> IN_PROGRESS -> COMPLETED)', async () => {
    // 1. Accept
    const acceptRes = await fetch(`${baseUrl}/api/v1/tables/calls/${createdCallId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACCEPTED', assignedWaiterId: 'waiter-101' })
    });
    assert.equal(acceptRes.status, 200);
    const accepted = await acceptRes.json();
    assert.equal(accepted.call.status, 'ACCEPTED');

    // 2. In Progress
    const progressRes = await fetch(`${baseUrl}/api/v1/tables/calls/${createdCallId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'IN_PROGRESS' })
    });
    assert.equal(progressRes.status, 200);
    const inProgress = await progressRes.json();
    assert.equal(inProgress.call.status, 'IN_PROGRESS');

    // 3. Complete
    const completeRes = await fetch(`${baseUrl}/api/v1/tables/calls/${createdCallId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'COMPLETED' })
    });
    assert.equal(completeRes.status, 200);
    const completed = await completeRes.json();
    assert.equal(completed.call.status, 'COMPLETED');
  });

  // 2. Pre-Bill & Billing Preview
  await t.test('Submits an order and retrieves itemized bill preview with GST breakdown', async () => {
    const orderRes = await fetch(`${baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        tableId,
        tableNumber: '14',
        items: [
          { menuItemId: 'e0000000-0000-0000-0000-000000000010', quantity: 2, course: 'MAIN' }, // Plain Idli
          { menuItemId: 'e0000000-0000-0000-0000-000000000057', quantity: 1, course: 'DRINKS' } // Water Bottle
        ],
        taxRate: 5.0,
        tipCents: 3000,
        paymentMethod: 'UPI'
      })
    });

    assert.equal(orderRes.status, 201);
    const createdOrder = await orderRes.json();
    testOrderId = createdOrder.id;

    // Fetch Bill Preview
    const billRes = await fetch(`${baseUrl}/api/v1/orders/${testOrderId}/bill-preview`);
    assert.equal(billRes.status, 200);
    const bill = await billRes.json();

    assert.equal(bill.orderId, testOrderId);
    assert.ok(bill.subtotalCents > 0);
    // GST 5% = CGST 2.5% + SGST 2.5%
    assert.equal(bill.cgstCents, Math.round(bill.subtotalCents * 0.025));
    assert.equal(bill.sgstCents, Math.round(bill.subtotalCents * 0.025));
    assert.equal(bill.totalTaxCents, bill.cgstCents + bill.sgstCents);
    assert.equal(bill.tipCents, 3000);
    assert.equal(bill.finalPayableCents, bill.subtotalCents + bill.totalTaxCents + bill.tipCents - bill.discountCents);
  });

  // 3. Zero-Trust UPI Workflow
  await t.test('GET /api/v1/payments/config returns configured UPI destination 9010150809', async () => {
    const res = await fetch(`${baseUrl}/api/v1/payments/config`);
    assert.equal(res.status, 200);
    const config = await res.json();
    assert.equal(config.upiMobile, '9010150809');
    assert.equal(config.upiVpa, '9010150809@ybl');
    assert.equal(config.payeeName, 'Abiruchi Hotel');
  });

  await t.test('GET /api/v1/payments/upi/qr returns zero-trust pending verification payload', async () => {
    const res = await fetch(`${baseUrl}/api/v1/payments/upi/qr?orderId=${testOrderId}&amount=250`);
    assert.equal(res.status, 200);
    const qrData = await res.json();
    assert.equal(qrData.upiVpa, '9010150809@ybl');
    assert.equal(qrData.payeeName, 'Abiruchi Hotel');
    assert.equal(qrData.verificationMode, 'ZERO_TRUST_MANAGER_RECONCILIATION');
    assert.equal(qrData.paymentStatus, 'AWAITING_VERIFICATION');
    assert.ok(qrData.upiString.includes('pa=9010150809@ybl'));
    assert.ok(qrData.upiString.includes('pn=Abiruchi%20Hotel'));
  });

  await t.test('POST /api/v1/payments/upi/verify-reconciliation marks order as PAID after manager verification', async () => {
    const res = await fetch(`${baseUrl}/api/v1/payments/upi/verify-reconciliation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: testOrderId,
        transactionRef: 'UPI-TXN-901015-8888',
        amount: 250,
        verifiedBy: 'floor_manager_1'
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.paymentStatus, 'PAID');
    assert.equal(data.order.paymentStatus, 'PAID');
  });

  // 4. Booking Lifecycle
  await t.test('POST /api/v1/bookings/enhanced creates booking, then manager confirms, checks-in, and completes', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const createRes = await fetch(`${baseUrl}/api/v1/bookings/enhanced`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        guestName: 'Arjun Reddy',
        guestPhone: '9010150809',
        partySize: 4,
        adultsCount: 4,
        childrenCount: 0,
        slotDate: today,
        slotTime: '20:00'
      })
    });

    assert.equal(createRes.status, 201);
    const booking = await createRes.json();
    assert.ok(booking.id);
    testBookingId = booking.id;

    // Manager confirms
    const confirmRes = await fetch(`${baseUrl}/api/v1/bookings/${testBookingId}/confirm`, { method: 'POST' });
    assert.equal(confirmRes.status, 200);
    const confirmed = await confirmRes.json();
    assert.equal(confirmed.booking.status, 'CONFIRMED');

    // Manager marks arrived / check-in
    const checkinRes = await fetch(`${baseUrl}/api/v1/bookings/${testBookingId}/check-in`, { method: 'POST' });
    assert.equal(checkinRes.status, 200);
    const checkedIn = await checkinRes.json();
    assert.equal(checkedIn.booking.status, 'CHECKED_IN');

    // Manager completes
    const completeRes = await fetch(`${baseUrl}/api/v1/bookings/${testBookingId}/complete`, { method: 'POST' });
    assert.equal(completeRes.status, 200);
    const completed = await completeRes.json();
    assert.equal(completed.booking.status, 'COMPLETED');
  });

  await t.test('POST /api/v1/bookings/:id/reject rejects booking', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const createRes = await fetch(`${baseUrl}/api/v1/bookings/enhanced`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        guestName: 'Cancel Test',
        guestPhone: '9876543210',
        partySize: 2,
        adultsCount: 2,
        childrenCount: 0,
        slotDate: today,
        slotTime: '21:00'
      })
    });
    const booking = await createRes.json();

    const rejectRes = await fetch(`${baseUrl}/api/v1/bookings/${booking.id}/reject`, { method: 'POST' });
    assert.equal(rejectRes.status, 200);
    const rejected = await rejectRes.json();
    assert.equal(rejected.booking.status, 'REJECTED');
  });
});
