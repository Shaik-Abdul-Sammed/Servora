import { createHmac, timingSafeEqual } from 'node:crypto';
import type { QRTableSessionPayload } from '@abiruchi/shared-types';

/**
 * Generates an HMAC-SHA256 signature for a QR table session payload.
 */
export function signQRTablePayload(
  payload: Omit<QRTableSessionPayload, 'signature'>,
  secretKey: string
): string {
  const serialized = `${payload.tenantId}:${payload.outletId}:${payload.tableId}:${payload.tableNumber}:${payload.issuedAt}:${payload.expiresAt}`;
  return createHmac('sha256', secretKey).update(serialized).digest('hex');
}

/**
 * Creates a signed QR table session object.
 */
export function createSignedQRSession(
  params: {
    tenantId: string;
    outletId: string;
    tableId: string;
    tableNumber: string;
    ttlMs?: number;
    mode?: 'TABLE' | 'TOKEN' | 'BOOKING' | 'MENU_ONLY';
  },
  secretKey: string
): QRTableSessionPayload {
  const now = Date.now();
  const ttl = params.ttlMs ?? 1000 * 60 * 60 * 12; // Default 12 hours
  const unsigned = {
    tenantId: params.tenantId,
    outletId: params.outletId,
    tableId: params.tableId,
    tableNumber: params.tableNumber,
    issuedAt: now,
    expiresAt: now + ttl,
    mode: params.mode || 'TABLE',
  };

  const signature = signQRTablePayload(
    {
      tenantId: unsigned.tenantId,
      outletId: unsigned.outletId,
      tableId: unsigned.tableId,
      tableNumber: unsigned.tableNumber,
      issuedAt: unsigned.issuedAt,
      expiresAt: unsigned.expiresAt,
    },
    secretKey
  );
  return {
    ...unsigned,
    signature,
  };
}

/**
 * Validates a QR table session payload against expiration and signature forgery.
 */
export function verifyQRTableSession(
  payload: QRTableSessionPayload,
  secretKey: string
): { isValid: boolean; error?: string } {
  const now = Date.now();
  if (now > payload.expiresAt) {
    return { isValid: false, error: 'QR_SESSION_EXPIRED' };
  }

  const expectedSignature = signQRTablePayload(
    {
      tenantId: payload.tenantId,
      outletId: payload.outletId,
      tableId: payload.tableId,
      tableNumber: payload.tableNumber,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
    },
    secretKey
  );

  const sigBuf = Buffer.from(payload.signature, 'hex');
  const expBuf = Buffer.from(expectedSignature, 'hex');

  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return { isValid: false, error: 'INVALID_SIGNATURE' };
  }

  return { isValid: true };
}
