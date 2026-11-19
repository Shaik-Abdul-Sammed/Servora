import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderApp } from '../../services/order-service/src/server.ts';
import type { AddressInfo } from 'node:net';

test('Abiruchi Hotel P0 Commercial Cases (Groups A through H) Integration Test Suite', async (suite) => {
  const server = createOrderApp();

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  suite.after(() => {
    server.close();
  });

  // =========================================================================
  // Group A — QR CRUD by Manager (Cases 1, 2, 3, 5)
  // =========================================================================
  let createdTableId = '';

  await suite.test('Group A: POST /api/v1/qr/tables creates new table QR', async () => {
    const res = await fetch(`${baseUrl}/api/v1/qr/tables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableNumber: 'Table 15', zone: 'Window' }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.id || data.table?.id);
    const tableObj = data.table || data;
    assert.equal(tableObj.tableNumber || tableObj.name, 'Table 15');
    assert.equal(tableObj.zone, 'Window');
    createdTableId = tableObj.id;
  });

  await suite.test('Group A: PUT /api/v1/qr/tables/:id renames table and updates zone', async () => {
    const res = await fetch(`${baseUrl}/api/v1/qr/tables/${createdTableId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableNumber: 'Window 15', zone: 'Balcony' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    const tableObj = data.table || data;
    assert.equal(tableObj.tableNumber || tableObj.name, 'Window 15');
    assert.equal(tableObj.zone, 'Balcony');
  });

  await suite.test('Group A: GET /api/v1/qr/tables lists all active QRs', async () => {
    const res = await fetch(`${baseUrl}/api/v1/qr/tables`);
    assert.equal(res.status, 200);
    const list = await res.json();
    const tables = Array.isArray(list) ? list : list.tables;
    assert.ok(Array.isArray(tables));
    const found = tables.find((t: any) => t.id === createdTableId);
    assert.ok(found);
    assert.equal(found.tableNumber || found.name, 'Window 15');
  });

  await suite.test('Group A: GET /api/v1/qr/tables/:id/pdf generates printable standee PDF', async () => {
    const res = await fetch(`${baseUrl}/api/v1/qr/tables/${createdTableId}/pdf`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /application\/pdf/);
    const buffer = await res.arrayBuffer();
    const bytes = Buffer.from(buffer);
    assert.ok(bytes.length > 50);
    assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
  });

  await suite.test('Group A: DELETE /api/v1/qr/tables/:id soft deletes QR and stops resolving (410)', async () => {
    const delRes = await fetch(`${baseUrl}/api/v1/qr/tables/${createdTableId}`, {
      method: 'DELETE',
    });
    assert.equal(delRes.status, 200);

    // Guest scanning this QR now gets 410 Gone
    const sessionRes = await fetch(`${baseUrl}/api/v1/qr/session?tableId=${createdTableId}`);
    assert.equal(sessionRes.status, 410);
    const errData = await sessionRes.json();
    assert.ok(errData.error.includes('no longer active'));
  });

  // =========================================================================
  // Group B — Tenant Profile / Multi-Location (Cases 7, 13, 14)
  // =========================================================================
  await suite.test('Group B: GET /api/v1/tenant/profile returns public restaurant profile', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tenant/profile`);
    assert.equal(res.status, 200);
    const profile = await res.json();
    assert.ok(profile.name.includes('Abiruchi'));
    assert.ok(profile.gstin);
    assert.ok(profile.fssai);
    assert.ok(profile.phone);
    assert.ok(profile.address);
  });

  await suite.test('Group B: PUT /api/v1/tenant/profile updates today special and operating hours', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tenant/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        today_special: 'Peshawari Paneer Tikka & Bamboo Biryani',
        operating_hours: '10:30 AM - 11:30 PM (Daily)',
      }),
    });
    assert.equal(res.status, 200);
    const updated = await res.json();
    const prof = updated.profile || updated;
    assert.equal(prof.today_special, 'Peshawari Paneer Tikka & Bamboo Biryani');
    assert.equal(prof.operating_hours, '10:30 AM - 11:30 PM (Daily)');
  });

  // =========================================================================
  // Group C — Table Booking Lifecycle (Cases 15, 17, 18)
  // =========================================================================
  let createdBookingId = '';

  await suite.test('Group C: GET /api/v1/bookings/availability returns capacity slots', async () => {
    const res = await fetch(`${baseUrl}/api/v1/bookings/availability?date=2026-12-01&partySize=4`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.slots));
    assert.ok(data.slots.length > 0);
  });

  await suite.test('Group C: POST /api/v1/bookings creates booking with code', async () => {
    const res = await fetch(`${baseUrl}/api/v1/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Suresh Kumar',
        phone: '9876543210',
        guests: 4,
        slotTime: '2026-12-01T19:30:00Z',
      }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.id || data.booking?.id);
    assert.ok(data.code || data.booking?.referenceId);
    assert.ok(data.status || data.booking?.status);
    createdBookingId = data.id || data.booking.id;
  });

  await suite.test('Group C: POST /api/v1/bookings/:id/prepay initializes deposit intent', async () => {
    const res = await fetch(`${baseUrl}/api/v1/bookings/${createdBookingId}/prepay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: 50000 }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.bookingId, createdBookingId);
    assert.equal(data.prepayAmountCents, 50000);
    assert.equal(data.paymentStatus, 'PAID');
  });

  await suite.test('Group C: PATCH /api/v1/bookings/:id/check-in marks arrived', async () => {
    const res = await fetch(`${baseUrl}/api/v1/bookings/${createdBookingId}/check-in`, {
      method: 'PATCH',
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status || data.booking?.status, 'ARRIVED');
  });

  await suite.test('Group C: PATCH /api/v1/bookings/:id/cancel cancels booking', async () => {
    const res = await fetch(`${baseUrl}/api/v1/bookings/${createdBookingId}/cancel`, {
      method: 'PATCH',
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status || data.booking?.status, 'CANCELLED');
  });

  // =========================================================================
  // Group D — Repeat Last Order & Privacy (Case 31)
  // =========================================================================
  const testGuestSession = 'sess_test_' + Date.now();
  let placedOrderId = '';

  await suite.test('Group D: POST /api/v1/orders records guest session header', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Guest-Session': testGuestSession,
      },
      body: JSON.stringify({
        outletId: 'default',
        tableNumber: 'Table 4',
        items: [
          { menuItemId: 'e0000000-0000-0000-0000-000000000010', quantity: 2 },
          { menuItemId: 'e0000000-0000-0000-0000-000000000011', quantity: 1 },
        ],
        paymentMethod: 'UPI',
      }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.id);
    placedOrderId = data.id;
  });

  await suite.test('Group D: GET /api/v1/orders/last returns recent items for session', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders/last?session=${encodeURIComponent(testGuestSession)}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    const orderObj = data.order || data.lastOrder;
    assert.ok(orderObj);
    assert.equal(orderObj.id, placedOrderId);
    assert.ok(data.items || orderObj.items);
    const items = data.items || orderObj.items;
    assert.equal(items.length, 2);
    assert.equal(items[0].name, 'Plain Idli');
  });

  await suite.test('Group D: DELETE /api/v1/orders/session/:uuid wipes session correlation', async () => {
    const delRes = await fetch(`${baseUrl}/api/v1/orders/session/${encodeURIComponent(testGuestSession)}`, {
      method: 'DELETE',
    });
    assert.equal(delRes.status, 200);

    // Follow-up fetch returns empty
    const checkRes = await fetch(`${baseUrl}/api/v1/orders/last?session=${encodeURIComponent(testGuestSession)}`);
    assert.equal(checkRes.status, 200);
    const checkData = await checkRes.json();
    assert.equal(checkData.order || checkData.lastOrder, null);
  });

  // =========================================================================
  // Group E — Token / Standalone Counter Mode (Cases 44, 45, 46, 47, 48)
  // =========================================================================
  let createdTokenId = '';
  let tokenCode = '';

  await suite.test('Group E: PUT /api/v1/tenant/order-mode activates token mode', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tenant/order-mode`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'token' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.mode || data.order_mode, 'token');
  });

  await suite.test('Group E: POST /api/v1/orders in token mode allocates alphanumeric token (A-XX)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId: 'default',
        tableNumber: 'Takeaway Counter',
        items: [{ menuItemId: 'e0000000-0000-0000-0000-000000000010', quantity: 3 }],
      }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.token);
    assert.match(data.token, /^A-\d+$/);
    tokenCode = data.token;
  });

  await suite.test('Group E: GET /api/v1/tokens/active returns active token queue', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tokens/active`);
    assert.equal(res.status, 200);
    const list = await res.json();
    const tokens = Array.isArray(list) ? list : list.tokens;
    assert.ok(Array.isArray(tokens));
    const tokenObj = tokens.find((t: any) => t.token_code === tokenCode);
    assert.ok(tokenObj);
    assert.equal(tokenObj.state, 'QUEUED');
    createdTokenId = tokenObj.id;
  });

  await suite.test('Group E: PATCH /api/v1/tokens/:id/state transitions state to PREPARING, READY, SERVED', async () => {
    // To PREPARING
    const prepRes = await fetch(`${baseUrl}/api/v1/tokens/${createdTokenId}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'PREPARING' }),
    });
    assert.equal(prepRes.status, 200);

    // To READY
    const readyRes = await fetch(`${baseUrl}/api/v1/tokens/${createdTokenId}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'READY' }),
    });
    assert.equal(readyRes.status, 200);
    const readyData = await readyRes.json();
    assert.equal(readyData.state || readyData.token?.state, 'READY');

    // To SERVED
    const servedRes = await fetch(`${baseUrl}/api/v1/tokens/${createdTokenId}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'SERVED' }),
    });
    assert.equal(servedRes.status, 200);
    const servedData = await servedRes.json();
    assert.equal(servedData.state || servedData.token?.state, 'SERVED');
  });

  // Revert order mode back to table for other tests
  await suite.test('Group E: Revert order mode to table', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tenant/order-mode`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'table' }),
    });
    assert.equal(res.status, 200);
  });

  // =========================================================================
  // Group F — Bill PDF / WhatsApp & CSV Export (Cases 53, 59, 60, 61, 62)
  // =========================================================================
  await suite.test('Group F: GET /api/v1/receipts/:orderId serves standalone print-friendly HTML', async () => {
    const res = await fetch(`${baseUrl}/api/v1/receipts/${placedOrderId}`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /text\/html/);
    const html = await res.text();
    assert.ok(html.includes('Abiruchi Hotel'));
    assert.ok(html.includes('TAX INVOICE'));
    assert.ok(html.includes(placedOrderId));
  });

  await suite.test('Group F: POST /api/v1/receipts/:orderId/pdf returns downloadable PDF bytes', async () => {
    const res = await fetch(`${baseUrl}/api/v1/receipts/${placedOrderId}/pdf`, {
      method: 'POST',
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /application\/pdf/);
    const buf = await res.arrayBuffer();
    assert.ok(buf.byteLength > 100);
    assert.equal(Buffer.from(buf).subarray(0, 4).toString(), '%PDF');
  });

  await suite.test('Group F: POST /api/v1/receipts/:orderId/whatsapp dispatches receipt via WhatsApp API stub', async () => {
    const res = await fetch(`${baseUrl}/api/v1/receipts/${placedOrderId}/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+919876543210' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.sent, true);
    assert.equal(data.targetPhone, '+919876543210');
  });

  await suite.test('Group F: GET /api/v1/analytics/export/orders.csv generates formatted orders CSV', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/export/orders.csv`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /text\/csv/);
    const csv = await res.text();
    assert.ok(csv.startsWith('order_id,table_number,status,total_rupees,payment_method,created_at'));
    assert.ok(csv.includes(placedOrderId));
  });

  await suite.test('Group F: GET /api/v1/analytics/export/daily.html serves printable summary report', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/export/daily.html`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Abiruchi Hotel - Daily Business Summary'));
    assert.ok(html.includes('Total Orders'));
    assert.ok(html.includes('Total Revenue'));
  });

  // =========================================================================
  // Group G — Manager Analytics & Revenue Filters (Cases 64, 65, 66, 67)
  // =========================================================================
  await suite.test('Group G: GET /api/v1/analytics/revenue calculates metrics with date & payment filter', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/revenue?period=today&paymentMethod=UPI`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.orderCount >= 1);
    assert.ok(data.totalRevenueCents > 0);
    assert.ok(data.byPaymentMethod);
  });

  await suite.test('Group G: GET /api/v1/analytics/qr-adoption computes QR vs manual adoption percentage', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/qr-adoption`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok('qrOrders' in data);
    assert.ok('totalOrders' in data);
    assert.ok('adoptionRate' in data);
  });

  // =========================================================================
  // Group H — Real-Time Waiter Assistance & Escalation (Cases 81, 82)
  // =========================================================================
  let callId = '';

  await suite.test('Group H: Active calls listing includes pending assistance requests', async () => {
    // Create an assistance request via existing endpoint
    await fetch(`${baseUrl}/api/v1/assistance/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId: 'Table 7', reason: 'WATER' }),
    });

    const res = await fetch(`${baseUrl}/api/v1/calls/active`);
    assert.equal(res.status, 200);
    const calls = await res.json();
    const callList = Array.isArray(calls) ? calls : calls.calls;
    assert.ok(Array.isArray(callList));
    assert.ok(callList.length > 0);
    callId = callList[0].id;
  });

  await suite.test('Group H: PATCH /api/v1/calls/:id/assign assigns staff to call', async () => {
    const res = await fetch(`${baseUrl}/api/v1/calls/${callId}/assign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffName: 'Ramesh (Captain)' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.assigned_to || data.call?.assigned_to, 'Ramesh (Captain)');
  });

  await suite.test('Group H: PATCH /api/v1/calls/:id/escalate escalates overdue assistance requests', async () => {
    const res = await fetch(`${baseUrl}/api/v1/calls/${callId}/escalate`, {
      method: 'PATCH',
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.escalated, 1);
  });

  // =========================================================================
  // Static Surface Routes Check (New 5 HTML Pages)
  // =========================================================================
  await suite.test('Static Surfaces: 5 New HTML pages are reachable with 200 OK', async () => {
    const surfaces = [
      '/owner.html',
      '/manager.html',
      '/staff.html',
      '/qr-manager.html',
      '/receipt.html',
    ];
    for (const surface of surfaces) {
      const res = await fetch(`${baseUrl}${surface}`);
      assert.equal(res.status, 200, `Expected 200 OK for ${surface}`);
      const text = await res.text();
      assert.ok(text.includes('Abiruchi Hotel'), `Expected Abiruchi Hotel branding in ${surface}`);
    }
  });
});
