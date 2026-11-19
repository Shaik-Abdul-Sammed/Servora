import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderApp } from '../../services/order-service/src/server.ts';
import type { AddressInfo } from 'node:net';

test('QA Phase 6: KDS Station Routing & Mixed Order Ticket Splitting', async (suite) => {
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

  // 1. Create a dedicated Coffee item explicitly configured for station COFFEE
  let coffeeItemId = '';
  await suite.test('Step 1: Setup menu items across 5 distinct preparation stations', async () => {
    const res = await fetch(`${baseUrl}/api/v1/menu/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId: OUTLET_ID,
        categoryId: 'd0000000-0000-0000-0000-000000000004',
        name: 'Single Origin Espresso Romano',
        description: 'Double extraction espresso with candied lemon peel',
        basePriceCents: 450,
        dietaryType: 'VEG',
        station: 'COFFEE',
      }),
    });
    assert.equal(res.status, 201);
    const item = await res.json();
    coffeeItemId = item.id;
  });

  // 2. Submit Mixed Order with 5 items spanning all 5 stations
  let mixedOrderId = '';
  await suite.test('Step 2: Submit a 5-item mixed order spanning all preparation stations', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId: OUTLET_ID,
        tableId: 'c0000000-0000-0000-0000-000000000001',
        tableNumber: 'T-01',
        items: [
          { menuItemId: 'e0000000-0000-0000-0000-000000000002', quantity: 1, course: 'MAIN' }, // Margherita -> PIZZA_OVEN
          { menuItemId: 'e0000000-0000-0000-0000-000000000001', quantity: 1, course: 'STARTER' }, // Burrata -> COLD_PREP
          { menuItemId: 'e0000000-0000-0000-0000-000000000004', quantity: 1, course: 'MAIN' }, // Tagliolini -> HOT_LINE
          { menuItemId: 'e0000000-0000-0000-0000-000000000005', quantity: 1, course: 'BEVERAGE' }, // Blood Orange Spritz -> BAR
          { menuItemId: coffeeItemId, quantity: 1, course: 'DESSERT' }, // Espresso -> COFFEE
        ],
        paymentMethod: 'UPI',
      }),
    });
    assert.equal(res.status, 201);
    const order = await res.json();
    assert.ok(order.id);
    assert.equal(order.items.length, 5);
    mixedOrderId = order.id;
  });

  // 3. Verify Station Ticket Splitting
  await suite.test('Step 3: Verify order splits into 5 station tickets retaining parent order ID', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders/${mixedOrderId}/station-tickets`);
    assert.equal(res.status, 200);
    const data = await res.json();
    const tickets = data.tickets || data;
    assert.equal(tickets.length, 5, 'Expected exactly 5 station tickets');

    const stations = tickets.map((t: any) => t.station);
    assert.ok(stations.includes('PIZZA_OVEN'), 'Expected PIZZA_OVEN ticket');
    assert.ok(stations.includes('COLD_PREP'), 'Expected COLD_PREP ticket');
    assert.ok(stations.includes('HOT_LINE'), 'Expected HOT_LINE ticket');
    assert.ok(stations.includes('BAR'), 'Expected BAR ticket');
    assert.ok(stations.includes('COFFEE'), 'Expected COFFEE ticket');

    for (const ticket of tickets) {
      assert.equal(ticket.orderId, mixedOrderId, 'All tickets must retain parent order ID');
      assert.equal(ticket.tableNumber, 'T-01');
      assert.ok(ticket.items.length >= 1);
    }
  });

  // 4. Test KDS Station Ticket Recall & Status Progression
  await suite.test('Step 4: Update order status to PREPARING and READY on KDS', async () => {
    const prepRes = await fetch(`${baseUrl}/api/v1/kds/orders/${mixedOrderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PREPARING' }),
    });
    assert.equal(prepRes.status, 200);

    const readyRes = await fetch(`${baseUrl}/api/v1/kds/orders/${mixedOrderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'READY' }),
    });
    assert.equal(readyRes.status, 200);

    // Verify guest live status tracking stepper reflects READY
    const statusRes = await fetch(`${baseUrl}/api/v1/orders/${mixedOrderId}/status-live`);
    assert.equal(statusRes.status, 200);
    const live = await statusRes.json();
    assert.equal(live.status, 'READY');
  });

  // 5. Test Recall feature
  await suite.test('Step 5: KDS order recall reverts or audits ticket recall request', async () => {
    const recallRes = await fetch(`${baseUrl}/api/v1/kds/orders/${mixedOrderId}/recall`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Kitchen mistake, refiring pasta' }),
    });
    assert.equal(recallRes.status, 200);
    const recalled = await recallRes.json();
    assert.ok(recalled.success);
    assert.ok(recalled.order);
  });
});
