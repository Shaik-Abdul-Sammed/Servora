import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { URL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { OrderStore } from './store.ts';
import { ServoraAIEngine } from '../../ai-service/src/ai-engine.ts';
import { AutomationEngine } from '../../automation-service/src/index.ts';
import {
  createSignedQRSession,
  verifyQRTableSession,
  calculateOrderTotals,
} from '../../../packages/utils/src/index.ts';
import type {
  Order,
  OrderItem,
  OrderStatus,
  QRTableSessionPayload,
  ServerEvent,
} from '../../../packages/shared-types/src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '../../..');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const QR_SIGNING_SECRET = process.env.QR_SIGNING_SALT || 'servora-dev-qr-secret-key-32-bytes-min';

const store = new OrderStore();
const aiEngine = new ServoraAIEngine();

// In-memory SSE clients for real-time KDS updates
const sseClients = new Set<ServerResponse>();

function broadcastEvent(event: ServerEvent) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(data);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Helper to set CORS and JSON headers
function sendJson(res: ServerResponse, statusCode: number, data: unknown) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-ID',
  });
  res.end(JSON.stringify(data));
}

// Helper to parse JSON body
function parseJsonBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : ({} as T));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

export function createOrderApp() {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-ID',
      });
      res.end();
      return;
    }

    const reqUrl = new URL(req.url ?? '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = reqUrl.pathname;
    const method = req.method ?? 'GET';

    try {
      // 0. Static Web Frontends (Guest QR PWA & Kitchen Display System)
      if ((pathname === '/' || pathname === '/guest') && method === 'GET') {
        const guestHtmlPath = join(repoRoot, 'apps/web-guest/public/index.html');
        if (existsSync(guestHtmlPath)) {
          const html = readFileSync(guestHtmlPath, 'utf-8');
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(html);
          return;
        }
      }

      if (pathname === '/kds' && method === 'GET') {
        const kdsHtmlPath = join(repoRoot, 'apps/kds/public/index.html');
        if (existsSync(kdsHtmlPath)) {
          const html = readFileSync(kdsHtmlPath, 'utf-8');
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(html);
          return;
        }
      }

      if (pathname === '/owner' && method === 'GET') {
        const ownerHtmlPath = join(repoRoot, 'apps/web-owner/public/index.html');
        if (existsSync(ownerHtmlPath)) {
          const html = readFileSync(ownerHtmlPath, 'utf-8');
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(html);
          return;
        }
      }

      if (pathname === '/admin' && method === 'GET') {
        const adminHtmlPath = join(repoRoot, 'apps/web-admin/public/index.html');
        if (existsSync(adminHtmlPath)) {
          const html = readFileSync(adminHtmlPath, 'utf-8');
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(html);
          return;
        }
      }

      if (pathname === '/waiter' && method === 'GET') {
        const waiterHtmlPath = join(repoRoot, 'apps/mobile-staff/public/index.html');
        if (existsSync(waiterHtmlPath)) {
          const html = readFileSync(waiterHtmlPath, 'utf-8');
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(html);
          return;
        }
      }

      if (pathname === '/manifest.json' && method === 'GET') {
        const manifestPath = join(repoRoot, 'apps/web-guest/public/manifest.json');
        if (existsSync(manifestPath)) {
          const json = readFileSync(manifestPath, 'utf-8');
          res.writeHead(200, { 'Content-Type': 'application/manifest+json; charset=utf-8' });
          res.end(json);
          return;
        }
      }

      // 1. Healthcheck
      if (pathname === '/health' && method === 'GET') {
        sendJson(res, 200, { status: 'healthy', timestamp: new Date().toISOString() });
        return;
      }

      // Guest Table Call to Waiter
      if (pathname === '/api/v1/tables/call' && method === 'POST') {
        const body = await parseJsonBody<{ tableNumber: string; reason: string }>(req);
        const callPayload = {
          tableNumber: body.tableNumber || 'T-01',
          reason: body.reason || 'Assistance requested',
          timestamp: new Date().toISOString(),
        };

        broadcastEvent({
          type: 'TABLE_CALL_WAITER',
          tenantId: 'a0000000-0000-0000-0000-000000000001',
          outletId: 'b0000000-0000-0000-0000-000000000001',
          timestamp: new Date().toISOString(),
          payload: callPayload,
        });

        sendJson(res, 200, { success: true, message: 'Waiter notified' });
        return;
      }

      // AI Multilingual Dietary Concierge
      if (pathname === '/api/v1/ai/concierge' && method === 'POST') {
        const body = await parseJsonBody<{ query: string; locale: 'en' | 'hi' | 'te' }>(req);
        const catalog = Array.from(store.menuItems.values());
        const result = aiEngine.answerDietaryQuery(body.query || '', body.locale || 'en', catalog);
        sendJson(res, 200, result);
        return;
      }

      // AI Dynamic Flash Pricing
      if (pathname === '/api/v1/ai/pricing/flash-deals' && method === 'GET') {
        const hour = new Date().getHours();
        const deal = aiEngine.evaluateDynamicPricing(30, hour);
        sendJson(res, 200, deal);
        return;
      }

      // AI Predictive Inventory Forecaster
      if (pathname === '/api/v1/ai/inventory/forecast' && method === 'GET') {
        const sampleInventory = [
          { name: 'Fior di Latte Mozzarella', currentStock: 8.5, hourlyUsage: 4.0 }, // 2.1h left -> Critical
          { name: 'San Marzano Tomatoes', currentStock: 45.0, hourlyUsage: 6.0 }, // 7.5h left -> Healthy
          { name: 'Truffle Carpaccio', currentStock: 12.0, hourlyUsage: 3.0 }, // 4.0h left -> Moderate
        ];
        const forecast = aiEngine.predictDepletion(sampleInventory);
        sendJson(res, 200, forecast);
        return;
      }

      // 2. Real-time Server-Sent Events (SSE) Stream
      if (pathname === '/api/v1/events' && method === 'GET') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });
        res.write(': heartbeat\n\n');
        sseClients.add(res);

        req.on('close', () => {
          sseClients.delete(res);
        });
        return;
      }

      // 3. Generate Signed QR Token
      if (pathname === '/api/v1/qr/generate' && method === 'POST') {
        const body = await parseJsonBody<{
          tenantId: string;
          outletId: string;
          tableId: string;
          tableNumber: string;
        }>(req);

        if (!body.tenantId || !body.outletId || !body.tableId || !body.tableNumber) {
          sendJson(res, 400, { error: 'Missing required table parameters' });
          return;
        }

        const signedSession = createSignedQRSession(body, QR_SIGNING_SECRET);
        sendJson(res, 201, signedSession);
        return;
      }

      // 4. Verify QR Token & Resolve Table Session
      if (pathname === '/api/v1/qr/session' && method === 'GET') {
        const token = reqUrl.searchParams.get('token');
        let session: QRTableSessionPayload | null = null;

        if (token) {
          try {
            session = JSON.parse(Buffer.from(token, 'base64url').toString('utf-8'));
          } catch {
            sendJson(res, 400, { error: 'Malformed session token encoding' });
            return;
          }
        } else {
          const tenantId = reqUrl.searchParams.get('tenantId');
          const outletId = reqUrl.searchParams.get('outletId');
          const tableId = reqUrl.searchParams.get('tableId');
          const tableNumber = reqUrl.searchParams.get('tableNumber');
          const issuedAt = parseInt(reqUrl.searchParams.get('issuedAt') || '0', 10);
          const expiresAt = parseInt(reqUrl.searchParams.get('expiresAt') || '0', 10);
          const signature = reqUrl.searchParams.get('signature');

          if (tenantId && outletId && tableId && tableNumber && signature) {
            session = { tenantId, outletId, tableId, tableNumber, issuedAt, expiresAt, signature };
          }
        }

        if (!session) {
          const tableId = reqUrl.searchParams.get('tableId');
          if (tableId && store.tables.has(tableId)) {
            const table = store.tables.get(tableId)!;
            const tenant = store.tenants.get(table.tenantId)!;
            const outlet = store.outlets.get(table.outletId)!;
            sendJson(res, 200, {
              verified: true,
              isDevFallback: true,
              tenant,
              outlet,
              table,
            });
            return;
          }

          sendJson(res, 400, { error: 'Missing QR session token or parameters' });
          return;
        }

        const verification = verifyQRTableSession(session, QR_SIGNING_SECRET);
        if (!verification.isValid) {
          sendJson(res, 401, { error: 'Invalid or expired QR table session', code: verification.error });
          return;
        }

        const tenant = store.tenants.get(session.tenantId);
        const outlet = store.outlets.get(session.outletId);
        const table = store.tables.get(session.tableId);

        if (!tenant || !outlet || !table || !table.isActive) {
          sendJson(res, 404, { error: 'Table or restaurant not found' });
          return;
        }

        sendJson(res, 200, {
          verified: true,
          tenant,
          outlet,
          table,
          session,
        });
        return;
      }

      // 5. Menu Catalog
      if (pathname === '/api/v1/menu' && method === 'GET') {
        const outletId =
          reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const menu = store.getMenu(outletId);
        sendJson(res, 200, menu);
        return;
      }

      // 6. Submit Order
      if (pathname === '/api/v1/orders' && method === 'POST') {
        const body = await parseJsonBody<{
          tenantId: string;
          outletId: string;
          tableId: string;
          tableNumber: string;
          items: Array<{
            menuItemId: string;
            quantity: number;
            selectedModifiers?: Array<{
              modifierGroupId: string;
              modifierGroupName: string;
              optionId: string;
              optionName: string;
              priceDeltaCents: number;
            }>;
            notes?: string;
          }>;
          guestNotes?: string;
          tipCents?: number;
        }>(req);

        if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
          sendJson(res, 400, { error: 'Order must contain at least one item' });
          return;
        }

        const validatedItems: OrderItem[] = [];
        for (const itemInput of body.items) {
          const menuItem = store.menuItems.get(itemInput.menuItemId);
          if (!menuItem) {
            sendJson(res, 400, { error: `Menu item not found: ${itemInput.menuItemId}` });
            return;
          }
          if (!menuItem.isAvailable) {
            sendJson(res, 400, { error: `Item currently unavailable (86): ${menuItem.name}` });
            return;
          }

          let itemModifierTotal = 0;
          const selectedMods = itemInput.selectedModifiers || [];
          for (const mod of selectedMods) {
            itemModifierTotal += mod.priceDeltaCents;
          }

          const unitPriceCents = menuItem.basePriceCents;
          const itemTotalCents = (unitPriceCents + itemModifierTotal) * itemInput.quantity;

          validatedItems.push({
            id: `item_${Math.random().toString(36).substring(2, 9)}`,
            menuItemId: menuItem.id,
            name: menuItem.name,
            unitPriceCents,
            quantity: itemInput.quantity,
            selectedModifiers: selectedMods,
            itemTotalCents,
            notes: itemInput.notes,
          });
        }

        const totals = calculateOrderTotals(
          validatedItems.map((i) => ({
            unitPriceCents: i.unitPriceCents,
            quantity: i.quantity,
            selectedModifiers: i.selectedModifiers,
          })),
          8.25,
          body.tipCents || 0
        );

        const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const now = new Date().toISOString();

        const newOrder: Order = {
          id: orderId,
          tenantId: body.tenantId || 'a0000000-0000-0000-0000-000000000001',
          outletId: body.outletId || 'b0000000-0000-0000-0000-000000000001',
          tableId: body.tableId,
          tableNumber: body.tableNumber,
          status: 'CONFIRMED',
          items: validatedItems,
          subtotalCents: totals.subtotalCents,
          taxCents: totals.taxCents,
          tipCents: totals.tipCents,
          totalCents: totals.totalCents,
          guestNotes: body.guestNotes,
          createdAt: now,
          updatedAt: now,
        };

        store.orders.set(orderId, newOrder);

        broadcastEvent({
          type: 'ORDER_CREATED',
          tenantId: newOrder.tenantId,
          outletId: newOrder.outletId,
          timestamp: now,
          payload: newOrder,
        });

        sendJson(res, 201, newOrder);
        return;
      }

      // 7. Get Order by ID
      if (pathname.startsWith('/api/v1/orders/') && method === 'GET') {
        const orderId = pathname.replace('/api/v1/orders/', '');
        const order = store.orders.get(orderId);
        if (!order) {
          sendJson(res, 404, { error: 'Order not found' });
          return;
        }
        sendJson(res, 200, order);
        return;
      }

      // 8. KDS Active Orders
      if (pathname === '/api/v1/kds/orders' && method === 'GET') {
        const outletId =
          reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const orders = store.getKdsOrders(outletId);
        sendJson(res, 200, orders);
        return;
      }

      // 9. Update KDS Order Status
      if (pathname.startsWith('/api/v1/kds/orders/') && pathname.endsWith('/status') && method === 'PATCH') {
        const orderId = pathname.replace('/api/v1/kds/orders/', '').replace('/status', '');
        const body = await parseJsonBody<{ status: OrderStatus }>(req);

        if (!body.status) {
          sendJson(res, 400, { error: 'Status is required' });
          return;
        }

        const updated = store.updateOrderStatus(orderId, body.status);
        if (!updated) {
          sendJson(res, 404, { error: 'Order not found' });
          return;
        }

        broadcastEvent({
          type: 'ORDER_STATUS_CHANGED',
          tenantId: updated.tenantId,
          outletId: updated.outletId,
          timestamp: new Date().toISOString(),
          payload: updated,
        });

        sendJson(res, 200, updated);
        return;
      }

      sendJson(res, 404, { error: `Route not found: ${method} ${pathname}` });
    } catch (err) {
      console.error('Server error:', err);
      sendJson(res, 500, { error: 'Internal Server Error' });
    }
  });
}

// Auto-start server if executed directly
if (process.argv[1] && process.argv[1].endsWith('server.ts')) {
  const app = createOrderApp();
  app.listen(PORT, () => {
    console.log(`[Servora Order Service] Server listening on http://localhost:${PORT}`);
  });
}
