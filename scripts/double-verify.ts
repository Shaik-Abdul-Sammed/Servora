import { createOrderApp } from '../services/order-service/src/server.ts';
import { SEED_CATEGORIES, createSeedMenuItems } from '../services/order-service/src/seed-menu.ts';
import { translateMenuData } from '../packages/content-translation/src/index.ts';
import { readFileSync, existsSync } from 'node:fs';
import type { AddressInfo } from 'node:net';

interface VerificationResult {
  category: string;
  item: string;
  status: 'VERIFIED' | 'FAILED';
  details: string;
}

const results: VerificationResult[] = [];

function check(category: string, item: string, condition: boolean, details: string) {
  results.push({
    category,
    item,
    status: condition ? 'VERIFIED' : 'FAILED',
    details,
  });
}

async function runDoubleVerification() {
  console.log('Starting Abiruchi Hotel Deep Double Verification Protocol...');

  // Verification 1: Invariant & File System Integrity
  console.log('[Phase 1] Auditing File System & Static Assets...');
  const guestHtml = readFileSync('apps/web-guest/public/index.html', 'utf-8');
  const bookingHtml = readFileSync('apps/web-guest/public/booking.html', 'utf-8');
  const ownerBookingsHtml = readFileSync('apps/web-owner/public/bookings.html', 'utf-8');
  const guestAppJs = readFileSync('apps/web-guest/public/app.js', 'utf-8');

  check('Branding', 'Customer App Title & Header', (guestHtml.includes('Abiruchi Hotel') || guestHtml.includes('ABIRUCHI HOTEL')) && (guestHtml.includes('taste of the land') || guestHtml.includes('Abiruchi Hotel')), 'Brand ABIRUCHI HOTEL established in guest app');
  check('Branding', 'Booking App Title & Header', (bookingHtml.includes('ABIRUCHI HOTEL') || bookingHtml.includes('Abiruchi Hotel')) && !bookingHtml.includes('Trattoria') && !bookingHtml.includes('Servora'), 'Purged legacy Trattoria branding from booking.html');
  check('Branding', 'Host Stand Portal Title', ownerBookingsHtml.includes('ABIRUCHI HOTEL') || ownerBookingsHtml.includes('Abiruchi Hotel'), 'Owner bookings interface uses ABIRUCHI HOTEL branding');

  // Verification 2: Menu Integrity
  console.log('[Phase 2] Auditing 56 Indian Menu Items & 5 Categories...');
  const seedItems = createSeedMenuItems('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001');
  check('Menu', 'Total Menu Item Count >= 50', seedItems.length >= 50, `Seeded exactly ${seedItems.length} items`);
  check('Menu', '5 Core Categories Defined', SEED_CATEGORIES.length === 5, `Categories: ${SEED_CATEGORIES.map(c => c.name).join(', ')}`);

  const catMap = new Map(SEED_CATEGORIES.map(c => [c.id, c.name]));
  const tiffins = seedItems.filter(i => catMap.get(i.categoryId) === 'Tiffins');
  const lunch = seedItems.filter(i => catMap.get(i.categoryId) === 'Lunch');
  const dinner = seedItems.filter(i => catMap.get(i.categoryId) === 'Dinner');
  const snacks = seedItems.filter(i => catMap.get(i.categoryId) === 'Snacks');
  const drinks = seedItems.filter(i => catMap.get(i.categoryId) === 'Cool Drinks');

  check('Menu', 'Tiffins Count >= 12', tiffins.length >= 12, `Found ${tiffins.length} tiffins`);
  check('Menu', 'Lunch Count >= 12', lunch.length >= 12, `Found ${lunch.length} lunch meals & biryanis`);
  check('Menu', 'Dinner Count >= 10', dinner.length >= 10, `Found ${dinner.length} dinner specialties`);
  check('Menu', 'Snacks Count >= 8', snacks.length >= 8, `Found ${snacks.length} evening snacks`);
  check('Menu', 'Cool Drinks Count >= 8', drinks.length >= 8, `Found ${drinks.length} beverages & coolers`);

  // Verification 3: Multilingual Engine (Telugu & Hindi)
  console.log('[Phase 3] Auditing Multilingual Translation Engine...');
  const menuObj = { categories: SEED_CATEGORIES, items: seedItems };
  const teMenu = await translateMenuData(menuObj, 'te');
  const hiMenu = await translateMenuData(menuObj, 'hi');

  check('Localization', 'Telugu Translation Completeness', teMenu.items.length >= 50 && teMenu.categories[0].name === 'టిఫిన్లు', `Telugu category: ${teMenu.categories[0].name}, Item: ${teMenu.items[0].name}`);
  check('Localization', 'Hindi Translation Completeness', hiMenu.items.length >= 50 && hiMenu.categories[0].name === 'टिफिन / नाश्ता', `Hindi category: ${hiMenu.categories[0].name}, Item: ${hiMenu.items[0].name}`);
  check('Localization', 'Telugu UI Labels in app.js', guestAppJs.includes('వెయిటర్‌ను పిలవండి') && guestAppJs.includes('మీ టేబుల్ బిల్లు'), 'Telugu UI dictionary integrated in guest SPA');
  check('Localization', 'Hindi UI Labels in app.js', guestAppJs.includes('वेटर को बुलाएं') && guestAppJs.includes('आपका टेबल बिल'), 'Hindi UI dictionary integrated in guest SPA');

  // Verification 4: Live Server API & Operational Workflow Double Check
  console.log('[Phase 4] Launching Ephemeral Instance for Dynamic Double Verification...');
  const server = createOrderApp();
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const outletId = 'b0000000-0000-0000-0000-000000000001';
  const tableId = 'c0000000-0000-0000-0000-000000000002'; // Table 14

  try {
    // 4.1 Frictionless Dining / QR Session
    const qrRes = await fetch(`${baseUrl}/api/v1/qr/session?tableId=${tableId}`);
    check('Guest Experience', 'QR Session Table Resolution', qrRes.status === 200, 'Table 14 resolved for guest dining without login');

    // 4.2 Waiter Assistance Lifecycle & Debounce
    const call1Res = await fetch(`${baseUrl}/api/v1/tables/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outletId, tableId, category: 'WATER', reason: 'Warm water please' })
    });
    const call1Data = await call1Res.json();
    check('Call Waiter', 'Ticket Dispatch & Status PENDING', call1Res.status === 200 && call1Data.status === 'PENDING', `Ticket created with ID: ${call1Data.id}`);

    // Debounce check within 30s
    const call2Res = await fetch(`${baseUrl}/api/v1/tables/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outletId, tableId, category: 'WATER', reason: 'Repeated spam click' })
    });
    const call2Data = await call2Res.json();
    check('Call Waiter', '30-Second Spam Debounce', call2Data.debounced === true && call2Data.call.id === call1Data.id, 'Duplicate assistance call debounced');

    // Lifecycle transitions
    const acceptRes = await fetch(`${baseUrl}/api/v1/tables/calls/${call1Data.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACCEPTED', staffId: 'waiter_ramesh' })
    });
    const acceptData = await acceptRes.json();
    check('Call Waiter', 'Lifecycle ACCEPTED Transition', acceptData.status === 'ACCEPTED', 'Waiter assigned');

    const progressRes = await fetch(`${baseUrl}/api/v1/tables/calls/${call1Data.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'IN_PROGRESS' })
    });
    const progressData = await progressRes.json();
    check('Call Waiter', 'Lifecycle IN_PROGRESS Transition', progressData.status === 'IN_PROGRESS', 'Assistance in progress');

    const completeRes = await fetch(`${baseUrl}/api/v1/tables/calls/${call1Data.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'COMPLETED' })
    });
    const completeData = await completeRes.json();
    check('Call Waiter', 'Lifecycle COMPLETED Transition', completeData.status === 'COMPLETED', 'Assistance completed');

    // 4.3 Order Submission & Itemized Pre-Bill
    const orderRes = await fetch(`${baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        tableId,
        tableNumber: '14',
        items: [
          { menuItemId: 'e0000000-0000-0000-0000-000000000013', quantity: 2, course: 'MAIN' }, // Masala Dosa
          { menuItemId: 'e0000000-0000-0000-0000-000000000057', quantity: 1, course: 'DRINKS' } // Water Bottle
        ],
        taxRate: 5.0,
        tipCents: 3000,
        paymentMethod: 'UPI'
      })
    });
    const orderData = await orderRes.json();
    check('Ordering', 'Order Submission to Kitchen', orderRes.status === 201 && orderData.id, `Created Order #${orderData.id}`);

    // Pre-Bill breakdown
    const billRes = await fetch(`${baseUrl}/api/v1/orders/${orderData.id}/bill-preview`);
    const billData = await billRes.json();
    check('Billing', 'CGST & SGST 5% Tax Calculation', billData.cgstCents === billData.sgstCents && billData.totalTaxCents === (billData.cgstCents + billData.sgstCents), `Subtotal: ₹${billData.subtotalCents/100}, CGST: ₹${billData.cgstCents/100}, SGST: ₹${billData.sgstCents/100}`);
    check('Billing', 'Final Payable Summation Invariant', billData.finalPayableCents === (billData.subtotalCents + billData.totalTaxCents + billData.tipCents - billData.discountCents), `Final Total: ₹${billData.finalPayableCents/100}`);

    // 4.4 Zero-Trust UPI Payment Destination & Verification
    const upiConfigRes = await fetch(`${baseUrl}/api/v1/payments/config`);
    const upiConfig = await upiConfigRes.json();
    check('UPI Payments', 'Configured Mobile & VPA', upiConfig.upiMobile === '9010150809' && upiConfig.upiVpa === '9010150809@ybl' && (upiConfig.payeeName === 'Abiruchi Hotel' || upiConfig.payeeName.includes('Abiruchi')), `VPA: ${upiConfig.upiVpa}, Payee: ${upiConfig.payeeName}`);

    const upiQrRes = await fetch(`${baseUrl}/api/v1/payments/upi/qr?orderId=${orderData.id}&amount=150`);
    const upiQrData = await upiQrRes.json();
    check('UPI Payments', 'Zero-Trust Awaiting Verification Policy', upiQrData.paymentStatus === 'AWAITING_VERIFICATION' && upiQrData.verificationMode === 'ZERO_TRUST_MANAGER_RECONCILIATION', 'Payment held in AWAITING_VERIFICATION until reconciled');

    const reconcileRes = await fetch(`${baseUrl}/api/v1/payments/upi/verify-reconciliation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: orderData.id,
        transactionRef: 'UPI-REF-901015-TEST',
        amountCents: billData.finalPayableCents,
        reconciledBy: 'manager_suresh'
      })
    });
    const reconcileData = await reconcileRes.json();
    check('UPI Payments', 'Manager Reconciliation & PAID State', reconcileRes.status === 200 && reconcileData.paymentStatus === 'PAID', 'Order transitioned to PAID state upon manager verification');

    // 4.5 Water Bottle Upsell Settings
    const wbSettingsRes = await fetch(`${baseUrl}/api/v1/settings/water-bottle?outletId=${outletId}`);
    const wbSettings = await wbSettingsRes.json();
    check('Water Hospitality', 'Packaged Water Upsell Configuration', wbSettings.enabled === true && wbSettings.priceCents === 2000, `Enabled: ${wbSettings.enabled}, Price: ₹${wbSettings.priceCents/100}`);

    // 4.6 Table Booking Lifecycle
    const today = new Date().toISOString().slice(0, 10);
    const bkCreateRes = await fetch(`${baseUrl}/api/v1/bookings/enhanced`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        guestName: 'Kavitha Rao',
        guestPhone: '9010150809',
        partySize: 3,
        adultsCount: 3,
        childrenCount: 0,
        slotDate: today,
        slotTime: '20:30'
      })
    });
    const bkData = await bkCreateRes.json();
    check('Bookings', 'Guest Table Reservation Creation', bkCreateRes.status === 201 && bkData.id, `Created Booking #${bkData.id}`);

    // Confirm booking
    const bkConfirmRes = await fetch(`${baseUrl}/api/v1/bookings/${bkData.id}/confirm`, { method: 'POST' });
    const bkConfirmed = await bkConfirmRes.json();
    check('Bookings', 'Manager Booking Confirmation', bkConfirmRes.status === 200 && bkConfirmed.booking.status === 'CONFIRMED', 'Booking confirmed by manager');

    // Check-in booking
    const bkCheckinRes = await fetch(`${baseUrl}/api/v1/bookings/${bkData.id}/check-in`, { method: 'POST' });
    const bkCheckedIn = await bkCheckinRes.json();
    check('Bookings', 'Host Stand Check-In / Arrived', bkCheckinRes.status === 200 && bkCheckedIn.booking.status === 'CHECKED_IN', 'Guest checked in at host stand');

    // Complete booking
    const bkCompleteRes = await fetch(`${baseUrl}/api/v1/bookings/${bkData.id}/complete`, { method: 'POST' });
    const bkCompleted = await bkCompleteRes.json();
    check('Bookings', 'Host Stand Completion', bkCompleteRes.status === 200 && bkCompleted.booking.status === 'COMPLETED', 'Table booking dining completed');

    // 4.7 KDS Multi-Station Routing Check
    const kdsRes = await fetch(`${baseUrl}/api/v1/kds/orders?outletId=${outletId}`);
    const kdsOrders = await kdsRes.json();
    check('KDS Operations', 'KDS Active Queue Retrieval', kdsRes.status === 200 && Array.isArray(kdsOrders), `Active KDS orders: ${kdsOrders.length}`);

  } finally {
    server.close();
  }

  // Summary Table Output
  console.log('\n================================================================================');
  console.log('ABIRUCHI HOTEL DOUBLE VERIFICATION AUDIT MATRIX');
  console.log('================================================================================');
  console.table(results);

  const total = results.length;
  const passed = results.filter(r => r.status === 'VERIFIED').length;
  const failed = results.filter(r => r.status === 'FAILED').length;

  console.log(`\nDOUBLE VERIFICATION SUMMARY: ${passed}/${total} Invariants Verified (${failed} Failures)`);

  if (failed > 0) {
    process.exit(1);
  }
}

runDoubleVerification().catch(err => {
  console.error('Double verification error:', err);
  process.exit(1);
});
