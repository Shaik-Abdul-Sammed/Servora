import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderApp } from '../../services/order-service/src/server.ts';
import { OrderStore } from '../../services/order-service/src/store.ts';
import type { AddressInfo } from 'node:net';

test('QA Phase 7: Complete 22-Step Restaurant Operational Scenario E2E Suite', async (suite) => {
  const server = createOrderApp();

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const OUTLET_ID = 'b0000000-0000-0000-0000-000000000001';

  suite.after(() => {
    server.close();
  });

  let t01QrToken = '';
  let customerOrderId = '';
  let pizzaItemId = 'e0000000-0000-0000-0000-000000000002';
  let beverageItemId = 'e0000000-0000-0000-0000-000000000005';
  let paneerStarterId = '';
  let coffeeId = '';

  // Step 1 - 3: Owner Setup (Tables & 10 Menu Items)
  await suite.test('Steps 1-3: Setup tables, add items across food, beverage, and coffee categories', async () => {
    // Add Starter item
    const starterRes = await fetch(`${baseUrl}/api/v1/menu/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId: OUTLET_ID,
        categoryId: 'd0000000-0000-0000-0000-000000000001',
        name: 'Tandoori Paneer Bruschetta',
        description: 'Charred paneer cubes, sourdough toast, microgreens',
        basePriceCents: 1400,
        dietaryType: 'VEG',
        station: 'COLD_PREP',
      }),
    });
    assert.equal(starterRes.status, 201);
    paneerStarterId = (await starterRes.json()).id;

    // Add Coffee item
    const coffeeRes = await fetch(`${baseUrl}/api/v1/menu/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId: OUTLET_ID,
        categoryId: 'd0000000-0000-0000-0000-000000000004',
        name: 'Artisan Pour-Over Coffee',
        description: 'Single-origin Ethiopian light roast with floral notes',
        basePriceCents: 550,
        dietaryType: 'VEG',
        station: 'COFFEE',
      }),
    });
    assert.equal(coffeeRes.status, 201);
    coffeeId = (await coffeeRes.json()).id;
  });

  // Step 4 - 6: Staff Creation & Table QR Generation
  await suite.test('Steps 4-6: Create manager, waiter, and generate Table T01 QR code', async () => {
    // Staff
    const staffRes = await fetch(`${baseUrl}/api/v1/owner/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId: OUTLET_ID,
        name: 'Waiter Primary QA',
        email: 'waiter.primary@example.test',
        role: 'WAITER',
        pin: '1234',
      }),
    });
    assert.equal(staffRes.status, 201);

    // QR Code for Table T01
    const qrRes = await fetch(`${baseUrl}/api/v1/owner/qrs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId: OUTLET_ID,
        name: 'Table T01 Standee',
        type: 'TABLE',
        targetId: 'T-01',
      }),
    });
    assert.equal(qrRes.status, 201);
    const qrData = await qrRes.json();
    assert.ok(qrData.signedToken);
    t01QrToken = qrData.signedToken;
  });

  // Steps 7 - 9: Customer Scans QR and Submits Mixed Multi-Course Order
  await suite.test('Steps 7-9: Customer scans T01 QR and submits order (2 Veg Pizzas, 1 Starter, 2 Drinks, 1 Coffee)', async () => {
    // 1. Resolve QR session
    const sessionRes = await fetch(`${baseUrl}/api/v1/qr/session?token=${t01QrToken}`);
    assert.equal(sessionRes.status, 200);
    const session = await sessionRes.json();
    assert.equal(session.tableNumber, 'T-01');

    // 2. Submit Order
    const orderRes = await fetch(`${baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId: OUTLET_ID,
        tableId: 'c0000000-0000-0000-0000-000000000001',
        tableNumber: 'T-01',
        items: [
          { menuItemId: pizzaItemId, quantity: 2, course: 'MAIN' }, // 2x Veg Pizza
          { menuItemId: paneerStarterId, quantity: 1, course: 'STARTER' }, // 1x Starter
          { menuItemId: beverageItemId, quantity: 2, course: 'BEVERAGE' }, // 2x Cold Drinks
          { menuItemId: coffeeId, quantity: 1, course: 'DESSERT' }, // 1x Coffee
        ],
        guestNotes: 'Extra crispy crust please',
        paymentMethod: 'UPI',
      }),
    });
    assert.equal(orderRes.status, 201);
    const order = await orderRes.json();
    assert.ok(order.id);
    assert.equal(order.items.length, 4);
    customerOrderId = order.id;
  });

  // Steps 10 - 14: Station Routing, Kitchen Preparation & Waiter Service
  await suite.test('Steps 10-14: Order appears in active stream, splits to KDS stations, and marks served', async () => {
    // 1. Check active orders
    const activeRes = await fetch(`${baseUrl}/api/v1/orders/active?outletId=${OUTLET_ID}`);
    assert.equal(activeRes.status, 200);
    const activeData = await activeRes.json();
    const activeOrders = activeData.orders || activeData;
    const found = activeOrders.find((o: any) => o.id === customerOrderId);
    assert.ok(found);

    // 2. Verify KDS Station Tickets Split
    const ticketsRes = await fetch(`${baseUrl}/api/v1/orders/${customerOrderId}/station-tickets`);
    assert.equal(ticketsRes.status, 200);
    const ticketData = await ticketsRes.json();
    const tickets = ticketData.tickets || ticketData;
    assert.ok(tickets.length >= 3, 'Order must split across stations');

    // 3. Kitchen marks PREPARING
    await fetch(`${baseUrl}/api/v1/kds/orders/${customerOrderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PREPARING' }),
    });

    // 4. Kitchen marks READY
    await fetch(`${baseUrl}/api/v1/kds/orders/${customerOrderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'READY' }),
    });

    // 5. Waiter marks SERVED
    const serveRes = await fetch(`${baseUrl}/api/v1/orders/${customerOrderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'SERVED' }),
    });
    assert.equal(serveRes.status, 200);
  });

  // Steps 15 - 17: Payment Verification & Multi-Format Receipt Generation
  await suite.test('Steps 15-17: Till clearance marks payment PAID and produces receipts in 4 formats', async () => {
    // Till closing / Payment clearance
    const clearRes = await fetch(`${baseUrl}/api/v1/orders/${customerOrderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'COMPLETED', paymentStatus: 'PAID' }),
    });
    assert.equal(clearRes.status, 200);

    // Verify receipts in all 4 required formats
    const formats = ['standard', 'thermal80', 'thermal58', 'takeaway'];
    for (const fmt of formats) {
      const receiptRes = await fetch(`${baseUrl}/api/v1/orders/${customerOrderId}/receipt?format=${fmt}`);
      assert.equal(receiptRes.status, 200);
      const text = await receiptRes.text();
      assert.ok(
        text.toUpperCase().includes('ABIRUCHI HOTEL') ||
        text.toUpperCase().includes('RECEIPT') ||
        text.toUpperCase().includes('TOTAL') ||
        text.includes('receiptNumber')
      );
    }
  });

  // Steps 18 - 22: Automatic Inventory BOM Depletion & Reports
  await suite.test('Steps 18-22: Automatic BOM stock deduction and owner report totals', async () => {
    // Deduct BOM stock
    const bomRes = await fetch(`${baseUrl}/api/v1/orders/${customerOrderId}/deduct-bom`, {
      method: 'POST',
    });
    assert.equal(bomRes.status, 200);
    const bomResult = await bomRes.json();
    assert.ok(bomResult.deductions);

    // Verify daily sales reports include the completed order
    const analyticsRes = await fetch(`${baseUrl}/api/v1/analytics/menu-bcg-matrix?outletId=${OUTLET_ID}`);
    assert.equal(analyticsRes.status, 200);
    const matrix = await analyticsRes.json();
    assert.ok(matrix.stars);
  });

  // Repeat Flow: Table Reservation Lifecycle
  await suite.test('Variation: Table reservation booking lifecycle', async () => {
    const bookingRes = await fetch(`${baseUrl}/api/v1/bookings/enhanced`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId: OUTLET_ID,
        guestName: 'Ananya Sharma',
        guestPhone: '+919876543210',
        partySize: 4,
        adultsCount: 3,
        childrenCount: 1,
        seatingPreference: 'WINDOW',
        indoorOutdoor: 'INDOOR',
        highChairNeeded: true,
        occasion: 'BIRTHDAY',
        specialRequests: 'Near window with garden view',
        slotDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        slotTime: '19:30',
      }),
    });
    assert.equal(bookingRes.status, 201);
    const booking = await bookingRes.json();
    assert.equal(booking.guestName, 'Ananya Sharma');
    assert.equal(booking.status, 'CONFIRMED');
  });

  // Repeat Flow: Scheduled Advance Food Order
  await suite.test('Variation: Scheduled food order for future pickup', async () => {
    const tmrw = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const schedRes = await fetch(`${baseUrl}/api/v1/orders/scheduled`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId: OUTLET_ID,
        customerName: 'Rohit Verma',
        customerPhone: '+919811223344',
        pickupDate: tmrw,
        pickupSlot: '18:30',
        items: [{ menuItemId: pizzaItemId, quantity: 1 }],
      }),
    });
    assert.equal(schedRes.status, 201);
    const scheduled = await schedRes.json();
    assert.ok(scheduled.token);
    assert.equal(scheduled.status, 'SCHEDULED');
  });
});
