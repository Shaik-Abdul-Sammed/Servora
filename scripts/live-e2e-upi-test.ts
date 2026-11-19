import assert from 'node:assert';

const BASE_URL = process.env.LIVE_URL || 'https://servora-hotel-os.onrender.com';
const TENANT_ID = 'a0000000-0000-0000-0000-000000000001';
const OUTLET_ID = 'b0000000-0000-0000-0000-000000000001';

async function req(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, headers: res.headers, body: json };
}

async function runLiveUpiWorkflow() {
  console.log('='.repeat(78));
  console.log(`LIVE UPI PREPAYMENT & TOKEN RECONCILIATION E2E TEST ON ${BASE_URL}`);
  console.log('='.repeat(78));

  // Step 0: Health check
  console.log('\n[1/17] Checking /health endpoint...');
  const health = await req('/health');
  assert.strictEqual(health.status, 200, 'Health check must return 200');
  assert.strictEqual(health.body.status, 'healthy');
  assert.strictEqual(health.body.database, 'turso');
  console.log(`  ✓ Healthy! Database: ${health.body.database}, Latency: ${health.body.latencyMs}ms`);

  // Step 1: Payment config
  console.log('\n[2/17] Verifying UPI Payment Config...');
  const config = await req('/api/v1/payments/config');
  assert.strictEqual(config.status, 200);
  assert.strictEqual(config.body.upiVpa, '9010150809@ybl');
  assert.strictEqual(config.body.payeeName, 'Abiruchi Hotel');
  assert.strictEqual(config.body.verificationMode, 'MANAGER_RECONCILIATION');
  console.log(`  ✓ Payee: ${config.body.payeeName}, VPA: ${config.body.upiVpa}`);

  // Step 2: Customer places an order requiring UPI prepayment
  console.log('\n[3/17] Customer places order with payMethod=UPI...');
  const orderRes = await req('/api/v1/orders', {
    method: 'POST',
    body: JSON.stringify({
      tenantId: TENANT_ID,
      outletId: OUTLET_ID,
      tableNumber: 'T-01',
      items: [
        {
          menuItemId: 'e0000000-0000-0000-0000-000000000010',
          quantity: 2,
        },
        {
          menuItemId: 'e0000000-0000-0000-0000-000000000065',
          quantity: 1,
        },
      ],
      diningOption: 'DINE_IN',
      payMethod: 'UPI',
    }),
  });
  assert.strictEqual(orderRes.status, 201, 'Order must be created with 201');
  const order = orderRes.body;
  const orderId = order.id;
  console.log(`  ✓ Order created: #${orderId.slice(-6).toUpperCase()}`);
  console.log(`  ✓ Subtotal: INR ${(order.subtotalCents / 100).toFixed(2)}, Tax: INR ${(order.taxCents / 100).toFixed(2)}, Total: INR ${(order.totalCents / 100).toFixed(2)}`);

  // Step 3 & 4: Exact amount & Provisional token
  console.log('\n[4/17] Verifying provisional token & payment state...');
  assert.ok(order.totalCents > 0, 'Total amount must be calculated server-side');
  assert.strictEqual(order.status, 'PENDING_PAYMENT', 'Order status must be PENDING_PAYMENT');
  assert.ok(order.token || order.token_code, 'Provisional order token must be assigned');
  const tokenCode = order.token || order.token_code;
  console.log(`  ✓ Provisional Token: ${tokenCode}, Order Status: ${order.status}`);

  // Step 5: Check kitchen queue — Kitchen must NOT receive unverified order
  console.log('\n[5/17] Confirming Kitchen Display System does NOT see pending payment order...');
  const kdsBefore = await req('/api/v1/kds/orders');
  assert.strictEqual(kdsBefore.status, 200);
  const inKdsBefore = Array.isArray(kdsBefore.body) && kdsBefore.body.some((o: any) => o.id === orderId);
  assert.strictEqual(inKdsBefore, false, 'Kitchen must not see order before payment is verified');
  console.log('  ✓ Kitchen queue verified clean: unverified order is hidden from KDS');

  // Step 6: Customer initiates UPI payment -> receives intent URI & QR URL
  console.log('\n[6/17] Customer opens UPI Intent / QR code...');
  const upiInit = await req('/api/v1/payments/upi/initiate', {
    method: 'POST',
    body: JSON.stringify({ orderId }),
  });
  assert.strictEqual(upiInit.status, 200);
  assert.ok(upiInit.body.upiUri.startsWith('upi://pay?'), 'Must return valid UPI intent URI');
  assert.ok(upiInit.body.upiUri.includes('pa=9010150809%40ybl') || upiInit.body.upiUri.includes('pa=9010150809@ybl'));
  assert.ok(upiInit.body.qrImageUrl.includes('create-qr-code'));
  console.log(`  ✓ Valid UPI URI: ${upiInit.body.upiUri.slice(0, 50)}...`);

  // Step 7: Negative test: Amount mismatch submission
  console.log('\n[7/17] Testing validation: Tampered / mismatched amount rejected...');
  const fakeUtr = 'UTR' + Date.now().toString().slice(-8);
  const mismatchRes = await req('/api/v1/payments/upi/submit-utr', {
    method: 'POST',
    body: JSON.stringify({
      orderId,
      utr: fakeUtr,
      amountPaise: 100, // 1 Rupee instead of total
      customerName: 'Test Customer',
      customerMobile: '9876543210',
    }),
  });
  assert.strictEqual(mismatchRes.status, 400, 'Tampered amount must be rejected with 400');
  console.log(`  ✓ Mismatched amount rejected: ${mismatchRes.body.error}`);

  // Step 8: Customer submits valid UTR
  console.log('\n[8/17] Customer submits genuine 12-digit UTR...');
  const realUtr = 'UTR' + Math.floor(100000000000 + Math.random() * 900000000000).toString();
  const submitRes = await req('/api/v1/payments/upi/submit-utr', {
    method: 'POST',
    body: JSON.stringify({
      orderId,
      utr: realUtr,
      amountPaise: order.totalCents,
      customerName: 'Ramesh Sharma',
      customerMobile: '9876543210',
    }),
  });
  assert.strictEqual(submitRes.status, 200);
  assert.strictEqual(submitRes.body.status, 'AWAITING_VERIFICATION');
  console.log(`  ✓ UTR submitted: ${realUtr} -> Payment status: ${submitRes.body.status}`);

  // Step 9: Customer receives WhatsApp click-to-chat reconciliation link
  console.log('\n[9/17] Generating WhatsApp payment reconciliation link...');
  const waRes = await req(`/api/v1/payments/upi/whatsapp-link?orderId=${orderId}`);
  assert.strictEqual(waRes.status, 200);
  assert.ok(waRes.body.whatsappUrl.includes('api.whatsapp.com') || waRes.body.whatsappUrl.includes('wa.me'));
  assert.ok(waRes.body.whatsappUrl.includes('9010150809'));
  console.log(`  ✓ WhatsApp link generated with pre-filled UTR and token: ${waRes.body.whatsappUrl.slice(0, 60)}...`);

  // Step 10: Negative test: Duplicate UTR rejection
  console.log('\n[10/17] Testing duplicate UTR submission rejection (409 Conflict)...');
  const dupRes = await req('/api/v1/payments/upi/submit-utr', {
    method: 'POST',
    body: JSON.stringify({
      orderId,
      utr: realUtr,
      amountPaise: order.totalCents,
      customerName: 'Duplicate Attempt',
      customerMobile: '9876543210',
    }),
  });
  assert.strictEqual(dupRes.status, 409, 'Duplicate UTR must be rejected with 409');
  console.log(`  ✓ Duplicate UTR rejected with 409 Conflict: ${dupRes.body.error}`);

  // Step 11: Manager sees payment in verification queue
  console.log('\n[11/17] Staff / Manager authentication...');
  const loginRes = await req('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'manager@abiruchi.local', password: 'managerpassword' }),
  });
  assert.strictEqual(loginRes.status, 200);
  const managerToken = loginRes.body.token;

  const waiterLogin = await req('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'waiter@abiruchi.local', password: 'waiterpassword' }),
  });
  assert.strictEqual(waiterLogin.status, 200);
  const waiterToken = waiterLogin.body.token;
  console.log('  ✓ Manager and Waiter authentication tokens acquired');

  console.log('\n[12/17] Manager inspects pending verification queue...');
  const pendingRes = await req('/api/v1/manager/payments/pending', {
    headers: { Authorization: `Bearer ${managerToken}` },
  });
  assert.strictEqual(pendingRes.status, 200);
  const itemInQueue = (pendingRes.body.pendingPayments || []).find((p: any) => p.orderId === orderId);
  assert.ok(itemInQueue, 'Order payment must appear in manager pending queue');
  assert.strictEqual(itemInQueue.utr, realUtr);
  assert.strictEqual(itemInQueue.customerName, 'Ramesh Sharma');
  console.log(`  ✓ Payment record in queue: UTR=${itemInQueue.utr}, Customer=${itemInQueue.customerName}, Token=${itemInQueue.token}`);

  // Step 13: RBAC test: Unauthorized waiter / non-manager cannot verify
  console.log('\n[13/17] RBAC: Unauthorized waiter attempts to verify payment...');
  const waiterAttempt = await req(`/api/v1/manager/payments/${itemInQueue.id}/verify`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${waiterToken}` },
    body: JSON.stringify({ notes: 'Waiter unauthorized verification' }),
  });
  assert.ok(waiterAttempt.status === 401 || waiterAttempt.status === 403, 'Waiter must be forbidden (401/403)');
  console.log(`  ✓ Unauthorized verification blocked with HTTP ${waiterAttempt.status}`);

  // Step 14: Authorized manager verifies payment against bank transaction
  console.log('\n[14/17] Authorized manager verifies payment with bank reconciliation note...');
  const verifyRes = await req(`/api/v1/manager/payments/${itemInQueue.id}/verify`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${managerToken}` },
    body: JSON.stringify({ notes: 'Bank credit confirmed in HDFC Current A/C #1234' }),
  });
  assert.strictEqual(verifyRes.status, 200);
  assert.strictEqual(verifyRes.body.payment.status, 'VERIFIED');
  assert.strictEqual(verifyRes.body.order.status, 'CONFIRMED');
  console.log(`  ✓ Payment verified! Order status -> ${verifyRes.body.order.status}`);

  // Step 15: Kitchen now receives the order
  console.log('\n[15/17] Confirming Kitchen Display System receives order after verification...');
  const kdsAfter = await req('/api/v1/kds/orders');
  assert.strictEqual(kdsAfter.status, 200);
  const inKdsAfter = Array.isArray(kdsAfter.body) && kdsAfter.body.some((o: any) => o.id === orderId);
  assert.strictEqual(inKdsAfter, true, 'Kitchen must now display confirmed order');
  console.log(`  ✓ KDS Ticket active for Order #${orderId.slice(-6).toUpperCase()}`);

  // Step 16: Free email receipt delivery test
  console.log('\n[16/17] Testing Free Customer Email Receipt Dispatch...');
  const emailRes = await req(`/api/v1/receipts/${orderId}/email`, {
    method: 'POST',
    body: JSON.stringify({ email: 'ramesh.sharma@example.com' }),
  });
  assert.strictEqual(emailRes.status, 200);
  assert.strictEqual(emailRes.body.sent, true);
  console.log(`  ✓ Email receipt dispatched to ${emailRes.body.email}`);

  // Step 17: Order & token consistency verification
  console.log('\n[17/17] Checking final order, payment, and token consistency...');
  const finalOrderRes = await req(`/api/v1/orders/${orderId}`);
  assert.strictEqual(finalOrderRes.status, 200);
  assert.strictEqual(finalOrderRes.body.status, 'CONFIRMED');
  assert.strictEqual(finalOrderRes.body.token, tokenCode);
  console.log(`  ✓ Final Verification: Order #${orderId.slice(-6)}: status=${finalOrderRes.body.status}, token=${finalOrderRes.body.token}`);

  console.log('\n' + '='.repeat(78));
  console.log('ALL 17 LIVE WORKFLOW TESTS PASSED CLEANLY ON PRODUCTION!');
  console.log('='.repeat(78));
}

runLiveUpiWorkflow().catch((err) => {
  console.error('\n❌ LIVE WORKFLOW TEST FAILED:', err);
  process.exit(1);
});
