import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { createOrderApp } from '../../services/order-service/src/server.ts';
import { getAutoDishPhoto, AUTHENTIC_DISH_PHOTOS, MULTILINGUAL_DISH_ALIASES } from '../../packages/utils/src/dish-photo-matcher.ts';

test('Manager GST & Pricing Controls & Fast Menu Loading Test Suite', async (t) => {
  const server = createOrderApp();

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  t.after(() => {
    server.close();
  });

  const tenantId = 'a0000000-0000-0000-0000-000000000001';
  const outletId = 'b0000000-0000-0000-0000-000000000001';

  // --------------------------------------------------------------------------
  // 1. Manager Pricing Config GET & PATCH
  // --------------------------------------------------------------------------
  await t.test('1. Manager fetches default pricing configuration', async () => {
    const res = await fetch(`${baseUrl}/api/v1/manager/pricing-config?outletId=${outletId}`);
    assert.equal(res.status, 200);
    const config = await res.json();
    assert.equal(config.gstEnabled, true);
    assert.equal(config.gstRate, 5.0);
    assert.equal(config.cgstRate, 2.5);
    assert.equal(config.sgstRate, 2.5);
    assert.ok(config.gstin);
    assert.equal(config.serviceChargeEnabled, false);
    assert.equal(config.packagingChargeCents, 0);
    assert.equal(config.surgePricingMultiplier, 1.0);
  });

  await t.test('2. Manager updates GST rate to 18%, service charge to 5%, and packaging charge to ₹15', async () => {
    const patchRes = await fetch(`${baseUrl}/api/v1/manager/pricing-config?outletId=${outletId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gstEnabled: true,
        gstRate: 18.0,
        gstin: '36AAAAA0000A1Z5',
        serviceChargeEnabled: true,
        serviceChargeRate: 5.0,
        packagingChargeCents: 1500, // ₹15.00
        surgePricingMultiplier: 1.0,
      }),
    });
    assert.equal(patchRes.status, 200);
    const updated = await patchRes.json();
    assert.equal(updated.gstRate, 18.0);
    assert.equal(updated.cgstRate, 9.0);
    assert.equal(updated.sgstRate, 9.0);
    assert.equal(updated.gstin, '36AAAAA0000A1Z5');
    assert.equal(updated.serviceChargeEnabled, true);
    assert.equal(updated.serviceChargeRate, 5.0);
    assert.equal(updated.packagingChargeCents, 1500);
    assert.equal(updated.packagingChargeINR, '15.00');
  });

  // --------------------------------------------------------------------------
  // 2. Dynamic Order Calculation with Manager's Rates
  // --------------------------------------------------------------------------
  await t.test('3. Dine-in order dynamically computes 18% GST and 5% service charge', async () => {
    // 2 x Plain Idli (₹40 x 2 = ₹80.00 = 8000 cents)
    const orderRes = await fetch(`${baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        outletId,
        tableId: 'c0000000-0000-0000-0000-000000000001',
        tableNumber: 'T-01',
        items: [
          {
            menuItemId: 'e0000000-0000-0000-0000-000000000010', // Plain Idli ₹40
            quantity: 2,
          },
        ],
      }),
    });

    assert.equal(orderRes.status, 201);
    const order = await orderRes.json();
    assert.equal(order.subtotalCents, 8000); // ₹80.00
    // 18% GST on 8000 = 1440 cents (₹14.40)
    assert.equal(order.taxCents, 1440);
    // 5% Service charge on 8000 = 400 cents (₹4.00)
    assert.equal(order.serviceChargeCents, 400);
    // Total = 8000 + 1440 + 400 = 9840 cents
    assert.equal(order.totalCents, 9840);
    assert.equal(order.gstin, '36AAAAA0000A1Z5');
  });

  await t.test('4. Takeaway order automatically includes configured ₹15 packaging charge', async () => {
    const orderRes = await fetch(`${baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        outletId,
        tableId: 'takeaway',
        tableNumber: 'Takeaway',
        isTakeaway: true,
        items: [
          {
            menuItemId: 'e0000000-0000-0000-0000-000000000010', // Plain Idli ₹40
            quantity: 1,
          },
        ],
      }),
    });

    assert.equal(orderRes.status, 201);
    const order = await orderRes.json();
    assert.equal(order.subtotalCents, 4000); // ₹40.00
    // 18% GST on 4000 = 720 cents
    assert.equal(order.taxCents, 720);
    // Packaging charge = 1500 cents (₹15.00)
    assert.equal(order.packagingChargeCents, 1500);
    // 5% Service charge on 4000 = 200 cents
    assert.equal(order.serviceChargeCents, 200);
    // Total = 4000 + 720 + 200 + 1500 = 6420 cents
    assert.equal(order.totalCents, 6420);
  });

  await t.test('5. Manager can disable GST completely (0% tax)', async () => {
    await fetch(`${baseUrl}/api/v1/manager/pricing-config?outletId=${outletId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gstEnabled: false,
        serviceChargeEnabled: false,
        packagingChargeCents: 0,
      }),
    });

    const orderRes = await fetch(`${baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        outletId,
        tableId: 'c0000000-0000-0000-0000-000000000001',
        tableNumber: 'T-02',
        items: [
          {
            menuItemId: 'e0000000-0000-0000-0000-000000000010',
            quantity: 1,
          },
        ],
      }),
    });

    assert.equal(orderRes.status, 201);
    const order = await orderRes.json();
    assert.equal(order.taxCents, 0);
    assert.equal(order.totalCents, 4000);
  });

  // --------------------------------------------------------------------------
  // 3. Manager Menu Dish Price Updates
  // --------------------------------------------------------------------------
  await t.test('6. Manager updates dish price via PATCH /api/v1/manager/menu-pricing', async () => {
    // Update Plain Idli price to ₹45 (4500 cents)
    const patchRes = await fetch(`${baseUrl}/api/v1/manager/menu-pricing?outletId=${outletId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          {
            id: 'e0000000-0000-0000-0000-000000000010',
            basePriceCents: 4500, // ₹45.00
          },
        ],
      }),
    });

    assert.equal(patchRes.status, 200);
    const result = await patchRes.json();
    assert.equal(result.success, true);
    assert.equal(result.updatedCount, 1);

    // Verify subsequent order uses updated price
    const orderRes = await fetch(`${baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        outletId,
        tableId: 'c0000000-0000-0000-0000-000000000001',
        tableNumber: 'T-03',
        items: [
          {
            menuItemId: 'e0000000-0000-0000-0000-000000000010',
            quantity: 1,
          },
        ],
      }),
    });

    assert.equal(orderRes.status, 201);
    const order = await orderRes.json();
    assert.equal(order.subtotalCents, 4500);
  });

  // --------------------------------------------------------------------------
  // 4. Dish Photo Matcher: Distinctness & Multilingual Accuracy
  // --------------------------------------------------------------------------
  await t.test('7. Vada and Samosa have distinct non-colliding authentic photography', () => {
    const vadaPhoto = getAutoDishPhoto('Vada');
    const samosaPhoto = getAutoDishPhoto('Samosa');
    assert.notEqual(vadaPhoto, samosaPhoto, 'Vada and Samosa must not share the same photo URL');
    assert.ok(vadaPhoto.includes('medu-vada') || vadaPhoto.includes('photo-1626082927389'), 'Vada photo must be authentic medu vada');
    assert.ok(samosaPhoto.includes('samosa') || samosaPhoto.includes('photo-1601050690597'), 'Samosa photo must be authentic samosa');
  });

  await t.test('8. Butter Naan and Onion Dosa have distinct non-colliding photography', () => {
    const naanPhoto = getAutoDishPhoto('Butter Naan');
    const onionDosaPhoto = getAutoDishPhoto('Onion Dosa');
    assert.notEqual(naanPhoto, onionDosaPhoto, 'Butter Naan and Onion Dosa must not share the same photo URL');
    assert.ok(onionDosaPhoto.includes('onion-dosa') || onionDosaPhoto.includes('photo-1645177628172'), 'Onion dosa must have dosa photography');
    assert.ok(naanPhoto.includes('butter-naan') || naanPhoto.includes('photo-1565557623262'), 'Butter naan must have naan photography');
  });

  await t.test('9. Malabar Parotta and Poori have distinct non-colliding photography', () => {
    const parottaPhoto = getAutoDishPhoto('Parotta');
    const pooriPhoto = getAutoDishPhoto('Poori');
    assert.notEqual(parottaPhoto, pooriPhoto, 'Parotta and Poori must not share the same photo URL');
    assert.ok(parottaPhoto.includes('malabar-parotta') || parottaPhoto.includes('photo-1606471191009'), 'Parotta must have layered flatbread photo');
    assert.ok(pooriPhoto.includes('poori') || pooriPhoto.includes('photo-1626777552726'), 'Poori must have puffed poori photo');
  });

  await t.test('10. Punugulu and Mirchi Bajji have distinct non-colliding photography', () => {
    const punuguluPhoto = getAutoDishPhoto('Punugulu');
    const mirchiBajjiPhoto = getAutoDishPhoto('Mirchi Bajji');
    assert.notEqual(punuguluPhoto, mirchiBajjiPhoto, 'Punugulu and Mirchi Bajji must not share the same photo URL');
  });

  await t.test('11. Telugu and Hindi dish names correctly map to authentic dish photos without falling back to Plain Idli', () => {
    // Telugu
    const teluguVada = getAutoDishPhoto('వడ');
    const teluguDosa = getAutoDishPhoto('మసాలా దోశ');
    const teluguBiryani = getAutoDishPhoto('చికెన్ బిర్యానీ');
    const teluguPoori = getAutoDishPhoto('పూరి');
    const teluguCoffee = getAutoDishPhoto('ఫిల్టర్ కాఫీ');

    const idliFallback = 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc';

    assert.notEqual(teluguVada, idliFallback, 'Telugu Vada must not fall back to plain idli');
    assert.ok(teluguDosa.includes('masala-dosa') || teluguDosa.includes('photo-1625398407796'), 'Telugu Masala Dosa must match masala dosa');
    assert.ok(teluguBiryani.includes('chicken-biryani') || teluguBiryani.includes('photo-1633945274405'), 'Telugu Biryani must match biryani');
    assert.ok(teluguPoori.includes('poori') || teluguPoori.includes('photo-1626777552726'), 'Telugu Poori must match poori');
    assert.ok(teluguCoffee.includes('filter-coffee') || teluguCoffee.includes('photo-1514432324607'), 'Telugu Coffee must match coffee');

    // Hindi
    const hindiVada = getAutoDishPhoto('वड़ा');
    const hindiDosa = getAutoDishPhoto('मसाला डोसा');
    const hindiBiryani = getAutoDishPhoto('चिकन बिरयानी');

    assert.notEqual(hindiVada, idliFallback, 'Hindi Vada must not fall back to plain idli');
    assert.ok(hindiDosa.includes('masala-dosa') || hindiDosa.includes('photo-1625398407796'), 'Hindi Masala Dosa must match masala dosa');
    assert.ok(hindiBiryani.includes('chicken-biryani') || hindiBiryani.includes('photo-1633945274405'), 'Hindi Biryani must match biryani');
  });

  await t.test('12. Chicken Noodles does not falsely match Chicken Biryani', () => {
    const chickenNoodlesPhoto = getAutoDishPhoto('Chicken Noodles');
    const chickenBiryaniPhoto = getAutoDishPhoto('Chicken Biryani');
    assert.notEqual(chickenNoodlesPhoto, chickenBiryaniPhoto, 'Chicken Noodles must match noodles, not biryani');
    assert.ok(chickenNoodlesPhoto.includes('chicken-noodles') || chickenNoodlesPhoto.includes('photo-1569718212165'), 'Must match stir-fry noodles');
  });

  // --------------------------------------------------------------------------
  // 5. Fast Loading Assets Verification
  // --------------------------------------------------------------------------
  await t.test('13. Guest index.html includes instant skeleton card placeholders for 0ms visual render', () => {
    const html = fs.readFileSync(path.resolve('apps/web-guest/public/index.html'), 'utf-8');
    assert.ok(html.includes('class="skeleton-card"'), 'index.html must contain skeleton cards');
    assert.ok(html.includes('skeleton-box skeleton-img'), 'index.html must have skeleton image placeholder');
    assert.ok(html.includes('id="menuContainer"'), 'index.html must contain menuContainer');
  });

  await t.test('14. Guest app.js implements loadCachedMenuImmediately and parallel startup', () => {
    const js = fs.readFileSync(path.resolve('apps/web-guest/public/app.js'), 'utf-8');
    assert.ok(js.includes('loadCachedMenuImmediately'), 'app.js must implement loadCachedMenuImmediately()');
    assert.ok(js.includes('abiruchi_cached_menu_'), 'app.js must use localStorage cached menu');
    assert.ok(js.includes('Promise.allSettled'), 'app.js must parallelize startup fetch calls to eliminate waterfalls');
    assert.ok(js.includes('decoding="async"'), 'app.js must include decoding="async" for fast image rendering');
    assert.ok(js.includes('w=360&q=75'), 'app.js must request optimized lightweight mobile thumbnails');
  });

  await t.test('15. Manager dashboard includes GST & Pricing Hub and simulated bill calculator', () => {
    const mgrHtml = fs.readFileSync(path.resolve('apps/web-owner/public/manager.html'), 'utf-8');
    assert.ok(mgrHtml.includes('id="tab-pricing"'), 'manager.html must contain tab-pricing panel');
    assert.ok(mgrHtml.includes('id="gstMasterToggle"'), 'manager.html must have GST toggle');
    assert.ok(mgrHtml.includes('id="customGstRateInput"'), 'manager.html must have GST rate input');
    assert.ok(mgrHtml.includes('id="splitCgstDisplay"'), 'manager.html must have live CGST split display');
    assert.ok(mgrHtml.includes('id="splitSgstDisplay"'), 'manager.html must have live SGST split display');
    assert.ok(mgrHtml.includes('id="packagingChargeInput"'), 'manager.html must have packaging charge input');
    assert.ok(mgrHtml.includes('id="billSimTitle"'), 'manager.html must have real-time bill preview simulator');
    assert.ok(mgrHtml.includes('id="menuPricingTable"'), 'manager.html must have quick menu item price editor');
  });
});
