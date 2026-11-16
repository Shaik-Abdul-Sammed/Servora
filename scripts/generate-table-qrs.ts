#!/usr/bin/env node
/**
 * Servora CLI: Generate and Export Signed Table QR Tokens
 * Usage: node --experimental-strip-types scripts/generate-table-qrs.ts
 */

import { createSignedQRSession } from '../packages/utils/src/qr-crypto.ts';

const TENANT_ID = process.env.TENANT_ID || 'a0000000-0000-0000-0000-000000000001';
const OUTLET_ID = process.env.OUTLET_ID || 'b0000000-0000-0000-0000-000000000001';
const SECRET_KEY = process.env.QR_SIGNING_SALT || 'servora-dev-qr-secret-key-32-bytes-min';
const BASE_URL = process.env.SERVORA_PUBLIC_URL || 'https://order.servora.local';

const tables = [
  { id: 'c0000000-0000-0000-0000-000000000001', number: 'T-01', cap: 2, zone: 'Main Dining' },
  { id: 'c0000000-0000-0000-0000-000000000002', number: 'T-02', cap: 4, zone: 'Main Dining' },
  { id: 'c0000000-0000-0000-0000-000000000003', number: 'T-03', cap: 4, zone: 'Patio Terrace' },
  { id: 'c0000000-0000-0000-0000-000000000004', number: 'T-04', cap: 6, zone: 'Patio Terrace' },
  { id: 'c0000000-0000-0000-0000-000000000005', number: 'Bar-01', cap: 1, zone: 'Cocktail Bar' },
];

console.log('='.repeat(78));
console.log('   SERVORA TABLE QR CODE BATCH GENERATOR (HMAC-SHA256 SIGNED)');
console.log('   Tenant:  Trattoria Servora');
console.log('   Outlet:  Downtown Flagship');
console.log('='.repeat(78));

const manifest: Array<{ tableNumber: string; zone: string; qrUrl: string; tokenB64: string }> = [];

for (const table of tables) {
  const signed = createSignedQRSession(
    {
      tenantId: TENANT_ID,
      outletId: OUTLET_ID,
      tableId: table.id,
      tableNumber: table.number,
      ttlMs: 1000 * 60 * 60 * 24 * 30, // 30-day token for physical table sticker
    },
    SECRET_KEY
  );

  const tokenB64 = Buffer.from(JSON.stringify(signed)).toString('base64url');
  const qrUrl = `${BASE_URL}/?token=${tokenB64}`;

  manifest.push({
    tableNumber: table.number,
    zone: table.zone,
    qrUrl,
    tokenB64,
  });

  console.log(`\n[TABLE ${table.number}] (${table.zone}, Seats ${table.cap})`);
  console.log(`  Signature: ${signed.signature.slice(0, 16)}...`);
  console.log(`  Expires:   ${new Date(signed.expiresAt).toLocaleDateString()}`);
  console.log(`  QR Target: ${qrUrl}`);
}

console.log('\n' + '='.repeat(78));
console.log(`Successfully generated ${manifest.length} tamper-evident table QR codes.`);
console.log('Ready for printing onto dining table tents and NFC acrylic pucks.');
console.log('='.repeat(78));
