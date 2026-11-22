import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderApp } from '../../services/order-service/src/server.ts';
import type { AddressInfo } from 'node:net';

test('Surface Routes & Static Assets Verification', async (t) => {
  const server = createOrderApp();

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  t.after(() => {
    server.close();
  });

  const routes = [
    '/',
    '/guest/styles.css',
    '/guest/app.js',
    '/guest/dish-photos.js',
    '/guest/router.js',
    '/receipt',
    '/booking',
    '/manifest.json',
    '/owner',
    '/owner.html',
    '/owner/tokens',
    '/owner/orders',
    '/owner/menu',
    '/owner/inventory',
    '/owner/availability',
    '/owner/payments',
    '/owner/bookings',
    '/owner/settings',
    '/owner/specials',
    '/owner/offers',
    '/owner/beverages',
    '/owner/staff',
    '/qr-manager.html',
    '/owner/dish-photos.js',
    '/owner/shared.js',
    '/staff.html',
    '/staff/waiter-voice.js',
    '/staff/shared.js',
    '/staff/confirm',
    '/staff/requests',
    '/staff/tickets',
    '/staff/tokens',
    '/waiter',
    '/admin',
    '/kitchen',
    '/marketing',
    '/pricing',
    '/for-restaurants',
    '/for-cafes',
    '/for-bars',
    '/owner/',
    '/kitchen/',
    '/waiter/',
    '/admin/',
    '/marketing/',
    '/menu',
    '/cart',
    '/orders',
    '/inventory',
    '/bookings',
    '/table/14',
    '/api/v1/menu',
    '/api/v1/payments/config',
    '/api/v1/outlets',
    '/api/v1/tables/calls/pending',
    '/api/v1/tokens/active',
  ];

  for (const r of routes) {
    await t.test(`GET ${r} returns 200 OK`, async () => {
      const res = await fetch(`${baseUrl}${r}`);
      assert.equal(res.status, 200, `Expected 200 for ${r}, got ${res.status}`);
      const text = await res.text();
      assert.ok(text.length > 0, `Expected non-empty body for ${r}`);
    });
  }

  await t.test('GET /unknown-route returns 404 HTML Page for browser navigation', async () => {
    const res = await fetch(`${baseUrl}/some-missing-page`, {
      headers: { 'Accept': 'text/html,application/xhtml+xml' }
    });
    assert.equal(res.status, 404);
    assert.ok(res.headers.get('content-type')?.includes('text/html'));
    const html = await res.text();
    assert.ok(html.includes('404'));
    assert.ok(html.includes('Page Not Found'));
    assert.ok(html.includes('Guest Digital Menu'));
  });
});
