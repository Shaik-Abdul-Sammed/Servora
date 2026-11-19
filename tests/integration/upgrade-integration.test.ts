import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderApp } from '../../services/order-service/src/server.ts';
import type { AddressInfo } from 'node:net';

test('Abiruchi Hotel Upgrade Features Integration HTTP API Test Suite', async (t) => {
  const server = createOrderApp();

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const outletId = 'b0000000-0000-0000-0000-000000000001';

  t.after(() => {
    server.close();
  });

  let createdBeverageId = '';
  let createdSpecialId = '';
  let createdOfferId = '';
  let createdBookingId = '';

  await t.test('Integration: POST /api/v1/beverages & GET /api/v1/beverages', async () => {
    const postRes = await fetch(`${baseUrl}/api/v1/beverages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        name: 'Fresh Mint Lemonade',
        category: 'JUICE',
        priceCents: 450,
        stock: 50,
        sizeOptions: ['Regular', 'Large'],
      }),
    });
    assert.equal(postRes.status, 201);
    const created = await postRes.json();
    assert.ok(created.id);
    assert.equal(created.name, 'Fresh Mint Lemonade');
    createdBeverageId = created.id;

    const getRes = await fetch(`${baseUrl}/api/v1/beverages?outletId=${outletId}`);
    assert.equal(getRes.status, 200);
    const list = await getRes.json();
    assert.ok(Array.isArray(list));
    assert.ok(list.some((b: any) => b.id === createdBeverageId));

    // PATCH beverage
    const patchRes = await fetch(`${baseUrl}/api/v1/beverages/${createdBeverageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceCents: 500, stock: 45 }),
    });
    assert.equal(patchRes.status, 200);
  });

  await t.test('Integration: POST & GET /api/v1/guest/water-preference', async () => {
    const postRes = await fetch(`${baseUrl}/api/v1/guest/water-preference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId: 't-test-water', preference: 'COMPLIMENTARY' }),
    });
    assert.equal(postRes.status, 200);
    const postData = await postRes.json();
    assert.equal(postData.preference, 'COMPLIMENTARY');
    assert.match(postData.note, /No items added automatically/);

    const getRes = await fetch(`${baseUrl}/api/v1/guest/water-preference/t-test-water`);
    assert.equal(getRes.status, 200);
    const getData = await getRes.json();
    assert.equal(getData.preference, 'COMPLIMENTARY');
  });

  await t.test('Integration: Today Specials CRUD lifecycle', async () => {
    // Create
    const postRes = await fetch(`${baseUrl}/api/v1/owner/specials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        name: 'Woodfired Truffle Pizza',
        description: 'Wild mushrooms, fresh mozzarella, truffle oil',
        basePriceCents: 2400,
        discountPriceCents: 1999,
        limitedQty: 20,
        tags: ['CHEF_CHOICE', 'HAPPY_HOUR'],
      }),
    });
    assert.equal(postRes.status, 201);
    const created = await postRes.json();
    assert.ok(created.id);
    createdSpecialId = created.id;

    // List active
    const getRes = await fetch(`${baseUrl}/api/v1/specials?outletId=${outletId}`);
    assert.equal(getRes.status, 200);
    const specials = await getRes.json();
    assert.ok(specials.some((s: any) => s.id === createdSpecialId));

    // Patch
    const patchRes = await fetch(`${baseUrl}/api/v1/owner/specials/${createdSpecialId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discountPriceCents: 1850 }),
    });
    assert.equal(patchRes.status, 200);

    // Delete
    const delRes = await fetch(`${baseUrl}/api/v1/owner/specials/${createdSpecialId}`, {
      method: 'DELETE',
    });
    assert.equal(delRes.status, 200);
  });

  await t.test('Integration: Offers & Best Offer calculation', async () => {
    // Create Offer
    const postRes = await fetch(`${baseUrl}/api/v1/owner/offers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        type: 'PERCENT_DISCOUNT',
        name: '15% Off Family Meal',
        discountPercent: 15,
        minOrderCents: 3000,
      }),
    });
    assert.equal(postRes.status, 201);
    const created = await postRes.json();
    assert.ok(created.id);
    createdOfferId = created.id;

    // Get Active Offers
    const getRes = await fetch(`${baseUrl}/api/v1/offers?outletId=${outletId}`);
    assert.equal(getRes.status, 200);
    const list = await getRes.json();
    assert.ok(list.some((o: any) => o.id === createdOfferId));

    // Calculate Best Offer via POST /api/v1/checkout/best-offer
    const calcRes = await fetch(`${baseUrl}/api/v1/checkout/best-offer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outletId, subtotalCents: 4000 }),
    });
    assert.equal(calcRes.status, 200);
    const calcData = await calcRes.json();
    assert.ok(calcData.savedCents >= 600, '15% of 4000 is 600');
    assert.equal(calcData.discountedTotalCents, 4000 - calcData.savedCents);

    // Eligible query via GET /api/v1/offers/eligible
    const eligRes = await fetch(`${baseUrl}/api/v1/offers/eligible?outletId=${outletId}&subtotal=5000`);
    assert.equal(eligRes.status, 200);
    const eligData = await eligRes.json();
    assert.ok(eligData.savedCents > 0);
  });

  await t.test('Integration: AI Grounded Recommendations & Demand Forecast', async () => {
    // AI Recommendations
    const recRes = await fetch(`${baseUrl}/api/v1/ai/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outletId, dietaryFilters: [] }),
    });
    assert.equal(recRes.status, 200);
    const recData = await recRes.json();
    assert.ok(Array.isArray(recData.recommendations));
    assert.ok(recData.disclaimer.includes('actual menu data'));

    // Demand Forecast
    const foreRes = await fetch(`${baseUrl}/api/v1/ai/forecast?outletId=${outletId}&date=2026-12-30`);
    assert.equal(foreRes.status, 200);
    const foreData = await foreRes.json();
    assert.equal(foreData.forecastDate, '2026-12-30');
    assert.ok(typeof foreData.predictedCovers === 'number');
  });

  await t.test('Integration: Enhanced Table Bookings lifecycle', async () => {
    // Enhanced booking with adults/children/dietary/seating
    const bookRes = await fetch(`${baseUrl}/api/v1/bookings/enhanced`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        guestName: 'Gwendolyn Smith',
        guestPhone: '+19876543210',
        partySize: 5,
        adultsCount: 3,
        childrenCount: 2,
        childrenAges: [5, 8],
        seatingPreference: 'PATIO',
        indoorOutdoor: 'OUTDOOR',
        highChairNeeded: true,
        occasion: 'BIRTHDAY',
        specialRequests: 'Near heater',
        slotDate: '2026-12-28',
        slotTime: '20:00',
        depositAmountCents: 2000,
      }),
    });
    assert.equal(bookRes.status, 201);
    const booking = await bookRes.json();
    assert.ok(booking.id);
    assert.equal(booking.status, 'CONFIRMED');
    assert.equal(booking.adultsCount, 3);
    assert.equal(booking.childrenCount, 2);
    createdBookingId = booking.id;

    // Check-in
    const checkInRes = await fetch(`${baseUrl}/api/v1/bookings/${createdBookingId}/check-in`, {
      method: 'POST',
    });
    assert.equal(checkInRes.status, 200);
    const checkedInData = await checkInRes.json();
    assert.equal(checkedInData.booking?.status || checkedInData.status, 'CHECKED_IN');

    // Walk-in booking
    const walkInRes = await fetch(`${baseUrl}/api/v1/bookings/walk-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outletId, partySize: 3, guestName: 'Walk-In Table 8' }),
    });
    assert.equal(walkInRes.status, 201);
    const walkInData = await walkInRes.json();
    assert.equal(walkInData.status, 'CHECKED_IN');

    // No-show workflow
    const b2Res = await fetch(`${baseUrl}/api/v1/bookings/enhanced`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        guestName: 'Will No Show',
        partySize: 2,
        slotDate: '2026-12-28',
        slotTime: '22:00',
      }),
    });
    const b2 = await b2Res.json();
    const noShowRes = await fetch(`${baseUrl}/api/v1/bookings/${b2.id}/no-show`, {
      method: 'POST',
    });
    assert.equal(noShowRes.status, 200);
    const noShowData = await noShowRes.json();
    assert.equal(noShowData.status, 'NO_SHOW');

    // Waitlist query
    const waitlistRes = await fetch(`${baseUrl}/api/v1/bookings/waitlist?outletId=${outletId}&date=2026-12-28`);
    assert.equal(waitlistRes.status, 200);
    const waitlistData = await waitlistRes.json();
    assert.ok(Array.isArray(waitlistData));
  });

  await t.test('Integration: Offer redemption log query', async () => {
    const redRes = await fetch(`${baseUrl}/api/v1/owner/offers/redemptions?outletId=${outletId}`);
    assert.equal(redRes.status, 200);
    const redData = await redRes.json();
    assert.ok(Array.isArray(redData));
  });

  await t.test('Integration: Menu Item CRUD (POST, PATCH, DELETE)', async () => {
    // 1. Create dish
    const postRes = await fetch(`${baseUrl}/api/v1/menu/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoryId: 'd0000000-0000-0000-0000-000000000001',
        name: 'Crispy Calamari Fritti',
        description: 'Tender squid rings with garlic aioli and lemon wedges',
        basePriceCents: 1850,
        dietaryType: 'NON_VEG',
        imageUrl: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=300&q=80',
        station: 'GRILL',
      }),
    });
    assert.equal(postRes.status, 201);
    const created = await postRes.json();
    assert.ok(created.id);
    assert.equal(created.name, 'Crispy Calamari Fritti');

    // 2. Patch dish
    const patchRes = await fetch(`${baseUrl}/api/v1/menu/items/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ basePriceCents: 1950, isAvailable: true }),
    });
    assert.equal(patchRes.status, 200);
    const patched = await patchRes.json();
    assert.equal(patched.basePriceCents, 1950);

    // 3. Delete dish
    const delRes = await fetch(`${baseUrl}/api/v1/menu/items/${created.id}`, {
      method: 'DELETE',
    });
    assert.equal(delRes.status, 200);
  });

  await t.test('Integration: Scheduled Food Ordering lifecycle', async () => {
    // 1. Get available slots
    const slotsRes = await fetch(`${baseUrl}/api/v1/orders/scheduled/slots?outletId=${outletId}&date=2026-12-31`);
    assert.equal(slotsRes.status, 200);
    const slotsData = await slotsRes.json();
    assert.ok(Array.isArray(slotsData.slots));
    assert.ok(slotsData.slots.length > 0);

    // 2. Schedule order
    const scheduleRes = await fetch(`${baseUrl}/api/v1/orders/scheduled`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        customerName: 'Kavya Patel',
        customerPhone: '+919988776655',
        items: [{ itemId: 'e0000000-0000-0000-0000-000000000001', name: 'Margherita Verace', quantity: 1, unitPriceCents: 1900 }],
        scheduledPickupTime: '2026-12-31T18:30:00Z',
      }),
    });
    assert.equal(scheduleRes.status, 201);
    const preOrder = await scheduleRes.json();
    assert.ok(preOrder.preOrderId);
    assert.equal(preOrder.status, 'SCHEDULED');

    // 3. Reschedule
    const reschedRes = await fetch(`${baseUrl}/api/v1/orders/scheduled/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preOrderId: preOrder.preOrderId,
        newPickupTime: '2026-12-31T19:00:00Z',
      }),
    });
    assert.equal(reschedRes.status, 200);

    // 4. Cancel
    const cancelRes = await fetch(`${baseUrl}/api/v1/orders/scheduled/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preOrderId: preOrder.preOrderId,
        reason: 'Change of plans',
      }),
    });
    assert.equal(cancelRes.status, 200);
  });

  await t.test('Integration: Dynamic UPI QR generation', async () => {
    const upiRes = await fetch(`${baseUrl}/api/v1/payments/upi/qr?amount=48000&orderId=ORD-9988`);
    assert.equal(upiRes.status, 200);
    const upiData = await upiRes.json();
    assert.equal(upiData.currency, 'INR');
    assert.equal(upiData.amountINR, '480.00');
    assert.ok(upiData.upiUri.startsWith('upi://pay'));
    assert.ok(upiData.qrPayload);
  });

  await t.test('Integration: Free Base Plan subscription & waiter limit enforcement', async () => {
    // 1. Get plan details
    const subRes = await fetch(`${baseUrl}/api/v1/owner/subscription?outletId=${outletId}`);
    assert.equal(subRes.status, 200);
    const sub = await subRes.json();
    assert.equal(sub.tier, 'FREE_BASE');
    assert.equal(sub.maxWaiters, 3);
    assert.equal(sub.isFree, true);

    // 2. Add 3 waiters successfully
    const w1 = await (await fetch(`${baseUrl}/api/v1/owner/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outletId, name: 'Suresh Kumar', role: 'WAITER', phone: '+919876500001' }),
    })).json();
    const w2 = await (await fetch(`${baseUrl}/api/v1/owner/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outletId, name: 'Pooja Reddy', role: 'WAITER', phone: '+919876500002' }),
    })).json();
    const w3 = await (await fetch(`${baseUrl}/api/v1/owner/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outletId, name: 'Rohan Verma', role: 'WAITER', phone: '+919876500003' }),
    })).json();
    assert.ok(w1.id && w2.id && w3.id);

    // 3. 4th waiter must be rejected with 403 PLAN_LIMIT_REACHED
    const w4Res = await fetch(`${baseUrl}/api/v1/owner/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outletId, name: 'Limit Breaker', role: 'WAITER', phone: '+919876500004' }),
    });
    assert.equal(w4Res.status, 403);
    const w4Err = await w4Res.json();
    assert.equal(w4Err.error, 'PLAN_LIMIT_REACHED');

    // 4. Table transfer
    const transferRes = await fetch(`${baseUrl}/api/v1/owner/staff/transfer-tables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outletId, fromStaffId: w1.id, toStaffId: w2.id, tableNumbers: ['Table 14'] }),
    });
    assert.equal(transferRes.status, 200);
  });

  await t.test('Integration: Manager QR Code Studio lifecycle', async () => {
    // 1. Generate Single QR
    const genRes = await fetch(`${baseUrl}/api/v1/owner/qrs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outletId, name: 'VIP Booth 7', type: 'TABLE', targetId: '7' }),
    });
    assert.equal(genRes.status, 201);
    const qr = await genRes.json();
    assert.ok(qr.id);
    assert.ok(qr.code);

    // 2. Generate Bulk QRs
    const bulkRes = await fetch(`${baseUrl}/api/v1/owner/qrs/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outletId, type: 'TAKEAWAY', count: 3, prefix: 'Pickup Counter' }),
    });
    assert.equal(bulkRes.status, 201);
    const bulk = await bulkRes.json();
    assert.equal(bulk.count, 3);

    // 3. List QRs
    const listRes = await fetch(`${baseUrl}/api/v1/owner/qrs?outletId=${outletId}`);
    assert.equal(listRes.status, 200);
    const list = await listRes.json();
    assert.ok(list.length >= 4);

    // 4. Track Scan
    const scanRes = await fetch(`${baseUrl}/api/v1/qr/track-scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrId: qr.id, userAgent: 'Mobile Safari 17' }),
    });
    assert.equal(scanRes.status, 200);
    const scanData = await scanRes.json();
    assert.equal(scanData.scanCount, 1);

    // 5. Revoke token
    const revokeRes = await fetch(`${baseUrl}/api/v1/owner/qrs/${qr.id}/revoke`, {
      method: 'POST',
    });
    assert.equal(revokeRes.status, 200);
  });

  await t.test('Integration: Multi-layout Receipts API', async () => {
    const seedOrderId = 'ord_demo_001';
    const recRes = await fetch(`${baseUrl}/api/v1/orders/${seedOrderId}/receipt?format=thermal58`);
    assert.equal(recRes.status, 200);
    const rec = await recRes.json();
    assert.equal(rec.format, 'thermal58');
    assert.ok(rec.receiptNumber.startsWith('REC-'));
    assert.equal(rec.restaurant.name, 'Abiruchi Hotel');
    assert.ok(rec.items.length > 0);
    assert.ok(rec.totalINR);
    assert.equal(rec.currency, 'INR');
  });
});
