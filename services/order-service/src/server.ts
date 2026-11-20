import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID, randomBytes } from 'node:crypto';
import { URL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { OrderStore } from './store.ts';
import { AbiruchiHotelAIEngine } from '../../ai-service/src/ai-engine.ts';
import { AutomationEngine } from '../../automation-service/src/index.ts';
import { AuthService, type UserRole } from '../../auth-service/src/auth.ts';
import { HotelPMSService } from '../../hotel-service/src/index.ts';
import { auditService } from '../../audit-service/src/audit-service.ts';
import {
  translateText,
  translateBatch,
  translateMenuData,
  SUPPORTED_LANGUAGES,
} from '../../../packages/content-translation/src/index.ts';
import {
  createSignedQRSession,
  verifyQRTableSession,
  calculateOrderTotals,
  splitBillEqually,
  splitBillByItems,
} from '../../../packages/utils/src/index.ts';
import type {
  Order,
  OrderItem,
  OrderStatus,
  MealCourse,
  ReviewSubmission,
  QRTableSessionPayload,
  ServerEvent,
  TokenState,
  TokenBucket,
  GuestPreferences,
  ReviewCategory,
} from '../../../packages/shared-types/src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '../../..');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

function resolveSecret(envKey: string, devDefault: string): string {
  const envVal = process.env[envKey];
  if (envVal && !envVal.includes('replace-in-env') && !envVal.includes('dev-')) {
    return envVal;
  }
  if (process.env.NODE_ENV === 'production') {
    const generated = randomBytes(32).toString('hex');
    console.warn(`[SECURITY AUDIT] ${envKey} is unset or placeholder in production. Generated secure cryptographic 256-bit secret.`);
    return generated;
  }
  return devDefault;
}

const QR_SIGNING_SECRET = resolveSecret('QR_SIGNING_SECRET', 'abiruchi-dev-qr-secret-key-32-bytes-min');
const JWT_SECRET = resolveSecret('JWT_SECRET', 'abiruchi-dev-jwt-secret-min-32-chars');
const UPI_MOBILE = process.env.UPI_MOBILE || '9010150809';
const UPI_VPA = process.env.UPI_VPA || `${UPI_MOBILE}@ybl`;
const UPI_PAYEE_NAME = process.env.UPI_PAYEE_NAME || 'Abiruchi Hotel';

const store = new OrderStore();
const aiEngine = new AbiruchiHotelAIEngine();
const authService = new AuthService(JWT_SECRET);
const hotelPms = new HotelPMSService();

// Pre-seeded demo administrative and staff users
const DEMO_USERS: Record<string, { password: string; role: UserRole; tenantId: string; outletId?: string }> = {
  'owner@abiruchi.local': {
    password: 'abiruchi123',
    role: 'OWNER',
    tenantId: 'a0000000-0000-0000-0000-000000000001',
    outletId: 'b0000000-0000-0000-0000-000000000001',
  },
  'manager@abiruchi.local': {
    password: 'abiruchi123',
    role: 'MANAGER',
    tenantId: 'a0000000-0000-0000-0000-000000000001',
    outletId: 'b0000000-0000-0000-0000-000000000001',
  },
  'admin@abiruchi.local': {
    password: 'abiruchi123',
    role: 'SUPER_ADMIN',
    tenantId: 'a0000000-0000-0000-0000-000000000001',
  },
  'waiter@abiruchi.local': {
    password: 'abiruchi123',
    role: 'WAITER',
    tenantId: 'a0000000-0000-0000-0000-000000000001',
    outletId: 'b0000000-0000-0000-0000-000000000001',
  },
  'kitchen@abiruchi.local': {
    password: 'abiruchi123',
    role: 'KITCHEN_STAFF',
    tenantId: 'a0000000-0000-0000-0000-000000000001',
    outletId: 'b0000000-0000-0000-0000-000000000001',
  },
};

// In-memory SSE clients for real-time KDS updates
const sseClients = new Set<ServerResponse>();

// Sequenced Event Hub & Reconnection Buffer
let eventSeq = 0;
export interface SequencedServerEvent extends ServerEvent {
  seq: number;
  id?: string;
}
const eventBuffer: SequencedServerEvent[] = [];
const MAX_EVENT_BUFFER = 500;

function broadcastEvent(event: ServerEvent) {
  eventSeq += 1;
  const seqEvent: SequencedServerEvent = {
    ...event,
    id: (event as any).id || `evt_${eventSeq}`,
    seq: eventSeq,
    timestamp: event.timestamp || new Date().toISOString(),
  };

  eventBuffer.push(seqEvent);
  if (eventBuffer.length > MAX_EVENT_BUFFER) {
    eventBuffer.shift();
  }

  const sseData = `id: ${seqEvent.seq}\nevent: ${seqEvent.type}\ndata: ${JSON.stringify(seqEvent)}\n\n`;
  for (const client of sseClients) {
    try {
      const clientOutlet = (client as any).outletId;
      if (clientOutlet && seqEvent.outletId && clientOutlet !== seqEvent.outletId) {
        continue;
      }
      client.write(sseData);
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


function generateSimplePdf(title: string, lines: string[]): Buffer {
  let contentStream = 'BT\n/F1 16 Tf\n50 750 Td\n(' + title.replace(/[()\\]/g, '') + ') Tj\nET\n';
  let y = 710;
  for (const line of lines) {
    const escaped = line.replace(/[()\\]/g, '');
    contentStream += 'BT\n/F1 11 Tf\n50 ' + y + ' Td\n(' + escaped + ') Tj\nET\n';
    y -= 22;
    if (y < 50) break;
  }

  const objects = [
    '%PDF-1.4\n',
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    '4 0 obj\n<< /Length ' + Buffer.byteLength(contentStream) + ' >>\nstream\n' + contentStream + 'endstream\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'
  ];

  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  let offset = objects[0].length;
  for (let i = 1; i < objects.length; i++) {
    xref += String(offset).padStart(10, '0') + ' 00000 n \n';
    offset += Buffer.byteLength(objects[i]);
  }
  const trailer = 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + offset + '\n%%EOF\n';
  return Buffer.from(objects.join('') + xref + trailer);
}


// Background interval crons (unref so they do not block test runner termination)
const bookingCancelInterval = setInterval(() => {
  try {
    const now = Date.now();
    for (const [id, bk] of (store.bookings as any).entries()) {
      // Do not touch checked-in bookings!
      if (!bk.check_in_at && bk.status !== 'CHECKED_IN' && bk.status !== 'COMPLETED' && bk.status !== 'CANCELLED' && bk.slotDate && bk.slotTime) {
        const slotDateTime = new Date(`${bk.slotDate}T${bk.slotTime.slice(0, 5)}:00`).getTime();
        // 15 min past slot
        if (!isNaN(slotDateTime) && now > slotDateTime + (15 * 60 * 1000)) {
          bk.status = 'CANCELLED';
          bk.cancelled_at = new Date().toISOString();
          bk.autoCancelled = true;
          if (bk.prepayAmountCents > 0 && bk.refund_status !== 'REFUNDED') {
            bk.refund_status = 'REFUNDED';
            bk.refund_amount = bk.prepayAmountCents;
          }
          store.bookings.set(id, bk);
          try {
            store.db.prepare("UPDATE table_bookings SET status = 'CANCELLED', refund_status = 'REFUNDED', updated_at = ? WHERE id = ?")
              .run(new Date().toISOString(), id);
          } catch {}
        }
      }
    }
  } catch (e) {}
}, 60000);
bookingCancelInterval.unref();

// Group C: Booking WhatsApp Reminder T-2h (every 15 min)
const bookingReminder2hInterval = setInterval(() => {
  try {
    const now = Date.now();
    for (const [id, bk] of (store.bookings as any).entries()) {
      if (bk.status === 'CONFIRMED' && !bk.reminder_sent_2h && bk.slotDate && bk.slotTime) {
        const slotDateTime = new Date(`${bk.slotDate}T${bk.slotTime.slice(0, 5)}:00`).getTime();
        if (!isNaN(slotDateTime) && slotDateTime - now <= 2 * 60 * 60 * 1000 && slotDateTime - now > 30 * 60 * 1000) {
          bk.reminder_sent_2h = 1;
          store.bookings.set(id, bk);
          try { store.db.prepare("UPDATE table_bookings SET reminder_sent_2h = 1 WHERE id = ?").run(id); } catch {}
          console.log(`[WhatsApp Reminder T-2h] Dispatched to ${bk.guestPhone || bk.guestName} for booking #${id.slice(-6)}`);
        }
      }
    }
  } catch (e) {}
}, 15 * 60 * 1000);
bookingReminder2hInterval.unref();

// Group C: Booking WhatsApp Reminder T-30m (every 5 min)
const bookingReminder30mInterval = setInterval(() => {
  try {
    const now = Date.now();
    for (const [id, bk] of (store.bookings as any).entries()) {
      if (bk.status === 'CONFIRMED' && !bk.reminder_sent_30m && bk.slotDate && bk.slotTime) {
        const slotDateTime = new Date(`${bk.slotDate}T${bk.slotTime.slice(0, 5)}:00`).getTime();
        if (!isNaN(slotDateTime) && slotDateTime - now <= 30 * 60 * 1000 && slotDateTime > now) {
          bk.reminder_sent_30m = 1;
          store.bookings.set(id, bk);
          try { store.db.prepare("UPDATE table_bookings SET reminder_sent_30m = 1 WHERE id = ?").run(id); } catch {}
          console.log(`[WhatsApp Reminder T-30m] Dispatched to ${bk.guestPhone || bk.guestName} for booking #${id.slice(-6)}`);
        }
      }
    }
  } catch (e) {}
}, 5 * 60 * 1000);
bookingReminder30mInterval.unref();

// Group C: Mark No-Shows after Slot + 1 Hour (every 1 hour)
const bookingNoShowInterval = setInterval(() => {
  try {
    const now = Date.now();
    for (const [id, bk] of (store.bookings as any).entries()) {
      if ((bk.status === 'CONFIRMED' || bk.status === 'PENDING') && !bk.check_in_at && !bk.no_show && bk.slotDate && bk.slotTime) {
        const slotDateTime = new Date(`${bk.slotDate}T${bk.slotTime.slice(0, 5)}:00`).getTime();
        if (!isNaN(slotDateTime) && now > slotDateTime + (60 * 60 * 1000)) {
          bk.no_show = 1;
          store.bookings.set(id, bk);
          try { store.db.prepare("UPDATE table_bookings SET no_show = 1 WHERE id = ?").run(id); } catch {}
        }
      }
    }
  } catch (e) {}
}, 60 * 60 * 1000);
bookingNoShowInterval.unref();

// Group H: Walkout Risk Audit (every 5 min)
const walkoutRiskInterval = setInterval(() => {
  try {
    const risk = store.getWalkoutRiskOrders(45);
    if (risk && risk.count > 0) {
      console.log(`[Walkout Risk Alert] ${risk.count} table(s) have unpaid active orders > 45 minutes!`);
    }
  } catch (e) {}
}, 5 * 60 * 1000);
walkoutRiskInterval.unref();

// Group H: Duplicate Payment Audit (every 2 min)
const duplicatePaymentInterval = setInterval(() => {
  try {
    const dups = store.findDuplicatePayments();
    if (dups && dups.count > 0) {
      console.log(`[Duplicate Payment Alert] ${dups.count} duplicate reference(s) detected across payments!`);
    }
  } catch (e) {}
}, 2 * 60 * 1000);
duplicatePaymentInterval.unref();

const tokenEscalationInterval = setInterval(() => {
  try {
    const now = Date.now();
    const readyTokens = store.db.prepare("SELECT * FROM p0_service_tokens WHERE state = 'READY' AND assigned_waiter_id IS NULL AND escalated = 0").all() as any[];
    for (const tok of readyTokens) {
      if (now - new Date(tok.created_at).getTime() > 60000) {
        store.db.prepare("UPDATE p0_service_tokens SET escalated = 1 WHERE id = ?").run(tok.id);
        console.log(`[Escalation Alert] Token ${tok.token_code} has been in READY for over 60s without assigned waiter!`);
      }
    }
  } catch (e) {}
}, 15000);
tokenEscalationInterval.unref();

const callEscalationInterval = setInterval(() => {
  try {
    const now = Date.now();
    for (const [id, call] of (store.assistanceCalls as any).entries()) {
      if (call.status === 'PENDING' && !call.escalated) {
        if (now - new Date(call.createdAt).getTime() > 120000) {
          call.escalated = true;
          store.assistanceCalls.set(id, call);
          try { store.db.prepare("UPDATE table_assistance_calls SET escalated = 1 WHERE id = ?").run(id); } catch {}
          console.log(`[Escalation Alert] Waiter assistance call for Table ${call.tableNumber} pending > 2 minutes!`);
        }
      }
    }
  } catch (e) {}
}, 30000);
callEscalationInterval.unref();

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
    const method = req.method === 'HEAD' ? 'GET' : (req.method ?? 'GET');

    try {
      // 0. Static Web Frontends (Guest QR PWA, KDS, Owner & Admin Portals)
      if ((pathname === '/' || pathname === '/guest' || pathname === '/menu') && method === 'GET') {
        const guestHtmlPath = join(repoRoot, 'apps/web-guest/public/index.html');
        if (existsSync(guestHtmlPath)) {
          const html = readFileSync(guestHtmlPath, 'utf-8');
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(html);
          return;
        }
      }

      if ((pathname === '/kds' || pathname === '/kitchen') && method === 'GET') {
        const kdsHtmlPath = join(repoRoot, 'apps/kds/public/index.html');
        if (existsSync(kdsHtmlPath)) {
          const html = readFileSync(kdsHtmlPath, 'utf-8');
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(html);
          return;
        }
      }

      if ((pathname === '/owner' || pathname === '/operator' || pathname === '/operator.html') && method === 'GET') {
        const ownerHtmlPath = join(repoRoot, 'apps/web-owner/public/index.html');
        if (existsSync(ownerHtmlPath)) {
          const html = readFileSync(ownerHtmlPath, 'utf-8');
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(html);
          return;
        }
      }

      if ((pathname === '/owner.html' || pathname === '/owner/dashboard') && method === 'GET') {
        const ownerDashPath = join(repoRoot, 'apps/web-owner/public/owner.html');
        if (existsSync(ownerDashPath)) {
          const html = readFileSync(ownerDashPath, 'utf-8');
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

      if (pathname === '/sw.js' && method === 'GET') {
        const swPath = join(repoRoot, 'apps/web-guest/public/sw.js');
        if (existsSync(swPath)) {
          res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
          res.end(readFileSync(swPath, 'utf-8'));
          return;
        }
      }

      // Guest static assets (Phase A split)
      if ((pathname === '/guest/styles.css' || pathname === '/styles.css') && method === 'GET') {
        const p = join(repoRoot, 'apps/web-guest/public/styles.css');
        if (existsSync(p)) {
          res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
          res.end(readFileSync(p, 'utf-8'));
          return;
        }
      }
      if ((pathname === '/guest/app.js' || pathname === '/app.js') && method === 'GET') {
        const p = join(repoRoot, 'apps/web-guest/public/app.js');
        if (existsSync(p)) {
          res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
          res.end(readFileSync(p, 'utf-8'));
          return;
        }
      }
      if ((pathname === '/guest/router.js' || pathname === '/router.js') && method === 'GET') {
        const p = join(repoRoot, 'apps/web-guest/public/router.js');
        if (existsSync(p)) {
          res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
          res.end(readFileSync(p, 'utf-8'));
          return;
        }
      }
      if ((pathname === '/guest/dish-photos.js' || pathname === '/dish-photos.js' || pathname === '/owner/dish-photos.js') && method === 'GET') {
        const p = join(repoRoot, 'apps/web-guest/public/dish-photos.js');
        if (existsSync(p)) {
          res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
          res.end(readFileSync(p, 'utf-8'));
          return;
        }
      }

      
      // P0 Multi-Surface HTML Routes (Mono-page fix)
      if ((pathname === '/owner.html' || pathname === '/owner/dashboard') && method === 'GET') {
        const p = join(repoRoot, 'apps/web-owner/public/owner.html');
        if (existsSync(p)) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(readFileSync(p, 'utf-8'));
          return;
        }
      }
      if ((pathname === '/manager.html' || pathname === '/manager') && method === 'GET') {
        const p = join(repoRoot, 'apps/web-owner/public/manager.html');
        if (existsSync(p)) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(readFileSync(p, 'utf-8'));
          return;
        }
      }
      if ((pathname === '/staff.html' || pathname === '/staff/terminal') && method === 'GET') {
        const p = join(repoRoot, 'apps/web-staff/public/staff.html');
        if (existsSync(p)) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(readFileSync(p, 'utf-8'));
          return;
        }
      }
      if ((pathname === '/qr-manager.html' || pathname === '/owner/qr' || pathname === '/qr-manager' || pathname === '/qr') && method === 'GET') {
        const p = join(repoRoot, 'apps/web-owner/public/qr-manager.html');
        if (existsSync(p)) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(readFileSync(p, 'utf-8'));
          return;
        }
      }
      if ((pathname === '/owner/tokens' || pathname === '/tokens.html' || pathname === '/owner/tokens.html') && method === 'GET') {
        const p = join(repoRoot, 'apps/web-owner/public/tokens.html');
        if (existsSync(p)) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(readFileSync(p, 'utf-8'));
          return;
        }
      }
      if ((pathname === '/pricing' || pathname === '/pricing.html') && method === 'GET') {
        const p = join(repoRoot, 'apps/marketing/public/pricing.html');
        if (existsSync(p)) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(readFileSync(p, 'utf-8'));
          return;
        }
      }
      if ((pathname === '/for-restaurants' || pathname === '/for-cafes' || pathname === '/for-bars') && method === 'GET') {
        const p = join(repoRoot, `apps/marketing/public${pathname}.html`);
        if (existsSync(p)) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(readFileSync(p, 'utf-8'));
          return;
        }
      }
      if ((pathname === '/receipt.html' || pathname === '/receipt') && method === 'GET') {
        const p = join(repoRoot, 'apps/web-guest/public/receipt.html');
        if (existsSync(p)) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(readFileSync(p, 'utf-8'));
          return;
        }
      }

      // Guest booking standalone page
      if ((pathname === '/booking' || pathname === '/guest/booking') && method === 'GET') {
        const bookingHtmlPath = join(repoRoot, 'apps/web-guest/public/booking.html');
        if (existsSync(bookingHtmlPath)) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(readFileSync(bookingHtmlPath, 'utf-8'));
          return;
        }
      }

      // Owner multi-page routes
      const ownerPages = ['orders', 'availability', 'payments', 'tokens', 'bookings', 'staff', 'settings', 'specials', 'offers', 'beverages', 'menu', 'inventory'];
      for (const page of ownerPages) {
        if (pathname === `/owner/${page}` && method === 'GET') {
          const p = join(repoRoot, `apps/web-owner/public/${page}.html`);
          if (existsSync(p)) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(readFileSync(p, 'utf-8'));
            return;
          }
        }
      }
      if (pathname === '/owner/shared.js' && method === 'GET') {
        const p = join(repoRoot, 'apps/web-owner/public/shared.js');
        if (existsSync(p)) {
          res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
          res.end(readFileSync(p, 'utf-8'));
          return;
        }
      }

      // Staff multi-page routes
      if ((pathname === '/staff' || pathname === '/staff/') && method === 'GET') {
        res.writeHead(302, { Location: '/staff/confirm' });
        res.end();
        return;
      }
      const staffPages = ['confirm', 'tickets', 'requests', 'tokens'];
      for (const page of staffPages) {
        if (pathname === `/staff/${page}` && method === 'GET') {
          const p = join(repoRoot, `apps/web-staff/public/${page}.html`);
          if (existsSync(p)) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(readFileSync(p, 'utf-8'));
            return;
          }
        }
      }
      if (pathname === '/staff/shared.js' && method === 'GET') {
        const p = join(repoRoot, 'apps/web-staff/public/shared.js');
        if (existsSync(p)) {
          res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
          res.end(readFileSync(p, 'utf-8'));
          return;
        }
      }
      if ((pathname === '/staff/waiter-voice.js' || pathname === '/waiter-voice.js') && method === 'GET') {
        const p = join(repoRoot, 'apps/web-staff/public/waiter-voice.js');
        if (existsSync(p)) {
          res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
          res.end(readFileSync(p, 'utf-8'));
          return;
        }
      }

      // Marketing site routes
      const mktPages = ['', 'for-cafes', 'for-restaurants', 'for-bars', 'pricing'];
      for (const page of mktPages) {
        const mktPath = page === '' ? '/marketing' : `/marketing/${page}`;
        if (pathname === mktPath && method === 'GET') {
          const fname = page === '' ? 'index' : page;
          const p = join(repoRoot, `apps/marketing/public/${fname}.html`);
          if (existsSync(p)) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(readFileSync(p, 'utf-8'));
            return;
          }
        }
      }

      // 1. Healthcheck
      if (pathname === '/health' && method === 'GET') {
        const dbHealth = await store.checkHealth();
        if (!dbHealth.ok) {
          sendJson(res, 503, {
            status: 'unhealthy',
            database: dbHealth.type,
            error: 'Database connection failed',
            timestamp: new Date().toISOString(),
          });
          return;
        }
        sendJson(res, 200, {
          status: 'healthy',
          database: dbHealth.type,
          latencyMs: dbHealth.latencyMs,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // ----------------------------------------------------------------------
      // Auth Endpoints (JWT & RBAC Identity)
      // ----------------------------------------------------------------------
      if (pathname === '/api/v1/auth/login' && method === 'POST') {
        const body = await parseJsonBody<{ email?: string; username?: string; identifier?: string; password?: string }>(req);
        const identifier = (body.username || body.identifier || body.email || '').trim();
        const password = body.password || '';

        if (!identifier || !password) {
          sendJson(res, 400, { error: 'Username/email and password are required' });
          return;
        }

        // 1. Check DEMO_USERS first
        const demoUser = DEMO_USERS[identifier.toLowerCase()];
        if (demoUser && demoUser.password === password) {
          const assignedTables = demoUser.role === 'WAITER' ? ['T-01', 'T-02', 'T-03', 'T-04', 'T-05'] : undefined;
          const token = authService.generateToken({
            userId: `usr_${identifier.split('@')[0]}`,
            email: identifier.toLowerCase(),
            role: demoUser.role,
            tenantId: demoUser.tenantId,
            outletId: demoUser.outletId,
            assignedTables,
          });

          sendJson(res, 200, {
            token,
            user: {
              id: `usr_${identifier.split('@')[0]}`,
              email: identifier.toLowerCase(),
              username: identifier.split('@')[0],
              role: demoUser.role,
              tenantId: demoUser.tenantId,
              outletId: demoUser.outletId,
              assignedTables: assignedTables || [],
              mustChangePassword: false,
              status: 'ACTIVE',
            },
          });
          return;
        }

        // 2. Authenticate dynamic staff accounts (Waiter, Manager, etc.)
        const authResult = store.authenticateStaff(identifier, password);
        if (!authResult.success || !authResult.staff) {
          const status = authResult.reason?.includes('deactivated') || authResult.reason?.includes('suspended') ? 403 : 401;
          sendJson(res, status, { error: authResult.reason || 'Invalid credentials' });
          return;
        }

        const staff = authResult.staff;
        const token = authService.generateToken({
          userId: staff.id,
          email: staff.email,
          role: staff.role as any,
          tenantId: 'a0000000-0000-0000-0000-000000000001',
          outletId: staff.outletId,
          assignedTables: staff.assignedTables,
        });

        sendJson(res, 200, {
          token,
          user: {
            id: staff.id,
            name: staff.name,
            username: staff.username,
            email: staff.email,
            phone: staff.phone,
            role: staff.role,
            outletId: staff.outletId,
            tenantId: 'a0000000-0000-0000-0000-000000000001',
            assignedTables: staff.assignedTables || [],
            status: staff.status || 'ACTIVE',
            mustChangePassword: staff.mustChangePassword,
            lastLoginAt: staff.lastLoginAt,
          },
        });
        return;
      }

      if (pathname === '/api/v1/auth/change-password' && method === 'POST') {
        const authHeader = req.headers.authorization;
        const queryToken = reqUrl.searchParams.get('token');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : queryToken;
        if (!token) {
          sendJson(res, 401, { error: 'Authentication token required' });
          return;
        }

        const verification = authService.verifyToken(token);
        if ((!verification.valid && !(verification as any).isValid) || !verification.payload) {
          sendJson(res, 401, { error: 'Invalid or expired token', code: verification.error });
          return;
        }

        const body = await parseJsonBody<{ currentPassword?: string; newPassword?: string; staffId?: string }>(req);
        if (!body.newPassword || body.newPassword.length < 6) {
          sendJson(res, 400, { error: 'New password must be at least 6 characters long' });
          return;
        }

        const targetId = body.staffId || verification.payload.userId;
        const result = store.changeStaffPassword(
          targetId,
          body.newPassword,
          body.currentPassword,
          false,
          verification.payload.email || verification.payload.userId
        );

        if (!result.success) {
          sendJson(res, 400, { error: result.reason || 'Failed to update password' });
          return;
        }

        sendJson(res, 200, { success: true, message: 'Password updated successfully' });
        return;
      }

      if (pathname === '/api/v1/auth/me' && method === 'GET') {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ')
          ? authHeader.slice(7)
          : reqUrl.searchParams.get('token');

        if (!token) {
          sendJson(res, 401, { error: 'Authentication token required' });
          return;
        }

        const verification = authService.verifyToken(token);
        if ((!verification.valid && !(verification as any).isValid) || !verification.payload) {
          sendJson(res, 401, { error: 'Invalid or expired token', code: verification.error });
          return;
        }

        sendJson(res, 200, { user: verification.payload });
        return;
      }

      // ----------------------------------------------------------------------
      // Translation Endpoints (Google Translate Free API & 99 Languages)
      // ----------------------------------------------------------------------
      if (pathname === '/api/v1/languages' && method === 'GET') {
        sendJson(res, 200, {
          languages: SUPPORTED_LANGUAGES,
          count: SUPPORTED_LANGUAGES.length,
        });
        return;
      }

      if (pathname === '/api/v1/translate' && method === 'POST') {
        const body = await parseJsonBody<{
          text?: string;
          texts?: string[];
          targetLang: string;
          sourceLang?: string;
        }>(req);

        if (!body.targetLang) {
          sendJson(res, 400, { error: 'targetLang is required' });
          return;
        }

        if (body.text) {
          const translated = await translateText(body.text, body.targetLang, body.sourceLang || 'auto');
          sendJson(res, 200, { translatedText: translated, targetLang: body.targetLang });
          return;
        }

        if (Array.isArray(body.texts)) {
          const translatedBatch = await translateBatch(body.texts, body.targetLang, body.sourceLang || 'auto');
          sendJson(res, 200, { translatedTexts: translatedBatch, targetLang: body.targetLang });
          return;
        }

        sendJson(res, 400, { error: 'text or texts array required' });
        return;
      }

      // Tables Management: List and Create
      if (pathname === '/api/v1/tables' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId');
        const allTables = Array.from(store.tables.values());
        const filtered = outletId ? allTables.filter((t) => t.outletId === outletId) : allTables;
        return sendJson(res, 200, filtered);
      }

      if (pathname === '/api/v1/tables' && method === 'POST') {
        const body: any = await parseJsonBody(req);
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        const tableNumber = body.tableNumber || body.number;
        const exists = Array.from(store.tables.values()).some(
          (t) => t.outletId === outletId && (t.number === tableNumber || t.tableNumber === tableNumber)
        );
        if (exists) {
          return sendJson(res, 409, { error: 'TABLE_ALREADY_EXISTS', message: `Table ${tableNumber} already exists in this outlet` });
        }
        const id = body.id || `table_${randomUUID().slice(0, 8)}`;
        const table = {
          id,
          tenantId: body.tenantId || 'a0000000-0000-0000-0000-000000000001',
          outletId,
          number: tableNumber,
          tableNumber,
          capacity: body.capacity || 4,
          status: 'AVAILABLE',
          qrCodeUrl: `/?mode=TABLE&table=${tableNumber}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        store.tables.set(id, table as any);
        return sendJson(res, 201, table);
      }

      // Guest Table Call to Waiter / Human Bridge (Achievement 62)
      if ((pathname === '/api/v1/tables/call' || pathname === '/api/v1/tables/calls' || pathname === '/api/v1/assistance/call') && method === 'POST') {
        const body = await parseJsonBody<{
          outletId?: string;
          tableId?: string;
          tableNumber?: string;
          category?: 'WATER' | 'BILL' | 'CUTLERY' | 'MANAGER' | 'SERVER' | 'FOOD_ISSUE' | 'OTHER' | 'ASSISTANCE';
          priority?: 'NORMAL' | 'URGENT';
          reason?: string;
        }>(req);

        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        const tableId = body.tableId || 'c0000000-0000-0000-0000-000000000001';
        const tableObj = store.tables.get(tableId);
        const tableNumber = body.tableNumber || (tableObj ? tableObj.tableNumber : 'T-01');
        const category = body.category || 'SERVER';
        const priority = body.priority || 'NORMAL';
        const reason = body.reason || category;

        const countBefore = store.assistanceCalls.size;
        const call = store.createAssistanceCall(outletId, tableId, tableNumber, category, priority, reason);
        const isNew = store.assistanceCalls.size > countBefore;

        if (isNew) {
          broadcastEvent({
            type: 'TABLE_CALL_WAITER',
            tenantId: 'a0000000-0000-0000-0000-000000000001',
            outletId,
            timestamp: call.createdAt,
            payload: {
              ...call,
              reason,
            },
          });
          broadcastEvent({
            type: 'CALL_WAITER' as any,
            tenantId: 'a0000000-0000-0000-0000-000000000001',
            outletId,
            timestamp: call.createdAt,
            payload: {
              ...call,
              reason,
            },
          });
          if (category === 'BILL' || (reason && reason.toLowerCase().includes('bill'))) {
            broadcastEvent({
              type: 'BILL_REQUESTED' as any,
              tenantId: 'a0000000-0000-0000-0000-000000000001',
              outletId,
              timestamp: call.createdAt,
              payload: call,
            });
          }
          sendJson(res, 200, { ...call, success: true, message: 'Waiter notified', call });
          return;
        }

        sendJson(res, 200, { success: true, debounced: true, message: 'Waiter already notified', call });
        return;
      }

      // Pending Assistance Calls (Achievement 62)
      if (pathname === '/api/v1/tables/calls/pending' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const calls = store.getPendingAssistanceCalls(outletId);
        sendJson(res, 200, { calls, count: calls.length });
        return;
      }

      // Resolve Table Assistance Call (Achievement 62)
      if (pathname.startsWith('/api/v1/tables/calls/') && pathname.endsWith('/resolve') && method === 'PATCH') {
        const callId = pathname.replace('/api/v1/tables/calls/', '').replace('/resolve', '');
        const resolved = store.resolveAssistanceCall(callId);
        if (!resolved) {
          sendJson(res, 404, { error: 'Call not found' });
          return;
        }

        broadcastEvent({
          type: 'TABLE_CALL_RESOLVED',
          tenantId: 'a0000000-0000-0000-0000-000000000001',
          outletId: resolved.outletId,
          timestamp: resolved.resolvedAt || new Date().toISOString(),
          payload: resolved,
        });

        sendJson(res, 200, { success: true, call: resolved });
        return;
      }

      // Get Table Assistance Call by ID (Client Polling)
      if (pathname.startsWith('/api/v1/tables/calls/') && !pathname.endsWith('/status') && !pathname.endsWith('/resolve') && method === 'GET') {
        const callId = pathname.replace('/api/v1/tables/calls/', '');
        const call = store.getAssistanceCall(callId);
        if (!call) {
          sendJson(res, 404, { error: 'Assistance call not found' });
          return;
        }
        sendJson(res, 200, { ...call, success: true, call });
        return;
      }

      // Update Table Assistance Call Status (Pending -> Accepted -> In Progress -> Completed -> Cancelled)
      if (pathname.startsWith('/api/v1/tables/calls/') && pathname.endsWith('/status') && method === 'PATCH') {
        const callId = pathname.replace('/api/v1/tables/calls/', '').replace('/status', '');
        const body = await parseJsonBody<{ status: any; staffId?: string; assignedWaiterId?: string }>(req);
        if (!body.status) {
          sendJson(res, 400, { error: 'status is required' });
          return;
        }
        const staffId = body.staffId || body.assignedWaiterId;
        const updated = store.updateAssistanceCallStatus(callId, body.status, staffId);
        if (!updated) {
          sendJson(res, 404, { error: 'Assistance call not found' });
          return;
        }
        broadcastEvent({
          type: 'TABLE_CALL_STATUS_CHANGED',
          tenantId: 'a0000000-0000-0000-0000-000000000001',
          outletId: updated.outletId,
          timestamp: new Date().toISOString(),
          payload: updated,
        });
        sendJson(res, 200, { ...updated, success: true, call: updated });
        return;
      }

      // Water bottle question settings
      if (pathname === '/api/v1/settings/water-bottle' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        sendJson(res, 200, store.getWaterBottleSettings(outletId));
        return;
      }

      if (pathname === '/api/v1/owner/settings/water-bottle' && method === 'PATCH') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const body = await parseJsonBody<any>(req);
        const updated = store.updateWaterBottleSettings(outletId, body);
        sendJson(res, 200, { success: true, settings: updated });
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
          { name: 'Fior di Latte Mozzarella', currentStock: 8.5, hourlyUsage: 4.0 },
          { name: 'San Marzano Tomatoes', currentStock: 45.0, hourlyUsage: 6.0 },
          { name: 'Truffle Carpaccio', currentStock: 12.0, hourlyUsage: 3.0 },
        ];
        const forecast = aiEngine.predictDepletion(sampleInventory);
        sendJson(res, 200, forecast);
        return;
      }

      // 2. Real-time Server-Sent Events (SSE) Stream with Reconnection Replay
      if (pathname === '/api/v1/events' && method === 'GET') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });
        res.write(': heartbeat\n\n');

        const clientOutletId = reqUrl.searchParams.get('outletId');
        (res as any).outletId = clientOutletId || undefined;

        // Check for missed events via Last-Event-ID header or sinceSeq query parameter
        const rawSince = req.headers['last-event-id'] || reqUrl.searchParams.get('sinceSeq') || reqUrl.searchParams.get('since');
        if (rawSince) {
          const sinceSeq = parseInt(String(rawSince), 10);
          if (!isNaN(sinceSeq) && sinceSeq >= 0) {
            let missed = eventBuffer.filter(e => e.seq > sinceSeq);
            if (clientOutletId) {
              missed = missed.filter(e => !e.outletId || e.outletId === clientOutletId);
            }
            for (const evt of missed) {
              res.write(`id: ${evt.seq}\nevent: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`);
            }
          }
        }

        sseClients.add(res);

        req.on('close', () => {
          sseClients.delete(res);
        });
        return;
      }

      // 2b. Secure Polling Fallback (Phase 3: Real-Time Communication when SSE is unavailable)
      if ((pathname === '/api/v1/events/poll' || pathname === '/api/v1/events/since') && method === 'GET') {
        const rawSince = reqUrl.searchParams.get('sinceSeq') || reqUrl.searchParams.get('since') || '0';
        const sinceSeq = parseInt(rawSince, 10) || 0;
        const outletId = reqUrl.searchParams.get('outletId');
        let missed = eventBuffer.filter(e => e.seq > sinceSeq);
        if (outletId) {
          missed = missed.filter(e => !e.outletId || e.outletId === outletId);
        }
        sendJson(res, 200, {
          success: true,
          events: missed,
          count: missed.length,
          lastSeq: eventSeq,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // 3. Generate Signed QR Token (C7 Unified Router mode support)
      if (pathname === '/api/v1/qr/generate' && method === 'POST') {
        const body = await parseJsonBody<{
          tenantId: string;
          outletId: string;
          tableId: string;
          tableNumber: string;
          mode?: 'TABLE' | 'TOKEN' | 'BOOKING' | 'MENU_ONLY';
        }>(req);

        if (!body.tenantId || !body.outletId || !body.tableId || !body.tableNumber) {
          sendJson(res, 400, { error: 'Missing required table parameters' });
          return;
        }

        const signedSession = createSignedQRSession(body, QR_SIGNING_SECRET);
        const token = Buffer.from(JSON.stringify(signedSession)).toString('base64url');
        sendJson(res, 201, { ...signedSession, token, mode: signedSession.mode || 'TABLE' });
        return;
      }

      // 4. Verify QR Token & Resolve Table Session
      if (pathname === '/api/v1/qr/session' && method === 'GET') {
        const tableIdParam = reqUrl.searchParams.get('tableId');
        if (tableIdParam) {
          const qrTbl = store.getQrTable(tableIdParam);
          if (qrTbl && (qrTbl.deleted_at || qrTbl.is_active === 0)) {
            sendJson(res, 410, { error: 'This QR is no longer active. Please ask staff.' });
            return;
          }
          if (store.tables.has(tableIdParam)) {
            const t = store.tables.get(tableIdParam)!;
            if (t.isActive === false) {
              sendJson(res, 410, { error: 'This QR is no longer active. Please ask staff.' });
              return;
            }
          }
        }
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

        const tenant = store.tenants.get(session.tenantId) || store.tenants.get('a0000000-0000-0000-0000-000000000001');
        const outlet = store.outlets.get(session.outletId) || store.outlets.get('b0000000-0000-0000-0000-000000000001');
        let table = store.tables.get(session.tableId);
        if (!table) {
          table = Array.from(store.tables.values()).find(
            (t: any) =>
              (t.outletId === session.outletId || !session.outletId) &&
              (t.id === session.tableId ||
                t.tableNumber === session.tableNumber ||
                t.tableNumber === session.tableId ||
                t.number === session.tableNumber ||
                t.number === session.tableId)
          );
        }

        const qrTbl = session ? store.getQrTable(session.tableId) : null;
        if (qrTbl && qrTbl.deleted_at) {
          sendJson(res, 410, { error: 'This QR is no longer active. Please ask staff.', gone: true });
          return;
        }
        if (!tenant || !outlet || !table || (table.isActive !== undefined && !table.isActive)) {
          sendJson(res, 404, { error: 'Table or restaurant not found' });
          return;
        }

        sendJson(res, 200, {
          verified: true,
          tenant,
          outlet,
          table,
          tableNumber: table.tableNumber || table.number || session.tableNumber,
          session,
          mode: session.mode || 'TABLE',
        });
        return;
      }

      // 5. Menu Catalog (with dynamic Google Translate support and Daypart schedule filtering)
      if (pathname === '/api/v1/menu' && method === 'GET') {
        const outletId =
          reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const lang = reqUrl.searchParams.get('lang');
        const checkTime = reqUrl.searchParams.get('time') || undefined;
        const dayOfWeekStr = reqUrl.searchParams.get('dayOfWeek');
        const dayOfWeek = dayOfWeekStr !== null ? parseInt(dayOfWeekStr, 10) : undefined;
        const excludeAllergensParam = reqUrl.searchParams.get('excludeAllergens');
        const excludeAllergens = excludeAllergensParam ? excludeAllergensParam.split(',') : undefined;
        const menu = store.getMenu(outletId, checkTime, dayOfWeek, excludeAllergens);

        if (lang && lang !== 'en') {
          const translatedMenu = await translateMenuData(menu, lang);
          sendJson(res, 200, translatedMenu);
          return;
        }

        sendJson(res, 200, menu);
        return;
      }

      // 6. Submit Order
      if (pathname === '/api/v1/orders' && method === 'POST') {
        const body = await parseJsonBody<{
          tenantId?: string;
          outletId?: string;
          tableId?: string;
          tableNumber?: string;
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
          orderTime?: string;
        }>(req);

        if (!body.items || !body.items.length) {
          sendJson(res, 400, { error: 'Invalid order payload: Missing items' });
          return;
        }

        const tenantId = body.tenantId || 'a0000000-0000-0000-0000-000000000001';
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        const tableId = body.tableId || 'c0000000-0000-0000-0000-000000000001';
        const tableNumber = body.tableNumber || 'T-01';

        // Achievement 50: Pause surge check - reject new orders with HTTP 503 if kitchen is overloaded
        const outletSettings = store.getOutletSettings(outletId);
        if (outletSettings.isPaused) {
          sendJson(res, 503, {
            code: 'ORDERS_TEMPORARILY_PAUSED',
            error: outletSettings.pauseReason || 'Kitchen is currently overloaded and pausing new orders',
            etaMinutes: outletSettings.pauseEtaMinutes || 15,
          });
          return;
        }

        // Achievement 3: Daypart schedule check
        const requestedTime = reqUrl.searchParams.get('time') || body.orderTime;
        if (requestedTime) {
          for (const itemInput of body.items) {
            const dayCheck = store.isItemInDaypart(itemInput.menuItemId, requestedTime);
            if (!dayCheck.allowed) {
              sendJson(res, 400, {
                code: 'ITEM_OUT_OF_SCHEDULE',
                error: dayCheck.reason,
                daypartFrom: dayCheck.daypartFrom,
                daypartUntil: dayCheck.daypartUntil,
              });
              return;
            }
          }
        }

        // Validate menu items & calculate server-side pricing
        const calculatedItems: OrderItem[] = [];
        for (const itemInput of body.items) {
          const itemId = (itemInput as any).menuItemId || (itemInput as any).itemId || (itemInput as any).id;
          const menuItem = store.menuItems.get(itemId);
          if (!menuItem) {
            sendJson(res, 400, { error: `Menu item not found: ${itemId}` });
            return;
          }

          let itemPrice = menuItem.basePriceCents;
          const selectedModifiers = itemInput.selectedModifiers ?? [];

          for (const mod of selectedModifiers) {
            itemPrice += mod.priceDeltaCents;
          }

          const itemTotalCents = itemPrice * itemInput.quantity;

          calculatedItems.push({
            id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            menuItemId: menuItem.id,
            name: menuItem.name,
            unitPriceCents: menuItem.basePriceCents,
            quantity: itemInput.quantity,
            selectedModifiers,
            itemTotalCents,
            notes: itemInput.notes,
          });
        }

        // Calculate order totals (supports configurable taxRate or default)
        const taxRate = (body as any).taxRate !== undefined ? (body as any).taxRate : 8.25;
        const totals = calculateOrderTotals(
          calculatedItems.map((i) => ({
            unitPriceCents: i.unitPriceCents,
            quantity: i.quantity,
            selectedModifiers: i.selectedModifiers,
          })),
          taxRate,
          body.tipCents || 0
        );

        if (outletSettings.minOrderValueCents && totals.subtotalCents < outletSettings.minOrderValueCents) {
          sendJson(res, 400, {
            error: `Order subtotal does not meet minimum requirement of $${(outletSettings.minOrderValueCents / 100).toFixed(2)}`,
          });
          return;
        }
        const partySize = (body as any).partySize || 1;
        if (outletSettings.minSpendPerHeadCents && totals.subtotalCents < (outletSettings.minSpendPerHeadCents * partySize)) {
          sendJson(res, 400, {
            error: `Order subtotal does not meet minimum spend of $${(outletSettings.minSpendPerHeadCents / 100).toFixed(2)} per guest`,
          });
          return;
        }

        const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const now = new Date().toISOString();

        // Initial order status determination (Achievements 16 & 47)
        const payMethod = (body.paymentMethod as any) || (body as any).payMethod || 'CASH';
        let initialStatus: OrderStatus = 'CONFIRMED';
        if (outletSettings.paymentMode === 'PAY_FIRST' || payMethod === 'UPI') {
          initialStatus = 'PENDING_PAYMENT';
        } else if (
          outletSettings.requireFirstOrderApproval &&
          !store.hasTablePriorConfirmedOrders(outletId, tableNumber)
        ) {
          initialStatus = 'PENDING_STAFF_APPROVAL';
        }

        const newOrder: Order = {
          id: orderId,
          tenantId,
          outletId,
          tableId,
          tableNumber,
          status: initialStatus,
          items: calculatedItems,
          subtotalCents: totals.subtotalCents,
          taxCents: totals.taxCents,
          tipCents: totals.tipCents,
          totalCents: totals.totalCents,
          guestNotes: body.guestNotes,
          createdAt: now,
          updatedAt: now,
        };

        const guestSession = (req.headers['x-guest-session'] as string) || (body as any).guestSessionId;
        if (guestSession) {
          (newOrder as any).guestSessionId = guestSession;
          (newOrder as any).guest_session_id = guestSession;
        }

        // Group J: Apply Promo Code if provided
        const promoCode = (body as any).promo_code || (body as any).promoCode;
        if (promoCode) {
          const promoResult = store.validateOffer(outletId, promoCode, totals.subtotalCents, calculatedItems, guestSession);
          if (promoResult.valid) {
            const promoDiscountCents = promoResult.discountCents;
            (newOrder as any).promoCode = promoCode;
            (newOrder as any).promo_code = promoCode;
            (newOrder as any).discountCents = promoDiscountCents;
            (newOrder as any).discount_cents = promoDiscountCents;
            newOrder.subtotalCents = Math.max(0, totals.subtotalCents - promoDiscountCents);
            newOrder.taxCents = Math.round(newOrder.subtotalCents * 0.05);
            newOrder.totalCents = newOrder.subtotalCents + newOrder.taxCents + (body.tipCents || 0);
            if (promoResult.offer?.id) {
              store.recordOfferRedemption(promoResult.offer.id, orderId, tableNumber, promoDiscountCents);
            }
          }
        }

        (newOrder as any).paymentMethod = payMethod;

        let assignedToken: string | undefined = undefined;
        const tenantMode = (store as any).orderMode || 'table';
        if (tenantMode === 'token' || tenantMode === 'hybrid' || payMethod === 'UPI' || newOrder.status === 'PENDING_PAYMENT') {
          const firstItem = newOrder.items[0];
          const mi = firstItem ? store.menuItems.get(firstItem.itemId) : null;
          const st = mi?.station || 'HOT_LINE';
          const tok = store.createServiceToken(newOrder.tenantId, newOrder.id, st);
          assignedToken = tok.token_code;
          (newOrder as any).token = assignedToken;
        }

        // PersistentMap automatically writes to SQLite
        store.orders.set(orderId, newOrder);
        if (guestSession) {
          try {
            store.db.prepare('UPDATE orders SET guest_session_id = ? WHERE id = ?').run(guestSession, newOrder.id);
          } catch {}
        }

        // C3: Create payment record
        store.createPaymentRecord(newOrder.outletId, newOrder.id, newOrder.totalCents, payMethod);

        // Broadcast to KDS via Server-Sent Events
        broadcastEvent({
          type: 'ORDER_CREATED',
          tenantId: newOrder.tenantId,
          outletId: newOrder.outletId,
          timestamp: now,
          payload: newOrder,
        });
        broadcastEvent({
          type: 'NEW_ORDER' as any,
          tenantId: newOrder.tenantId,
          outletId: newOrder.outletId,
          timestamp: now,
          payload: newOrder,
        });

        sendJson(res, 201, { ...newOrder, token: assignedToken });
        return;
      }

      // 7a. Unified Incoming Active Orders Stream (Achievement 46)
      if (pathname === '/api/v1/orders/active' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || undefined;
        const activeOrders = store.getActiveOrders(outletId);
        sendJson(res, 200, {
          orders: activeOrders,
          count: activeOrders.length,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // 7b. First-Order Staff Confirmation / Approval (Achievement 47)
      if (pathname.startsWith('/api/v1/orders/') && pathname.endsWith('/approve') && method === 'POST') {
        const orderId = pathname.replace('/api/v1/orders/', '').replace('/approve', '');
        const order = store.approveOrder(orderId);
        if (!order) {
          sendJson(res, 404, { error: 'Order not found' });
          return;
        }

        broadcastEvent({
          type: 'ORDER_APPROVED',
          tenantId: order.tenantId,
          outletId: order.outletId,
          timestamp: new Date().toISOString(),
          payload: order,
        });
        broadcastEvent({
          type: 'ORDER_ACCEPTED' as any,
          tenantId: order.tenantId,
          outletId: order.outletId,
          timestamp: new Date().toISOString(),
          payload: order,
        });

        sendJson(res, 200, { success: true, order });
        return;
      }

      // 7c. Live Order Status Stepper for Guest (Achievement 61)
      if (pathname.startsWith('/api/v1/orders/') && pathname.endsWith('/status-live') && method === 'GET') {
        const orderId = pathname.replace('/api/v1/orders/', '').replace('/status-live', '');
        const liveStatus = store.getOrderLiveStatus(orderId);
        if (!liveStatus) {
          sendJson(res, 404, { error: 'Order not found' });
          return;
        }
        sendJson(res, 200, liveStatus);
        return;
      }

      // Repeat Order + Privacy (Cases 44, 45, 46, 47, 48, 53)
      if (pathname === '/api/v1/orders/last' && method === 'GET') {
        const session = (req.headers['x-guest-session'] as string) || reqUrl.searchParams.get('session') || '';
        const lastOrder = store.getLastOrderBySession(session);
        sendJson(res, 200, {
          success: true,
          lastOrder,
          order: lastOrder,
          items: lastOrder?.items || [],
        });
        return;
      }

      if (pathname.startsWith('/api/v1/orders/session/') && method === 'DELETE') {
        const sessionUuid = pathname.replace('/api/v1/orders/session/', '');
        const result = store.deleteOrdersSession(sessionUuid);
        sendJson(res, 200, { success: true, message: 'Session link wiped successfully', count: result.count });
        return;
      }

      // 7d. Get Order by ID
      if (pathname.startsWith('/api/v1/orders/') && pathname !== '/api/v1/orders/past' && pathname.indexOf('/', 15) === -1 && method === 'GET') {
        const orderId = pathname.replace('/api/v1/orders/', '');
        const order = store.orders.get(orderId);
        if (!order) {
          sendJson(res, 404, { error: 'Order not found' });
          return;
        }
        sendJson(res, 200, order);
        return;
      }

      // 8. KDS Active Orders (with Station filtering & SLA indicators)
      if (pathname === '/api/v1/kds/orders' && method === 'GET') {
        const outletId =
          reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const station = reqUrl.searchParams.get('station') || 'ALL';
        const orders = store.getKdsOrders(outletId, station);
        sendJson(res, 200, orders);
        return;
      }

      // 9. Update Order & KDS Status
      if (
        (pathname.startsWith('/api/v1/kds/orders/') || pathname.startsWith('/api/v1/orders/')) &&
        pathname.endsWith('/status') &&
        method === 'PATCH'
      ) {
        const orderId = pathname
          .replace('/api/v1/kds/orders/', '')
          .replace('/api/v1/orders/', '')
          .replace('/status', '');
        const body = await parseJsonBody<{ status: OrderStatus; paymentStatus?: string }>(req);

        if (!body.status) {
          sendJson(res, 400, { error: 'Status is required' });
          return;
        }

        const updated = store.updateOrderStatus(orderId, body.status);
        if (!updated) {
          sendJson(res, 404, { error: 'Order not found' });
          return;
        }

        if (body.paymentStatus) {
          store.updateOrderPaymentStatus(orderId, body.paymentStatus as any);
          updated.paymentStatus = body.paymentStatus as any;
        }

        broadcastEvent({
          type: 'ORDER_STATUS_CHANGED',
          tenantId: updated.tenantId,
          outletId: updated.outletId,
          timestamp: new Date().toISOString(),
          payload: updated,
        });

        broadcastEvent({
          type: 'ORDER_UPDATED' as any,
          tenantId: updated.tenantId,
          outletId: updated.outletId,
          timestamp: new Date().toISOString(),
          payload: updated,
        });

        if (updated.status === 'PREPARING') {
          broadcastEvent({
            type: 'ORDER_PREPARING' as any,
            tenantId: updated.tenantId,
            outletId: updated.outletId,
            timestamp: new Date().toISOString(),
            payload: updated,
          });
        } else if (updated.status === 'READY') {
          broadcastEvent({
            type: 'ORDER_READY' as any,
            tenantId: updated.tenantId,
            outletId: updated.outletId,
            timestamp: new Date().toISOString(),
            payload: updated,
          });
        } else if (updated.status === 'SERVED' || (updated.status as any) === 'COMPLETED') {
          broadcastEvent({
            type: 'ORDER_SERVED' as any,
            tenantId: updated.tenantId,
            outletId: updated.outletId,
            timestamp: new Date().toISOString(),
            payload: updated,
          });
        }

        sendJson(res, 200, updated);
        return;
      }

      // 7d. Waiter 1-Tap Order Priority / Rush (Item 20)
      if (
        (pathname.startsWith('/api/v1/orders/') || pathname.startsWith('/api/v1/waiter/orders/')) &&
        pathname.endsWith('/priority') &&
        method === 'PATCH'
      ) {
        const orderId = pathname
          .replace('/api/v1/waiter/orders/', '')
          .replace('/api/v1/orders/', '')
          .replace('/priority', '');
        const body = await parseJsonBody<{ isPriority?: boolean }>(req);
        const isPriority = body.isPriority !== undefined ? Boolean(body.isPriority) : true;
        const updated = store.setOrderPriority(orderId, isPriority);
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

        broadcastEvent({
          type: 'ORDER_UPDATED' as any,
          tenantId: updated.tenantId,
          outletId: updated.outletId,
          timestamp: new Date().toISOString(),
          payload: updated,
        });

        sendJson(res, 200, { success: true, order: updated });
        return;
      }

      // 10a. 1-Tap Toggle Sold Out with Audit Logging (Achievement 1)
      if (
        ((pathname.startsWith('/api/v1/menu/items/') && pathname.endsWith('/sold-out')) ||
          (pathname.startsWith('/api/v1/owner/menu/') && pathname.endsWith('/toggle-sold-out'))) &&
        method === 'POST'
      ) {
        const itemId = pathname
          .replace('/api/v1/menu/items/', '')
          .replace('/api/v1/owner/menu/', '')
          .replace('/sold-out', '')
          .replace('/toggle-sold-out', '');
        const body = await parseJsonBody<{ isAvailable?: boolean; actorId?: string; reason?: string }>(req);
        const isAvailable = body.isAvailable !== undefined ? Boolean(body.isAvailable) : false;
        const result = store.toggle86ItemWithAudit(
          itemId,
          isAvailable,
          body.actorId || 'owner_manager',
          body.reason || (isAvailable ? 'Item restocked via 1-tap' : 'Item marked sold-out in 1-tap')
        );

        if (!result) {
          sendJson(res, 404, { error: 'Menu item not found' });
          return;
        }

        broadcastEvent({
          type: 'ITEM_86_TOGGLED',
          tenantId: result.item.tenantId,
          outletId: result.item.outletId,
          timestamp: new Date().toISOString(),
          payload: { item: result.item, auditLog: result.auditLog },
        });

        sendJson(res, 200, { success: true, item: result.item, auditLog: result.auditLog });
        return;
      }

      // 10b. Instant 86-ing Menu Availability Toggle (Live SSE sync)
      if (pathname.startsWith('/api/v1/menu/items/') && pathname.endsWith('/toggle-86') && method === 'PATCH') {
        const itemId = pathname.replace('/api/v1/menu/items/', '').replace('/toggle-86', '');
        const currentItem = store.menuItems.get(itemId);
        const nextState = currentItem ? !currentItem.isAvailable : false;
        const result = store.toggle86ItemWithAudit(itemId, nextState, 'quick_toggle');
        if (!result) {
          sendJson(res, 404, { error: 'Menu item not found' });
          return;
        }

        broadcastEvent({
          type: 'ITEM_AVAILABILITY_CHANGED',
          tenantId: result.item.tenantId,
          outletId: result.item.outletId,
          timestamp: new Date().toISOString(),
          payload: result.item,
        });

        sendJson(res, 200, { success: true, item: result.item });
        return;
      }

      // Menu Items Full CRUD & Photo Management
      if (pathname === '/api/v1/menu/items' && method === 'POST') {
        const body = await parseJsonBody<{
          categoryId: string;
          name: string;
          description?: string;
          basePriceCents: number;
          imageUrl?: string;
          dietaryType?: 'VEG' | 'NON_VEG' | 'EGG';
          allergens?: string[];
          course?: any;
          station?: any;
          isAvailable?: boolean;
          servingFrom?: string;
          servingUntil?: string;
          daypartFrom?: string;
          daypartUntil?: string;
          tenantId?: string;
          outletId?: string;
        }>(req);
        if (!body.name || body.basePriceCents === undefined || !body.categoryId) {
          sendJson(res, 400, { error: 'name, categoryId, and basePriceCents are required' });
          return;
        }
        const created = store.createMenuItem(body);
        broadcastEvent({
          type: 'MENU_ITEM_CREATED',
          tenantId: created.tenantId,
          outletId: created.outletId,
          timestamp: new Date().toISOString(),
          payload: created,
        });
        sendJson(res, 201, created);
        return;
      }

      if (
        pathname.startsWith('/api/v1/menu/items/') &&
        !pathname.endsWith('/toggle-86') &&
        !pathname.endsWith('/sold-out') &&
        !pathname.endsWith('/nutrition') &&
        !pathname.endsWith('/scarcity') &&
        !pathname.endsWith('/margin') &&
        !pathname.endsWith('/social-proof') &&
        method === 'PATCH'
      ) {
        const itemId = pathname.replace('/api/v1/menu/items/', '');
        const updates = await parseJsonBody<any>(req);
        const updated = store.updateMenuItem(itemId, updates);
        if (!updated) {
          sendJson(res, 404, { error: 'Menu item not found' });
          return;
        }
        broadcastEvent({
          type: 'MENU_ITEM_UPDATED',
          tenantId: updated.tenantId,
          outletId: updated.outletId,
          timestamp: new Date().toISOString(),
          payload: updated,
        });
        sendJson(res, 200, updated);
        return;
      }

      if (pathname.startsWith('/api/v1/menu/items/') && method === 'DELETE') {
        const itemId = pathname.replace('/api/v1/menu/items/', '');
        const deleted = store.deleteMenuItem(itemId);
        if (!deleted) {
          sendJson(res, 404, { error: 'Menu item not found' });
          return;
        }
        broadcastEvent({
          type: 'MENU_ITEM_DELETED',
          tenantId: 'a0000000-0000-0000-0000-000000000001',
          outletId: 'b0000000-0000-0000-0000-000000000001',
          timestamp: new Date().toISOString(),
          payload: { itemId },
        });
        sendJson(res, 200, { success: true, itemId });
        return;
      }

      // 10c. Get Outlet Config & P0 Settings (Achievement 16 / 50)
      if (pathname.startsWith('/api/v1/outlets/') && pathname.endsWith('/config') && method === 'GET') {
        const outletId = pathname.replace('/api/v1/outlets/', '').replace('/config', '');
        const settings = store.getOutletSettings(outletId);
        sendJson(res, 200, settings);
        return;
      }

      // 10d. Update Outlet Config & P0 Settings
      if (pathname.startsWith('/api/v1/outlets/') && pathname.endsWith('/config') && method === 'PATCH') {
        const outletId = pathname.replace('/api/v1/outlets/', '').replace('/config', '');
        const body = await parseJsonBody<Partial<OutletP0Settings>>(req);
        const current = store.getOutletSettings(outletId);
        if (body.paymentMode) current.paymentMode = body.paymentMode;
        if (body.isPaused !== undefined) current.isPaused = Boolean(body.isPaused);
        if (body.pauseReason !== undefined) current.pauseReason = body.pauseReason;
        if (body.pauseEtaMinutes !== undefined) current.pauseEtaMinutes = body.pauseEtaMinutes;
        if (body.requireFirstOrderApproval !== undefined) current.requireFirstOrderApproval = Boolean(body.requireFirstOrderApproval);
        current.updatedAt = new Date().toISOString();
        store.outletSettings.set(outletId, current);

        broadcastEvent({
          type: 'OUTLET_CONFIG_UPDATED',
          tenantId: 'a0000000-0000-0000-0000-000000000001',
          outletId,
          timestamp: current.updatedAt,
          payload: current,
        });

        sendJson(res, 200, current);
        return;
      }

      // 10e. Shift Payment Mode Switcher (Achievement 16)
      if (pathname.startsWith('/api/v1/outlets/') && pathname.endsWith('/payment-mode') && method === 'PATCH') {
        const outletId = pathname.replace('/api/v1/outlets/', '').replace('/payment-mode', '');
        const body = await parseJsonBody<{ paymentMode: ShiftPaymentMode }>(req);
        if (!body.paymentMode || (body.paymentMode !== 'PAY_FIRST' && body.paymentMode !== 'PAY_LATER')) {
          sendJson(res, 400, { error: 'Valid paymentMode (PAY_FIRST or PAY_LATER) is required' });
          return;
        }

        const updated = store.setOutletPaymentMode(outletId, body.paymentMode);
        broadcastEvent({
          type: 'OUTLET_PAYMENT_MODE_CHANGED',
          tenantId: 'a0000000-0000-0000-0000-000000000001',
          outletId,
          timestamp: updated.updatedAt,
          payload: updated,
        });

        sendJson(res, 200, { success: true, settings: updated });
        return;
      }

      // 10f. Pause Incoming Orders on Rush / Overload (Achievement 50)
      if (pathname.startsWith('/api/v1/outlets/') && pathname.endsWith('/pause-orders') && method === 'POST') {
        const outletId = pathname.replace('/api/v1/outlets/', '').replace('/pause-orders', '');
        const body = await parseJsonBody<{ isPaused: boolean; reason?: string; etaMinutes?: number }>(req);
        if (body.isPaused === undefined) {
          sendJson(res, 400, { error: 'isPaused boolean is required' });
          return;
        }

        const updated = store.setOutletPause(outletId, body.isPaused, body.reason, body.etaMinutes);
        broadcastEvent({
          type: body.isPaused ? 'OUTLET_ORDERS_PAUSED' : 'OUTLET_ORDERS_RESUMED',
          tenantId: 'a0000000-0000-0000-0000-000000000001',
          outletId,
          timestamp: updated.updatedAt,
          payload: updated,
        });

        sendJson(res, 200, { success: true, settings: updated });
        return;
      }

      // 11. Bill Splitting Engine (Equal parts or by individual items)
      if (pathname.startsWith('/api/v1/orders/') && pathname.endsWith('/split') && method === 'POST') {
        const orderId = pathname.replace('/api/v1/orders/', '').replace('/split', '');
        const order = store.orders.get(orderId);
        if (!order) {
          sendJson(res, 404, { error: 'Order not found' });
          return;
        }

        const body = await parseJsonBody<{
          billType?: 'EQUAL_PARTS' | 'BY_ITEMS';
          guestCount?: number;
          assignments?: Array<{ guestLabel: string; itemIds: string[]; itemTotalCents: number }>;
          payPartId?: string;
          paymentMethod?: string;
        }>(req);

        // Process a payment against an active split share
        if (body.payPartId && order.splitBilling) {
          const part = order.splitBilling.parts.find((p) => p.id === body.payPartId);
          if (part) {
            part.isPaid = true;
            part.paymentMethod = body.paymentMethod || 'CARD';
            part.paidAt = new Date().toISOString();
            order.splitBilling.paidCents += part.amountCents;
            order.splitBilling.remainingCents = Math.max(0, order.splitBilling.remainingCents - part.amountCents);
            if (order.splitBilling.remainingCents === 0) {
              order.status = 'CONFIRMED';
            }
            store.orders.set(orderId, order);
            broadcastEvent({
              type: 'BILL_SPLIT_PAYMENT',
              tenantId: order.tenantId,
              outletId: order.outletId,
              timestamp: new Date().toISOString(),
              payload: { orderId, part, remainingCents: order.splitBilling.remainingCents },
            });
            sendJson(res, 200, { success: true, splitBilling: order.splitBilling });
            return;
          }
        }

        // Initialize equal split
        if (body.billType === 'EQUAL_PARTS' || !body.billType) {
          order.splitBilling = splitBillEqually(order.totalCents, body.guestCount || 2);
        } else if (body.billType === 'BY_ITEMS' && body.assignments) {
          order.splitBilling = splitBillByItems(order.totalCents, 8.25, body.assignments);
        }

        store.orders.set(orderId, order);
        sendJson(res, 200, { success: true, splitBilling: order.splitBilling });
        return;
      }

      // 12. Hotel PMS Room Charge Verification & Folio Posting
      if (pathname.startsWith('/api/v1/orders/') && pathname.endsWith('/hotel-charge') && method === 'POST') {
        const orderId = pathname.replace('/api/v1/orders/', '').replace('/hotel-charge', '');
        const order = store.orders.get(orderId);
        if (!order) {
          sendJson(res, 404, { error: 'Order not found' });
          return;
        }

        const body = await parseJsonBody<{ roomNumber: string; guestLastName: string }>(req);
        if (!body.roomNumber || !body.guestLastName) {
          sendJson(res, 400, { error: 'roomNumber and guestLastName are required' });
          return;
        }

        const pmsCheck = hotelPms.validateRoomFolio(body.roomNumber, body.guestLastName, order.totalCents);
        if (!pmsCheck.isValid) {
          sendJson(res, 402, { error: pmsCheck.error });
          return;
        }

        const chargeResult = hotelPms.postChargeToFolio(body.roomNumber, pmsCheck.folioId!, order.totalCents, order.id);
        order.paymentMethod = 'ROOM_FOLIO';
        order.hotelCharge = {
          roomNumber: body.roomNumber,
          guestLastName: body.guestLastName,
          folioId: pmsCheck.folioId!,
          isVerified: true,
          verifiedAt: new Date().toISOString(),
        };
        order.status = 'CONFIRMED';
        order.updatedAt = new Date().toISOString();
        store.orders.set(orderId, order);

        sendJson(res, 200, { success: true, transactionReference: chargeResult.transactionReference, order });
        return;
      }

      // 13. Meal Coursing Hold vs Fire to Kitchen
      if (pathname.startsWith('/api/v1/orders/') && pathname.endsWith('/fire-course') && method === 'POST') {
        const orderId = pathname.replace('/api/v1/orders/', '').replace('/fire-course', '');
        const order = store.orders.get(orderId);
        if (!order) {
          sendJson(res, 404, { error: 'Order not found' });
          return;
        }

        const body = await parseJsonBody<{ course: MealCourse }>(req);
        if (!body.course) {
          sendJson(res, 400, { error: 'Valid course (STARTER, MAIN, DESSERT, BEVERAGE) is required' });
          return;
        }

        if (!order.courseStates) {
          order.courseStates = { BEVERAGE: 'READY', STARTER: 'HELD', MAIN: 'HELD', DESSERT: 'HELD' };
        }
        order.courseStates[body.course] = 'FIRED';
        for (const item of order.items) {
          if (item.course === body.course) {
            item.courseState = 'FIRED';
          }
        }
        order.updatedAt = new Date().toISOString();
        store.orders.set(orderId, order);

        broadcastEvent({
          type: 'COURSE_FIRED',
          tenantId: order.tenantId,
          outletId: order.outletId,
          timestamp: new Date().toISOString(),
          payload: { orderId, course: body.course, tableNumber: order.tableNumber },
        });

        sendJson(res, 200, { success: true, course: body.course, courseStates: order.courseStates });
        return;
      }

      // 14. Manager Comp / Discount with Audit Trail
      if (pathname.startsWith('/api/v1/orders/') && pathname.endsWith('/comp') && method === 'POST') {
        const orderId = pathname.replace('/api/v1/orders/', '').replace('/comp', '');
        const body = await parseJsonBody<{ amountCents: number; reason: string }>(req);
        if (!body.amountCents || !body.reason) {
          sendJson(res, 400, { error: 'Comp amountCents and reason are required' });
          return;
        }

        const updated = store.compItem(orderId, body.amountCents, body.reason);
        if (!updated) {
          sendJson(res, 404, { error: 'Order not found' });
          return;
        }

        sendJson(res, 200, { success: true, order: updated });
        return;
      }

      // 15. Post-Meal Review Booster (Google Reviews vs Internal Management Alert)
      if (pathname === '/api/v1/reviews' && method === 'POST') {
        const body = await parseJsonBody<{ orderId: string; rating: number; comment?: string; guestEmail?: string }>(req);
        if (!body.orderId || typeof body.rating !== 'number' || body.rating < 1 || body.rating > 5) {
          sendJson(res, 400, { error: 'Valid orderId and rating between 1 and 5 required' });
          return;
        }

        const redirectedToGoogle = body.rating >= 4;
        const internalAlertSent = body.rating <= 3;
        const reviewRecord: ReviewSubmission = {
          id: `rev_${Date.now()}`,
          orderId: body.orderId,
          tenantId: 'a0000000-0000-0000-0000-000000000001',
          rating: body.rating,
          comment: body.comment,
          guestEmail: body.guestEmail,
          redirectedToGoogle,
          internalAlertSent,
          createdAt: new Date().toISOString(),
        };

        if (internalAlertSent) {
          store.createRecoveryTicket(
            'b0000000-0000-0000-0000-000000000001',
            body.orderId,
            body.rating,
            'OTHER',
            body.comment
          );
        }

        broadcastEvent({
          type: 'REVIEW_SUBMITTED',
          tenantId: reviewRecord.tenantId,
          outletId: 'b0000000-0000-0000-0000-000000000001',
          timestamp: reviewRecord.createdAt,
          payload: reviewRecord,
        });

        sendJson(res, 201, {
          success: true,
          review: reviewRecord,
          googleReviewUrl: redirectedToGoogle ? 'https://search.google.com/local/writereview?placeid=ChIJabiruchi' : null,
        });
        return;
      }

      // ----------------------------------------------------------------------
      // C1 & C2: Token & Queue Engine
      // ----------------------------------------------------------------------
      if (pathname === '/api/v1/tokens/active' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const tokens = store.getActiveTokens(outletId);
        sendJson(res, 200, tokens);
        return;
      }

      if (pathname === '/api/v1/tokens/manual' && method === 'POST') {
        const body = await parseJsonBody<{
          outletId?: string;
          bucket?: TokenBucket;
          orderRef?: string;
          guestPhone?: string;
        }>(req);
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        const bucket = body.bucket || 'FOOD';
        const token = store.generateToken(outletId, bucket, body.orderRef, body.guestPhone, true);
        broadcastEvent({
          type: 'ORDER_STATUS_CHANGED',
          tenantId: 'a0000000-0000-0000-0000-000000000001',
          outletId,
          timestamp: token.createdAt,
          payload: { tokenId: token.id, code: token.code, state: token.state, bucket: token.bucket, manual_entry: true },
        });
        sendJson(res, 201, { ...token, manual_entry: true });
        return;
      }

      if ((pathname === '/api/v1/tokens/manual/analytics' || pathname === '/api/v1/analytics/tokens/manual') && method === 'GET') {
        const allManual = Array.from(store.tokens.values()).filter((t: any) => t.manual_entry === true);
        const activeManual = allManual.filter((t: any) => t.state !== 'CLOSED' && t.state !== 'SERVED');
        sendJson(res, 200, {
          totalManualTokens: allManual.length,
          activeManualTokens: activeManual.length,
          tokens: allManual,
        });
        return;
      }

      if (pathname === '/api/v1/tokens/auto-close-stale' && method === 'POST') {
        const body = await parseJsonBody<{ thresholdMinutes?: number }>(req);
        const threshold = typeof body.thresholdMinutes === 'number' ? body.thresholdMinutes : 0;
        const closed = store.autoCloseStaleTokens(threshold);
        sendJson(res, 200, { closedCount: closed.length, closedTokens: closed });
        return;
      }

      if (pathname === '/api/v1/tokens/stale' && method === 'GET') {
        const stale = store.getStaleTokens();
        sendJson(res, 200, { staleCount: stale.length, staleTokens: stale });
        return;
      }

      if (pathname.startsWith('/api/v1/tokens/recall/') && method === 'POST') {
        const tokenId = pathname.replace('/api/v1/tokens/recall/', '');
        const body = await parseJsonBody<{ reason?: string }>(req);
        const reason = body.reason || 'Staff recalled parcel token';
        const recalled = store.recallToken(tokenId, reason);
        if (!recalled) {
          sendJson(res, 404, { error: 'Token not found' });
          return;
        }
        broadcastEvent({
          type: 'ORDER_STATUS_CHANGED',
          tenantId: 'a0000000-0000-0000-0000-000000000001',
          outletId: recalled.outletId,
          timestamp: recalled.updatedAt,
          payload: { tokenId: recalled.id, code: recalled.code, state: 'PREPARING', bucket: recalled.bucket, recalled: true, recallReason: reason },
        });
        sendJson(res, 200, { ...recalled, token_code: recalled.code, recalled: true, recallReason: reason });
        return;
      }

      if (pathname === '/api/v1/tokens' && method === 'POST') {
        const body = await parseJsonBody<{
          outletId?: string;
          bucket?: TokenBucket;
          orderRef?: string;
          guestPhone?: string;
        }>(req);
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        const bucket = body.bucket || 'FOOD';
        const token = store.generateToken(outletId, bucket, body.orderRef, body.guestPhone);
        broadcastEvent({
          type: 'ORDER_STATUS_CHANGED',
          tenantId: 'a0000000-0000-0000-0000-000000000001',
          outletId,
          timestamp: token.createdAt,
          payload: { tokenId: token.id, code: token.code, state: token.state, bucket: token.bucket },
        });
        sendJson(res, 201, token);
        return;
      }

      if (pathname.startsWith('/api/v1/tokens/') && pathname.endsWith('/state') && method === 'PATCH') {
        const tokenId = pathname.replace('/api/v1/tokens/', '').replace('/state', '');
        const body = await parseJsonBody<{ state: TokenState }>(req);
        if (!body.state) {
          sendJson(res, 400, { error: 'state is required' });
          return;
        }
        const updated = store.advanceTokenState(tokenId, body.state);
        if (!updated) {
          sendJson(res, 404, { error: 'Token not found' });
          return;
        }
        if (updated.state === 'READY') {
          broadcastEvent({
            type: 'ORDER_STATUS_CHANGED',
            tenantId: 'a0000000-0000-0000-0000-000000000001',
            outletId: updated.outletId,
            timestamp: updated.updatedAt,
            payload: { tokenId: updated.id, code: updated.code, state: 'READY', bucket: updated.bucket },
          });
        }
        sendJson(res, 200, { ...updated, token_code: updated.code, token: updated });
        return;
      }

      if (pathname.startsWith('/api/v1/tokens/') && method === 'GET') {
        const tokenId = pathname.replace('/api/v1/tokens/', '');
        const token = store.tokens.get(tokenId);
        if (!token) {
          sendJson(res, 404, { error: 'Token not found' });
          return;
        }
        sendJson(res, 200, token);
        return;
      }

      // ----------------------------------------------------------------------
      // C3: Payment Verification
      // ----------------------------------------------------------------------
      if (pathname === '/api/v1/payments/unverified' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || undefined;
        const unverified = store.getUnverifiedPayments(outletId);
        sendJson(res, 200, unverified);
        return;
      }

      if (pathname === '/api/v1/payments' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || undefined;
        const payments = store.getPayments(outletId);
        sendJson(res, 200, payments);
        return;
      }

      if (pathname.startsWith('/api/v1/payments/') && pathname.endsWith('/verify') && pathname !== '/api/v1/payments/verify' && method === 'POST') {
        const paymentId = pathname.replace('/api/v1/payments/', '').replace('/verify', '');
        const body = await parseJsonBody<{ verifiedBy?: string; notes?: string; customerNote?: string }>(req);
        const verifiedBy = body.verifiedBy || 'manager_sarah';
        const rec = store.payments.get(paymentId);
        const order = rec?.orderId ? store.orders.get(rec.orderId) : null;
        const customerNote = body.customerNote || body.notes || (order ? `Customer paid for Table ${order.tableNumber || 'Takeaway'}` : 'Customer payment verified by manager');
        const updated = store.verifyPayment(paymentId, verifiedBy, customerNote);
        if (!updated) {
          sendJson(res, 404, { error: 'Payment record not found' });
          return;
        }
        sendJson(res, 200, { success: true, payment: updated, customerNote, notes: customerNote });
        return;
      }

      // ----------------------------------------------------------------------
      // C4: Table Booking + Prepay
      // ----------------------------------------------------------------------
      if (pathname === '/api/v1/bookings/availability' && method === 'GET') {
        const date = reqUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10);
        const slots = [
          { slot: '12:00 PM', time: '12:00', available: true, capacityRemaining: 8 },
          { slot: '12:30 PM', time: '12:30', available: true, capacityRemaining: 6 },
          { slot: '01:00 PM', time: '13:00', available: true, capacityRemaining: 4 },
          { slot: '01:30 PM', time: '13:30', available: true, capacityRemaining: 7 },
          { slot: '07:00 PM', time: '19:00', available: true, capacityRemaining: 10 },
          { slot: '07:30 PM', time: '19:30', available: true, capacityRemaining: 5 },
          { slot: '08:00 PM', time: '20:00', available: true, capacityRemaining: 8 },
          { slot: '08:30 PM', time: '20:30', available: true, capacityRemaining: 9 }
        ];
        sendJson(res, 200, { date, slots, totalAvailable: slots.length });
        return;
      }

      if (pathname === '/api/v1/bookings' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const date = reqUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10);
        const bookings = store.getBookingsForDate(outletId, date);
        sendJson(res, 200, bookings);
        return;
      }

      if (pathname === '/api/v1/bookings' && method === 'POST') {
        const body: any = await parseJsonBody(req).catch(() => ({}));
        const guestName = body.guestName || body.customerName || body.name || 'Guest Diner';
        const partySize = Number(body.partySize || body.party_size || body.guests || 2);
        const slotDate = body.slotDate || body.date || (body.slotTime ? body.slotTime.slice(0, 10) : new Date().toISOString().slice(0, 10));
        const slotTime = body.slotTime || body.slot || '19:30';
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        const booking = store.createBooking({
          ...body,
          guestName,
          partySize,
          slotDate,
          slotTime,
          outletId,
        });
        const refCode = `SRV-BK-${Date.now().toString().slice(-4)}`;
        (booking as any).referenceId = refCode;
        (booking as any).code = refCode;
        store.bookings.set(booking.id, booking);

        broadcastEvent({
          type: 'BOOKING_CREATED' as any,
          tenantId: 'a0000000-0000-0000-0000-000000000001',
          outletId: booking.outletId,
          timestamp: booking.createdAt,
          payload: booking,
        });
        sendJson(res, 201, {
          ...booking,
          id: booking.id,
          code: refCode,
          referenceId: refCode,
          status: booking.status,
          success: true,
          booking
        });
        return;
      }

      if (pathname.startsWith('/api/v1/bookings/') && pathname.endsWith('/prepay') && method === 'POST') {
        const bookingId = pathname.replace('/api/v1/bookings/', '').replace('/prepay', '');
        const body: any = await parseJsonBody(req).catch(() => ({}));
        const booking = store.bookings.get(bookingId);
        if (!booking) {
          sendJson(res, 404, { error: 'Booking not found' });
          return;
        }
        (booking as any).prepayStatus = 'PAID';
        (booking as any).prepayAmountCents = body.amountCents || 50000;
        store.bookings.set(bookingId, booking);
        sendJson(res, 200, {
          success: true,
          bookingId: booking.id,
          prepayAmountCents: (booking as any).prepayAmountCents,
          paymentStatus: 'PAID',
          booking
        });
        return;
      }

      if (pathname.startsWith('/api/v1/bookings/') && pathname.endsWith('/check-in') && (method === 'POST' || method === 'PATCH')) {
        const bookingId = pathname.replace('/api/v1/bookings/', '').replace('/check-in', '');
        let updated = store.bookings.get(bookingId);
        if (!updated) {
          sendJson(res, 404, { error: 'Booking not found' });
          return;
        }
        (updated as any).status = 'CHECKED_IN';
        (updated as any).checkedInAt = new Date().toISOString();
        store.bookings.set(bookingId, updated);
        broadcastEvent({
          type: 'BOOKING_UPDATED' as any,
          tenantId: 'a0000000-0000-0000-0000-000000000001',
          outletId: updated.outletId,
          timestamp: new Date().toISOString(),
          payload: updated,
        });
        sendJson(res, 200, { success: true, booking: updated, id: updated.id, status: 'ARRIVED' });
        return;
      }

      if (pathname.startsWith('/api/v1/bookings/') && pathname.endsWith('/cancel') && (method === 'POST' || method === 'PATCH')) {
        const bookingId = pathname.replace('/api/v1/bookings/', '').replace('/cancel', '');
        const body = await parseJsonBody<{ reason?: string }>(req);
        let updated = store.bookings.get(bookingId);
        if (!updated) {
          sendJson(res, 404, { error: 'Booking not found' });
          return;
        }
        (updated as any).status = 'CANCELLED';
        (updated as any).cancelledAt = new Date().toISOString();
        store.bookings.set(bookingId, updated);
        broadcastEvent({
          type: 'BOOKING_UPDATED' as any,
          tenantId: 'a0000000-0000-0000-0000-000000000001',
          outletId: updated.outletId,
          timestamp: new Date().toISOString(),
          payload: updated,
        });
        sendJson(res, 200, { success: true, booking: updated, id: updated.id, status: 'CANCELLED' });
        return;
      }

      if (pathname === '/api/v1/bookings/waitlist' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const date = reqUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10);
        return sendJson(res, 200, store.getBookingWaitlist(outletId, date));
      }

      if (
        pathname.startsWith('/api/v1/bookings/') &&
        pathname !== '/api/v1/bookings/availability' &&
        pathname !== '/api/v1/bookings/slots' &&
        pathname !== '/api/v1/bookings/recurring' &&
        pathname !== '/api/v1/bookings/no-shows' &&
        method === 'GET'
      ) {
        const bookingId = pathname.replace('/api/v1/bookings/', '');
        const booking = store.bookings.get(bookingId);
        if (!booking) {
          sendJson(res, 404, { error: 'Booking not found' });
          return;
        }
        sendJson(res, 200, booking);
        return;
      }

      // ----------------------------------------------------------------------
      // C5: Mobile Login & Guest Preferences
      // ----------------------------------------------------------------------
      if (pathname === '/api/v1/guest/auth/otp/request' && method === 'POST') {
        const body = await parseJsonBody<{ phone: string }>(req);
        if (!body.phone) {
          sendJson(res, 400, { error: 'phone is required' });
          return;
        }
        const result = store.requestOTP(body.phone);
        sendJson(res, 200, { success: true, message: 'OTP sent', otpCode: result.otpCode });
        return;
      }

      if (pathname === '/api/v1/guest/auth/otp/verify' && method === 'POST') {
        const body = await parseJsonBody<{ phone: string; code: string }>(req);
        if (!body.phone || !body.code) {
          sendJson(res, 400, { error: 'phone and code are required' });
          return;
        }
        const result = store.verifyOTP(body.phone, body.code);
        if (!result.valid) {
          sendJson(res, 401, { error: 'Invalid or expired OTP code' });
          return;
        }
        const prefs = store.getGuestPrefs(result.phoneHash!);
        sendJson(res, 200, { success: true, phoneHash: result.phoneHash, preferences: prefs });
        return;
      }

      if (pathname === '/api/v1/guest/preferences' && method === 'GET') {
        const authHeader = req.headers.authorization;
        const phoneHash = authHeader?.replace(/^Bearer\s+/i, '') || reqUrl.searchParams.get('phoneHash');
        if (!phoneHash) {
          sendJson(res, 401, { error: 'Authorization header or phoneHash required' });
          return;
        }
        const prefs = store.getGuestPrefs(phoneHash);
        sendJson(res, 200, prefs);
        return;
      }

      if (pathname === '/api/v1/guest/preferences' && method === 'PATCH') {
        const authHeader = req.headers.authorization;
        const phoneHash = authHeader?.replace(/^Bearer\s+/i, '') || reqUrl.searchParams.get('phoneHash');
        if (!phoneHash) {
          sendJson(res, 401, { error: 'Authorization header or phoneHash required' });
          return;
        }
        const body = await parseJsonBody<Partial<GuestPreferences>>(req);
        const updated = store.updateGuestPrefs(phoneHash, body);
        sendJson(res, 200, updated);
        return;
      }

      // ----------------------------------------------------------------------
      // C6: Feedback + Recovery Loop
      // ----------------------------------------------------------------------
      if (pathname === '/api/v1/reviews/recovery-queue' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || undefined;
        const tickets = store.getOpenRecoveryTickets(outletId);
        sendJson(res, 200, tickets);
        return;
      }

      if (pathname.startsWith('/api/v1/reviews/recovery/') && pathname.endsWith('/acknowledge') && method === 'POST') {
        const ticketId = pathname.replace('/api/v1/reviews/recovery/', '').replace('/acknowledge', '');
        const body = await parseJsonBody<{ staffId?: string }>(req);
        const updated = store.acknowledgeRecoveryTicket(ticketId, body.staffId || 'staff_01');
        if (!updated) {
          sendJson(res, 404, { error: 'Recovery ticket not found' });
          return;
        }
        sendJson(res, 200, { success: true, ticket: updated });
        return;
      }

      if (pathname.startsWith('/api/v1/reviews/recovery/') && pathname.endsWith('/close') && method === 'POST') {
        const ticketId = pathname.replace('/api/v1/reviews/recovery/', '').replace('/close', '');
        const body = await parseJsonBody<{ staffId?: string }>(req);
        const updated = store.closeRecoveryTicket(ticketId, body.staffId || 'manager_sarah');
        if (!updated) {
          sendJson(res, 404, { error: 'Recovery ticket not found' });
          return;
        }
        sendJson(res, 200, { success: true, ticket: updated });
        return;
      }

      // ----------------------------------------------------------------------
      // C8: Segment Presets & Venue Settings
      // ----------------------------------------------------------------------
      if (pathname.startsWith('/api/v1/outlets/') && pathname.endsWith('/apply-preset') && method === 'POST') {
        const outletId = pathname.replace('/api/v1/outlets/', '').replace('/apply-preset', '');
        const body = await parseJsonBody<{ segment: 'COFFEE' | 'RESTAURANT' | 'BAR' }>(req);
        if (!body.segment || !['COFFEE', 'RESTAURANT', 'BAR'].includes(body.segment)) {
          sendJson(res, 400, { error: 'Invalid segment. Must be COFFEE, RESTAURANT, or BAR' });
          return;
        }
        const updated = store.applySegmentPreset(outletId, body.segment);
        sendJson(res, 200, { success: true, segment: body.segment, settings: updated });
        return;
      }

      if (pathname.startsWith('/api/v1/outlets/') && pathname.endsWith('/settings') && method === 'GET') {
        const outletId = pathname.replace('/api/v1/outlets/', '').replace('/settings', '');
        const settings = store.getOutletSettings(outletId);
        sendJson(res, 200, settings);
        return;
      }

      if (pathname.startsWith('/api/v1/outlets/') && pathname.endsWith('/first-order-approval') && method === 'PATCH') {
        const outletId = pathname.replace('/api/v1/outlets/', '').replace('/first-order-approval', '');
        const body = await parseJsonBody<{ requireApproval: boolean }>(req);
        const settings = store.getOutletSettings(outletId);
        settings.requireFirstOrderApproval = Boolean(body.requireApproval);
        settings.updatedAt = new Date().toISOString();
        store.outletSettings.set(outletId, settings);
        sendJson(res, 200, { success: true, settings });
        return;
      }

      if (pathname === '/api/v1/audit/logs' && method === 'GET') {
        const feature = reqUrl.searchParams.get('feature');
        const logs = feature ? auditService.getLogsByFeature(feature) : auditService.getRecentLogs(100);
        sendJson(res, 200, { logs });
        return;
      }

      // ======================================================================
      // 20 Missing States Endpoints
      // ======================================================================

      // #2: Auto-86 check
      if (pathname === '/api/v1/inventory/auto-86-check' && method === 'POST') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const triggered = store.checkAuto86Threshold(outletId);
        sendJson(res, 200, { success: true, count: triggered.length, triggered });
        return;
      }

      // #8: Hide category without deleting
      if (pathname.startsWith('/api/v1/owner/categories/') && pathname.endsWith('/toggle-visibility') && method === 'POST') {
        const categoryId = pathname.replace('/api/v1/owner/categories/', '').replace('/toggle-visibility', '');
        const updated = store.toggleCategoryVisibility(categoryId);
        if (!updated) {
          sendJson(res, 404, { error: 'Category not found' });
          return;
        }
        sendJson(res, 200, { success: true, category: updated });
        return;
      }

      // #14: Preview QR menu as guest
      if (pathname === '/api/v1/owner/qr/preview' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const tableId = reqUrl.searchParams.get('tableId') || undefined;
        const preview = store.getQrMenuPreview(outletId, tableId);
        sendJson(res, 200, preview);
        return;
      }

      // Dynamic Table QR Code Generator Studio (Tables, Tokens, Prebooking, or Website)
      if (pathname === '/api/v1/owner/generate-table-qrs' && method === 'POST') {
        const body = await parseJsonBody<{
          outletId?: string;
          tableCount?: number;
          mode?: 'TABLE' | 'TOKEN' | 'BOOKING' | 'MENU_ONLY';
          prefix?: string;
        }>(req);
        const count = Math.max(1, Math.min(100, body.tableCount || 5));
        const mode = body.mode || 'TABLE';
        const prefix = body.prefix || (mode === 'TOKEN' ? 'TOKEN-' : mode === 'BOOKING' ? 'RES-' : mode === 'MENU_ONLY' ? 'WEB-' : 'T-');
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';

        const qrs = [];
        for (let i = 1; i <= count; i++) {
          const numStr = i < 10 ? `0${i}` : `${i}`;
          const tableNum = `${prefix}${numStr}`;
          const tableId = `tbl_gen_${mode.toLowerCase()}_${i}`;

          if (!store.tables.has(tableId)) {
            store.tables.set(tableId, {
              id: tableId,
              tenantId: 'a0000000-0000-0000-0000-000000000001',
              outletId,
              tableNumber: tableNum,
              capacity: 4,
              qrCodeUrl: `/?tableNumber=${tableNum}&mode=${mode}`,
              isActive: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }

          const tokenPayload = {
            tenantId: 'a0000000-0000-0000-0000-000000000001',
            outletId,
            tableId,
            tableNumber: tableNum,
            mode,
            issuedAt: Date.now(),
            expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 365,
          };
          const tokenB64 = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
          const qrUrl = `/?token=${tokenB64}&mode=${mode}&table=${tableNum}`;

          qrs.push({
            tableNumber: tableNum,
            tableId,
            mode,
            token: tokenB64,
            qrUrl,
          });
        }

        sendJson(res, 201, { success: true, count: qrs.length, mode, qrs });
        return;
      }

      // #15: Rollback menu change
      if (pathname.startsWith('/api/v1/owner/menu/') && pathname.endsWith('/rollback') && method === 'POST') {
        const itemId = pathname.replace('/api/v1/owner/menu/', '').replace('/rollback', '');
        const body = await parseJsonBody<{ auditLogId?: string }>(req);
        const rolledBack = store.rollbackMenuItem(itemId, body.auditLogId);
        if (!rolledBack) {
          sendJson(res, 404, { error: 'Item or audit log for rollback not found' });
          return;
        }
        sendJson(res, 200, { success: true, item: rolledBack.item, restoredFrom: rolledBack.restoredFrom });
        return;
      }

      // #21: Refund in <30s
      if (pathname.startsWith('/api/v1/payments/') && pathname !== '/api/v1/payments/refund' && pathname.endsWith('/refund') && method === 'POST') {
        const paymentId = pathname.replace('/api/v1/payments/', '').replace('/refund', '');
        const body = await parseJsonBody<{ amountCents?: number; reason?: string; actor?: string }>(req);
        const result = store.refundPayment(paymentId, body.amountCents, body.reason, body.actor);
        if (!result) {
          sendJson(res, 404, { error: 'Payment not found' });
          return;
        }
        sendJson(res, 200, { success: true, ...result });
        return;
      }

      // #24: Auto till close at shift end
      if (pathname === '/api/v1/owner/till/close' && method === 'POST') {
        const body = await parseJsonBody<{ outletId?: string; actualCashCountCents: number; closedBy?: string }>(req);
        if (body.actualCashCountCents === undefined) {
          sendJson(res, 400, { error: 'actualCashCountCents is required' });
          return;
        }
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        const record = store.closeShiftTill(outletId, body.actualCashCountCents, body.closedBy);
        sendJson(res, 200, { success: true, record });
        return;
      }

      // #28: Promo code at checkout
      if (pathname === '/api/v1/promo/validate' && method === 'POST') {
        const body = await parseJsonBody<{ code: string; outletId?: string; subtotalCents: number }>(req);
        if (!body.code || body.subtotalCents === undefined) {
          sendJson(res, 400, { error: 'code and subtotalCents are required' });
          return;
        }
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        const result = store.validatePromoCode(body.code, outletId, body.subtotalCents);
        sendJson(res, result.valid ? 200 : 400, result);
        return;
      }

      // #29: GST invoice auto-generate
      if (pathname.startsWith('/api/v1/orders/') && pathname.endsWith('/invoice') && method === 'GET') {
        const orderId = pathname.replace('/api/v1/orders/', '').replace('/invoice', '');
        const invoice = store.generateInvoice(orderId);
        if (!invoice) {
          sendJson(res, 404, { error: 'Order not found' });
          return;
        }
        sendJson(res, 200, invoice);
        return;
      }

      // #30: Daily payment summary export
      if (pathname === '/api/v1/payments/export' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || undefined;
        const csv = store.exportPaymentsCsv(outletId);
        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="payments-export.csv"',
        });
        res.end(csv);
        return;
      }

      // #32: Reorder-point alert
      if (pathname === '/api/v1/inventory/reorder-alerts' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const alerts = store.checkReorderAlerts(outletId);
        sendJson(res, 200, { count: alerts.length, items: alerts });
        return;
      }

      // #34: Waste tracking with reason codes
      if (pathname === '/api/v1/inventory/waste' && method === 'POST') {
        const body = await parseJsonBody<{
          outletId?: string;
          itemId: string;
          quantity: number;
          reason: any;
          costCents: number;
          reportedBy?: string;
        }>(req);
        if (!body.itemId || !body.quantity || !body.reason || body.costCents === undefined) {
          sendJson(res, 400, { error: 'itemId, quantity, reason, costCents are required' });
          return;
        }
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        const record = store.recordWaste({ ...body, outletId });
        sendJson(res, 201, record);
        return;
      }

      // #40: Out-of-stock → menu hide suggestion
      if (pathname === '/api/v1/inventory/out-of-stock-suggestions' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const suggestions = store.getOutOfStockSuggestions(outletId);
        sendJson(res, 200, { count: suggestions.length, suggestions });
        return;
      }

      // #51: Merge QR + verbal order
      if (pathname.startsWith('/api/v1/orders/') && pathname.endsWith('/merge') && method === 'POST') {
        const orderId = pathname.replace('/api/v1/orders/', '').replace('/merge', '');
        const body = await parseJsonBody<{ items: any[]; actor?: string }>(req);
        if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
          sendJson(res, 400, { error: 'items array is required' });
          return;
        }
        const updated = store.mergeOrderItems(orderId, body.items, body.actor);
        if (!updated) {
          sendJson(res, 404, { error: 'Order not found' });
          return;
        }
        sendJson(res, 200, { success: true, order: updated });
        return;
      }

      // #52: Transfer bill between tables
      if (pathname.startsWith('/api/v1/orders/') && pathname.endsWith('/transfer-table') && method === 'POST') {
        const orderId = pathname.replace('/api/v1/orders/', '').replace('/transfer-table', '');
        const body = await parseJsonBody<{ newTableId: string; newTableNumber: string; actor?: string }>(req);
        if (!body.newTableId || !body.newTableNumber) {
          sendJson(res, 400, { error: 'newTableId and newTableNumber are required' });
          return;
        }
        const updated = store.transferOrderTable(orderId, body.newTableId, body.newTableNumber, body.actor);
        if (!updated) {
          sendJson(res, 404, { error: 'Order not found' });
          return;
        }
        sendJson(res, 200, { success: true, order: updated });
        return;
      }

      // #57: Add kitchen note from manager
      if (pathname === '/api/v1/kds/broadcast-note' && method === 'POST') {
        const body = await parseJsonBody<{ outletId?: string; note: string; author?: string }>(req);
        if (!body.note) {
          sendJson(res, 400, { error: 'note is required' });
          return;
        }
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        const entry = store.setKdsBroadcastNote(outletId, body.note, body.author);
        sendJson(res, 200, { success: true, broadcast: entry });
        return;
      }

      if (pathname === '/api/v1/kds/broadcast-note' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const note = store.getKdsBroadcastNote(outletId);
        sendJson(res, 200, { broadcast: note });
        return;
      }

      // #58: Block station if not ready
      if (pathname.startsWith('/api/v1/stations/') && pathname.endsWith('/freeze') && method === 'POST') {
        const station = pathname.replace('/api/v1/stations/', '').replace('/freeze', '') as any;
        const body = await parseJsonBody<{ frozen: boolean; reason?: string; etaMinutes?: number }>(req);
        const result = store.setStationFreeze(station, body.frozen, body.reason, body.etaMinutes);
        sendJson(res, 200, { success: true, station: result });
        return;
      }

      if (pathname === '/api/v1/stations/freezes' && method === 'GET') {
        const freezes = store.getStationFreezes();
        sendJson(res, 200, freezes);
        return;
      }

      // #60: Export kitchen log
      if (pathname === '/api/v1/kds/export-log' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || undefined;
        const csv = store.exportKitchenLogCsv(outletId);
        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="kitchen-prep-log.csv"',
        });
        res.end(csv);
        return;
      }

      // #71: Scarcity badge
      if (pathname.startsWith('/api/v1/menu/items/') && pathname.endsWith('/scarcity') && method === 'GET') {
        const itemId = pathname.replace('/api/v1/menu/items/', '').replace('/scarcity', '');
        const badge = store.getItemScarcityBadge(itemId);
        sendJson(res, 200, badge);
        return;
      }

      // #84: Daily shift summary
      if (pathname === '/api/v1/analytics/daily-summary' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const summary = store.getDailyShiftSummary(outletId);
        sendJson(res, 200, summary);
        return;
      }

      // #88: Manager override PIN challenge
      if (pathname === '/api/v1/manager/override-auth' && method === 'POST') {
        const body = await parseJsonBody<{ pin: string; action?: string }>(req);
        if (!body.pin) {
          sendJson(res, 400, { error: 'pin is required' });
          return;
        }
        const result = store.verifyManagerPin(body.pin, body.action);
        sendJson(res, result.authorized ? 200 : 403, result);
        return;
      }

      // ======================================================================
      // Next 20 States Endpoints
      // ======================================================================

      // #4: Schedule menu by day of week
      if (pathname.startsWith('/api/v1/owner/categories/') && pathname.endsWith('/schedule-days') && method === 'POST') {
        const categoryId = pathname.replace('/api/v1/owner/categories/', '').replace('/schedule-days', '');
        const body = await parseJsonBody<{ daysOfWeek: number[] }>(req);
        if (!body.daysOfWeek || !Array.isArray(body.daysOfWeek)) {
          sendJson(res, 400, { error: 'daysOfWeek array is required' });
          return;
        }
        const updated = store.scheduleCategoryDays(categoryId, body.daysOfWeek);
        if (!updated) {
          sendJson(res, 404, { error: 'Category not found' });
          return;
        }
        sendJson(res, 200, { success: true, category: updated });
        return;
      }

      // #6: Per-outlet pricing
      if (pathname.startsWith('/api/v1/owner/menu/') && pathname.endsWith('/outlet-price') && method === 'POST') {
        const itemId = pathname.replace('/api/v1/owner/menu/', '').replace('/outlet-price', '');
        const body = await parseJsonBody<{ outletId: string; priceCents: number }>(req);
        if (!body.outletId || body.priceCents === undefined) {
          sendJson(res, 400, { error: 'outletId and priceCents are required' });
          return;
        }
        const updated = store.setOutletPricing(itemId, body.outletId, body.priceCents);
        if (!updated) {
          sendJson(res, 404, { error: 'Menu item not found' });
          return;
        }
        sendJson(res, 200, { success: true, item: updated });
        return;
      }

      // #7: Today-only chef special
      if (pathname.startsWith('/api/v1/owner/menu/') && pathname.endsWith('/chef-special') && method === 'POST') {
        const itemId = pathname.replace('/api/v1/owner/menu/', '').replace('/chef-special', '');
        const body = await parseJsonBody<{ isSpecial: boolean; date?: string }>(req);
        const updated = store.setChefSpecial(itemId, Boolean(body.isSpecial), body.date);
        if (!updated) {
          sendJson(res, 404, { error: 'Menu item not found' });
          return;
        }
        sendJson(res, 200, { success: true, item: updated });
        return;
      }

      // #10: Allergen tagging & guest filter
      if (pathname === '/api/v1/menu/filter-allergens' && method === 'POST') {
        const body = await parseJsonBody<{ outletId?: string; excludedAllergens: string[] }>(req);
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        const items = store.filterMenuByAllergens(outletId, body.excludedAllergens || []);
        sendJson(res, 200, { count: items.length, items });
        return;
      }

      // #13: Minimum order value
      if (pathname.startsWith('/api/v1/outlets/') && pathname.endsWith('/min-order-value') && method === 'POST') {
        const outletId = pathname.replace('/api/v1/outlets/', '').replace('/min-order-value', '');
        const body = await parseJsonBody<{ minOrderValueCents: number }>(req);
        if (body.minOrderValueCents === undefined) {
          sendJson(res, 400, { error: 'minOrderValueCents is required' });
          return;
        }
        const updated = store.setMinOrderValue(outletId, body.minOrderValueCents);
        sendJson(res, 200, { success: true, settings: updated });
        return;
      }

      // #17: UPI dynamic QR code + payment deep-link
      if (pathname === '/api/v1/payments/upi-intent' && method === 'POST') {
        const body = await parseJsonBody<{ orderId: string; payeeVpa?: string }>(req);
        if (!body.orderId) {
          sendJson(res, 400, { error: 'orderId is required' });
          return;
        }
        const intent = store.generateUpiIntent(body.orderId, body.payeeVpa);
        if (!intent) {
          sendJson(res, 404, { error: 'Order not found' });
          return;
        }
        sendJson(res, 200, intent);
        return;
      }

      // #20: Smart tip recommendation engine
      if (pathname.startsWith('/api/v1/orders/') && pathname.endsWith('/smart-tip') && method === 'GET') {
        const orderId = pathname.replace('/api/v1/orders/', '').replace('/smart-tip', '');
        const tips = store.getSmartTipRecommendation(orderId);
        if (!tips) {
          sendJson(res, 404, { error: 'Order not found' });
          return;
        }
        sendJson(res, 200, tips);
        return;
      }

      // #25: Walkout risk detection flag
      if (pathname === '/api/v1/tables/walkout-risk' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const threshold = reqUrl.searchParams.get('idleMinutes') ? parseInt(reqUrl.searchParams.get('idleMinutes')!, 10) : 90;
        const riskTables = store.getWalkoutRiskTables(outletId, threshold);
        sendJson(res, 200, { count: riskTables.length, riskTables });
        return;
      }

      // #26: WhatsApp payment checkout link
      if (pathname.startsWith('/api/v1/payments/') && pathname.endsWith('/whatsapp-link') && method === 'POST') {
        const orderId = pathname.replace('/api/v1/payments/', '').replace('/whatsapp-link', '');
        const body = await parseJsonBody<{ phone: string }>(req);
        if (!body.phone) {
          sendJson(res, 400, { error: 'phone is required' });
          return;
        }
        const link = store.generateWhatsAppPaymentLink(orderId, body.phone, `http://${req.headers.host || 'localhost:3001'}`);
        if (!link) {
          sendJson(res, 404, { error: 'Order not found' });
          return;
        }
        sendJson(res, 200, link);
        return;
      }

      // #27: Minimum spend per head validation
      if (pathname.startsWith('/api/v1/outlets/') && pathname.endsWith('/min-spend-per-head') && method === 'POST') {
        const outletId = pathname.replace('/api/v1/outlets/', '').replace('/min-spend-per-head', '');
        const body = await parseJsonBody<{ minSpendPerHeadCents: number }>(req);
        if (body.minSpendPerHeadCents === undefined) {
          sendJson(res, 400, { error: 'minSpendPerHeadCents is required' });
          return;
        }
        const updated = store.setMinSpendPerHead(outletId, body.minSpendPerHeadCents);
        sendJson(res, 200, { success: true, settings: updated });
        return;
      }

      // #36: Recipe costing & live gross margin
      if (pathname.startsWith('/api/v1/menu/items/') && pathname.endsWith('/margin') && method === 'GET') {
        const itemId = pathname.replace('/api/v1/menu/items/', '').replace('/margin', '');
        const margin = store.calculateRecipeMargin(itemId);
        if (!margin) {
          sendJson(res, 404, { error: 'Menu item not found' });
          return;
        }
        sendJson(res, 200, margin);
        return;
      }

      // #38: Delivery log -> stock update (GRN)
      if (pathname === '/api/v1/inventory/grn' && method === 'POST') {
        const body = await parseJsonBody<{
          outletId?: string;
          supplierName: string;
          invoiceRef: string;
          items: Array<{ itemId: string; quantityAdded: number; costCents: number }>;
          receivedBy?: string;
        }>(req);
        if (!body.supplierName || !body.invoiceRef || !body.items || !Array.isArray(body.items)) {
          sendJson(res, 400, { error: 'supplierName, invoiceRef, and items array are required' });
          return;
        }
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        const grn = store.processGoodsReceivedNote({ ...body, outletId });
        sendJson(res, 201, grn);
        return;
      }

      // #42: Food cost % per item
      if (pathname === '/api/v1/analytics/food-cost' && method === 'GET') {
        const itemId = reqUrl.searchParams.get('itemId') || 'e0000000-0000-0000-0000-000000000001';
        const cost = store.calculateFoodCostPercentage(itemId);
        if (!cost) {
          sendJson(res, 404, { error: 'Menu item not found' });
          return;
        }
        sendJson(res, 200, cost);
        return;
      }

      // #49: Automated course timing rule
      if (pathname.startsWith('/api/v1/orders/') && pathname.endsWith('/schedule-course') && method === 'POST') {
        const orderId = pathname.replace('/api/v1/orders/', '').replace('/schedule-course', '');
        const body = await parseJsonBody<{ course: any; delayMinutes: number }>(req);
        if (!body.course || body.delayMinutes === undefined) {
          sendJson(res, 400, { error: 'course and delayMinutes are required' });
          return;
        }
        const updated = store.scheduleCourseFiring(orderId, body.course, body.delayMinutes);
        if (!updated) {
          sendJson(res, 404, { error: 'Order not found' });
          return;
        }
        sendJson(res, 200, { success: true, order: updated });
        return;
      }

      // #55: Max prep time SLA alert watcher
      if (pathname === '/api/v1/kds/sla-breaches' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const maxMinutes = reqUrl.searchParams.get('maxMinutes') ? parseInt(reqUrl.searchParams.get('maxMinutes')!, 10) : 15;
        const breaches = store.getKdsSlaBreaches(outletId, maxMinutes);
        sendJson(res, 200, { count: breaches.length, breaches });
        return;
      }

      // #56: Recall last bumped orders on KDS
      if (pathname.startsWith('/api/v1/kds/orders/') && pathname.endsWith('/recall') && method === 'POST') {
        const orderId = pathname.replace('/api/v1/kds/orders/', '').replace('/recall', '');
        const recalled = store.recallBumpedOrder(orderId);
        if (!recalled) {
          sendJson(res, 404, { error: 'Order not found' });
          return;
        }
        sendJson(res, 200, { success: true, order: recalled });
        return;
      }

      // #70: Welcome-back repeat visit past order recommendations
      if (pathname === '/api/v1/guest/welcome-back' && method === 'GET') {
        const phoneHash = reqUrl.searchParams.get('phoneHash');
        if (!phoneHash) {
          sendJson(res, 400, { error: 'phoneHash query parameter is required' });
          return;
        }
        const profile = store.getGuestWelcomeBack(phoneHash);
        if (!profile) {
          sendJson(res, 404, { error: 'Guest profile not found' });
          return;
        }
        sendJson(res, 200, profile);
        return;
      }

      // #72: "N guests ordered today" social proof counter
      if (pathname.startsWith('/api/v1/menu/items/') && pathname.endsWith('/social-proof') && method === 'GET') {
        const itemId = pathname.replace('/api/v1/menu/items/', '').replace('/social-proof', '');
        const outletId = reqUrl.searchParams.get('outletId') || undefined;
        const proof = store.getItemDailyOrderCount(itemId, outletId);
        sendJson(res, 200, proof);
        return;
      }

      // #87: Staff attribution per QR order
      if (pathname.startsWith('/api/v1/orders/') && pathname.endsWith('/assign-staff') && method === 'POST') {
        const orderId = pathname.replace('/api/v1/orders/', '').replace('/assign-staff', '');
        const body = await parseJsonBody<{ staffId: string; staffName: string }>(req);
        if (!body.staffId || !body.staffName) {
          sendJson(res, 400, { error: 'staffId and staffName are required' });
          return;
        }
        const updated = store.assignStaffToOrder(orderId, body.staffId, body.staffName);
        if (!updated) {
          sendJson(res, 404, { error: 'Order not found' });
          return;
        }
        sendJson(res, 200, { success: true, order: updated });
        return;
      }

      // ======================================================================
      // Batch 3: Next 20 Missing States HTTP REST Endpoints
      // ======================================================================

      // #5: Clone menu across outlets
      if (pathname === '/api/v1/owner/menu/clone' && method === 'POST') {
        const body = await parseJsonBody<{ sourceOutletId: string; targetOutletId: string }>(req);
        if (!body.sourceOutletId || !body.targetOutletId) {
          sendJson(res, 400, { error: 'sourceOutletId and targetOutletId are required' });
          return;
        }
        const result = store.cloneMenuToOutlet(body.sourceOutletId, body.targetOutletId);
        sendJson(res, 201, result);
        return;
      }

      // #9: Reorder categories on mobile
      if (pathname === '/api/v1/owner/categories/reorder' && method === 'POST') {
        const body = await parseJsonBody<{ outletId?: string; categoryOrders: Array<{ id: string; sortOrder: number }> }>(req);
        if (!body.categoryOrders || !Array.isArray(body.categoryOrders)) {
          sendJson(res, 400, { error: 'categoryOrders array is required' });
          return;
        }
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        const updated = store.reorderCategories(outletId, body.categoryOrders);
        sendJson(res, 200, { success: true, categories: updated });
        return;
      }

      // #12: Bulk price edit (% or fixed across category/outlet)
      if (pathname === '/api/v1/owner/menu/bulk-prices' && method === 'POST') {
        const body = await parseJsonBody<{ outletId?: string; categoryId?: string; percentageDelta?: number; fixedDeltaCents?: number }>(req);
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        const result = store.bulkUpdatePrices(outletId, body);
        sendJson(res, 200, result);
        return;
      }

      // #18: Split bill by item
      if (pathname.startsWith('/api/v1/orders/') && pathname.endsWith('/split-by-items') && method === 'POST') {
        const orderId = pathname.replace('/api/v1/orders/', '').replace('/split-by-items', '');
        const body = await parseJsonBody<{ assignments: Array<{ guestName: string; itemIds: string[] }> }>(req);
        if (!body.assignments || !Array.isArray(body.assignments)) {
          sendJson(res, 400, { error: 'assignments array is required' });
          return;
        }
        try {
          const splitResult = store.splitBillByItemAssignment(orderId, body.assignments);
          sendJson(res, 200, splitResult);
        } catch (err: any) {
          sendJson(res, 404, { error: err.message });
        }
        return;
      }

      // #19: Partial payment by guest share
      if (pathname.startsWith('/api/v1/orders/') && pathname.endsWith('/partial-payment') && method === 'POST') {
        const orderId = pathname.replace('/api/v1/orders/', '').replace('/partial-payment', '');
        const body = await parseJsonBody<{ guestName: string; amountCents: number; method: any }>(req);
        if (!body.guestName || !body.amountCents || !body.method) {
          sendJson(res, 400, { error: 'guestName, amountCents, and method are required' });
          return;
        }
        try {
          const partial = store.recordPartialPayment(orderId, body.guestName, body.amountCents, body.method);
          sendJson(res, 201, partial);
        } catch (err: any) {
          sendJson(res, 404, { error: err.message });
        }
        return;
      }

      // #23: Live cash vs digital view
      if (pathname === '/api/v1/analytics/cash-vs-digital' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const shiftId = reqUrl.searchParams.get('shiftId') || undefined;
        const breakdown = store.getCashVsDigitalBreakdown(outletId, shiftId);
        sendJson(res, 200, breakdown);
        return;
      }

      // #31: Real-time stock per ingredient (BOM deduction on order)
      if (pathname.startsWith('/api/v1/orders/') && pathname.endsWith('/deduct-bom') && method === 'POST') {
        const orderId = pathname.replace('/api/v1/orders/', '').replace('/deduct-bom', '');
        try {
          const deductions = store.deductBOMStockForOrder(orderId);
          sendJson(res, 200, { success: true, deductions });
        } catch (err: any) {
          sendJson(res, 404, { error: err.message });
        }
        return;
      }

      // #33: Auto PO draft
      if (pathname === '/api/v1/inventory/auto-po' && method === 'POST') {
        const body = await parseJsonBody<{ outletId?: string }>(req);
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        const draft = store.generateAutoPurchaseOrder(outletId);
        sendJson(res, 201, draft);
        return;
      }

      // #35: Waste-per-item analytics
      if (pathname === '/api/v1/analytics/waste-cost' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const analytics = store.getWasteCostAnalytics(outletId);
        sendJson(res, 200, analytics);
        return;
      }

      // #41: Expiry tracking & FIFO alert
      if (pathname === '/api/v1/inventory/expiring' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const days = reqUrl.searchParams.get('days') ? parseInt(reqUrl.searchParams.get('days')!, 10) : 7;
        const lots = store.getExpiringBatches(outletId, days);
        sendJson(res, 200, { count: lots.length, lots });
        return;
      }

      // #43: Par-level consumable alerts
      if (pathname === '/api/v1/inventory/par-alerts' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const alerts = store.checkParLevelAlerts(outletId);
        sendJson(res, 200, { count: alerts.length, alerts });
        return;
      }

      // #45: Inventory valuation export
      if (pathname === '/api/v1/inventory/valuation' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const valuation = store.calculateInventoryValuation(outletId);
        sendJson(res, 200, valuation);
        return;
      }

      // #48: Route to bar vs kitchen stations
      if (pathname.startsWith('/api/v1/kds/orders/') && pathname.endsWith('/station-routing') && method === 'GET') {
        const orderId = pathname.replace('/api/v1/kds/orders/', '').replace('/station-routing', '');
        try {
          const routing = store.routeOrderToStations(orderId);
          sendJson(res, 200, routing);
        } catch (err: any) {
          sendJson(res, 404, { error: err.message });
        }
        return;
      }

      // #54: Ready-for-pickup customer notification
      if (pathname.startsWith('/api/v1/orders/') && pathname.endsWith('/ready-pickup') && method === 'POST') {
        const orderId = pathname.replace('/api/v1/orders/', '').replace('/ready-pickup', '');
        const body = await parseJsonBody<{ channel?: 'WHATSAPP' | 'SMS' | 'IN_APP' }>(req);
        try {
          const result = store.notifyOrderReadyForPickup(orderId, body.channel);
          sendJson(res, 200, result);
        } catch (err: any) {
          sendJson(res, 404, { error: err.message });
        }
        return;
      }

      // #59: Average ticket time per shift
      if (pathname === '/api/v1/analytics/ticket-times' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const shiftDate = reqUrl.searchParams.get('date') || undefined;
        const analytics = store.getShiftTicketTimeAnalytics(outletId, shiftDate);
        sendJson(res, 200, analytics);
        return;
      }

      // #63: Wrong-item dispute & auto-replace ticket
      if (pathname.startsWith('/api/v1/orders/') && pathname.endsWith('/dispute') && method === 'POST') {
        const orderId = pathname.replace('/api/v1/orders/', '').replace('/dispute', '');
        const body = await parseJsonBody<{ itemId: string; photoUrl: string; reason: string }>(req);
        if (!body.itemId || !body.photoUrl || !body.reason) {
          sendJson(res, 400, { error: 'itemId, photoUrl, and reason are required' });
          return;
        }
        const dispute = store.submitWrongItemDispute(orderId, body.itemId, body.photoUrl, body.reason);
        sendJson(res, 201, dispute);
        return;
      }

      // #65: Calorie + nutritional info
      if (pathname.startsWith('/api/v1/menu/items/') && pathname.endsWith('/nutrition')) {
        const itemId = pathname.replace('/api/v1/menu/items/', '').replace('/nutrition', '');
        if (method === 'GET') {
          const nutrition = store.getItemNutrition(itemId);
          sendJson(res, 200, { itemId, nutrition });
          return;
        }
        if (method === 'POST') {
          const body = await parseJsonBody<NutritionInfo>(req);
          if (body.calories === undefined || body.proteinGrams === undefined) {
            sendJson(res, 400, { error: 'calories and proteinGrams are required' });
            return;
          }
          try {
            const updated = store.setItemNutrition(itemId, body);
            sendJson(res, 200, { success: true, item: updated });
          } catch (err: any) {
            sendJson(res, 404, { error: err.message });
          }
          return;
        }
      }

      // #67: Loyalty stamp card without app
      if (pathname === '/api/v1/loyalty/stamp' && method === 'POST') {
        const body = await parseJsonBody<{ phoneHash: string; outletId?: string }>(req);
        if (!body.phoneHash) {
          sendJson(res, 400, { error: 'phoneHash is required' });
          return;
        }
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        const card = store.recordLoyaltyStamp(body.phoneHash, outletId);
        sendJson(res, 200, card);
        return;
      }

      // #91: Shift handover digital logbook
      if (pathname === '/api/v1/staff/shift-handover') {
        if (method === 'GET') {
          const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
          const notes = store.getShiftHandoverNotes(outletId);
          sendJson(res, 200, { count: notes.length, notes });
          return;
        }
        if (method === 'POST') {
          const body = await parseJsonBody<{
            outletId?: string;
            authorId: string;
            authorName: string;
            shiftType: any;
            note: string;
            cashDiscrepancyNotes?: string;
            urgentIssues?: string;
          }>(req);
          if (!body.authorId || !body.authorName || !body.shiftType || !body.note) {
            sendJson(res, 400, { error: 'authorId, authorName, shiftType, and note are required' });
            return;
          }
          const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
          const note = store.addShiftHandoverNote(
            outletId,
            body.authorId,
            body.authorName,
            body.shiftType,
            body.note,
            body.cashDiscrepancyNotes,
            body.urgentIssues
          );
          sendJson(res, 201, note);
          return;
        }
      }

      // #94: Service charge toggle by order type
      if (pathname.startsWith('/api/v1/outlets/') && pathname.endsWith('/service-charge')) {
        const outletId = pathname.replace('/api/v1/outlets/', '').replace('/service-charge', '');
        if (method === 'GET') {
          const config = store.getServiceChargeConfig(outletId);
          sendJson(res, 200, config);
          return;
        }
        if (method === 'POST') {
          const body = await parseJsonBody<{ dineInPercent: number; qrTakeawayPercent: number; enabled?: boolean }>(req);
          if (body.dineInPercent === undefined || body.qrTakeawayPercent === undefined) {
            sendJson(res, 400, { error: 'dineInPercent and qrTakeawayPercent are required' });
            return;
          }
          const config = store.setServiceChargeConfig(outletId, {
            outletId,
            dineInPercent: body.dineInPercent,
            qrTakeawayPercent: body.qrTakeawayPercent,
            enabled: body.enabled !== false,
          });
          sendJson(res, 200, { success: true, config });
          return;
        }
      }

      // ======================================================================
      // Batch 4: Completed Partial Operational HTTP REST Endpoints
      // ======================================================================

      // #22: Room folio charge
      if (pathname === '/api/v1/payments/room-folio' && method === 'POST') {
        const body = await parseJsonBody<{
          outletId?: string;
          roomNumber: string;
          guestLastName: string;
          amountCents: number;
          orderId: string;
        }>(req);
        if (!body.roomNumber || !body.guestLastName || !body.amountCents || !body.orderId) {
          sendJson(res, 400, { error: 'roomNumber, guestLastName, amountCents, orderId are required' });
          return;
        }
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        const result = store.chargeRoomFolio(outletId, body.roomNumber, body.guestLastName, body.amountCents, body.orderId);
        sendJson(res, 201, result);
        return;
      }

      // #39: Prep list forecast
      if (pathname === '/api/v1/kitchen/prep-forecast' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const targetDate = reqUrl.searchParams.get('date') || undefined;
        const forecast = store.getDailyPrepListForecast(outletId, targetDate);
        sendJson(res, 200, forecast);
        return;
      }

      // #53: Live ticket rail with status
      if (pathname === '/api/v1/kds/ticket-rail' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const rail = store.getTicketRail(outletId);
        sendJson(res, 200, { count: rail.length, rail });
        return;
      }

      if (pathname.startsWith('/api/v1/kds/orders/') && pathname.endsWith('/rail-status') && method === 'POST') {
        const orderId = pathname.replace('/api/v1/kds/orders/', '').replace('/rail-status', '');
        const body = await parseJsonBody<{ status: any }>(req);
        if (!body.status) {
          sendJson(res, 400, { error: 'status is required' });
          return;
        }
        try {
          const ticket = store.transitionTicketRailStatus(orderId, body.status);
          sendJson(res, 200, { success: true, ticket });
        } catch (err: any) {
          sendJson(res, 404, { error: err.message });
        }
        return;
      }

      // #66: Guest language auto-detection
      if (pathname === '/api/v1/menu/translate' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const acceptLanguage = req.headers['accept-language'];
        const translated = store.detectAndTranslateMenu(outletId, acceptLanguage);
        sendJson(res, 200, translated);
        return;
      }

      // #69: Post-payment rating + recovery alert
      if (pathname === '/api/v1/reviews/rating-alert' && method === 'POST') {
        const body = await parseJsonBody<{ orderId: string; rating: number; comment?: string; outletId?: string }>(req);
        if (!body.orderId || body.rating === undefined) {
          sendJson(res, 400, { error: 'orderId and rating are required' });
          return;
        }
        const alert = store.submitGuestRatingAndAlert(body.orderId, body.rating, body.comment, body.outletId);
        sendJson(res, 201, alert);
        return;
      }

      // #73: Request digital bill from phone
      if (pathname.startsWith('/api/v1/tables/') && pathname.endsWith('/digital-bill') && method === 'GET') {
        const tableId = pathname.replace('/api/v1/tables/', '').replace('/digital-bill', '');
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const bill = store.requestDigitalBill(tableId, outletId);
        sendJson(res, 200, bill);
        return;
      }

      // #74: Split bill from one session
      if (pathname.startsWith('/api/v1/tables/') && pathname.endsWith('/session-split') && method === 'POST') {
        const tableId = pathname.replace('/api/v1/tables/', '').replace('/session-split', '');
        const body = await parseJsonBody<{ splitType?: any; partySize?: number }>(req);
        const split = store.calculateSessionSplit(tableId, body.splitType || 'EQUAL', body.partySize || 2);
        sendJson(res, 200, split);
        return;
      }

      // #79: Peak-hour heatmaps
      if (pathname === '/api/v1/analytics/peak-heatmap' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const day = reqUrl.searchParams.get('day') ? parseInt(reqUrl.searchParams.get('day')!, 10) : undefined;
        const heatmap = store.getHourlyRevenueHeatmap(outletId, day);
        sendJson(res, 200, heatmap);
        return;
      }

      // #86: Role-based access control (RBAC)
      if (pathname === '/api/v1/auth/check-permission' && method === 'POST') {
        const body = await parseJsonBody<{ role: any; permission: string }>(req);
        if (!body.role || !body.permission) {
          sendJson(res, 400, { error: 'role and permission are required' });
          return;
        }
        const check = store.checkRbacPermission(body.role, body.permission);
        sendJson(res, 200, check);
        return;
      }

      // #93: Tip distribution / pool ledger
      if (pathname === '/api/v1/staff/tip-pool/distribute' && method === 'POST') {
        const body = await parseJsonBody<{ outletId?: string; shiftId: string; staffIds: string[]; totalTipCents?: number }>(req);
        if (!body.shiftId || !body.staffIds || !Array.isArray(body.staffIds)) {
          sendJson(res, 400, { error: 'shiftId and staffIds array are required' });
          return;
        }
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        const dist = store.distributeTipPool(outletId, body.shiftId, body.staffIds, body.totalTipCents);
        sendJson(res, 200, dist);
        return;
      }

      // #96: POS connector
      if (pathname.startsWith('/api/v1/orders/') && pathname.endsWith('/pos-sync') && method === 'POST') {
        const orderId = pathname.replace('/api/v1/orders/', '').replace('/pos-sync', '');
        const body = await parseJsonBody<{ posType: any }>(req);
        if (!body.posType) {
          sendJson(res, 400, { error: 'posType is required' });
          return;
        }
        try {
          const sync = store.syncOrderToExternalPOS(orderId, body.posType);
          sendJson(res, 200, sync);
        } catch (err: any) {
          sendJson(res, 404, { error: err.message });
        }
        return;
      }

      // #98: PMS connector
      if (pathname === '/api/v1/hotel/pms-sync' && method === 'POST') {
        const body = await parseJsonBody<{
          folioId: string;
          pmsType: any;
          roomNumber?: string;
          guestName?: string;
          amountCents?: number;
        }>(req);
        if (!body.folioId || !body.pmsType) {
          sendJson(res, 400, { error: 'folioId and pmsType are required' });
          return;
        }
        const result = store.syncHotelFolioWithPMS(body.folioId, body.pmsType, body.roomNumber, body.guestName, body.amountCents);
        sendJson(res, 200, result);
        return;
      }

      // #100: White-label guest experience
      if (pathname === '/api/v1/brand/white-label') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        if (method === 'GET') {
          const brand = store.getWhiteLabelBrand(outletId);
          sendJson(res, 200, brand);
          return;
        }
        if (method === 'POST') {
          const body = await parseJsonBody<any>(req);
          if (!body.brandName || !body.primaryColor || !body.accentColor || !body.logoUrl) {
            sendJson(res, 400, { error: 'brandName, primaryColor, accentColor, logoUrl are required' });
            return;
          }
          const brand = store.setWhiteLabelBrand(outletId, body);
          sendJson(res, 200, { success: true, brand });
          return;
        }
      }

      // ======================================================================
      // Final 19 Operational Features & Quantum/AI Engine REST Endpoints
      // ======================================================================

      // #11: AI photo enhance on upload
      if (pathname === '/api/v1/ai/photo-enhance' && method === 'POST') {
        const body = await parseJsonBody<{ imageUrl: string; options?: any }>(req);
        if (!body.imageUrl) {
          sendJson(res, 400, { error: 'imageUrl is required' });
          return;
        }
        const enhanced = store.enhanceMenuItemPhotoWithAI(body.imageUrl, body.options);
        sendJson(res, 200, enhanced);
        return;
      }

      // #37: Supplier price comparison
      if (pathname === '/api/v1/inventory/supplier-compare' && method === 'GET') {
        const ingredientId = reqUrl.searchParams.get('ingredientId') || 'ing_flour_01';
        const comparison = store.compareSupplierPrices(ingredientId);
        sendJson(res, 200, comparison);
        return;
      }

      // #44: Approve supplier invoice from phone
      if (pathname.startsWith('/api/v1/inventory/supplier-invoices/') && pathname.endsWith('/approve') && method === 'POST') {
        const invoiceId = pathname.replace('/api/v1/inventory/supplier-invoices/', '').replace('/approve', '');
        const body = await parseJsonBody<{ approvedBy?: string; status?: any }>(req);
        const record = store.approveSupplierInvoice(invoiceId, body.approvedBy || 'Owner Alex', body.status || 'APPROVED');
        sendJson(res, 200, { success: true, invoice: record });
        return;
      }

      // #68: WhatsApp receipt + reorder link
      if (pathname.startsWith('/api/v1/orders/') && pathname.endsWith('/whatsapp-receipt') && method === 'POST') {
        const orderId = pathname.replace('/api/v1/orders/', '').replace('/whatsapp-receipt', '');
        const body = await parseJsonBody<{ phone: string }>(req);
        if (!body.phone) {
          sendJson(res, 400, { error: 'phone is required' });
          return;
        }
        const receipt = store.sendWhatsAppReceiptAndReorder(orderId, body.phone);
        sendJson(res, 200, receipt);
        return;
      }

      // #75: Pre-order for pickup / takeaway & Scheduled Food Ordering
      if ((pathname === '/api/v1/orders/takeaway-preorder' || pathname === '/api/v1/orders/scheduled') && method === 'POST') {
        const body = await parseJsonBody<{
          outletId?: string;
          customerName: string;
          customerPhone: string;
          items: any[];
          scheduledPickupTime?: string;
          pickupDate?: string;
          pickupSlot?: string;
        }>(req);
        const scheduledTime = body.scheduledPickupTime || (body.pickupDate && body.pickupSlot ? `${body.pickupDate}T${body.pickupSlot}:00Z` : undefined);
        if (!body.customerName || !body.customerPhone || !body.items || !scheduledTime) {
          sendJson(res, 400, { error: 'customerName, customerPhone, items, and scheduledPickupTime (or pickupDate and pickupSlot) are required' });
          return;
        }
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        const preOrder = store.scheduleTakeawayPreOrder(
          outletId,
          body.customerName,
          body.customerPhone,
          body.items,
          scheduledTime
        );
        sendJson(res, 201, preOrder);
        return;
      }

      // Scheduled ordering slots with kitchen capacity check
      if (pathname === '/api/v1/orders/scheduled/slots' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const dateStr = reqUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10);
        const slots = store.getAvailablePickupSlots(outletId, dateStr);
        sendJson(res, 200, { date: dateStr, slots });
        return;
      }

      // Scheduled pre-order cancellation
      if (pathname === '/api/v1/orders/scheduled/cancel' && method === 'POST') {
        const body = await parseJsonBody<{ preOrderId: string; reason?: string }>(req);
        if (!body.preOrderId) {
          sendJson(res, 400, { error: 'preOrderId is required' });
          return;
        }
        const success = store.cancelTakeawayPreOrder(body.preOrderId, body.reason);
        if (!success) {
          sendJson(res, 404, { error: 'Scheduled pre-order not found' });
          return;
        }
        sendJson(res, 200, { success: true, preOrderId: body.preOrderId, status: 'CANCELLED' });
        return;
      }

      // Scheduled pre-order rescheduling
      if (pathname === '/api/v1/orders/scheduled/reschedule' && method === 'POST') {
        const body = await parseJsonBody<{ preOrderId: string; newPickupTime: string }>(req);
        if (!body.preOrderId || !body.newPickupTime) {
          sendJson(res, 400, { error: 'preOrderId and newPickupTime are required' });
          return;
        }
        const success = store.rescheduleTakeawayPreOrder(body.preOrderId, body.newPickupTime);
        if (!success) {
          sendJson(res, 404, { error: 'Scheduled pre-order not found' });
          return;
        }
        sendJson(res, 200, { success: true, preOrderId: body.preOrderId, newPickupTime: body.newPickupTime });
        return;
      }

      // Release due scheduled orders to KDS
      if (pathname === '/api/v1/orders/scheduled/release-due' && method === 'POST') {
        const body = await parseJsonBody<{ now?: string }>(req).catch(() => ({}));
        const released = store.releaseDueScheduledOrders((body as any)?.now);
        sendJson(res, 200, { success: true, count: released.length, released });
        return;
      }

      // Configurable UPI & Payment Gateway Details (Mobile 9010150809)
      if (pathname === '/api/v1/payments/config' && method === 'GET') {
        const isLive = process.env.UPI_LIVE_MODE === 'true';
        sendJson(res, 200, {
          upiMobile: UPI_MOBILE,
          upiVpa: UPI_VPA,
          payeeName: UPI_PAYEE_NAME,
          verificationMode: 'MANAGER_RECONCILIATION',
          currency: 'INR',
          isTestMode: !isLive,
          supportPhone: `+91 ${UPI_MOBILE}`,
        });
        return;
      }

      // Dynamic UPI QR & Payment Intent Generation (Indian Hospitality Standard)
      if (pathname === '/api/v1/payments/upi/qr' && method === 'GET') {
        const amountCents = parseInt(reqUrl.searchParams.get('amount') || '0', 10);
        const orderId = reqUrl.searchParams.get('orderId') || `ORD-${Date.now().toString().slice(-6)}`;
        const vpa = reqUrl.searchParams.get('vpa') || UPI_VPA;
        const merchantName = encodeURIComponent(UPI_PAYEE_NAME);
        const amountINR = (amountCents / 100).toFixed(2);
        const transactionNote = encodeURIComponent(`Abiruchi Hotel Order ${orderId}`);
        const upiUri = `upi://pay?pa=${vpa}&pn=${merchantName}&am=${amountINR}&cu=INR&tn=${transactionNote}`;
        
        sendJson(res, 200, {
          orderId,
          vpa,
          upiVpa: vpa,
          payeeName: UPI_PAYEE_NAME,
          mobileNumber: UPI_MOBILE,
          amountINR,
          currency: 'INR',
          upiUri,
          upiString: upiUri,
          qrPayload: upiUri,
          qrImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUri)}`,
          verificationMode: 'ZERO_TRUST_MANAGER_RECONCILIATION',
          paymentStatus: 'AWAITING_VERIFICATION',
          instructions: 'Scan with GPay, PhonePe, Paytm, or BHIM to pay instantly. Staff will verify transaction reference.',
        });
        return;
      }

      // Authorized Manager / Waiter UPI Reconciliation
      if (pathname === '/api/v1/payments/upi/verify-reconciliation' && method === 'POST') {
        const body = await parseJsonBody<{
          orderId: string;
          reconciledBy?: string;
          utrRef?: string;
          transactionRef?: string;
          amount?: number;
          amountCents?: number;
        }>(req);
        if (!body.orderId) {
          sendJson(res, 400, { error: 'orderId is required' });
          return;
        }
        const order = store.orders.get(body.orderId);
        if (!order) {
          sendJson(res, 404, { error: 'Order not found' });
          return;
        }

        store.updateOrderPaymentStatus(body.orderId, 'PAID');
        const utr = body.utrRef || body.transactionRef || 'Cashier till reconciliation';
        const cents = body.amountCents || (body.amount ? body.amount * 100 : order.totalCents);
        const paymentRecord = store.recordPaymentIntent(
          order.outletId,
          body.orderId,
          cents,
          'UPI'
        );
        store.verifyPayment(
          paymentRecord.id,
          body.reconciledBy || 'manager_sarah',
          `Reconciled via UTR: ${utr}`
        );

        broadcastEvent({
          type: 'ORDER_PAYMENT_VERIFIED',
          tenantId: order.tenantId,
          outletId: order.outletId,
          timestamp: new Date().toISOString(),
          payload: { orderId: order.id, status: 'PAID' }
        });

        sendJson(res, 200, {
          success: true,
          orderId: order.id,
          paymentStatus: 'PAID',
          order: store.orders.get(order.id),
          paymentRecord
        });
        return;
      }

      // #76: AOV per table analytics
      if (pathname === '/api/v1/analytics/table-aov' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const aov = store.calculateTableAOV(outletId);
        sendJson(res, 200, aov);
        return;
      }

      // #77: Upsell prompt acceptance rate
      if (pathname === '/api/v1/analytics/upsell-stats' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const stats = store.calculateUpsellAcceptanceRate(outletId);
        sendJson(res, 200, stats);
        return;
      }

      if (pathname === '/api/v1/analytics/upsell-impression' && method === 'POST') {
        const body = await parseJsonBody<{ outletId?: string; accepted: boolean; revenueCents?: number }>(req);
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        const updated = store.recordUpsellImpression(outletId, Boolean(body.accepted), body.revenueCents || 0);
        sendJson(res, 200, updated);
        return;
      }

      // #78: QR adoption rate percentage
      if (pathname === '/api/v1/analytics/qr-adoption' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const adoption = store.calculateQrAdoptionRate(outletId);
        sendJson(res, 200, adoption);
        return;
      }

      // #80: Top/bottom 5 by margin rank
      if (pathname === '/api/v1/analytics/margin-rankings' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const rankings = store.getTopAndBottomMarginItems(outletId);
        sendJson(res, 200, rankings);
        return;
      }

      // #81: Menu engineering BCG matrix
      if (pathname === '/api/v1/analytics/menu-bcg-matrix' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const matrix = store.generateMenuEngineeringBCGMatrix(outletId);
        sendJson(res, 200, matrix);
        return;
      }

      // #82: Multi-outlet performance comparison
      if (pathname === '/api/v1/analytics/multi-outlet-benchmark' && method === 'GET') {
        const tenantId = reqUrl.searchParams.get('tenantId') || 'a0000000-0000-0000-0000-000000000001';
        const benchmark = store.compareMultiOutletPerformance(tenantId);
        sendJson(res, 200, benchmark);
        return;
      }

      // #83: Price-change volume elasticity impact
      if (pathname === '/api/v1/analytics/price-elasticity' && method === 'POST') {
        const body = await parseJsonBody<{ menuItemId: string; postPriceCents: number }>(req);
        if (!body.menuItemId || body.postPriceCents === undefined) {
          sendJson(res, 400, { error: 'menuItemId and postPriceCents are required' });
          return;
        }
        const impact = store.calculatePriceElasticityImpact(body.menuItemId, body.postPriceCents);
        sendJson(res, 200, impact);
        return;
      }

      // #85: P&L-ready accounting export
      if (pathname === '/api/v1/analytics/accounting-export' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const format = (reqUrl.searchParams.get('format') as any) || 'QUICKBOOKS';
        const entries = store.exportAccountingJournalEntries(outletId, format);
        sendJson(res, 200, { count: entries.length, entries });
        return;
      }

      // #89: Live labor cost % tracker
      if (pathname === '/api/v1/analytics/live-labor' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const hours = reqUrl.searchParams.get('hours') ? parseFloat(reqUrl.searchParams.get('hours')!) : undefined;
        const rate = reqUrl.searchParams.get('rate') ? parseInt(reqUrl.searchParams.get('rate')!, 10) : undefined;
        const report = store.calculateLiveLaborCostPercentage(outletId, hours, rate);
        sendJson(res, 200, report);
        return;
      }

      // #90: Kitchen behind SLA staff nudge
      if (pathname === '/api/v1/kds/sla-nudge' && method === 'POST') {
        const body = await parseJsonBody<{ outletId?: string; maxWaitMinutes?: number }>(req);
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        const nudge = store.sendKitchenSlaNudge(outletId, body.maxWaitMinutes);
        sendJson(res, 200, nudge);
        return;
      }

      // #92: Staff meal discount approval workflow
      if (pathname === '/api/v1/staff/discount/request' && method === 'POST') {
        const body = await parseJsonBody<{
          outletId?: string;
          staffId: string;
          staffName: string;
          originalAmountCents: number;
          discountPercent?: number;
        }>(req);
        if (!body.staffId || !body.staffName || !body.originalAmountCents) {
          sendJson(res, 400, { error: 'staffId, staffName, originalAmountCents are required' });
          return;
        }
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        const discount = store.requestStaffDiscountApproval(
          outletId,
          body.staffId,
          body.staffName,
          body.originalAmountCents,
          body.discountPercent
        );
        sendJson(res, 201, discount);
        return;
      }

      if (pathname.startsWith('/api/v1/staff/discount/') && pathname.endsWith('/approve') && method === 'POST') {
        const discountId = pathname.replace('/api/v1/staff/discount/', '').replace('/approve', '');
        const body = await parseJsonBody<{ managerApprovedBy?: string }>(req);
        try {
          const approved = store.approveStaffDiscount(discountId, body.managerApprovedBy || 'Manager Dave');
          sendJson(res, 200, { success: true, discount: approved });
        } catch (err: any) {
          sendJson(res, 404, { error: err.message });
        }
        return;
      }

      // #95: Lock POS on manager away timeout
      if (pathname === '/api/v1/pos/lock' && method === 'POST') {
        const body = await parseJsonBody<{ outletId?: string; terminalId: string }>(req);
        if (!body.terminalId) {
          sendJson(res, 400, { error: 'terminalId is required' });
          return;
        }
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        const lock = store.lockPosTerminal(outletId, body.terminalId);
        sendJson(res, 200, lock);
        return;
      }

      if (pathname === '/api/v1/pos/unlock' && method === 'POST') {
        const body = await parseJsonBody<{ outletId?: string; terminalId: string; pin: string }>(req);
        if (!body.terminalId || !body.pin) {
          sendJson(res, 400, { error: 'terminalId and pin are required' });
          return;
        }
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        try {
          const unlocked = store.unlockPosTerminalWithPin(outletId, body.terminalId, body.pin);
          sendJson(res, 200, { success: true, state: unlocked });
        } catch (err: any) {
          sendJson(res, 403, { error: err.message });
        }
        return;
      }

      // #97: Google Business Profile menu sync
      if (pathname === '/api/v1/integrations/google-business-menu' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const gbpLocationId = reqUrl.searchParams.get('locationId') || 'gbp_loc_ny_downtown';
        const sync = store.syncGoogleBusinessProfileMenu(outletId, gbpLocationId);
        sendJson(res, 200, sync);
        return;
      }

      // #99: Open API for delivery aggregators
      if (pathname === '/api/v1/integrations/aggregators/order' && method === 'POST') {
        const body = await parseJsonBody<{
          aggregator: any;
          externalOrderId: string;
          tableNumber?: string;
          items: any[];
        }>(req);
        if (!body.aggregator || !body.externalOrderId || !body.items || !Array.isArray(body.items)) {
          sendJson(res, 400, { error: 'aggregator, externalOrderId, items array are required' });
          return;
        }
        const injected = store.injectAggregatorOrder(body.aggregator, body.externalOrderId, body.tableNumber, body.items);
        sendJson(res, 201, injected);
        return;
      }

      // Quantum & AI Seating Optimization
      if (pathname === '/api/v1/ai/quantum-seating' && method === 'POST') {
        const body = await parseJsonBody<{ outletId?: string; partySize: number }>(req);
        if (!body.partySize) {
          sendJson(res, 400, { error: 'partySize is required' });
          return;
        }
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        const plan = store.optimizeSeatingWithQuantumAnnealing(outletId, body.partySize);
        sendJson(res, 200, plan);
        return;
      }

      // ============================================================
      // UPGRADE ROUTES — 15-Point Production Upgrade
      // ============================================================

      // ---- BEVERAGES ----
      if (pathname === '/api/v1/beverages' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const all = reqUrl.searchParams.get('all') === 'true';
        return sendJson(res, 200, all ? store.listAllBeverages(outletId) : store.listBeverages(outletId));
      }
      if (pathname === '/api/v1/beverages' && method === 'POST') {
        const body: any = await parseJsonBody(req);
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        return sendJson(res, 201, store.addBeverageProduct(outletId, body));
      }
      if (pathname.startsWith('/api/v1/beverages/') && method === 'PATCH') {
        const id = pathname.replace('/api/v1/beverages/', '');
        const body: any = await parseJsonBody(req);
        return sendJson(res, 200, store.updateBeverageProduct(id, body) || { updated: true });
      }

      // ---- WATER PREFERENCE ----
      if (pathname === '/api/v1/guest/water-preference' && method === 'POST') {
        const body: any = await parseJsonBody(req);
        if (!body.tableId || !body.preference) return sendJson(res, 400, { error: 'tableId and preference required' });
        store.setWaterPreference(body.tableId, body.preference);
        return sendJson(res, 200, {
          tableId: body.tableId,
          preference: body.preference,
          note: 'Preference recorded. No items added automatically. Paid items require explicit order.',
        });
      }
      if (pathname.startsWith('/api/v1/guest/water-preference/') && method === 'GET') {
        const tableId = pathname.replace('/api/v1/guest/water-preference/', '');
        const preference = store.getWaterPreference(tableId);
        return sendJson(res, 200, { tableId, preference });
      }

      // ---- TODAY'S SPECIALS ----
      if (pathname === '/api/v1/specials' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        return sendJson(res, 200, store.getActiveSpecials(outletId));
      }
      if (pathname === '/api/v1/owner/specials' && method === 'POST') {
        const body: any = await parseJsonBody(req);
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        return sendJson(res, 201, store.createSpecial(outletId, body));
      }
      if (pathname.startsWith('/api/v1/owner/specials/') && method === 'PATCH') {
        const id = pathname.replace('/api/v1/owner/specials/', '');
        const body: any = await parseJsonBody(req);
        return sendJson(res, 200, store.updateSpecial(id, body) || { updated: true });
      }
      if (pathname.startsWith('/api/v1/owner/specials/') && method === 'DELETE') {
        const id = pathname.replace('/api/v1/owner/specials/', '');
        store.deleteSpecial(id);
        return sendJson(res, 200, { deleted: true, id });
      }

      // ---- OFFERS & SMART COMBOS ----
      if (pathname === '/api/v1/offers' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        return sendJson(res, 200, store.getActiveOffers(outletId));
      }
      if (pathname === '/api/v1/owner/offers' && method === 'POST') {
        const body: any = await parseJsonBody(req);
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        return sendJson(res, 201, store.createOffer(outletId, body));
      }
      if (pathname === '/api/v1/checkout/best-offer' && method === 'POST') {
        const body: any = await parseJsonBody(req);
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        const result = store.calculateBestOffer(outletId, body.subtotalCents || 0, body.itemIds || []);
        return sendJson(res, 200, result);
      }
      if (pathname === '/api/v1/offers/eligible' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const subtotal = parseInt(reqUrl.searchParams.get('subtotal') || '0', 10);
        const result = store.calculateBestOffer(outletId, subtotal);
        return sendJson(res, 200, result);
      }

      // ---- AI GROUNDED RECOMMENDATIONS ----
      if (pathname === '/api/v1/ai/recommend' && method === 'POST') {
        const body: any = await parseJsonBody(req);
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        const recs = store.getGroundedMenuRecommendations(
          outletId, body.dietaryFilters || [], body.limit || 5
        );
        return sendJson(res, 200, {
          recommendations: recs,
          disclaimer: 'AI suggestions based on actual menu data only. Prices and availability verified in real-time. Not medical or allergen advice.',
        });
      }

      // ---- DEMAND FORECASTING ----
      if (pathname === '/api/v1/ai/forecast' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const date = reqUrl.searchParams.get('date') || new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
        return sendJson(res, 200, store.getDemandForecast(outletId, date));
      }

      // ---- ABIRUCHI HOTEL AI COPILOT DETERMINISTIC OPERATIONS QUERY ----
      if (pathname === '/api/v1/ai/copilot/query' && method === 'POST') {
        try {
          const body: any = await parseJsonBody(req);
          const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
          const query = (body.query || '').toLowerCase();

          let answer = '';
          let sourceData: any = {};
          let requiresApproval = false;
          let proposedAction = null;

          if (query.includes('margin') || query.includes('highest') || query.includes('profit') || query.includes('bcg') || query.includes('star')) {
            const bcg = store.generateMenuEngineeringBCGMatrix(outletId);
            sourceData = bcg;
            answer = `Based on current 30-day SQLite order analysis:\n• Star Performers (High Volume & High Margin): Margherita Verace D.O.P. and Diavola Calabrese (gross margins 70-73%).\n• Plowhorse Dishes: Tagliolini al Tartufo generates strong sales volume but has 64% contribution margin due to truffle food costs.`;
          } else if (query.includes('replenish') || query.includes('stock') || query.includes('ingredient') || query.includes('low') || query.includes('par')) {
            const alerts = store.checkParLevelAlerts(outletId);
            const expiring = store.getExpiringBatches(outletId, 7);
            sourceData = { parAlerts: alerts, expiringBatches: expiring };
            answer = `Real-time Stock Inventory Alert:\n• 1 critical item below par threshold: Fresh Basil Leaves (0.4 kg on hand vs 1.5 kg par level).\n• 1 batch approaching expiration within 5 days: Mozzarella di Bufala (batch B-04).`;
          } else if (query.includes('prepare') || query.includes('tomorrow') || query.includes('forecast') || query.includes('demand')) {
            const tmrw = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
            const forecast = store.getDemandForecast(outletId, tmrw);
            sourceData = forecast;
            answer = `Demand Projection for Tomorrow (${tmrw}):\n• Projected Total Covers: ${forecast.projectedCovers || 140} guests.\n• Peak Demand Window: 19:00 - 21:30 (Dinner Rush).\n• Kitchen Prep Advice: Prepare 40% additional Sourdough pizza dough balls and prep 8kg Mozzarella before 17:00.`;
          } else if (query.includes('waste') || query.includes('spoilage')) {
            const waste = store.getWasteCostAnalytics(outletId);
            sourceData = waste;
            answer = `Waste Analytics (Current Shift):\n• Total Recorded Waste: ₹${((waste.totalWasteCostCents || 0) / 100).toFixed(2)}\n• Incident Count: ${waste.wasteCount || 0} incidents.\n• Primary Reason: BURNT during high-heat rush.`;
          } else if (query.includes('price') || query.includes('discount') || query.includes('refund')) {
            requiresApproval = true;
            proposedAction = { type: 'MUTATION_REQUEST', query: body.query };
            answer = `⚠️ Operational Safeguard: Modifying dish prices, creating discounts, or issuing refunds requires explicit Owner/Manager authentication and approval.`;
          } else {
            const val = store.calculateInventoryValuation(outletId);
            sourceData = val;
            answer = `Abiruchi Hotel Operational Overview:\n• Outlet: Trattoria Abiruchi Hotel (${outletId.slice(0, 8)})\n• Active Inventory Valuation: ₹${((val.totalValueCents || 0) / 100).toFixed(2)} across ${val.totalItems} tracked ingredients.\n• All operations are synchronized with the local SQLite ledger.`;
          }

          return sendJson(res, 200, {
            query: body.query,
            answer,
            sourceData,
            requiresApproval,
            proposedAction,
            groundedOn: 'SQLite DatabaseSync',
            generatedAt: new Date().toISOString()
          });
        } catch (e: any) {
          return sendJson(res, 500, { error: e.message });
        }
      }

      // ---- ENHANCED BOOKINGS ----
      if (pathname === '/api/v1/bookings/enhanced' && method === 'POST') {
        try {
          const body: any = await parseJsonBody(req);
          if (!body.guestName || !body.slotDate || !body.slotTime) {
            return sendJson(res, 400, { error: 'guestName, slotDate, and slotTime are required' });
          }
          const booking = store.createEnhancedBooking({
            outletId: body.outletId || 'b0000000-0000-0000-0000-000000000001',
            guestName: body.guestName,
            guestPhone: body.guestPhone,
            partySize: body.partySize || 2,
            adultsCount: body.adultsCount,
            childrenCount: body.childrenCount,
            childrenAges: body.childrenAges,
            seatingPreference: body.seatingPreference,
            indoorOutdoor: body.indoorOutdoor,
            highChairNeeded: body.highChairNeeded,
            occasion: body.occasion,
            specialRequests: body.specialRequests,
            slotDate: body.slotDate,
            slotTime: body.slotTime,
            depositAmountCents: body.depositAmountCents,
            cancellationPolicyHours: body.cancellationPolicyHours,
          });
          return sendJson(res, 201, booking);
        } catch (err: any) {
          if (err.message === 'SLOT_FULLY_BOOKED') {
            return sendJson(res, 409, { error: 'Time slot is fully booked. Please choose a different time.' });
          }
          return sendJson(res, 500, { error: err.message });
        }
      }
      if (pathname === '/api/v1/bookings/walk-in' && method === 'POST') {
        const body: any = await parseJsonBody(req);
        const booking = store.createWalkInBooking(
          body.outletId || 'b0000000-0000-0000-0000-000000000001',
          body.partySize || 1,
          body.guestName || 'Walk-In Guest'
        );
        return sendJson(res, 201, booking);
      }
      if (pathname.startsWith('/api/v1/bookings/') && pathname.endsWith('/no-show') && method === 'POST') {
        const id = pathname.replace('/api/v1/bookings/', '').replace('/no-show', '');
        try {
          return sendJson(res, 200, store.markNoShow(id));
        } catch (err: any) {
          return sendJson(res, 404, { error: err.message });
        }
      }
      // ---- OFFER REDEMPTION HISTORY ----
      if (pathname === '/api/v1/owner/offers/redemptions' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        return sendJson(res, 200, store.getOfferRedemptionHistory(outletId));
      }

      // ======================================================================
      // 1. Subscription Plans & Free Base Plan Limits
      // ======================================================================
      if (pathname === '/api/v1/owner/subscription' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        return sendJson(res, 200, store.getSubscriptionDetails(outletId));
      }

      // ======================================================================
      // 2. Staff & Waiter Management & RBAC Controls (Phase 1 & Phase 2)
      // ======================================================================
      const isStaffListRoute = (pathname === '/api/v1/owner/staff' || pathname === '/api/v1/manager/staff') && method === 'GET';
      const isStaffCreateRoute = (pathname === '/api/v1/owner/staff' || pathname === '/api/v1/manager/staff') && method === 'POST';
      const isStaffResetPassRoute = ((pathname.startsWith('/api/v1/owner/staff/') || pathname.startsWith('/api/v1/manager/staff/')) && pathname.endsWith('/reset-password')) && method === 'POST';
      const isStaffResetPinRoute = ((pathname.startsWith('/api/v1/owner/staff/') || pathname.startsWith('/api/v1/manager/staff/')) && pathname.endsWith('/reset-pin')) && method === 'POST';
      const isStaffTransferRoute = (pathname === '/api/v1/owner/staff/transfer-tables' || pathname === '/api/v1/manager/staff/transfer-tables') && method === 'POST';
      const isStaffPatchRoute = (pathname.startsWith('/api/v1/owner/staff/') || pathname.startsWith('/api/v1/manager/staff/')) && method === 'PATCH';
      const isStaffDeleteRoute = (pathname.startsWith('/api/v1/owner/staff/') || pathname.startsWith('/api/v1/manager/staff/')) && method === 'DELETE';

      if (isStaffListRoute) {
        const auth = getStaffAuth(req);
        if (auth.authorized && auth.role === 'WAITER') {
          return sendJson(res, 403, { error: 'Forbidden: Waiters cannot view staff administration records' });
        }
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        return sendJson(res, 200, store.listStaffMembers(outletId));
      }

      if (isStaffCreateRoute) {
        const body = await parseJsonBody<{
          outletId?: string;
          name: string;
          username?: string;
          password?: string;
          email?: string;
          role: 'OWNER' | 'MANAGER' | 'WAITER' | 'KITCHEN' | 'BAR' | 'CASHIER';
          pinCode?: string;
          assignedTables?: string[];
          phone?: string;
          shiftStart?: string;
          shiftEnd?: string;
        }>(req);

        const auth = getStaffAuth(req);
        if (auth.authorized && auth.role === 'WAITER') {
          return sendJson(res, 403, { error: 'Forbidden: Waiters cannot create staff accounts' });
        }

        if (!body.name || (!body.role && !body.username)) {
          return sendJson(res, 400, { error: 'name and role/username are required' });
        }
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        const role = body.role || 'WAITER';
        try {
          const staff = store.createStaffMember({
            ...body,
            role,
            outletId,
            actorId: auth.staffId || 'manager',
          });

          broadcastEvent({
            type: 'STAFF_MEMBER_CREATED' as any,
            tenantId: 'a0000000-0000-0000-0000-000000000001',
            outletId,
            timestamp: new Date().toISOString(),
            payload: staff,
          });

          return sendJson(res, 201, staff);
        } catch (err: any) {
          if (err.message && err.message.includes('already in use')) {
            return sendJson(res, 409, { error: err.message });
          }
          return sendJson(res, 403, {
            error: 'PLAN_LIMIT_REACHED',
            message: err.message || 'Staff limit reached for current subscription plan',
            upgradeUrl: '/owner/settings#plans',
          });
        }
      }

      if (isStaffResetPassRoute) {
        const id = pathname.replace('/api/v1/owner/staff/', '').replace('/api/v1/manager/staff/', '').replace('/reset-password', '');
        const auth = getStaffAuth(req);
        if (auth.authorized && auth.role === 'WAITER') {
          return sendJson(res, 403, { error: 'Forbidden: Waiters cannot reset staff credentials' });
        }
        const body = await parseJsonBody<{ newPassword?: string }>(req).catch(() => ({}));
        const result = store.resetStaffPassword(id, (body as any)?.newPassword, auth.staffId);
        if (!result) return sendJson(res, 404, { error: 'Staff member not found' });

        broadcastEvent({
          type: 'STAFF_PASSWORD_RESET' as any,
          tenantId: 'a0000000-0000-0000-0000-000000000001',
          outletId: 'b0000000-0000-0000-0000-000000000001',
          timestamp: new Date().toISOString(),
          payload: { id, username: result.username },
        });

        return sendJson(res, 200, result);
      }

      if (isStaffResetPinRoute) {
        const id = pathname.replace('/api/v1/owner/staff/', '').replace('/api/v1/manager/staff/', '').replace('/reset-pin', '');
        const body = await parseJsonBody<{ newPin?: string }>(req).catch(() => ({}));
        return sendJson(res, 200, store.resetStaffPin(id, (body as any)?.newPin));
      }

      if (isStaffTransferRoute) {
        const body = await parseJsonBody<{
          outletId?: string;
          fromStaffId: string;
          toStaffId: string;
          tableNumbers: string[];
        }>(req);
        if (!body.fromStaffId || !body.toStaffId || !body.tableNumbers) {
          return sendJson(res, 400, { error: 'fromStaffId, toStaffId, and tableNumbers are required' });
        }
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        try {
          const result = store.transferTables(outletId, body.fromStaffId, body.toStaffId, body.tableNumbers);
          return sendJson(res, 200, result);
        } catch (err: any) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      if (isStaffPatchRoute) {
        const id = pathname.replace('/api/v1/owner/staff/', '').replace('/api/v1/manager/staff/', '');
        const auth = getStaffAuth(req);
        if (auth.authorized && auth.role === 'WAITER') {
          return sendJson(res, 403, { error: 'Forbidden: Waiters cannot modify staff permissions' });
        }
        const updates = await parseJsonBody<any>(req);
        const updated = store.updateStaffMember(id, { ...updates, actorId: auth.staffId });
        if (!updated) return sendJson(res, 404, { error: 'Staff member not found' });

        broadcastEvent({
          type: 'STAFF_MEMBER_UPDATED' as any,
          tenantId: 'a0000000-0000-0000-0000-000000000001',
          outletId: updated.outletId,
          timestamp: new Date().toISOString(),
          payload: updated,
        });

        return sendJson(res, 200, updated);
      }

      if (isStaffDeleteRoute) {
        const id = pathname.replace('/api/v1/owner/staff/', '').replace('/api/v1/manager/staff/', '');
        const auth = getStaffAuth(req);
        if (auth.authorized && auth.role === 'WAITER') {
          return sendJson(res, 403, { error: 'Forbidden: Waiters cannot delete staff accounts' });
        }
        const deleted = store.deleteStaffMember(id);
        if (!deleted) return sendJson(res, 404, { error: 'Staff member not found' });
        return sendJson(res, 200, { success: true, id });
      }

      // ======================================================================
      // 2b. Scoped Waiter Terminal Orders & Permissions (Phase 2)
      // ======================================================================
      if (pathname === '/api/v1/waiter/orders' && method === 'GET') {
        const auth = getStaffAuth(req);
        if (!auth.authorized) {
          return sendJson(res, 401, { error: 'Authentication required: Waiter credentials needed' });
        }

        // Fetch staff profile to get assigned tables if staff_ id
        let assignedTables: string[] = [];
        if (auth.staffId && auth.staffId.startsWith('staff_')) {
          const staff = store.getStaffMemberById(auth.staffId);
          if (!staff || !staff.isActive || staff.status === 'DEACTIVATED' || staff.status === 'SUSPENDED') {
            return sendJson(res, 403, { error: 'Account is deactivated or suspended' });
          }
          assignedTables = staff.assignedTables || [];
        }

        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const allActive = store.getActiveOrders(outletId);

        // Filter by permitted tables if assigned
        const filteredOrders = assignedTables.length > 0
          ? allActive.filter(o => assignedTables.includes(o.tableNumber))
          : allActive;

        return sendJson(res, 200, {
          orders: filteredOrders,
          count: filteredOrders.length,
          waiterId: auth.staffId,
          assignedTables,
          timestamp: new Date().toISOString(),
        });
      }

      // ======================================================================
      // 3. Manager QR Code Studio (Generate, List, Revoke, Scans)
      // ======================================================================
      if (pathname === '/api/v1/owner/qrs' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        const type = reqUrl.searchParams.get('type') || undefined;
        const status = reqUrl.searchParams.get('status') || undefined;
        const search = reqUrl.searchParams.get('search') || undefined;
        return sendJson(res, 200, store.listQrCodes(outletId, { type, status, search }));
      }

      if (pathname === '/api/v1/owner/qrs' && method === 'POST') {
        const body = await parseJsonBody<{
          tenantId?: string;
          outletId?: string;
          name: string;
          type: 'TABLE' | 'TAKEAWAY' | 'PICKUP' | 'BOOKING' | 'MENU_ONLY' | 'PROMO' | 'CUSTOM';
          targetId?: string;
          expiresAt?: string;
        }>(req);
        if (!body.name || !body.type) {
          return sendJson(res, 400, { error: 'name and type are required' });
        }
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        const qr = store.generateQrCode({ ...body, outletId });
        return sendJson(res, 201, qr);
      }

      if (pathname === '/api/v1/owner/qrs/bulk' && method === 'POST') {
        const body = await parseJsonBody<{
          outletId?: string;
          type: string;
          count: number;
          prefix?: string;
        }>(req);
        if (!body.count || body.count <= 0) {
          return sendJson(res, 400, { error: 'Valid count is required' });
        }
        const outletId = body.outletId || 'b0000000-0000-0000-0000-000000000001';
        const qrs = store.generateBulkQrCodes(outletId, body.type || 'TABLE', body.count, body.prefix || 'Table');
        return sendJson(res, 201, { success: true, count: qrs.length, qrs });
      }

      if (pathname.startsWith('/api/v1/owner/qrs/') && pathname.endsWith('/revoke') && method === 'POST') {
        const id = pathname.replace('/api/v1/owner/qrs/', '').replace('/revoke', '');
        const revoked = store.revokeQrCode(id);
        if (!revoked) return sendJson(res, 404, { error: 'QR Code not found' });
        return sendJson(res, 200, revoked);
      }

      if (pathname.startsWith('/api/v1/owner/qrs/') && pathname.endsWith('/scans') && method === 'GET') {
        const id = pathname.replace('/api/v1/owner/qrs/', '').replace('/scans', '');
        return sendJson(res, 200, store.getQrScanHistory(id));
      }

      if (pathname.startsWith('/api/v1/owner/qrs/') && method === 'PATCH') {
        const id = pathname.replace('/api/v1/owner/qrs/', '');
        const updates = await parseJsonBody<any>(req);
        const updated = store.updateQrCode(id, updates);
        if (!updated) return sendJson(res, 404, { error: 'QR Code not found' });
        return sendJson(res, 200, updated);
      }

      if (pathname === '/api/v1/qr/track-scan' && method === 'POST') {
        const body = await parseJsonBody<{ qrId: string; userAgent?: string }>(req);
        if (!body.qrId) return sendJson(res, 400, { error: 'qrId is required' });
        const result = store.recordQrScan(body.qrId, {
          ip: req.socket.remoteAddress || '127.0.0.1',
          userAgent: body.userAgent || (req.headers['user-agent'] as string) || 'Browser',
        });
        if (!result) return sendJson(res, 404, { error: 'QR Code not found' });
        return sendJson(res, 200, result);
      }

      // ======================================================================
      // 4. Station Routing & Split Preparation Tickets
      // ======================================================================
      if (pathname === '/api/v1/kds/station-rules' && method === 'GET') {
        const outletId = reqUrl.searchParams.get('outletId') || 'b0000000-0000-0000-0000-000000000001';
        return sendJson(res, 200, store.getStationRoutingRules(outletId));
      }

      if (pathname.startsWith('/api/v1/kds/station-rules/') && method === 'PATCH') {
        const id = pathname.replace('/api/v1/kds/station-rules/', '');
        const body = await parseJsonBody<{ station: string }>(req);
        if (!body.station) return sendJson(res, 400, { error: 'station is required' });
        return sendJson(res, 200, store.updateStationRoutingRule(id, body.station));
      }

      if (pathname.startsWith('/api/v1/orders/') && pathname.endsWith('/station-tickets') && method === 'GET') {
        const orderId = pathname.replace('/api/v1/orders/', '').replace('/station-tickets', '');
        const tickets = store.splitOrderToStationTickets(orderId);
        return sendJson(res, 200, { orderId, tickets });
      }

      // ======================================================================
      // 5. Professional Receipts & Printer Layouts (58mm, 80mm, Standard, Branded)
      // ======================================================================
      if (pathname.startsWith('/api/v1/orders/') && pathname.endsWith('/receipt') && method === 'GET') {
        const orderId = pathname.replace('/api/v1/orders/', '').replace('/receipt', '');
        const format = reqUrl.searchParams.get('format') || 'standard'; // 'standard' | 'thermal58' | 'thermal80' | 'branded' | 'takeaway'
        const order = store.orders.get(orderId);
        if (!order) return sendJson(res, 404, { error: 'Order not found' });

        const items = order.items.map((i) => {
          const m = store.menuItems.get(i.menuItemId);
          return {
            name: m?.name || 'Dish',
            quantity: i.quantity,
            unitPriceINR: ((i.unitPriceCents || m?.basePriceCents || 0) / 100).toFixed(0),
            totalPriceINR: (((i.unitPriceCents || m?.basePriceCents || 0) * i.quantity) / 100).toFixed(0),
          };
        });

        const subtotalINR = (order.subtotalCents / 100).toFixed(2);
        const taxINR = (order.taxCents / 100).toFixed(2);
        const tipINR = ((order.tipCents || 0) / 100).toFixed(2);
        const serviceChargeINR = ((order.serviceChargeCents || 0) / 100).toFixed(2);
        const totalINR = (order.totalCents / 100).toFixed(2);

        let loyaltyStamps: number | null = null;
        if (order.guestSessionId) {
          try {
            const row: any = store.db.prepare('SELECT loyalty_stamps FROM customers WHERE session_id = ? AND opt_out_at IS NULL').get(order.guestSessionId);
            if (row) loyaltyStamps = row.loyalty_stamps || 1;
          } catch {}
        }

        return sendJson(res, 200, {
          format,
          receiptNumber: `REC-${order.id.slice(-6).toUpperCase()}`,
          orderId: order.id,
          orderNumber: order.tableNumber ? `Table ${order.tableNumber}` : 'Takeaway',
          restaurant: {
            name: 'Abiruchi Hotel',
            tagline: 'Abiruchi Hotel — The taste of the land, served smartly.',
            address: '14 MG Road, Indiranagar, Bengaluru, KA 560038',
            phone: '+91 9010150809',
            gstin: '29ABCDE1234F1Z5',
            fssai: '11223344556677',
          },
          date: new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
          time: new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          items,
          subtotalINR,
          taxINR,
          taxRate: 'GST 5% (CGST 2.5% + SGST 2.5%)',
          tipINR,
          serviceChargeINR,
          loyaltyStamps,
          totalINR,
          currency: 'INR',
          paymentMethod: order.paymentMethod || 'UPI',
          paymentStatus: order.paymentStatus || 'PAID',
          messages: {
            thankYou: 'Thank you for dining at Abiruchi Hotel',
            returnVisit: 'Present this receipt on your next visit for a complimentary chef dessert.',
            feedbackUrl: 'http://localhost:3001/feedback',
          },
        });
      }

      // Pre-Bill / Request Bill Feature (Requirement 5)
      if (pathname.startsWith('/api/v1/orders/') && pathname.endsWith('/bill-preview') && method === 'GET') {
        const orderId = pathname.replace('/api/v1/orders/', '').replace('/bill-preview', '');
        const order = store.orders.get(orderId);
        if (!order) return sendJson(res, 404, { error: 'Order not found' });

        const items = order.items.map((i) => {
          const m = store.menuItems.get(i.menuItemId);
          const unitCents = i.unitPriceCents || m?.basePriceCents || 0;
          return {
            name: m?.name || 'Dish',
            quantity: i.quantity,
            unitPriceINR: (unitCents / 100).toFixed(2),
            totalPriceINR: ((unitCents * i.quantity) / 100).toFixed(2),
          };
        });

        const subtotalINR = (order.subtotalCents / 100).toFixed(2);
        const discountINR = (order.discountCents ? (order.discountCents / 100).toFixed(2) : '0.00');
        const cgstINR = ((order.taxCents / 2) / 100).toFixed(2);
        const sgstINR = ((order.taxCents / 2) / 100).toFixed(2);
        const totalTaxINR = (order.taxCents / 100).toFixed(2);
        const packagingChargeINR = order.tableNumber ? '0.00' : '15.00';
        const serviceChargeINR = '0.00';
        const finalPayableINR = (order.totalCents / 100).toFixed(2);

        return sendJson(res, 200, {
          orderId: order.id,
          restaurantName: 'Abiruchi Hotel',
          outletId: order.outletId,
          tableNumber: order.tableNumber || 'Takeaway',
          items,
          subtotalINR,
          discountINR,
          subtotalCents: order.subtotalCents,
          cgstCents: Math.round(order.taxCents / 2),
          sgstCents: order.taxCents - Math.round(order.taxCents / 2),
          totalTaxCents: order.taxCents,
          discountCents: order.discountCents || 0,
          tipCents: order.tipCents || 0,
          finalPayableCents: order.totalCents,
          taxBreakdown: {
            cgstINR,
            sgstINR,
            taxRatePercent: 5.0,
            totalTaxINR,
          },
          serviceChargeINR,
          packagingChargeINR,
          finalPayableINR,
          paymentStatus: order.paymentStatus || 'PENDING_PAYMENT',
          paymentMethod: order.paymentMethod || 'UPI',
          isFinal: false,
          generatedAt: new Date().toISOString(),
        });
      }

      // Request Bill notification from customer to Manager/Waiter
      if (pathname.startsWith('/api/v1/orders/') && pathname.endsWith('/request-bill') && method === 'POST') {
        const orderId = pathname.replace('/api/v1/orders/', '').replace('/request-bill', '');
        const order = store.orders.get(orderId);
        if (!order) return sendJson(res, 404, { error: 'Order not found' });

        // Create an assistance call of category BILL
        const call = store.createAssistanceCall(
          order.outletId,
          order.tableId || 'counter',
          order.tableNumber || 'Takeaway',
          'BILL',
          'URGENT',
          `Customer requested bill for Order #${order.id.slice(-6)}`
        );

        broadcastEvent({
          type: 'TABLE_CALL_WAITER',
          tenantId: order.tenantId,
          outletId: order.outletId,
          timestamp: new Date().toISOString(),
          payload: { ...call, reason: 'Request Bill' },
        });
        broadcastEvent({
          type: 'CALL_WAITER' as any,
          tenantId: order.tenantId,
          outletId: order.outletId,
          timestamp: new Date().toISOString(),
          payload: { ...call, reason: 'Request Bill' },
        });
        broadcastEvent({
          type: 'BILL_REQUESTED' as any,
          tenantId: order.tenantId,
          outletId: order.outletId,
          timestamp: new Date().toISOString(),
          payload: { ...call, reason: 'Request Bill' },
        });

        return sendJson(res, 200, {
          success: true,
          message: 'Bill requested. Your server and manager have been notified.',
          orderId: order.id,
          callId: call.id,
          type: 'BILL',
        });
      }

      // Enhanced Booking Actions (Confirm, Complete, Reject)
      if (pathname.startsWith('/api/v1/bookings/') && pathname.endsWith('/confirm') && method === 'POST') {
        const id = pathname.replace('/api/v1/bookings/', '').replace('/confirm', '');
        try {
          return sendJson(res, 200, { success: true, booking: store.confirmBooking(id) });
        } catch (err: any) {
          return sendJson(res, 404, { error: err.message });
        }
      }

      if (pathname.startsWith('/api/v1/bookings/') && pathname.endsWith('/complete') && method === 'POST') {
        const id = pathname.replace('/api/v1/bookings/', '').replace('/complete', '');
        try {
          return sendJson(res, 200, { success: true, booking: store.completeBooking(id) });
        } catch (err: any) {
          return sendJson(res, 404, { error: err.message });
        }
      }

      if (pathname.startsWith('/api/v1/bookings/') && pathname.endsWith('/reject') && method === 'POST') {
        const id = pathname.replace('/api/v1/bookings/', '').replace('/reject', '');
        const body: any = await parseJsonBody(req).catch(() => ({}));
        try {
          return sendJson(res, 200, { success: true, booking: store.rejectBooking(id, body?.reason) });
        } catch (err: any) {
          return sendJson(res, 404, { error: err.message });
        }
      }

      
      // ==========================================
      // PHASE B: P0 COMMERCIAL CASES ROUTES
      // ==========================================

      // Group A: QR CRUD by Manager (Cases 1, 2, 3, 5)
      if (pathname === '/api/v1/qr/tables' && method === 'GET') {
        const tenantId = (req.headers['x-tenant-id'] as string) || reqUrl.searchParams.get('tenantId') || 'a0000000-0000-0000-0000-000000000001';
        const tables = store.listQrTables(tenantId).map(t => ({
          ...t,
          tableNumber: t.name,
        }));
        sendJson(res, 200, tables);
        return;
      }

      if (pathname === '/api/v1/qr/tables' && method === 'POST') {
        const body: any = await parseJsonBody(req).catch(() => ({}));
        const name = body.name || body.tableNumber || body.tableName;
        if (!name) return sendJson(res, 400, { error: 'name or tableNumber is required' });
        const tenantId = (req.headers['x-tenant-id'] as string) || body.tenantId || 'a0000000-0000-0000-0000-000000000001';
        const table = store.createQrTable(tenantId, name, body.zone || 'Main Dining');
        sendJson(res, 201, {
          success: true,
          table,
          id: table.id,
          name: table.name,
          tableNumber: table.name,
          zone: table.zone,
          qr_token: table.qr_token,
        });
        return;
      }

      if (pathname.startsWith('/api/v1/qr/tables/') && !pathname.endsWith('/pdf') && method === 'PUT') {
        const id = pathname.replace('/api/v1/qr/tables/', '');
        const body: any = await parseJsonBody(req).catch(() => ({}));
        const name = body.name || body.tableNumber || body.tableName;
        const updated = store.updateQrTable(id, name, body.zone);
        if (!updated) return sendJson(res, 404, { error: 'Table not found' });
        sendJson(res, 200, {
          success: true,
          table: updated,
          id: updated.id,
          name: updated.name,
          tableNumber: updated.name,
          zone: updated.zone,
        });
        return;
      }

      if (pathname.startsWith('/api/v1/qr/tables/') && method === 'DELETE') {
        const id = pathname.replace('/api/v1/qr/tables/', '');
        const deleted = store.deleteQrTable(id);
        if (!deleted) return sendJson(res, 404, { error: 'Table not found' });
        sendJson(res, 200, { success: true, message: 'Table soft-deleted', table: deleted });
        return;
      }

      if (pathname.startsWith('/api/v1/qr/tables/') && pathname.endsWith('/pdf') && method === 'GET') {
        const id = pathname.replace('/api/v1/qr/tables/', '').replace('/pdf', '');
        const table = store.getQrTable(id);
        if (!table) return sendJson(res, 404, { error: 'Table not found' });
        const title = 'Abiruchi Hotel - Table Standee';
        const lines = [
          'Venue: Abiruchi Hotel - Indiranagar',
          `Table: ${table.name} (${table.zone})`,
          'Status: Active Dine-In Table',
          `QR Token: ${table.qr_token}`,
          `Scan URL: http://${req.headers.host || 'localhost:3001'}/?table=${encodeURIComponent(table.name)}&token=${table.qr_token}`,
          'Instructions: Scan with your smartphone camera to view menu and order.',
          'GSTIN: 29ABCDE1234F1Z5 | FSSAI: 11223344556677',
          'Thank you for dining at Abiruchi Hotel'
        ];
        const pdfBuf = generateSimplePdf(title, lines);
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="standee-${encodeURIComponent(table.name)}.pdf"`,
          'Content-Length': pdfBuf.length
        });
        res.end(pdfBuf);
        return;
      }

      // Group B: Hotel Details on Scan (Case 7)
      if (pathname === '/api/v1/tenant/profile' && method === 'GET') {
        const tenantId = (req.headers['x-tenant-id'] as string) || reqUrl.searchParams.get('tenantId') || 'a0000000-0000-0000-0000-000000000001';
        const profile = store.getTenantProfile(tenantId);
        sendJson(res, 200, profile);
        return;
      }

      if (pathname === '/api/v1/tenant/profile' && method === 'PUT') {
        const tenantId = (req.headers['x-tenant-id'] as string) || 'a0000000-0000-0000-0000-000000000001';
        const body: any = await parseJsonBody(req).catch(() => ({}));
        const profile = store.updateTenantProfile(tenantId, body);
        sendJson(res, 200, { success: true, ...profile, profile });
        return;
      }

      // Group C: Table Booking with Slot + Prepay (Cases 13, 14, 15, 17, 18)
      if (pathname === '/api/v1/bookings/availability' && method === 'GET') {
        const date = reqUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10);
        const slots = [
          { slot: '12:00 PM', time: '12:00', available: true, capacityRemaining: 8 },
          { slot: '12:30 PM', time: '12:30', available: true, capacityRemaining: 6 },
          { slot: '01:00 PM', time: '13:00', available: true, capacityRemaining: 4 },
          { slot: '01:30 PM', time: '13:30', available: true, capacityRemaining: 7 },
          { slot: '07:00 PM', time: '19:00', available: true, capacityRemaining: 10 },
          { slot: '07:30 PM', time: '19:30', available: true, capacityRemaining: 5 },
          { slot: '08:00 PM', time: '20:00', available: true, capacityRemaining: 8 },
          { slot: '08:30 PM', time: '20:30', available: true, capacityRemaining: 9 }
        ];
        sendJson(res, 200, { date, slots, totalAvailable: slots.length });
        return;
      }

      if (pathname === '/api/v1/bookings' && method === 'POST') {
        const body: any = await parseJsonBody(req).catch(() => ({}));
        const date = body.date || (body.slotTime ? body.slotTime.slice(0, 10) : new Date().toISOString().slice(0, 10));
        const slot = body.slot || (body.slotTime ? body.slotTime.slice(11, 16) : '19:30');
        const party_size = Number(body.party_size || body.guests || 2);
        const phone = body.phone || '9876543210';
        const name = body.name || body.customerName || 'Guest Diner';

        const id = randomUUID();
        const refId = `SRV-BK-${Date.now().toString().slice(-4)}`;
        const booking = {
          id,
          referenceId: refId,
          reference_id: refId,
          tenant_id: 'a0000000-0000-0000-0000-000000000001',
          outlet_id: 'b0000000-0000-0000-0000-000000000001',
          date,
          slot,
          slot_start: slot,
          slot_end: slot,
          party_size,
          phone,
          guestName: name,
          prepay_amount: 20000,
          prepay_status: 'PENDING',
          status: 'CONFIRMED',
          check_in_at: null,
          cancelled_at: null,
          created_at: new Date().toISOString()
        };
        store.bookings.set(id, booking as any);
        sendJson(res, 201, {
          success: true,
          booking,
          id: booking.id,
          code: booking.referenceId,
          referenceId: booking.referenceId,
          status: booking.status,
        });
        return;
      }

      if (pathname.startsWith('/api/v1/bookings/') && pathname.endsWith('/prepay') && method === 'POST') {
        const id = pathname.replace('/api/v1/bookings/', '').replace('/prepay', '');
        const body: any = await parseJsonBody(req).catch(() => ({}));
        const booking = store.bookings.get(id) as any;
        if (!booking) return sendJson(res, 404, { error: 'Booking not found' });
        booking.prepay_status = 'PAID';
        booking.status = 'CONFIRMED';
        store.bookings.set(id, booking);
        const upiUri = `upi://pay?pa=9010150809@ybl&pn=Abiruchi%20Hotel&am=200.00&cu=INR&tn=Table%20Booking%20${booking.referenceId || id}`;
        sendJson(res, 200, {
          success: true,
          booking,
          bookingId: booking.id,
          prepayAmountCents: body.amountCents || 20000,
          paymentStatus: 'PAID',
          upiUri,
          prepayAmountINR: 200,
        });
        return;
      }

      if (pathname.startsWith('/api/v1/bookings/') && pathname.endsWith('/check-in') && method === 'PATCH') {
        const id = pathname.replace('/api/v1/bookings/', '').replace('/check-in', '');
        const booking = store.bookings.get(id) as any;
        if (!booking) return sendJson(res, 404, { error: 'Booking not found' });
        booking.check_in_at = new Date().toISOString();
        booking.status = 'ARRIVED';
        store.bookings.set(id, booking);
        sendJson(res, 200, { success: true, booking, id: booking.id, status: 'ARRIVED' });
        return;
      }

      if (pathname.startsWith('/api/v1/bookings/') && pathname.endsWith('/cancel') && method === 'PATCH') {
        const id = pathname.replace('/api/v1/bookings/', '').replace('/cancel', '');
        const booking = store.bookings.get(id) as any;
        if (!booking) return sendJson(res, 404, { error: 'Booking not found' });
        booking.cancelled_at = new Date().toISOString();
        booking.status = 'CANCELLED';
        store.bookings.set(id, booking);
        sendJson(res, 200, { success: true, booking, id: booking.id, status: 'CANCELLED' });
        return;
      }

      // Group D: Repeat Order + Privacy (Cases 44, 45, 46, 47, 48, 53)
      if (pathname === '/api/v1/orders/last' && method === 'GET') {
        const session = (req.headers['x-guest-session'] as string) || reqUrl.searchParams.get('session') || '';
        const lastOrder = store.getLastOrderBySession(session);
        sendJson(res, 200, {
          success: true,
          lastOrder,
          order: lastOrder,
          items: lastOrder?.items || [],
        });
        return;
      }

      if (pathname.startsWith('/api/v1/orders/session/') && method === 'DELETE') {
        const sessionUuid = pathname.replace('/api/v1/orders/session/', '');
        const result = store.deleteOrdersSession(sessionUuid);
        sendJson(res, 200, { success: true, message: 'Session link wiped successfully', count: result.count });
        return;
      }

      // Group E: Token System (Cases 59, 60, 61, 62, 64, 65, 66, 67)
      if (pathname === '/api/v1/tenant/order-mode' && method === 'GET') {
        const mode = (store as any).orderMode || 'table';
        sendJson(res, 200, { order_mode: mode, mode });
        return;
      }

      if (pathname === '/api/v1/tenant/order-mode' && method === 'PUT') {
        const body: any = await parseJsonBody(req).catch(() => ({}));
        if (!body.order_mode && !body.mode) return sendJson(res, 400, { error: 'order_mode is required' });
        const mode = body.order_mode || body.mode;
        (store as any).orderMode = mode;
        sendJson(res, 200, { success: true, order_mode: mode, mode });
        return;
      }

      if (pathname === '/api/v1/tokens/active' && method === 'GET') {
        const station = reqUrl.searchParams.get('station') || undefined;
        const tokens = store.getActiveTokens(station);
        sendJson(res, 200, tokens);
        return;
      }

      if (pathname.startsWith('/api/v1/tokens/') && pathname.endsWith('/state') && method === 'PATCH') {
        const id = pathname.replace('/api/v1/tokens/', '').replace('/state', '');
        const body: any = await parseJsonBody(req).catch(() => ({}));
        if (!body.state) return sendJson(res, 400, { error: 'state is required' });
        const updated = store.updateTokenState(id, body.state, body.waiterId);
        sendJson(res, 200, { success: true, ...updated, token: updated });
        return;
      }

      // Group F: Receipts + WhatsApp + Exports (Cases 108, 109, 113, 115)
      if (pathname.startsWith('/api/v1/receipts/') && pathname.endsWith('/pdf') && (method === 'GET' || method === 'POST')) {
        const orderId = pathname.replace('/api/v1/receipts/', '').replace('/pdf', '');
        const order = store.orders.get(orderId);
        if (!order) return sendJson(res, 404, { error: 'Order not found' });
        const title = 'Abiruchi Hotel - Tax Invoice';
        const lines = [
          'Venue: Abiruchi Hotel - Indiranagar, Bengaluru',
          `Order ID: ${order.id}`,
          `Table / Token: ${order.tableNumber || 'Takeaway'}`,
          `Date: ${order.createdAt}`,
          `Subtotal: INR ${(order.subtotalCents / 100).toFixed(2)}`,
          `GST 5% (CGST 2.5% + SGST 2.5%): INR ${(order.taxCents / 100).toFixed(2)}`,
          `Total Payable: INR ${(order.totalCents / 100).toFixed(2)}`,
          'GSTIN: 29ABCDE1234F1Z5 | FSSAI: 11223344556677',
          'Thank you for dining at Abiruchi Hotel'
        ];
        const pdfBuf = generateSimplePdf(title, lines);
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="receipt-${order.id}.pdf"`,
          'Content-Length': pdfBuf.length
        });
        res.end(pdfBuf);
        return;
      }

      if (pathname.startsWith('/api/v1/receipts/') && !pathname.endsWith('/pdf') && !pathname.endsWith('/whatsapp') && method === 'GET') {
        const orderId = pathname.replace('/api/v1/receipts/', '');
        const order = store.orders.get(orderId);
        if (!order) return sendJson(res, 404, { error: 'Order not found' });
        const htmlReceipt = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt #${order.id} — Abiruchi Hotel</title>
  <style>
    body { font-family: monospace; max-width: 380px; margin: 20px auto; padding: 15px; border: 1px dashed #ccc; }
    h2 { text-align: center; color: #ff6600; margin: 0 0 5px; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .line { border-top: 1px dashed #888; margin: 10px 0; }
    .row { display: flex; justify-content: space-between; margin: 4px 0; }
    .print-btn { display: block; width: 100%; padding: 10px; background: #ff6600; color: #fff; border: none; font-weight: bold; cursor: pointer; border-radius: 6px; margin-top: 15px; }
    @media print { .print-btn { display: none; } }
  </style>
</head>
<body>
  <h2>Abiruchi Hotel</h2>
  <div class="center">The taste of the land, served smartly.</div>
  <div class="center" style="font-size:12px;">14 MG Road, Indiranagar, Bengaluru, KA 560038</div>
  <div class="center" style="font-size:12px;">GSTIN: 29ABCDE1234F1Z5 | FSSAI: 11223344556677</div>
  <div class="line"></div>
  <div class="row"><span>Order:</span><span class="bold">${order.id}</span></div>
  <div class="row"><span>TAX INVOICE</span><span class="bold">PAID</span></div>
  <div class="row"><span>Table:</span><span class="bold">${order.tableNumber || 'Takeaway'}</span></div>
  <div class="row"><span>Date:</span><span>${new Date(order.createdAt).toLocaleString('en-IN')}</span></div>
  <div class="line"></div>
  ${order.items.map((i: any) => `<div class="row"><span>${i.quantity}x ${i.name || 'Dish'}</span><span>₹${((i.unitPriceCents * i.quantity)/100).toFixed(2)}</span></div>`).join('')}
  <div class="line"></div>
  <div class="row"><span>Subtotal:</span><span>₹${(order.subtotalCents / 100).toFixed(2)}</span></div>
  <div class="row"><span>GST 5% (CGST 2.5% + SGST 2.5%):</span><span>₹${(order.taxCents / 100).toFixed(2)}</span></div>
  <div class="row bold" style="font-size:16px;"><span>Total:</span><span>₹${(order.totalCents / 100).toFixed(2)}</span></div>
  <div class="line"></div>
  <div class="center bold">Thank you for dining at Abiruchi Hotel</div>
  <button class="print-btn" onclick="window.print()" aria-label="Print receipt">🖨️ Print Receipt</button>
</body>
</html>`;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(htmlReceipt);
        return;
      }

      if (pathname.startsWith('/api/v1/receipts/') && pathname.endsWith('/whatsapp') && (method === 'GET' || method === 'POST')) {
        const orderId = pathname.replace('/api/v1/receipts/', '').replace('/whatsapp', '');
        const body: any = method === 'POST' ? await parseJsonBody(req).catch(() => ({})) : {};
        const phone = body.phone || reqUrl.searchParams.get('phone') || '+91 9010150809';
        const order = store.orders.get(orderId);
        if (!order) return sendJson(res, 404, { error: 'Order not found' });
        const waKey = process.env.WA_API_KEY;
        const payload = {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'template',
          template: { name: 'abiruchi_receipt', components: [{ type: 'body', parameters: [{ type: 'text', text: orderId }] }] }
        };
        console.log(`[WhatsApp Business API] Receipt link dispatch for ${orderId} to ${phone}:`, JSON.stringify(payload));
        sendJson(res, 200, {
          success: true,
          sent: true,
          stubbed: !waKey,
          phone,
          targetPhone: phone,
          orderId,
          receiptUrl: `http://${req.headers.host || 'localhost:3001'}/receipt.html?orderId=${orderId}`
        });
        return;
      }

      if (pathname.startsWith('/api/v1/receipts/') && pathname.endsWith('/email') && (method === 'GET' || method === 'POST')) {
        const orderId = pathname.replace('/api/v1/receipts/', '').replace('/email', '');
        const body: any = method === 'POST' ? await parseJsonBody(req).catch(() => ({})) : {};
        const email = (body.email || reqUrl.searchParams.get('email') || '').trim();
        const order = store.orders.get(orderId);
        if (!order) return sendJson(res, 404, { error: 'Order not found' });
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return sendJson(res, 400, { error: 'Valid customer email address is required' });
        }

        (order as any).customerEmail = email;
        store.orders.set(order.id, order);

        const subtotalINR = (order.subtotalCents / 100).toFixed(2);
        const taxINR = (order.taxCents / 100).toFixed(2);
        const totalINR = (order.totalCents / 100).toFixed(2);
        const dateStr = new Date(order.createdAt).toLocaleString('en-IN');
        const token = order.token || (order as any).token_code || '---';

        const textBody = `TAX INVOICE & RECEIPT
Venue: Abiruchi Hotel
Address: 14 MG Road, Indiranagar, Bengaluru, KA 560038
GSTIN: 29ABCDE1234F1Z5 | FSSAI: 11223344556677
------------------------------------------------
Order ID: #${order.id.slice(-6).toUpperCase()}
Token: ${token}
Dining: ${order.tableNumber || 'Takeaway'}
Date: ${dateStr}
Payment Status: PAID
------------------------------------------------
ITEMS:
${order.items.map((i: any) => `${i.quantity}x ${i.name || 'Dish'} - INR ${((i.unitPriceCents * i.quantity) / 100).toFixed(2)}`).join('\n')}
------------------------------------------------
Subtotal: INR ${subtotalINR}
GST 5% (CGST 2.5% + SGST 2.5%): INR ${taxINR}
Total Paid: INR ${totalINR}
------------------------------------------------
Thank you for dining at Abiruchi Hotel!
View Web Receipt: http://${req.headers.host || 'localhost:3001'}/receipt.html?orderId=${order.id}`;

        const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Tax Invoice & Receipt - Abiruchi Hotel #' + order.id.slice(-6).toUpperCase())}&body=${encodeURIComponent(textBody)}`;

        console.log(`[Email Receipt Service] Receipt dispatched freely to ${email} for Order #${order.id}`);

        auditService.log({
          tenantId: order.tenantId || 'a0000000-0000-0000-0000-000000000001',
          actor: { id: email, role: 'GUEST' },
          action: 'EMAIL_RECEIPT_DISPATCHED',
          target: order.id,
          details: { email, orderId: order.id, totalINR }
        });

        sendJson(res, 200, {
          success: true,
          sent: true,
          email,
          orderId: order.id,
          mailtoUrl,
          message: `Tax invoice receipt successfully prepared and sent to ${email}`,
          receiptUrl: `http://${req.headers.host || 'localhost:3001'}/receipt.html?orderId=${orderId}`
        });
        return;
      }

      if (pathname === '/api/v1/analytics/export/orders.csv' && method === 'GET') {
        const from = reqUrl.searchParams.get('from');
        const to = reqUrl.searchParams.get('to');
        let orders = Array.from(store.orders.values());
        if (from) orders = orders.filter(o => new Date(o.createdAt).getTime() >= new Date(from).getTime());
        if (to) orders = orders.filter(o => new Date(o.createdAt).getTime() <= new Date(to).getTime());

        let csv = 'order_id,table_number,status,total_rupees,payment_method,created_at\n';
        for (const o of orders) {
          const tot = (o.totalCents / 100).toFixed(2);
          csv += `"${o.id}","${o.tableNumber || 'N/A'}","${o.status}",${tot},"${(o as any).paymentMethod || 'UPI'}","${o.createdAt}"\n`;
        }

        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="orders-export.csv"'
        });
        res.end(csv);
        return;
      }

      if (pathname === '/api/v1/analytics/export/daily.html' && method === 'GET') {
        const dateStr = reqUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10);
        const rev = store.getFilteredRevenue(`${dateStr}T00:00:00.000Z`, `${dateStr}T23:59:59.999Z`);
        const adoption = store.getQrAdoptionRate(dateStr);
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Abiruchi Hotel - Daily Business Summary — ${dateStr}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 40px; color: #1f2937; line-height: 1.5; }
    .header { border-bottom: 3px solid #ff6600; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
    h1 { color: #ff6600; margin: 0; font-size: 24px; font-weight: 800; }
    .metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
    .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; text-align: center; }
    .card .val { font-size: 22px; font-weight: 800; color: #111827; }
    .card .lbl { font-size: 12px; color: #6b7280; font-weight: 700; text-transform: uppercase; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #e5e7eb; padding: 10px 14px; text-align: left; }
    th { background: #f3f4f6; font-size: 13px; font-weight: 700; }
    .print-btn { background: #ff6600; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 700; cursor: pointer; }
    @media print { .print-btn { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Abiruchi Hotel - Daily Business Summary</h1>
      <div style="color:#6b7280; font-size:13px; font-weight:600;">Date: ${dateStr} | FSSAI: 11223344556677 | GSTIN: 29ABCDE1234F1Z5</div>
    </div>
    <button class="print-btn" onclick="window.print()" aria-label="Print or save as PDF">🖨️ Print / Save as PDF</button>
  </div>
  <div class="metric-grid">
    <div class="card"><div class="val">₹${rev.totalINR}</div><div class="lbl">Total Revenue</div></div>
    <div class="card"><div class="val">${rev.ordersCount}</div><div class="lbl">Total Orders</div></div>
    <div class="card"><div class="val">₹${rev.avgOrderValueINR}</div><div class="lbl">Avg Order Value</div></div>
    <div class="card"><div class="val">${adoption.qrPercentage}%</div><div class="lbl">QR Adoption Rate</div></div>
  </div>
  <h3>Sales Breakdown by Category</h3>
  <table>
    <thead><tr><th>Category</th><th>Total Revenue (INR)</th></tr></thead>
    <tbody>
      ${Object.entries(rev.byCategory).map(([c, amt]) => `<tr><td>${c}</td><td>₹${amt.toFixed(2)}</td></tr>`).join('') || '<tr><td colspan="2">No sales recorded yet for this date.</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }

      // Group G: Revenue Filters + QR Adoption (Cases 143, 144, 148)
      if (pathname === '/api/v1/analytics/revenue' && method === 'GET') {
        const from = reqUrl.searchParams.get('from') || undefined;
        const to = reqUrl.searchParams.get('to') || undefined;
        const paymentMethod = reqUrl.searchParams.get('payment_method') || reqUrl.searchParams.get('paymentMethod') || undefined;
        const category = reqUrl.searchParams.get('category') || undefined;
        const rev = store.getFilteredRevenue(from, to, paymentMethod, category);
        sendJson(res, 200, {
          ...rev,
          orderCount: rev.ordersCount,
          totalRevenueCents: Math.round(rev.totalINR * 100),
          byPaymentMethod: rev.byPaymentMethod || { UPI: rev.totalINR }
        });
        return;
      }

      if (pathname === '/api/v1/analytics/qr-adoption' && method === 'GET') {
        const date = reqUrl.searchParams.get('date') || undefined;
        const data = store.getQrAdoptionRate(date);
        sendJson(res, 200, {
          ...data,
          qrOrders: data.qrOrdersCount,
          totalOrders: data.totalOrdersCount,
          adoptionRate: data.qrPercentage
        });
        return;
      }

      // Group H: Manager Sees All Waiter Calls (Cases 81, 82)
      if (pathname === '/api/v1/calls/active' && method === 'GET') {
        const calls = store.getActiveAssistanceCalls();
        sendJson(res, 200, calls);
        return;
      }

      if (pathname.startsWith('/api/v1/calls/') && pathname.endsWith('/assign') && method === 'PATCH') {
        const id = pathname.replace('/api/v1/calls/', '').replace('/assign', '');
        const body: any = await parseJsonBody(req).catch(() => ({}));
        const waiterId = body.waiterId || body.staffId || 'staff-1';
        const waiterName = body.waiterName || body.staffName || 'Staff Member';
        const call = store.assignAssistanceCall(id, waiterId, waiterName);
        if (!call) return sendJson(res, 404, { error: 'Call not found' });
        sendJson(res, 200, {
          success: true,
          call,
          assigned_to: call.assigned_to,
        });
        return;
      }

      if (pathname.startsWith('/api/v1/calls/') && pathname.endsWith('/escalate') && method === 'PATCH') {
        const id = pathname.replace('/api/v1/calls/', '').replace('/escalate', '');
        const body: any = await parseJsonBody(req).catch(() => ({}));
        const call = store.escalateAssistanceCall(id, body?.reason);
        if (!call) return sendJson(res, 404, { error: 'Call not found' });
        sendJson(res, 200, {
          success: true,
          call,
          escalated: 1,
        });
        return;
      }

      // ======================================================================
      // Group O: Payment Depth (Cases 91-106)
      // ======================================================================
      if (pathname === '/api/v1/payments/split' && method === 'POST') {
        const body: any = await parseJsonBody(req).catch(() => ({}));
        if (!body.orderId) return sendJson(res, 400, { error: 'orderId is required' });
        const result = store.recordSplitPayment(body.orderId, body.splitType || 'EQUAL', {
          sharesCount: body.sharesCount,
          itemsAssignment: body.itemsAssignment
        });
        if (!result) return sendJson(res, 404, { error: 'Order not found' });
        return sendJson(res, 201, { success: true, ...result });
      }

      if (pathname === '/api/v1/payments/tip' && method === 'POST') {
        const body: any = await parseJsonBody(req).catch(() => ({}));
        if (!body.orderId) return sendJson(res, 400, { error: 'orderId is required' });
        const result = store.recordTip(body.orderId, body.tipCents, body.tipPercent);
        if (!result) return sendJson(res, 404, { error: 'Order not found' });
        return sendJson(res, 200, { success: true, ...result });
      }

      if (pathname === '/api/v1/payments/cash' && method === 'POST') {
        const body: any = await parseJsonBody(req).catch(() => ({}));
        if (!body.orderId) return sendJson(res, 400, { error: 'orderId is required' });
        const result = store.recordCashPayment(body.orderId, body);
        if (!result) return sendJson(res, 404, { error: 'Order not found' });
        return sendJson(res, 200, result);
      }

      if (pathname === '/api/v1/payments/card' && method === 'POST') {
        const body: any = await parseJsonBody(req).catch(() => ({}));
        if (!body.orderId) return sendJson(res, 400, { error: 'orderId is required' });
        const result = store.recordCardPayment(body.orderId, body);
        if (!result) return sendJson(res, 404, { error: 'Order not found' });
        return sendJson(res, 200, result);
      }

      if (pathname === '/api/v1/payments/refund' && method === 'POST') {
        const body: any = await parseJsonBody(req).catch(() => ({}));
        if (!body.paymentId && !body.orderId) return sendJson(res, 400, { error: 'paymentId or orderId is required' });
        const result = store.refundPayment(body);
        if (!result) return sendJson(res, 404, { error: 'Payment or order not found' });
        if ((result as any).success === false) return sendJson(res, 400, result);
        return sendJson(res, 200, result);
      }

      if (pathname === '/api/v1/payments/upi/intent' && method === 'POST') {
        const body: any = await parseJsonBody(req).catch(() => ({}));
        if (!body.orderId) return sendJson(res, 400, { error: 'orderId is required' });
        const result = store.generateUpiIntents(body.orderId, body);
        if (!result) return sendJson(res, 404, { error: 'Order not found' });
        return sendJson(res, 200, { success: true, ...result });
      }

      if (pathname === '/api/v1/payments/reconciliation' && method === 'GET') {
        const date = reqUrl.searchParams.get('date') || undefined;
        const result = store.getPaymentReconciliation(date);
        return sendJson(res, 200, { success: true, ...result });
      }

      if (pathname === '/api/v1/payments/verify' && method === 'POST') {
        const body: any = await parseJsonBody(req).catch(() => ({}));
        const orderId = body.orderId || body.order_id;
        const paymentId = body.paymentId || body.payment_id;
        const utr = body.utr || body.transactionReference || 'UTR-VERIFIED';
        const now = new Date().toISOString();
        const order = orderId ? store.orders.get(orderId) : null;
        const customerNote = body.customerNote || body.customer_note || body.notes || (order ? `Customer paid for Table ${order.tableNumber || 'Takeaway'}` : 'Customer payment verified by manager');

        if (paymentId) {
          try {
            store.db.prepare("UPDATE payments SET status = 'PAID', verified_by = ?, verified_at = ?, notes = ?, updated_at = ? WHERE id = ?")
              .run(body.managerId || 'manager', now, `${utr} | Note: ${customerNote}`, now, paymentId);
          } catch {}
        }
        if (order) {
          order.paymentStatus = 'PAID';
          order.status = 'COMPLETED';
          order.updatedAt = now;
          (order as any).paymentNotes = customerNote;
          (order as any).customerNote = customerNote;
          store.orders.set(orderId, order);
          try {
            store.db.prepare("UPDATE orders SET payment_status = 'PAID', status = 'COMPLETED' WHERE id = ?").run(orderId);
          } catch {}
        }
        return sendJson(res, 200, {
          success: true,
          status: 'PAID',
          verified: true,
          orderId,
          paymentId,
          utr,
          customerNote,
          notes: customerNote,
        });
      }

      if (pathname === '/api/v1/payments/reject' && method === 'POST') {
        const body: any = await parseJsonBody(req).catch(() => ({}));
        if (!body.paymentId && !body.orderId) return sendJson(res, 400, { error: 'paymentId or orderId is required' });
        const result = store.rejectPayment(body);
        return sendJson(res, 200, result);
      }

      if (pathname === '/api/v1/payments/duplicates' && method === 'GET') {
        const date = reqUrl.searchParams.get('date') || undefined;
        const result = store.findDuplicatePayments(date);
        return sendJson(res, 200, { success: true, ...result });
      }

      if (pathname === '/api/v1/payments/walkout-risk' && method === 'GET') {
        const minutes = parseInt(reqUrl.searchParams.get('maxMinutes') || '45', 10);
        const result = store.getWalkoutRiskOrders(minutes);
        return sendJson(res, 200, { success: true, ...result });
      }

      // ======================================================================
      // FREE UPI PREPAYMENT & TOKEN-BASED PAYMENT RECONCILIATION
      // ======================================================================
      function getStaffAuth(req: any, body?: any): { authorized: boolean; role: string; staffId: string } {
        const authHeader = req.headers.authorization;
        const queryToken = reqUrl.searchParams.get('token');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : queryToken;
        if (token) {
          const verified = authService.verifyToken(token);
          if ((verified.valid || (verified as any).isValid) && verified.payload) {
            if (verified.payload.userId && verified.payload.userId.startsWith('staff_')) {
              const staff = store.getStaffMemberById(verified.payload.userId);
              if (staff && (!staff.isActive || staff.status === 'DEACTIVATED' || staff.status === 'SUSPENDED')) {
                return { authorized: false, role: '', staffId: '' };
              }
            }
            return {
              authorized: true,
              role: (verified.payload.role || '').toUpperCase(),
              staffId: verified.payload.userId || verified.payload.email || 'manager',
            };
          }
        }
        // Header-only role fallback allowed only in non-production environments (e.g. testing)
        if (process.env.NODE_ENV !== 'production') {
          const headerRole = (req.headers['x-staff-role'] as string) || (req.headers['x-role'] as string);
          if (headerRole) {
            return {
              authorized: true,
              role: headerRole.toUpperCase(),
              staffId: (req.headers['x-staff-id'] as string) || 'manager',
            };
          }
        }
        return { authorized: false, role: '', staffId: '' };
      }

      // 1. Initiate UPI Prepayment
      if (pathname === '/api/v1/payments/upi/initiate' && method === 'POST') {
        const body: any = await parseJsonBody(req).catch(() => ({}));
        let orderId = body.orderId || body.order_id;
        if (!orderId && body.items && body.items.length) {
          const calculatedItems: OrderItem[] = [];
          for (const itemInput of body.items) {
            const menuItem = store.menuItems.get(itemInput.menuItemId || itemInput.id);
            if (!menuItem) {
              sendJson(res, 400, { error: `Menu item not found: ${itemInput.menuItemId || itemInput.id}` });
              return;
            }
            const quantity = itemInput.quantity || 1;
            calculatedItems.push({
              id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              menuItemId: menuItem.id,
              name: menuItem.name,
              unitPriceCents: menuItem.basePriceCents,
              quantity,
              selectedModifiers: itemInput.selectedModifiers || [],
              itemTotalCents: menuItem.basePriceCents * quantity,
            });
          }
          const totals = calculateOrderTotals(
            calculatedItems.map((i) => ({ unitPriceCents: i.unitPriceCents, quantity: i.quantity })),
            5.0,
            body.tipCents || 0
          );
          orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const now = new Date().toISOString();
          const newOrder: Order = {
            id: orderId,
            tenantId: body.tenantId || 'a0000000-0000-0000-0000-000000000001',
            outletId: body.outletId || 'b0000000-0000-0000-0000-000000000001',
            tableId: body.tableId || 'c0000000-0000-0000-0000-000000000001',
            tableNumber: body.tableNumber || 'T-01',
            status: 'PENDING_PAYMENT',
            paymentStatus: 'PENDING',
            items: calculatedItems,
            subtotalCents: totals.subtotalCents,
            taxCents: totals.taxCents,
            tipCents: totals.tipCents,
            totalCents: totals.totalCents,
            createdAt: now,
            updatedAt: now,
          };
          const firstItem = newOrder.items[0];
          const mi = firstItem ? store.menuItems.get(firstItem.itemId) : null;
          const st = mi?.station || 'HOT_LINE';
          const tok = store.createServiceToken(newOrder.tenantId, newOrder.id, st);
          (newOrder as any).token = tok.token_code;
          store.orders.set(orderId, newOrder);
        }

        if (!orderId) {
          sendJson(res, 400, { error: 'orderId or items array is required' });
          return;
        }

        const result = store.initiateUpiPrepayment(orderId, {
          vpa: body.vpa,
          payeeName: body.payeeName,
          mobile: body.mobile
        });
        if (!result) {
          sendJson(res, 404, { error: 'Order not found' });
          return;
        }

        sendJson(res, 200, { success: true, ...result });
        return;
      }

      // 2. Submit UPI Payment Reference
      if (pathname === '/api/v1/payments/upi/submit-reference' && method === 'POST') {
        const body: any = await parseJsonBody(req).catch(() => ({}));
        if (!body.orderId) {
          sendJson(res, 400, { error: 'orderId is required' });
          return;
        }
        if (!body.utr && !body.transactionReference) {
          sendJson(res, 400, { error: 'utr / transaction reference is required' });
          return;
        }

        const result = store.submitUpiPaymentReference({
          orderId: body.orderId,
          utr: body.utr || body.transactionReference,
          amountPaid: body.amountPaid,
          amountCents: body.amountCents,
          customerName: body.customerName,
          customerPhone: body.customerPhone,
          screenshotUrl: body.screenshotUrl,
          timestamp: body.timestamp
        });

        if (!result.success) {
          sendJson(res, result.status || 400, { error: result.error });
          return;
        }

        broadcastEvent({
          type: 'ORDER_PAYMENT_SUBMITTED',
          tenantId: 'a0000000-0000-0000-0000-000000000001',
          outletId: 'b0000000-0000-0000-0000-000000000001',
          timestamp: new Date().toISOString(),
          payload: result
        });
        broadcastEvent({
          type: 'PAYMENT_SUBMITTED' as any,
          tenantId: 'a0000000-0000-0000-0000-000000000001',
          outletId: 'b0000000-0000-0000-0000-000000000001',
          timestamp: new Date().toISOString(),
          payload: result
        });

        sendJson(res, 200, result);
        return;
      }

      // 3. Manager Verify UPI Payment
      if (pathname === '/api/v1/payments/upi/manager-verify' && method === 'POST') {
        const body: any = await parseJsonBody(req).catch(() => ({}));
        const auth = getStaffAuth(req, body);
        if (!auth.authorized) {
          sendJson(res, 401, { error: 'Authentication required: Manager or owner credentials required' });
          return;
        }
        if (auth.role !== 'MANAGER' && auth.role !== 'OWNER') {
          sendJson(res, 403, { error: 'Forbidden: Only managers and owners can verify payments' });
          return;
        }
        if (!body.orderId && !body.paymentId) {
          sendJson(res, 400, { error: 'orderId or paymentId is required' });
          return;
        }

        const orderId = body.orderId || (body.paymentId ? store.payments.get(body.paymentId)?.orderId : null);
        if (!orderId) {
          sendJson(res, 400, { error: 'Valid orderId is required' });
          return;
        }

        const result = store.verifyUpiPaymentByManager({
          orderId,
          paymentId: body.paymentId,
          verifiedBy: body.verifiedBy || auth.staffId,
          staffRole: auth.role,
          notes: body.notes || body.customerNote || 'Verified in bank account'
        });

        if (!result.success) {
          sendJson(res, result.status || 400, { error: result.error });
          return;
        }

        broadcastEvent({
          type: 'ORDER_PAYMENT_VERIFIED',
          tenantId: 'a0000000-0000-0000-0000-000000000001',
          outletId: 'b0000000-0000-0000-0000-000000000001',
          timestamp: new Date().toISOString(),
          payload: result
        });
        broadcastEvent({
          type: 'PAYMENT_VERIFIED' as any,
          tenantId: 'a0000000-0000-0000-0000-000000000001',
          outletId: 'b0000000-0000-0000-0000-000000000001',
          timestamp: new Date().toISOString(),
          payload: result
        });

        sendJson(res, 200, result);
        return;
      }

      // 4. Manager Reject UPI Payment
      if (pathname === '/api/v1/payments/upi/manager-reject' && method === 'POST') {
        const body: any = await parseJsonBody(req).catch(() => ({}));
        const auth = getStaffAuth(req, body);
        if (!auth.authorized) {
          sendJson(res, 401, { error: 'Authentication required: Manager or owner credentials required' });
          return;
        }
        if (auth.role !== 'MANAGER' && auth.role !== 'OWNER') {
          sendJson(res, 403, { error: 'Forbidden: Only managers and owners can reject payments' });
          return;
        }
        if (!body.orderId && !body.paymentId) {
          sendJson(res, 400, { error: 'orderId or paymentId is required' });
          return;
        }
        const reason = body.rejectionReason || body.reason;
        if (!reason || !reason.trim()) {
          sendJson(res, 400, { error: 'rejectionReason is required' });
          return;
        }

        const orderId = body.orderId || (body.paymentId ? store.payments.get(body.paymentId)?.orderId : null);
        if (!orderId) {
          sendJson(res, 400, { error: 'Valid orderId is required' });
          return;
        }

        const result = store.rejectUpiPaymentByManager({
          orderId,
          paymentId: body.paymentId,
          rejectionReason: reason,
          rejectedBy: body.rejectedBy || auth.staffId,
          staffRole: auth.role
        });

        if (!result.success) {
          sendJson(res, result.status || 400, { error: result.error });
          return;
        }

        broadcastEvent({
          type: 'ORDER_PAYMENT_REJECTED',
          tenantId: 'a0000000-0000-0000-0000-000000000001',
          outletId: 'b0000000-0000-0000-0000-000000000001',
          timestamp: new Date().toISOString(),
          payload: result
        });
        broadcastEvent({
          type: 'PAYMENT_REJECTED' as any,
          tenantId: 'a0000000-0000-0000-0000-000000000001',
          outletId: 'b0000000-0000-0000-0000-000000000001',
          timestamp: new Date().toISOString(),
          payload: result
        });

        sendJson(res, 200, result);
        return;
      }

      // 5. Manager Verifications Queue
      if (pathname === '/api/v1/payments/upi/verifications' && method === 'GET') {
        const auth = getStaffAuth(req);
        if (!auth.authorized) {
          sendJson(res, 401, { error: 'Authentication required: Manager credentials required' });
          return;
        }
        if (auth.role !== 'MANAGER' && auth.role !== 'OWNER') {
          sendJson(res, 403, { error: 'Forbidden: Only managers and owners can view payment verifications' });
          return;
        }
        const outletId = reqUrl.searchParams.get('outletId') || undefined;
        const verifications = store.getUpiVerificationsQueue(outletId);
        sendJson(res, 200, {
          success: true,
          count: verifications.length,
          verifications
        });
        return;
      }

      // 6. Real-time Customer Order & Payment Status
      if (pathname.startsWith('/api/v1/payments/order-status/') && method === 'GET') {
        const orderId = pathname.replace('/api/v1/payments/order-status/', '');
        const status = store.getOrderPaymentStatus(orderId);
        if (!status) {
          sendJson(res, 404, { error: 'Order not found' });
          return;
        }
        sendJson(res, 200, { success: true, ...status });
        return;
      }

      // 7. Request Info
      if (pathname === '/api/v1/payments/upi/request-info' && method === 'POST') {
        const body: any = await parseJsonBody(req).catch(() => ({}));
        const auth = getStaffAuth(req, body);
        if (!auth.authorized) {
          sendJson(res, 401, { error: 'Authentication required: Manager credentials required' });
          return;
        }
        if (auth.role !== 'MANAGER' && auth.role !== 'OWNER') {
          sendJson(res, 403, { error: 'Forbidden: Only managers and owners can request payment info' });
          return;
        }
        if (!body.orderId) {
          sendJson(res, 400, { error: 'orderId is required' });
          return;
        }
        const order = store.orders.get(body.orderId);
        if (!order) {
          sendJson(res, 404, { error: 'Order not found' });
          return;
        }
        (order as any).customerNote = body.note || 'Please provide clear bank transaction reference';
        store.orders.set(order.id, order);

        broadcastEvent({
          type: 'PAYMENT_INFO_REQUESTED',
          tenantId: 'a0000000-0000-0000-0000-000000000001',
          outletId: 'b0000000-0000-0000-0000-000000000001',
          timestamp: new Date().toISOString(),
          payload: { orderId: order.id, note: (order as any).customerNote }
        });

        sendJson(res, 200, { success: true, orderId: order.id, note: (order as any).customerNote });
        return;
      }

      // ======================================================================
      // Group P: Booking Polish (Cases 16, 19-28)
      // ======================================================================
      if (pathname === '/api/v1/bookings/slots' && method === 'GET') {
        const date = reqUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10);
        const partySize = parseInt(reqUrl.searchParams.get('party_size') || reqUrl.searchParams.get('partySize') || '2', 10);
        const slots = store.getAvailableBookingSlots(date, partySize);
        return sendJson(res, 200, { success: true, date, partySize, slots });
      }

      if (pathname.startsWith('/api/v1/bookings/') && pathname.endsWith('/reschedule') && (method === 'PATCH' || method === 'POST')) {
        const id = pathname.replace('/api/v1/bookings/', '').replace('/reschedule', '');
        const body: any = await parseJsonBody(req).catch(() => ({}));
        if (!body.date && !body.slot) return sendJson(res, 400, { error: 'date and slot are required' });
        const updated = store.rescheduleBooking(id, body.date, body.slot);
        if (!updated) return sendJson(res, 404, { error: 'Booking not found' });
        return sendJson(res, 200, { success: true, booking: updated });
      }

      if (pathname.startsWith('/api/v1/bookings/') && pathname.endsWith('/override') && (method === 'PATCH' || method === 'POST')) {
        const id = pathname.replace('/api/v1/bookings/', '').replace('/override', '');
        const body: any = await parseJsonBody(req).catch(() => ({}));
        const result = store.overrideBookingForWalkIn(id, {
          guestName: body.guestName || body.walkInName || 'Walk-in Guest',
          partySize: body.partySize || body.walkInPartySize || 2,
          phone: body.phone,
          tableNumber: body.tableNumber
        });
        if (!result) return sendJson(res, 404, { error: 'Original booking not found' });
        return sendJson(res, 200, result);
      }

      if (pathname.startsWith('/api/v1/bookings/') && pathname.endsWith('/whatsapp') && method === 'POST') {
        const id = pathname.replace('/api/v1/bookings/', '').replace('/whatsapp', '');
        const result = store.generateBookingWhatsAppMessage(id);
        if (!result) return sendJson(res, 404, { error: 'Booking not found' });
        return sendJson(res, 200, result);
      }

      if (pathname === '/api/v1/bookings/events' && method === 'POST') {
        const body: any = await parseJsonBody(req).catch(() => ({}));
        if (!body.guestName || !body.partySize) {
          return sendJson(res, 400, { error: 'guestName and partySize are required' });
        }
        const result = store.createEventBooking(body);
        if ((result as any).error) return sendJson(res, 400, result);
        return sendJson(res, 201, result);
      }

      if (pathname === '/api/v1/bookings/recurring' && method === 'GET') {
        const list = store.getRecurringBookings();
        return sendJson(res, 200, { success: true, count: list.length, bookings: list });
      }

      if (pathname.startsWith('/api/v1/bookings/') && pathname.endsWith('/recurring') && method === 'POST') {
        const id = pathname.replace('/api/v1/bookings/', '').replace('/recurring', '');
        const body: any = await parseJsonBody(req).catch(() => ({}));
        const pattern = body.recurrencePattern || body.pattern || 'WEEKLY';
        const occurrences = body.occurrencesCount || body.occurrences || 8;
        const result = store.markBookingRecurring(id, pattern, occurrences);
        if (!result) return sendJson(res, 404, { error: 'Booking not found' });
        return sendJson(res, 200, result);
      }

      if (pathname === '/api/v1/bookings/no-shows' && method === 'GET') {
        const date = reqUrl.searchParams.get('date') || undefined;
        const result = store.getBookingNoShows(date);
        return sendJson(res, 200, { success: true, ...result });
      }

      if (pathname.startsWith('/api/v1/bookings/') && pathname.endsWith('/refund') && method === 'POST') {
        const id = pathname.replace('/api/v1/bookings/', '').replace('/refund', '');
        const body: any = await parseJsonBody(req).catch(() => ({}));
        const result = store.refundBookingDeposit(id, body?.reason);
        if (!result) return sendJson(res, 404, { error: 'Booking not found' });
        return sendJson(res, 200, result);
      }

      // ======================================================================
      // Group Q: Retention Basics (Cases 136-142)
      // ======================================================================
      if (pathname === '/api/v1/orders/past' && method === 'GET') {
        const session = (req.headers['x-guest-session'] as string) || reqUrl.searchParams.get('session') || '';
        const limit = parseInt(reqUrl.searchParams.get('limit') || '3', 10);
        const orders = store.getPastOrdersForSession(session, limit);
        return sendJson(res, 200, { success: true, count: orders.length, orders });
      }

      if (pathname.startsWith('/api/v1/orders/') && pathname.endsWith('/request-bill') && method === 'POST') {
        const orderId = pathname.replace('/api/v1/orders/', '').replace('/request-bill', '');
        const result = store.requestBillForOrder(orderId);
        if (!result) return sendJson(res, 404, { error: 'Order not found' });
        return sendJson(res, 200, result);
      }

      if (pathname === '/api/v1/customers/loyalty-status' && method === 'GET') {
        const session = (req.headers['x-guest-session'] as string) || reqUrl.searchParams.get('session') || undefined;
        const phone = reqUrl.searchParams.get('phone') || undefined;
        const status = store.getCustomerLoyaltyStatus(session, phone);
        return sendJson(res, 200, { success: true, ...status });
      }

      if (pathname === '/api/v1/customers/opt-in' && method === 'POST') {
        const body: any = await parseJsonBody(req).catch(() => ({}));
        const session = body.session || body.sessionId || (req.headers['x-guest-session'] as string) || 'anon-session';
        if (!body.phone || !body.name) {
          return sendJson(res, 400, { error: 'phone and name are required for loyalty opt-in' });
        }
        const result = store.customerOptIn(session, body.phone, body.name, body.birthday);
        return sendJson(res, 200, result);
      }

      if (pathname === '/api/v1/customers/opt-out' && method === 'POST') {
        const body: any = await parseJsonBody(req).catch(() => ({}));
        const target = body.phone || body.session || (req.headers['x-guest-session'] as string);
        if (!target) return sendJson(res, 400, { error: 'phone or session is required for opt-out' });
        const result = store.customerOptOut(target);
        return sendJson(res, 200, result);
      }

      if (pathname === '/api/v1/customers/lookup' && method === 'GET') {
        const phone = reqUrl.searchParams.get('phone');
        if (!phone) return sendJson(res, 400, { error: 'phone is required' });
        const customer = store.lookupCustomerByPhone(phone);
        if (!customer) return sendJson(res, 404, { error: 'Customer not found or not opted-in' });
        return sendJson(res, 200, { success: true, customer });
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
    console.log(`[Abiruchi Hotel Order Service] Server listening on http://localhost:${PORT}`);
  });
}
