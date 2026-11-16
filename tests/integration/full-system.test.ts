import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderApp } from '../../services/order-service/src/server.ts';
import type { AddressInfo } from 'node:net';

test('Full Multi-Persona System & AI Integration', async (t) => {
  const server = createOrderApp();

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  t.after(() => {
    server.close();
  });

  await t.test('GET /owner serves Venue Operator Dashboard', async () => {
    const res = await fetch(`${baseUrl}/owner`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Operator Portal/);
    assert.match(html, /Floor Plan/);
  });

  await t.test('GET /admin serves Super-Admin Platform Console', async () => {
    const res = await fetch(`${baseUrl}/admin`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Super-Admin/);
    assert.match(html, /Trattoria Servora/);
  });

  await t.test('GET /waiter serves Floor Waitstaff Terminal', async () => {
    const res = await fetch(`${baseUrl}/waiter`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Waitstaff Terminal/);
    assert.match(html, /Live Guest Table Requests/);
  });

  await t.test('GET /manifest.json serves valid PWA App Manifest', async () => {
    const res = await fetch(`${baseUrl}/manifest.json`);
    assert.equal(res.status, 200);
    const manifest = await res.json();
    assert.equal(manifest.short_name, 'Servora');
    assert.equal(manifest.display, 'standalone');
  });

  await t.test('POST /api/v1/tables/call broadcasts table request to waitstaff', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tables/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableNumber: 'T-02',
        reason: 'Bring Water',
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
  });

  await t.test('POST /api/v1/ai/concierge responds to multilingual queries', async () => {
    const res = await fetch(`${baseUrl}/api/v1/ai/concierge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'What is dairy free?',
        locale: 'en',
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.safeDishes.length > 0);
  });

  await t.test('GET /api/v1/ai/inventory/forecast predicts 86 item depletion', async () => {
    const res = await fetch(`${baseUrl}/api/v1/ai/inventory/forecast`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.length >= 3);
    assert.ok(data.some((d: { ingredient: string }) => d.ingredient.includes('Mozzarella')));
  });
});
