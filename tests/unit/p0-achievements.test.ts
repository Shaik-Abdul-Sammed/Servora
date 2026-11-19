import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderApp } from '../../services/order-service/src/server.ts';
import { OrderStore } from '../../services/order-service/src/store.ts';
import type { AddressInfo } from 'node:net';

test('Abiruchi Hotel P0 Operational Achievements Test Suite', async (suite) => {
  const server = createOrderApp();

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const outletId = 'b0000000-0000-0000-0000-000000000001';
  const tenantId = 'a0000000-0000-0000-0000-000000000001';

  suite.after(() => {
    server.close();
  });

  // --------------------------------------------------------------------------
  // Achievement 1: Toggle item sold-out in one tap
  // --------------------------------------------------------------------------
  await suite.test('Achievement #1: 1-Tap Sold Out toggle with audit logging', async () => {
    const itemId = 'e0000000-0000-0000-0000-000000000001'; // Burrata Pugliese

    // 1. Mark Sold-Out
    const resSoldOut = await fetch(`${baseUrl}/api/v1/menu/items/${itemId}/sold-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isAvailable: false,
        actorId: 'manager_sarah',
        reason: 'Ran out of fresh burrata delivery',
      }),
    });
    assert.equal(resSoldOut.status, 200);
    const dataSoldOut = await resSoldOut.json();
    assert.equal(dataSoldOut.success, true);
    assert.equal(dataSoldOut.item.isAvailable, false);
    assert.equal(dataSoldOut.auditLog.action, 'SOLD_OUT');
    assert.equal(dataSoldOut.auditLog.actorId, 'manager_sarah');

    // 2. Verify Menu endpoint reflects unavailable state
    const menuRes = await fetch(`${baseUrl}/api/v1/menu?outletId=${outletId}`);
    const menuData = await menuRes.json();
    const itemInMenu = menuData.items.find((i: { id: string }) => i.id === itemId);
    assert.ok(itemInMenu);
    assert.equal(itemInMenu.isAvailable, false);

    // 3. 1-Tap Restock
    const resRestocked = await fetch(`${baseUrl}/api/v1/menu/items/${itemId}/sold-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isAvailable: true,
        actorId: 'chef_marco',
        reason: 'Emergency dairy restock received',
      }),
    });
    assert.equal(resRestocked.status, 200);
    const dataRestocked = await resRestocked.json();
    assert.equal(dataRestocked.item.isAvailable, true);
    assert.equal(dataRestocked.auditLog.action, 'RESTOCKED');
  });

  // --------------------------------------------------------------------------
  // Achievement 3: Schedule menu by time of day (dayparts)
  // --------------------------------------------------------------------------
  await suite.test('Achievement #3: Schedule menu by time of day (dayparts)', async () => {
    // Pizzas are scheduled between 11:30 and 23:00; Beverages are 00:00 to 23:59
    // Query menu at 08:00 AM (breakfast/off-hours for pizza)
    const resEarly = await fetch(`${baseUrl}/api/v1/menu?outletId=${outletId}&time=08:00`);
    assert.equal(resEarly.status, 200);
    const earlyMenu = await resEarly.json();

    const pizzaCatEarly = earlyMenu.categories.find((c: { name: string }) => c.name.includes('Pizzas'));
    assert.equal(pizzaCatEarly, undefined); // Pizza category is hidden at 08:00

    const beverageCatEarly = earlyMenu.categories.find((c: { name: string }) => c.name.includes('Beverages'));
    assert.ok(beverageCatEarly); // All-day beverages category is active

    // Query menu at 12:30 PM (lunch time)
    const resLunch = await fetch(`${baseUrl}/api/v1/menu?outletId=${outletId}&time=12:30`);
    assert.equal(resLunch.status, 200);
    const lunchMenu = await resLunch.json();
    const pizzaCatLunch = lunchMenu.categories.find((c: { name: string }) => c.name.includes('Pizzas'));
    assert.ok(pizzaCatLunch); // Pizza category is visible at 12:30

    // Attempt to order Pizza at 08:00 AM -> Rejection 400 ITEM_OUT_OF_SCHEDULE
    const resOrderEarly = await fetch(`${baseUrl}/api/v1/orders?time=08:00`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        outletId,
        tableNumber: 'T-01',
        items: [{ menuItemId: 'e0000000-0000-0000-0000-000000000002', quantity: 1 }],
      }),
    });
    assert.equal(resOrderEarly.status, 400);
    const earlyErr = await resOrderEarly.json();
    assert.equal(earlyErr.code, 'ITEM_OUT_OF_SCHEDULE');
    assert.ok(earlyErr.error.includes('scheduled'));
  });

  // --------------------------------------------------------------------------
  // Achievement 16: Pay-first/pay-later toggle per shift
  // --------------------------------------------------------------------------
  await suite.test('Achievement #16: Pay-first / pay-later toggle per shift', async () => {
    // 1. Check default settings
    const resCfg = await fetch(`${baseUrl}/api/v1/outlets/${outletId}/config`);
    assert.equal(resCfg.status, 200);
    const cfg = await resCfg.json();
    assert.equal(cfg.paymentMode, 'PAY_LATER');

    // 2. Switch shift to PAY_FIRST (e.g. for late-night bar rush)
    const resPatch = await fetch(`${baseUrl}/api/v1/outlets/${outletId}/payment-mode`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMode: 'PAY_FIRST' }),
    });
    assert.equal(resPatch.status, 200);
    const patched = await resPatch.json();
    assert.equal(patched.settings.paymentMode, 'PAY_FIRST');

    // 3. New order submitted during PAY_FIRST shift initializes in PENDING_PAYMENT
    const resOrder = await fetch(`${baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        outletId,
        tableNumber: 'Bar-01',
        items: [{ menuItemId: 'e0000000-0000-0000-0000-000000000005', quantity: 1 }],
      }),
    });
    assert.equal(resOrder.status, 201);
    const order = await resOrder.json();
    assert.equal(order.status, 'PENDING_PAYMENT');

    // 4. Restore shift to PAY_LATER
    await fetch(`${baseUrl}/api/v1/outlets/${outletId}/payment-mode`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMode: 'PAY_LATER' }),
    });
  });

  // --------------------------------------------------------------------------
  // Achievement 46: Unified incoming order screen
  // --------------------------------------------------------------------------
  await suite.test('Achievement #46: Unified incoming order screen', async () => {
    const resActive = await fetch(`${baseUrl}/api/v1/orders/active?outletId=${outletId}`);
    assert.equal(resActive.status, 200);
    const data = await resActive.json();
    assert.ok(Array.isArray(data.orders));
    assert.ok(data.count >= 1);
    // Verify none of the returned orders are CANCELLED or SERVED
    for (const o of data.orders) {
      assert.notEqual(o.status, 'CANCELLED');
      assert.notEqual(o.status, 'SERVED');
    }
  });

  // --------------------------------------------------------------------------
  // Achievement 47: First-order staff confirmation
  // --------------------------------------------------------------------------
  await suite.test('Achievement #47: First-order staff confirmation', async () => {
    // 1. Enable requireFirstOrderApproval on outlet
    await fetch(`${baseUrl}/api/v1/outlets/${outletId}/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requireFirstOrderApproval: true }),
    });

    const newTableNumber = `T-${Date.now().toString().slice(-4)}`;

    // 2. Submit initial order for this new table -> must be PENDING_STAFF_APPROVAL
    const resFirst = await fetch(`${baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        outletId,
        tableNumber: newTableNumber,
        items: [{ menuItemId: 'e0000000-0000-0000-0000-000000000005', quantity: 1 }],
      }),
    });
    assert.equal(resFirst.status, 201);
    const firstOrder = await resFirst.json();
    assert.equal(firstOrder.status, 'PENDING_STAFF_APPROVAL');

    // 3. Kitchen KDS must NOT show this order while pending staff approval
    const resKdsBefore = await fetch(`${baseUrl}/api/v1/kds/orders?outletId=${outletId}`);
    const kdsOrdersBefore = await resKdsBefore.json();
    const foundInKdsBefore = kdsOrdersBefore.some((o: { id: string }) => o.id === firstOrder.id);
    assert.equal(foundInKdsBefore, false);

    // 4. Staff confirms order
    const resApprove = await fetch(`${baseUrl}/api/v1/orders/${firstOrder.id}/approve`, {
      method: 'POST',
    });
    assert.equal(resApprove.status, 200);
    const approvedData = await resApprove.json();
    assert.equal(approvedData.order.status, 'CONFIRMED');

    // 5. Kitchen KDS now receives the approved ticket
    const resKdsAfter = await fetch(`${baseUrl}/api/v1/kds/orders?outletId=${outletId}`);
    const kdsOrdersAfter = await resKdsAfter.json();
    const foundInKdsAfter = kdsOrdersAfter.some((o: { id: string }) => o.id === firstOrder.id);
    assert.equal(foundInKdsAfter, true);

    // 6. Reset requireFirstOrderApproval to false
    await fetch(`${baseUrl}/api/v1/outlets/${outletId}/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requireFirstOrderApproval: false }),
    });
  });

  // --------------------------------------------------------------------------
  // Achievement 50: Pause new orders when overloaded (surge pause)
  // --------------------------------------------------------------------------
  await suite.test('Achievement #50: Pause new orders when overloaded (surge pause)', async () => {
    // 1. Kitchen surge pauses orders with 20 minute ETA
    const resPause = await fetch(`${baseUrl}/api/v1/outlets/${outletId}/pause-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isPaused: true,
        reason: 'Friday evening rush - 40 tickets in prep',
        etaMinutes: 20,
      }),
    });
    assert.equal(resPause.status, 200);
    const pauseData = await resPause.json();
    assert.equal(pauseData.settings.isPaused, true);
    assert.equal(pauseData.settings.pauseEtaMinutes, 20);

    // 2. Incoming order should be rejected with 503
    const resBlocked = await fetch(`${baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        outletId,
        tableNumber: 'T-02',
        items: [{ menuItemId: 'e0000000-0000-0000-0000-000000000005', quantity: 1 }],
      }),
    });
    assert.equal(resBlocked.status, 503);
    const blockedData = await resBlocked.json();
    assert.equal(blockedData.code, 'ORDERS_TEMPORARILY_PAUSED');
    assert.equal(blockedData.etaMinutes, 20);

    // 3. Resume kitchen
    const resResume = await fetch(`${baseUrl}/api/v1/outlets/${outletId}/pause-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPaused: false }),
    });
    assert.equal(resResume.status, 200);

    // 4. Subsequent order succeeds
    const resSuccess = await fetch(`${baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        outletId,
        tableNumber: 'T-02',
        items: [{ menuItemId: 'e0000000-0000-0000-0000-000000000005', quantity: 1 }],
      }),
    });
    assert.equal(resSuccess.status, 201);
  });

  // --------------------------------------------------------------------------
  // Achievement 61: Live order status to guest
  // --------------------------------------------------------------------------
  await suite.test('Achievement #61: Live order status 4-stage stepper to guest', async () => {
    // 1. Create order
    const resOrder = await fetch(`${baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        outletId,
        tableNumber: 'T-03',
        items: [{ menuItemId: 'e0000000-0000-0000-0000-000000000005', quantity: 1 }],
      }),
    });
    const order = await resOrder.json();

    // 2. Stage check for CONFIRMED order
    const resStatus1 = await fetch(`${baseUrl}/api/v1/orders/${order.id}/status-live`);
    assert.equal(resStatus1.status, 200);
    const statusData1 = await resStatus1.json();
    assert.equal(statusData1.currentStage, 1);
    assert.equal(statusData1.stages.length, 4);
    assert.equal(statusData1.stages[0].completed, true); // Placed
    assert.equal(statusData1.stages[1].current, true); // Approved

    // 3. Transition to PREPARING
    await fetch(`${baseUrl}/api/v1/kds/orders/${order.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PREPARING' }),
    });

    const resStatus2 = await fetch(`${baseUrl}/api/v1/orders/${order.id}/status-live`);
    const statusData2 = await resStatus2.json();
    assert.equal(statusData2.currentStage, 2);
    assert.equal(statusData2.stages[2].current, true); // Preparing

    // 4. Transition to READY_FOR_PICKUP
    await fetch(`${baseUrl}/api/v1/kds/orders/${order.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'READY_FOR_PICKUP' }),
    });

    const resStatus3 = await fetch(`${baseUrl}/api/v1/orders/${order.id}/status-live`);
    const statusData3 = await resStatus3.json();
    assert.equal(statusData3.currentStage, 3);
  });

  // --------------------------------------------------------------------------
  // Achievement 62: One-tap human bridge with routing
  // --------------------------------------------------------------------------
  await suite.test('Achievement #62: One-tap human bridge with category routing & resolve', async () => {
    // 1. Guest requests water refill
    const resCall = await fetch(`${baseUrl}/api/v1/tables/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outletId,
        tableId: 'c0000000-0000-0000-0000-000000000003',
        tableNumber: 'T-03',
        category: 'WATER',
        priority: 'NORMAL',
        reason: 'Water bottle empty',
      }),
    });
    assert.equal(resCall.status, 200);
    const callData = await resCall.json();
    assert.equal(callData.success, true);
    assert.ok(callData.call.id);
    assert.equal(callData.call.category, 'WATER');
    assert.equal(callData.call.status, 'PENDING');

    // 2. Waitstaff retrieves pending calls
    const resPending = await fetch(`${baseUrl}/api/v1/tables/calls/pending?outletId=${outletId}`);
    assert.equal(resPending.status, 200);
    const pendingData = await resPending.json();
    const foundCall = pendingData.calls.find((c: { id: string }) => c.id === callData.call.id);
    assert.ok(foundCall);

    // 3. Staff resolves call
    const resResolve = await fetch(`${baseUrl}/api/v1/tables/calls/${callData.call.id}/resolve`, {
      method: 'PATCH',
    });
    assert.equal(resResolve.status, 200);
    const resolvedData = await resResolve.json();
    assert.equal(resolvedData.call.status, 'RESOLVED');
    assert.ok(resolvedData.call.resolvedAt);

    // 4. Verify call is cleared from pending list
    const resPendingAfter = await fetch(`${baseUrl}/api/v1/tables/calls/pending?outletId=${outletId}`);
    const pendingAfter = await resPendingAfter.json();
    const stillPresent = pendingAfter.calls.some((c: { id: string }) => c.id === callData.call.id);
    assert.equal(stillPresent, false);
  });
});
