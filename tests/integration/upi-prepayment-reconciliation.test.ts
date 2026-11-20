import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync, existsSync } from 'node:fs';
import { createOrderApp } from '../../services/order-service/src/server.ts';
import { OrderStore } from '../../services/order-service/src/store.ts';

describe('UPI Prepayment & Token-Based Reconciliation Integration Test Suite', () => {
  let server: any;
  let baseUrl: string;
  let managerToken: string;
  let waiterToken: string;
  let testDbFile: string;

  const tenantId = 'a0000000-0000-0000-0000-000000000001';
  const outletId = 'b0000000-0000-0000-0000-000000000001';

  async function api(path: string, options: RequestInit = {}) {
    return fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        Connection: 'close',
        ...(options.headers || {}),
      },
    });
  }

  before(async () => {
    // 1. Prepare dedicated test database file so we can test restart persistence
    testDbFile = join(tmpdir(), `test_upi_recon_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.db`);
    process.env.DATABASE_FILE = testDbFile;
    process.env.UPI_VPA = 'abiruchihotel@icici';
    process.env.UPI_PAYEE_NAME = 'Abiruchi Hotel Indiranagar';
    process.env.UPI_MOBILE = '9010150809';
    process.env.WHATSAPP_PHONE = '919010150809';

    // 2. Start server on dynamic port
    server = createOrderApp(testDbFile);
    server.keepAliveTimeout = 60000;
    server.headersTimeout = 65000;
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;

    // 3. Obtain Manager JWT
    const mgrRes = await api('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'manager@abiruchi.local', password: 'abiruchi123' }),
    });
    assert.strictEqual(mgrRes.status, 200, 'Manager login must succeed');
    const mgrData = await mgrRes.json();
    managerToken = mgrData.token;

    // 4. Obtain Waiter JWT (for unauthorized verification test)
    const waiterRes = await api('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'waiter@abiruchi.local', password: 'abiruchi123' }),
    });
    assert.strictEqual(waiterRes.status, 200, 'Waiter login must succeed');
    const waiterData = await waiterRes.json();
    waiterToken = waiterData.token;
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (existsSync(testDbFile)) {
      try { unlinkSync(testDbFile); } catch {}
    }
  });

  let testOrderId: string;
  let testOrderToken: string;
  let testOrderTotalCents: number;
  let testOrderTotalINR: string;
  const sampleUtr = `UTR${Date.now()}987`;

  // Scenario 1: Customer initiates UPI payment -> receives valid UPI URI and order token
  test('Scenario 1: Customer initiates UPI payment -> receives valid UPI URI and order token', async () => {
    // 1. Create an order with PENDING_PAYMENT / UPI
    const orderRes = await api('/api/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        outletId,
        tableNumber: 'T-10',
        paymentMethod: 'UPI',
        items: [
          { menuItemId: 'e0000000-0000-0000-0000-000000000001', quantity: 2 }, // Masala Dosa
          { menuItemId: 'e0000000-0000-0000-0000-000000000004', quantity: 2 }, // Filter Coffee
        ],
      }),
    });
    assert.strictEqual(orderRes.status, 201, 'Order creation must succeed');
    const createdOrder = await orderRes.json();
    testOrderId = createdOrder.id;
    testOrderTotalCents = createdOrder.totalCents;
    testOrderTotalINR = (testOrderTotalCents / 100).toFixed(2);

    // 2. Initiate UPI payment
    const initRes = await api('/api/v1/payments/upi/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: testOrderId }),
    });
    assert.strictEqual(initRes.status, 200, 'UPI initiation must return 200');
    const initData = await initRes.json();

    assert.strictEqual(initData.success, true);
    assert.strictEqual(initData.orderId, testOrderId);
    assert.ok(initData.token, 'Must return allocated order token code');
    testOrderToken = initData.token;

    // Validate standard UPI URI format
    assert.ok(initData.upiUri.startsWith('upi://pay?'), 'URI must start with upi://pay?');
    assert.ok(initData.upiUri.includes(`pa=${encodeURIComponent(process.env.UPI_VPA!)}`), 'Must include payee VPA');
    assert.ok(initData.upiUri.includes(`pn=${encodeURIComponent(process.env.UPI_PAYEE_NAME!)}`), 'Must include payee name');
    assert.ok(initData.upiUri.includes(`am=${testOrderTotalINR}`), 'Must include exact calculated amount');
    assert.ok(initData.upiUri.includes('cu=INR'), 'Must specify currency INR');
    assert.ok(initData.upiUri.includes('tr='), 'Must include unique transaction reference');
    assert.ok(initData.upiUri.includes('tn='), 'Must include transaction note');

    // Validate disclaimer and status separation
    assert.strictEqual(initData.orderStatus, 'PENDING_PAYMENT');
    assert.strictEqual(initData.paymentStatus, 'PENDING');
    assert.ok(initData.disclaimer.includes('does not confirm payment'), 'Must show non-confirmation disclaimer');
  });

  // Scenario 2: Customer submits valid UTR -> payment status becomes AWAITING_VERIFICATION
  test('Scenario 2: Customer submits valid UTR -> payment status becomes AWAITING_VERIFICATION', async () => {
    const submitRes = await api('/api/v1/payments/upi/submit-reference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: testOrderId,
        utr: sampleUtr,
        amountPaid: parseFloat(testOrderTotalINR),
        customerName: 'Priya Sharma',
        customerPhone: '9876543210',
      }),
    });
    assert.strictEqual(submitRes.status, 200, 'Submitting valid reference must succeed');
    const submitData = await submitRes.json();

    assert.strictEqual(submitData.success, true);
    assert.strictEqual(submitData.paymentStatus, 'AWAITING_VERIFICATION');
    assert.strictEqual(submitData.orderStatus, 'PENDING_PAYMENT');
    assert.strictEqual(submitData.token, testOrderToken);
    assert.strictEqual(submitData.utr, sampleUtr);
    assert.ok(submitData.message.includes('waiting for manager verification'));
  });

  // Scenario 3: Duplicate UTR submission -> rejected with 409 Conflict
  test('Scenario 3: Duplicate UTR submission -> rejected with appropriate 409 Conflict', async () => {
    // Create a different order
    const order2Res = await api('/api/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        outletId,
        tableNumber: 'T-11',
        paymentMethod: 'UPI',
        items: [{ menuItemId: 'e0000000-0000-0000-0000-000000000001', quantity: 1 }],
      }),
    });
    const order2 = await order2Res.json();

    // Try to reuse sampleUtr on order2
    const dupRes = await api('/api/v1/payments/upi/submit-reference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order2.id,
        utr: sampleUtr, // Duplicate!
        amountPaid: parseFloat((order2.totalCents / 100).toFixed(2)),
      }),
    });

    assert.strictEqual(dupRes.status, 409, 'Duplicate UTR must be rejected with 409 Conflict');
    const dupData = await dupRes.json();
    assert.ok(dupData.error.includes('already been submitted'), 'Must explain reference already submitted');
  });

  // Scenario 4: Amount mismatch between order total and submitted amount -> rejected with 400
  test('Scenario 4: Amount mismatch between order total and submitted amount -> rejected', async () => {
    // Create another order
    const order3Res = await api('/api/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        outletId,
        tableNumber: 'T-12',
        paymentMethod: 'UPI',
        items: [{ menuItemId: 'e0000000-0000-0000-0000-000000000001', quantity: 2 }],
      }),
    });
    const order3 = await order3Res.json();

    const mismatchRes = await api('/api/v1/payments/upi/submit-reference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order3.id,
        utr: `UTR${Date.now()}MISMATCH`,
        amountPaid: 10.00, // Intentional mismatch!
      }),
    });

    assert.strictEqual(mismatchRes.status, 400, 'Amount mismatch must be rejected with 400');
    const mismatchData = await mismatchRes.json();
    assert.ok(mismatchData.error.includes('does not match order total'), 'Must return amount mismatch explanation');
  });

  // Scenario 5: Unauthorized user attempts to verify payment -> rejected (401/403)
  test('Scenario 5: Unauthorized user attempts to verify payment -> rejected (401/403)', async () => {
    // 1. Unauthenticated call
    const unauthRes = await api('/api/v1/payments/upi/manager-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: testOrderId }),
    });
    assert.ok(unauthRes.status === 401 || unauthRes.status === 403, 'Unauthenticated call must be rejected');

    // 2. Waiter role attempting to verify
    const waiterVerifyRes = await api('/api/v1/payments/upi/manager-verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${waiterToken}`,
      },
      body: JSON.stringify({ orderId: testOrderId }),
    });
    assert.strictEqual(waiterVerifyRes.status, 403, 'Non-manager role must receive 403 Forbidden');
    const waiterErr = await waiterVerifyRes.json();
    assert.ok(waiterErr.error.includes('Forbidden') || waiterErr.error.includes('managers and owners'));
  });

  // Scenario 6: Authorized manager verifies payment -> payment marked VERIFIED, order moves to CONFIRMED
  test('Scenario 6: Authorized manager verifies payment -> payment marked VERIFIED, order moves to CONFIRMED', async () => {
    const verifyRes = await api('/api/v1/payments/upi/manager-verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({
        orderId: testOrderId,
        notes: 'Verified against ICICI Current Account transaction list',
      }),
    });
    assert.strictEqual(verifyRes.status, 200, 'Manager verification must return 200');
    const verifyData = await verifyRes.json();

    assert.strictEqual(verifyData.success, true);
    assert.strictEqual(verifyData.paymentStatus, 'VERIFIED');
    assert.strictEqual(verifyData.orderStatus, 'CONFIRMED');
    assert.strictEqual(verifyData.token, testOrderToken);
    assert.ok(verifyData.verifiedBy);

    // Verify order status endpoint reflects VERIFIED and CONFIRMED
    const statusRes = await api(`/api/v1/payments/order-status/${testOrderId}`);
    const statusData = await statusRes.json();
    assert.strictEqual(statusData.orderStatus, 'CONFIRMED');
    assert.strictEqual(statusData.paymentStatus, 'PAID');
    assert.strictEqual(statusData.token, testOrderToken);
  });

  // Scenario 7: Authorized manager rejects payment -> payment marked REJECTED with reason, customer notified
  test('Scenario 7: Authorized manager rejects payment -> payment marked REJECTED with reason, customer notified', async () => {
    // 1. Create another order and submit fake reference
    const orderForRejectRes = await api('/api/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        outletId,
        tableNumber: 'T-15',
        paymentMethod: 'UPI',
        items: [{ menuItemId: 'e0000000-0000-0000-0000-000000000001', quantity: 1 }],
      }),
    });
    const orderForReject = await orderForRejectRes.json();
    const fakeUtr = `FAKE${Date.now()}`;

    await api('/api/v1/payments/upi/submit-reference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: orderForReject.id,
        utr: fakeUtr,
        amountPaid: parseFloat((orderForReject.totalCents / 100).toFixed(2)),
      }),
    });

    // 2. Manager rejects the payment
    const rejectRes = await api('/api/v1/payments/upi/manager-reject', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({
        orderId: orderForReject.id,
        rejectionReason: 'Transaction not found in bank account',
      }),
    });
    assert.strictEqual(rejectRes.status, 200, 'Manager rejection must return 200');
    const rejectData = await rejectRes.json();

    assert.strictEqual(rejectData.success, true);
    assert.strictEqual(rejectData.paymentStatus, 'REJECTED');
    assert.strictEqual(rejectData.orderStatus, 'PENDING_PAYMENT');
    assert.strictEqual(rejectData.rejectionReason, 'Transaction not found in bank account');
    assert.strictEqual(rejectData.canResubmit, true);

    // 3. Customer polling reflects rejection and allows resubmission
    const custStatusRes = await api(`/api/v1/payments/order-status/${orderForReject.id}`);
    const custStatus = await custStatusRes.json();
    assert.strictEqual(custStatus.paymentStatus, 'REJECTED');
    assert.strictEqual(custStatus.rejectionReason, 'Transaction not found in bank account');
  });

  // Scenario 8: WhatsApp URL generated with correct format, phone number, and encoded parameters
  test('Scenario 8: WhatsApp URL generated with correct format, phone number, and encoded parameters', async () => {
    const orderRes = await api('/api/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        outletId,
        tableNumber: 'T-20',
        paymentMethod: 'UPI',
        items: [{ menuItemId: 'e0000000-0000-0000-0000-000000000001', quantity: 1 }],
      }),
    });
    const order = await orderRes.json();
    const utr = `UTRWA${Date.now()}`;

    const subRes = await api('/api/v1/payments/upi/submit-reference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order.id,
        utr,
        amountPaid: parseFloat((order.totalCents / 100).toFixed(2)),
        customerName: 'Kavitha Reddy',
        customerPhone: '9848012345',
      }),
    });
    const subData = await subRes.json();

    assert.ok(subData.whatsAppUrl, 'WhatsApp URL must be returned');
    assert.ok(subData.whatsAppUrl.startsWith('https://wa.me/919010150809?text='), 'Must target clean 919010150809');

    const decoded = decodeURIComponent(subData.whatsAppUrl.split('?text=')[1]);
    assert.ok(decoded.includes('Hello Abiruchi Hotel,'), 'Must contain greeting');
    assert.ok(decoded.includes(`Order #${order.id}`), 'Must contain Order ID');
    assert.ok(decoded.includes(`Token: ${order.token}`), 'Must contain Token');
    assert.ok(decoded.includes(`UPI Ref / UTR: ${utr}`), 'Must contain UTR');
    assert.ok(decoded.includes('Customer Name: Kavitha Reddy'), 'Must contain Customer Name');
    assert.ok(decoded.includes('Customer Phone: 9848012345'), 'Must contain Customer Phone');
    assert.ok(decoded.includes('Please verify and prepare my order.'), 'Must contain closing instruction');
  });

  // Scenario 9: WhatsApp URL fallback when phone number is missing
  test('Scenario 9: WhatsApp URL fallback when phone number is missing', async () => {
    const oldWaPhone = process.env.WHATSAPP_PHONE;
    const oldUpiMobile = process.env.UPI_MOBILE;
    delete process.env.WHATSAPP_PHONE;
    delete process.env.UPI_MOBILE;

    try {
      const orderRes = await api('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          outletId,
          tableNumber: 'T-21',
          paymentMethod: 'UPI',
          items: [{ menuItemId: 'e0000000-0000-0000-0000-000000000001', quantity: 1 }],
        }),
      });
      const order = await orderRes.json();
      const utr = `UTRFALLBACK${Date.now()}`;

      const subRes = await api('/api/v1/payments/upi/submit-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          utr,
          amountPaid: parseFloat((order.totalCents / 100).toFixed(2)),
          customerName: 'Anil Kumar',
        }),
      });
      const subData = await subRes.json();

      assert.ok(subData.whatsAppUrl, 'Must still return fallback WhatsApp URL');
      assert.ok(subData.whatsAppUrl.startsWith('https://wa.me/'), 'Must use wa.me protocol');
      assert.ok(subData.whatsAppUrl.includes('?text='), 'Must include prefilled text');
    } finally {
      process.env.WHATSAPP_PHONE = oldWaPhone;
      process.env.UPI_MOBILE = oldUpiMobile;
    }
  });

  // Scenario 10: Order token lifecycle persists correctly across all states
  test('Scenario 10: Order token lifecycle persists correctly across all states', async () => {
    // 1. Created: PENDING_PAYMENT -> token allocated
    const orderRes = await api('/api/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        outletId,
        tableNumber: 'T-30',
        paymentMethod: 'UPI',
        items: [{ menuItemId: 'e0000000-0000-0000-0000-000000000001', quantity: 1 }],
      }),
    });
    const order = await orderRes.json();
    const token = order.token;
    assert.ok(token, 'Token allocated on creation');

    // 2. Waiting: AWAITING_VERIFICATION -> token intact
    const utr = `UTRTOK${Date.now()}`;
    await api('/api/v1/payments/upi/submit-reference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order.id,
        utr,
        amountPaid: parseFloat((order.totalCents / 100).toFixed(2)),
      }),
    });

    // 3. Active: Verified by Manager -> token moves to kitchen queue
    const vRes = await api('/api/v1/payments/upi/manager-verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({ orderId: order.id }),
    });
    const vData = await vRes.json();
    assert.strictEqual(vData.token, token);

    // 4. Kitchen advance token to PREPARING
    const tokensRes = await api('/api/v1/tokens/active');
    const activeTokens = await tokensRes.json();
    const tokenObj = activeTokens.find((t: any) => (t.token_code || t.code) === token);
    assert.ok(tokenObj, 'Token must be present in kitchen queue');

    const prepRes = await api(`/api/v1/tokens/${tokenObj.id}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'PREPARING' }),
    });
    assert.strictEqual(prepRes.status, 200);

    // 5. Kitchen advance to READY
    const readyRes = await api(`/api/v1/tokens/${tokenObj.id}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'READY' }),
    });
    assert.strictEqual(readyRes.status, 200);

    // 6. Customer collects order -> token SERVED / CLOSED
    const closedRes = await api(`/api/v1/tokens/${tokenObj.id}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'SERVED' }),
    });
    assert.strictEqual(closedRes.status, 200);
  });

  // Scenario 11: Database persistence: verification survives server restart
  test('Scenario 11: Database persistence: verification survives server restart', async () => {
    const persistDbFile = join(tmpdir(), `persist-upi-restart-${Date.now()}.db`);
    const s1 = new OrderStore(persistDbFile);
    const pOrderId = 'ord_restart_durability_test';

    // Create order on s1
    s1.orders.set(pOrderId, {
      id: pOrderId,
      tenantId,
      outletId,
      tableNumber: 'T-99',
      status: 'PENDING_PAYMENT',
      paymentStatus: 'PENDING',
      paymentMethod: 'UPI',
      items: [{ menuItemId: 'e0000000-0000-0000-0000-000000000001', name: 'Masala Dosa', unitPriceCents: 12000, quantity: 1, totalCents: 12000 }],
      subtotalCents: 12000,
      taxCents: 600,
      tipCents: 0,
      totalCents: 12600,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 1. Customer initiates UPI Prepayment on s1
    const initResult = s1.initiateUpiPrepayment(pOrderId);
    assert.ok(initResult, 'UPI Prepayment initiated');
    assert.ok(initResult.token, 'Token allocated');

    // 2. Customer submits UTR on s1
    const pUtr = `RESTART_UTR_${Date.now()}`;
    const submitResult = s1.submitUpiPaymentReference({
      orderId: pOrderId,
      utr: pUtr,
      amountCents: 12600,
      customerName: 'Durability Tester',
      customerPhone: '9988776655',
    });
    assert.strictEqual(submitResult.success, true);
    assert.strictEqual(submitResult.paymentStatus, 'AWAITING_VERIFICATION');

    // 3. Manager verifies payment on s1
    const verifyResult = s1.verifyUpiPaymentByManager({
      orderId: pOrderId,
      verifiedBy: 'manager_sarah',
      staffRole: 'MANAGER',
      notes: 'Verified before reboot',
    });
    assert.strictEqual(verifyResult.success, true);
    assert.strictEqual(verifyResult.paymentStatus, 'VERIFIED');
    assert.strictEqual(verifyResult.orderStatus, 'CONFIRMED');

    // 4. Simulate complete server reboot: instantiate a fresh store instance from same db file
    const s2 = new OrderStore(persistDbFile);

    // Verify order survived reboot with status CONFIRMED and paymentStatus PAID
    const orderAfterReboot = s2.orders.get(pOrderId);
    assert.ok(orderAfterReboot, 'Order must survive server restart');
    assert.strictEqual(orderAfterReboot.status, 'CONFIRMED');
    assert.strictEqual(orderAfterReboot.paymentStatus, 'PAID');

    // Verify direct SQLite row has status PAID and utr
    const directRow = s2.getDb().prepare('SELECT * FROM payments WHERE order_id = ?').get(pOrderId) as any;
    assert.ok(directRow, 'Payment row must exist in SQLite after restart');
    assert.strictEqual(directRow.status, 'PAID');
    assert.strictEqual(directRow.utr, pUtr);

    // Verify verification queue entry survived reboot
    const queueAfter = s2.getUpiVerificationsQueue();
    const verifItem = queueAfter.find(q => q.orderId === pOrderId);
    assert.ok(verifItem, 'Verification queue entry must survive server restart');
    assert.strictEqual(verifItem?.utr, pUtr);

    try { s1.getDb().close(); } catch {}
    try { s2.getDb().close(); } catch {}
    try { unlinkSync(persistDbFile); } catch {}
    process.env.DATABASE_FILE = testDbFile;
  });

  // Scenario 12: Concurrent submissions for same order handled cleanly
  test('Scenario 12: Concurrent submissions for same order handled cleanly without race condition', async () => {
    const orderRes = await api('/api/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        outletId,
        tableNumber: 'T-40',
        paymentMethod: 'UPI',
        items: [{ menuItemId: 'e0000000-0000-0000-0000-000000000001', quantity: 1 }],
      }),
    });
    const order = await orderRes.json();
    const amountPaid = parseFloat((order.totalCents / 100).toFixed(2));

    const utr1 = `CONCUR1_${Date.now()}`;
    const utr2 = `CONCUR2_${Date.now()}`;

    // Send two concurrent submissions
    const [sub1, sub2] = await Promise.all([
      api('/api/v1/payments/upi/submit-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, utr: utr1, amountPaid }),
      }),
      api('/api/v1/payments/upi/submit-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, utr: utr2, amountPaid }),
      }),
    ]);

    // At least one submission must succeed cleanly
    assert.ok(sub1.ok || sub2.ok, 'At least one submission must succeed');

    // Verify order is now in AWAITING_VERIFICATION state
    const statusRes = await api(`/api/v1/payments/order-status/${order.id}`);
    const statusData = await statusRes.json();
    assert.strictEqual(statusData.paymentStatus, 'AWAITING_VERIFICATION');
    assert.strictEqual(statusData.orderStatus, 'PENDING_PAYMENT');
  });
});
