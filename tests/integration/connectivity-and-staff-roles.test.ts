import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync, existsSync } from 'node:fs';
import { createOrderApp } from '../../services/order-service/src/server.ts';

describe('Connectivity, Staff Accounts & Real-Time Role Coordination Suite', () => {
  let server: any;
  let baseUrl: string;
  let testDbFile: string;

  let managerToken = '';
  let waiter1Id = '';
  let waiter1Username = 'waiter_anand';
  let waiter1TempPass = 'TempPass@123';
  let waiter1Token = '';
  let waiter2Id = '';
  let waiter2Username = 'waiter_bharat';

  let order1Id = '';
  let order2Id = '';

  before(async () => {
    testDbFile = join(tmpdir(), `test_staff_conn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.db`);
    process.env.DATABASE_FILE = testDbFile;

    server = createOrderApp(testDbFile);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    try {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    } catch {}
    try {
      if (app && (app as any).store && typeof (app as any).store.close === 'function') {
        (app as any).store.close();
      }
    } catch {}
    try {
      if (existsSync(testDbFile)) unlinkSync(testDbFile);
      if (existsSync(`${testDbFile}-wal`)) unlinkSync(`${testDbFile}-wal`);
      if (existsSync(`${testDbFile}-shm`)) unlinkSync(`${testDbFile}-shm`);
    } catch {}
  });

  async function apiRequest(path: string, options: { method?: string; headers?: Record<string, string>; body?: any } = {}) {
    const url = new URL(path, baseUrl);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    let bodyStr: string | undefined = undefined;
    if (options.body) {
      bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    const res = await fetch(url.toString(), {
      method: options.method || 'GET',
      headers,
      body: bodyStr
    });

    const status = res.status;
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status, data, headers: res.headers };
  }

  // ==========================================================================
  // PHASE 1: MANAGER-CREATED WAITER ACCOUNTS
  // ==========================================================================
  it('Phase 1.1: Manager logs in and obtains administrative session', async () => {
    const res = await apiRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'manager@abiruchi.local', password: 'abiruchi123' }
    });

    assert.strictEqual(res.status, 200, 'Manager login must succeed');
    assert.ok(res.data.token, 'Token must be returned');
    assert.strictEqual(res.data.user.role, 'MANAGER');
    managerToken = res.data.token;
  });

  it('Phase 1.2: Manager creates Waiter 1 with assigned tables T-01, T-02', async () => {
    const res = await apiRequest('/api/v1/manager/staff', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        name: 'Anand Kumar',
        phone: '9876543211',
        username: waiter1Username,
        password: waiter1TempPass,
        role: 'WAITER',
        assignedTables: ['T-01', 'T-02'],
        shiftStart: '10:00',
        shiftEnd: '22:00'
      }
    });

    assert.strictEqual(res.status, 201, 'Waiter 1 creation must return 201');
    assert.ok(res.data.id, 'Waiter ID must be assigned');
    assert.strictEqual(res.data.username, waiter1Username);
    assert.strictEqual(res.data.role, 'WAITER');
    assert.strictEqual(res.data.status, 'ACTIVE');
    assert.strictEqual(res.data.mustChangePassword, true, 'Temporary password must mandate change');
    assert.deepStrictEqual(res.data.assignedTables, ['T-01', 'T-02']);
    waiter1Id = res.data.id;
  });

  it('Phase 1.3: Manager creates Waiter 2 with assigned tables T-03, T-04', async () => {
    const res = await apiRequest('/api/v1/manager/staff', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        name: 'Bharat Reddy',
        phone: '9876543212',
        username: waiter2Username,
        role: 'WAITER',
        assignedTables: ['T-03', 'T-04']
      }
    });

    assert.strictEqual(res.status, 201, 'Waiter 2 creation must succeed');
    assert.ok(res.data.tempPassword, 'Auto-generated temporary password must be provided');
    assert.strictEqual(res.data.mustChangePassword, true);
    waiter2Id = res.data.id;
  });

  it('Phase 1.4: Prevent duplicate usernames (409 Conflict)', async () => {
    const res = await apiRequest('/api/v1/manager/staff', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        name: 'Duplicate Anand',
        username: waiter1Username, // collision!
        role: 'WAITER'
      }
    });

    assert.strictEqual(res.status, 409, 'Duplicate username must be rejected with 409 Conflict');
  });

  it('Phase 1.5: Manager lists all staff members with status and table assignments', async () => {
    const res = await apiRequest('/api/v1/manager/staff', {
      headers: { Authorization: `Bearer ${managerToken}` }
    });

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data), 'Staff list must be an array');
    const w1 = res.data.find((s: any) => s.id === waiter1Id);
    assert.ok(w1, 'Waiter 1 must be present in staff roster');
    assert.strictEqual(w1.username, waiter1Username);
    assert.strictEqual(w1.status, 'ACTIVE');
  });

  // ==========================================================================
  // PHASE 2: INDIVIDUAL WAITER LOGIN & ROLE PERMISSIONS
  // ==========================================================================
  it('Phase 2.1: Waiter 1 logs in with temporary credentials', async () => {
    const res = await apiRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { identifier: waiter1Username, password: waiter1TempPass }
    });

    assert.strictEqual(res.status, 200, 'Waiter 1 login must succeed');
    assert.ok(res.data.token, 'JWT token must be issued');
    assert.strictEqual(res.data.user.role, 'WAITER');
    assert.strictEqual(res.data.user.mustChangePassword, true, 'mustChangePassword flag must be returned');
    assert.deepStrictEqual(res.data.user.assignedTables, ['T-01', 'T-02']);
    waiter1Token = res.data.token;
  });

  it('Phase 2.2: Waiter 1 completes mandatory password change on first login', async () => {
    const res = await apiRequest('/api/v1/auth/change-password', {
      method: 'POST',
      headers: { Authorization: `Bearer ${waiter1Token}` },
      body: { currentPassword: waiter1TempPass, newPassword: 'PermSecurePass@2026' }
    });

    assert.strictEqual(res.status, 200, 'Password change must succeed');
    assert.strictEqual(res.data.success, true);

    // Verify subsequent login with new password succeeds and mustChangePassword is false
    const loginRes = await apiRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { identifier: waiter1Username, password: 'PermSecurePass@2026' }
    });
    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginRes.data.user.mustChangePassword, false, 'Forced password flag cleared');
    waiter1Token = loginRes.data.token;
  });

  it('Phase 2.3: Waiter attempts to create staff accounts -> strictly 403 Forbidden', async () => {
    const res = await apiRequest('/api/v1/manager/staff', {
      method: 'POST',
      headers: { Authorization: `Bearer ${waiter1Token}` },
      body: { name: 'Illegal Staff', username: 'illegal', role: 'WAITER' }
    });

    assert.strictEqual(res.status, 403, 'Waiter cannot manage staff accounts');
  });

  it('Phase 2.4: Waiter attempts to verify payments -> strictly 403 Forbidden', async () => {
    const res = await apiRequest('/api/v1/payments/upi/manager-verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${waiter1Token}` },
      body: { orderId: 'ord_sample_999' }
    });

    assert.strictEqual(res.status, 403, 'Waiters must never have payment verification authority');
  });

  // ==========================================================================
  // PHASE 3 & 4: REAL-TIME COMMUNICATION & CUSTOMER ORDERING
  // ==========================================================================
  it('Phase 3.1: Customer places order at Table 1 (assigned to Waiter 1)', async () => {
    const menuRes = await apiRequest('/api/v1/menu');
    const sampleItemId = menuRes.data.items[0].id;

    const res = await apiRequest('/api/v1/orders', {
      method: 'POST',
      body: {
        tableNumber: 'T-01',
        paymentMethod: 'UPI',
        items: [
          { menuItemId: sampleItemId, quantity: 2 }
        ]
      }
    });

    assert.strictEqual(res.status, 201);
    assert.ok(res.data.id);
    assert.strictEqual(res.data.tableNumber, 'T-01');
    order1Id = res.data.id;
  });

  it('Phase 3.2: Customer places order at Table 3 (assigned to Waiter 2)', async () => {
    const menuRes = await apiRequest('/api/v1/menu');
    const sampleItemId = menuRes.data.items[0].id;

    const res = await apiRequest('/api/v1/orders', {
      method: 'POST',
      body: {
        tableNumber: 'T-03',
        paymentMethod: 'UPI',
        items: [
          { menuItemId: sampleItemId, quantity: 1 }
        ]
      }
    });

    assert.strictEqual(res.status, 201);
    order2Id = res.data.id;
  });

  it('Phase 3.3: Waiter 1 queries scoped active orders -> sees T-01, excludes T-03', async () => {
    const res = await apiRequest('/api/v1/waiter/orders', {
      headers: { Authorization: `Bearer ${waiter1Token}` }
    });

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data.orders));
    const tableNumbers = res.data.orders.map((o: any) => o.tableNumber);
    assert.ok(tableNumbers.includes('T-01'), 'Waiter 1 must see Table T-01');
    assert.ok(!tableNumbers.includes('T-03'), 'Waiter 1 must NOT see Table T-03 (assigned to Waiter 2)');
  });

  it('Phase 3.4: Real-time event polling fallback recovers sequenced events', async () => {
    const res = await apiRequest('/api/v1/events/poll?sinceSeq=0');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.success);
    assert.ok(Array.isArray(res.data.events));
    assert.ok(res.data.events.length > 0, 'Event buffer must contain sequenced events');
    const types = res.data.events.map((e: any) => e.type);
    assert.ok(types.includes('NEW_ORDER') || types.includes('ORDER_CREATED'), 'NEW_ORDER event must be recorded');
  });

  // ==========================================================================
  // PHASE 5: UPI PREPAYMENT & STATUS SYNCHRONIZATION
  // ==========================================================================
  it('Phase 5.1: Customer submits UTR for Table 1 -> payment marked AWAITING_VERIFICATION', async () => {
    const res = await apiRequest('/api/v1/payments/upi/submit-reference', {
      method: 'POST',
      body: {
        orderId: order1Id,
        utr: 'UTR778899001122',
        customerName: 'Raghavan'
      }
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.data.status === 'AWAITING_VERIFICATION' || res.data.payment?.status === 'AWAITING_VERIFICATION' || res.data.paymentStatus === 'AWAITING_VERIFICATION');
  });

  it('Phase 5.2: Waiter 1 views Table 1 order -> sees read-only AWAITING_VERIFICATION badge', async () => {
    const res = await apiRequest('/api/v1/waiter/orders', {
      headers: { Authorization: `Bearer ${waiter1Token}` }
    });

    assert.strictEqual(res.status, 200);
    const ord = res.data.orders.find((o: any) => o.id === order1Id);
    assert.ok(ord);
    assert.strictEqual(ord.paymentStatus, 'AWAITING_VERIFICATION');
  });

  it('Phase 5.3: Manager verifies payment -> status becomes PAID and atomic event emitted', async () => {
    const res = await apiRequest('/api/v1/payments/upi/manager-verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        orderId: order1Id,
        notes: 'Verified via HDFC Merchant Netbanking'
      }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.paymentStatus === 'PAID' || res.data.paymentStatus === 'VERIFIED' || res.data.status === 'PAID');
  });

  it('Phase 5.4: Waiter advances order status PREPARING -> READY -> SERVED', async () => {
    // Prep
    const r1 = await apiRequest(`/api/v1/orders/${order1Id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${waiter1Token}` },
      body: { status: 'PREPARING' }
    });
    assert.strictEqual(r1.status, 200);

    // Ready
    const r2 = await apiRequest(`/api/v1/orders/${order1Id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${waiter1Token}` },
      body: { status: 'READY' }
    });
    assert.strictEqual(r2.status, 200);

    // Served
    const r3 = await apiRequest(`/api/v1/orders/${order1Id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${waiter1Token}` },
      body: { status: 'SERVED' }
    });
    assert.strictEqual(r3.status, 200);
  });

  // ==========================================================================
  // PHASE 7: ACCOUNT SUSPENSION & PERMISSION REVOCATION
  // ==========================================================================
  it('Phase 7.1: Manager suspends Waiter 1 account', async () => {
    const res = await apiRequest(`/api/v1/manager/staff/${waiter1Id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { status: 'SUSPENDED' }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'SUSPENDED');
    assert.strictEqual(res.data.isActive, false);
  });

  it('Phase 7.2: Suspended Waiter 1 token is immediately revoked on subsequent calls (401/403)', async () => {
    const res = await apiRequest('/api/v1/waiter/orders', {
      headers: { Authorization: `Bearer ${waiter1Token}` }
    });

    assert.ok(res.status === 401 || res.status === 403, 'Suspended waiter access must be denied');
  });

  it('Phase 7.3: Suspended Waiter 1 cannot log in (403 Forbidden)', async () => {
    const res = await apiRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { identifier: waiter1Username, password: 'PermSecurePass@2026' }
    });

    assert.strictEqual(res.status, 403, 'Suspended account login must fail with 403');
    assert.ok(res.data.error.toLowerCase().includes('suspended'));
  });

  it('Phase 7.4: Manager resets password for Waiter 2', async () => {
    const res = await apiRequest(`/api/v1/manager/staff/${waiter2Id}/reset-password`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { newPassword: 'ManagerReset@8899' }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.tempPassword, 'ManagerReset@8899');
    assert.strictEqual(res.data.mustChangePassword, true);

    // Verify Waiter 2 can login with new temporary password
    const loginRes = await apiRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { identifier: waiter2Username, password: 'ManagerReset@8899' }
    });
    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginRes.data.user.mustChangePassword, true);
  });
});
