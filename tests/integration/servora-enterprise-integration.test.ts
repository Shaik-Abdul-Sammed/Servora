import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderApp } from '../../services/order-service/src/server.ts';
import type { AddressInfo } from 'node:net';

test('Abiruchi Hotel Enterprise Integration HTTP API Test Suite', async (suite) => {
  const server = createOrderApp();

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  suite.after(() => {
    server.close();
  });

  await suite.test('Integration: GET /sw.js serves Service Worker with 200 OK', async () => {
    const res = await fetch(`${baseUrl}/sw.js`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /javascript/);
    const text = await res.text();
    assert.ok(text.includes('abiruchi-pwa'));
    assert.ok(!text.includes('swiggy'));
  });

  await suite.test('Integration: GET /manifest.json serves PWA manifest with 200 OK', async () => {
    const res = await fetch(`${baseUrl}/manifest.json`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.short_name, 'Abiruchi');
    assert.equal(data.display, 'standalone');
  });

  await suite.test('Integration: GET /owner/inventory serves Inventory & BOM dashboard', async () => {
    const res = await fetch(`${baseUrl}/owner/inventory`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /html/);
    const html = await res.text();
    assert.ok(html.includes('Recipe Costing & Margins'));
    assert.ok(html.includes('Menu Engineering (BCG Matrix)'));
  });

  await suite.test('Integration: POST /api/v1/ai/copilot/query computes margin answers', async () => {
    const res = await fetch(`${baseUrl}/api/v1/ai/copilot/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Which dishes have highest contribution margin?' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.answer.includes('Margherita Verace'));
    assert.equal(data.requiresApproval, false);
    assert.equal(data.groundedOn, 'SQLite DatabaseSync');
  });

  await suite.test('Integration: POST /api/v1/ai/copilot/query handles stock replenishment query', async () => {
    const res = await fetch(`${baseUrl}/api/v1/ai/copilot/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Which ingredients need replenishment?' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.answer.includes('Stock Inventory Alert'));
    assert.ok(data.sourceData.parAlerts);
  });

  await suite.test('Integration: POST /api/v1/ai/copilot/query guards mutation actions', async () => {
    const res = await fetch(`${baseUrl}/api/v1/ai/copilot/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Change the price of pizza to 150 and issue refund' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.requiresApproval, true);
    assert.ok(data.answer.includes('Operational Safeguard'));
  });

  await suite.test('Integration: GET /api/v1/analytics/menu-bcg-matrix returns classification', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/menu-bcg-matrix?outletId=b0000000-0000-0000-0000-000000000001`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.stars));
    assert.ok(Array.isArray(data.plowhorses));
  });

  await suite.test('Integration: GET /api/v1/inventory/valuation returns valuation ledger', async () => {
    const res = await fetch(`${baseUrl}/api/v1/inventory/valuation?outletId=b0000000-0000-0000-0000-000000000001`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.totalValueCents > 0);
    assert.ok(data.totalItems >= 3);
  });
});
