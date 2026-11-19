import fs from 'node:fs';
import path from 'node:path';
import { createSignedQRSession } from '../packages/utils/src/qr-crypto.ts';

const TENANT_ID = process.env.TENANT_ID || 'a0000000-0000-0000-0000-000000000001';
const OUTLET_ID = process.env.OUTLET_ID || 'b0000000-0000-0000-0000-000000000001';
const SECRET_KEY = process.env.QR_SIGNING_SALT || 'abiruchi-dev-qr-secret-key-32-bytes-min';
const BASE_URL = process.env.PUBLIC_URL || 'https://servora-hotel-os.onrender.com';
const OUT_DIR = path.resolve(process.cwd(), 'DOCUMENTS/QR');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

interface TableDef {
  id: string;
  number: string;
  filename: string;
  zone: string;
  seats: number;
  type: 'TABLE' | 'BAR' | 'TAKEAWAY' | 'UPI';
  customUrl?: string;
}

const items: TableDef[] = [
  { id: 'c0000000-0000-0000-0000-000000000001', number: 'T-01', filename: 'Table-01-Main-Dining', zone: 'Main Dining', seats: 2, type: 'TABLE' },
  { id: 'c0000000-0000-0000-0000-000000000002', number: 'T-02', filename: 'Table-02-Main-Dining', zone: 'Main Dining', seats: 4, type: 'TABLE' },
  { id: 'c0000000-0000-0000-0000-000000000003', number: 'T-03', filename: 'Table-03-Patio-Terrace', zone: 'Patio Terrace', seats: 4, type: 'TABLE' },
  { id: 'c0000000-0000-0000-0000-000000000004', number: 'T-04', filename: 'Table-04-Patio-Terrace', zone: 'Patio Terrace', seats: 6, type: 'TABLE' },
  { id: 'c0000000-0000-0000-0000-000000000005', number: 'T-05', filename: 'Table-05-Main-Dining', zone: 'Main Dining', seats: 2, type: 'TABLE' },
  { id: 'c0000000-0000-0000-0000-000000000006', number: 'T-06', filename: 'Table-06-Main-Dining', zone: 'Main Dining', seats: 4, type: 'TABLE' },
  { id: 'c0000000-0000-0000-0000-000000000007', number: 'T-07', filename: 'Table-07-AC-Hall', zone: 'AC Hall', seats: 4, type: 'TABLE' },
  { id: 'c0000000-0000-0000-0000-000000000008', number: 'T-08', filename: 'Table-08-AC-Hall', zone: 'AC Hall', seats: 6, type: 'TABLE' },
  { id: 'c0000000-0000-0000-0000-000000000009', number: 'T-09', filename: 'Table-09-Family-Section', zone: 'Family Section', seats: 8, type: 'TABLE' },
  { id: 'c0000000-0000-0000-0000-000000000010', number: 'T-10', filename: 'Table-10-Family-Section', zone: 'Family Section', seats: 4, type: 'TABLE' },
  { id: 'c0000000-0000-0000-0000-000000000011', number: 'T-11', filename: 'Table-11-Executive-Dining', zone: 'Executive Dining', seats: 4, type: 'TABLE' },
  { id: 'c0000000-0000-0000-0000-000000000012', number: 'T-12', filename: 'Table-12-Executive-Dining', zone: 'Executive Dining', seats: 6, type: 'TABLE' },
  { id: 'c0000000-0000-0000-0000-000000000014', number: 'T-14', filename: 'Table-14-Main-Dining', zone: 'Main Dining', seats: 4, type: 'TABLE' },
  { id: 'c0000000-0000-0000-0000-000000000015', number: 'T-15', filename: 'Table-15-Family-Section', zone: 'Family Section', seats: 6, type: 'TABLE' },
  { id: 'c0000000-0000-0000-0000-000000000020', number: 'Bar-01', filename: 'Table-Bar-01-Beverage-Counter', zone: 'Cocktail & Beverage Bar', seats: 2, type: 'BAR' },
  { id: 'c0000000-0000-0000-0000-000000000021', number: 'Pickup-01', filename: 'Takeaway-Counter-Pickup', zone: 'Parcel & Takeaway Counter', seats: 0, type: 'TAKEAWAY' },
  {
    id: 'upi-direct-merchant-indiranagar',
    number: 'UPI-Merchant',
    filename: 'UPI-Payee-Indiranagar-9010150809',
    zone: 'Merchant Standee Billing Counter',
    seats: 0,
    type: 'UPI',
    customUrl: 'upi://pay?pa=9010150809@ybl&pn=Abiruchi%20Hotel&cu=INR'
  },
  {
    id: 'upi-counter-standee',
    number: 'UPI-Standee',
    filename: 'UPI-Payment-Standee-Counter',
    zone: 'Main Billing Counter Standee',
    seats: 0,
    type: 'UPI',
    customUrl: 'upi://pay?pa=9010150809@ybl&pn=Abiruchi%20Hotel&mc=5812&cu=INR'
  }
];

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function run() {
  console.log(`Generating and saving ${items.length} QR codes into ${OUT_DIR}...`);
  const manifest: any[] = [];
  const htmlCards: string[] = [];

  for (const item of items) {
    let targetUrl = item.customUrl || '';
    let tokenB64 = '';
    let signedSession: any = null;

    if (item.type !== 'UPI') {
      signedSession = createSignedQRSession(
        {
          tenantId: TENANT_ID,
          outletId: OUTLET_ID,
          tableId: item.id,
          tableNumber: item.number,
          ttlMs: 1000 * 60 * 60 * 24 * 365, // 1 year table tent sticker
        },
        SECRET_KEY
      );
      tokenB64 = Buffer.from(JSON.stringify(signedSession)).toString('base64url');
      targetUrl = `${BASE_URL}/?token=${tokenB64}&table=${item.number}`;
    }

    const pngUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(targetUrl)}`;
    const svgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&format=svg&data=${encodeURIComponent(targetUrl)}`;

    console.log(`Processing: ${item.filename}...`);
    try {
      const pngBuf = await fetchBuffer(pngUrl);
      const svgBuf = await fetchBuffer(svgUrl);

      const pngPath = path.join(OUT_DIR, `${item.filename}.png`);
      const svgPath = path.join(OUT_DIR, `${item.filename}.svg`);

      fs.writeFileSync(pngPath, pngBuf);
      fs.writeFileSync(svgPath, svgBuf);

      manifest.push({
        id: item.id,
        number: item.number,
        name: item.filename,
        zone: item.zone,
        seats: item.seats,
        type: item.type,
        targetUrl,
        token: tokenB64 || undefined,
        signature: signedSession?.signature || undefined,
        pngFile: `${item.filename}.png`,
        svgFile: `${item.filename}.svg`,
        generatedAt: new Date().toISOString()
      });

      // Add to printable HTML sheet
      htmlCards.push(`
        <div class="qr-card">
          <div class="brand">ABIRUCHI HOTEL</div>
          <div class="zone-badge">${item.zone}</div>
          <div class="qr-frame">
            <img src="./${item.filename}.svg" alt="${item.filename}" />
          </div>
          <div class="table-name">${item.number}</div>
          <div class="subtext">${item.type === 'UPI' ? 'Scan with any UPI App to Pay' : 'Scan to View Menu & Order'}</div>
          <div class="footer-note">Free Wi-Fi: Abiruchi-Guest | Touchless Dining</div>
        </div>
      `);
    } catch (e: any) {
      console.error(`Failed to export ${item.filename}:`, e.message);
    }
  }

  // Write manifest
  fs.writeFileSync(path.join(OUT_DIR, 'QR-MANIFEST.json'), JSON.stringify(manifest, null, 2));

  // Write printable HTML sheet
  const printableHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Abiruchi Hotel — Official Table Tents & Counter QR Codes</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #f8fafc; color: #0f172a; padding: 20px; }
    .header-bar { text-align: center; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 2px solid #e2e8f0; }
    .header-bar h1 { font-size: 24px; font-weight: 800; color: #1e293b; letter-spacing: -0.5px; }
    .header-bar p { font-size: 13px; color: #64748b; margin-top: 4px; }
    .print-btn { background: #ea580c; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; margin-top: 10px; }
    @media print {
      .no-print { display: none; }
      body { background: #fff; padding: 0; }
    }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; }
    .qr-card {
      background: #fff;
      border: 2px solid #e2e8f0;
      border-radius: 16px;
      padding: 20px;
      text-align: center;
      page-break-inside: avoid;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .brand { font-size: 15px; font-weight: 900; letter-spacing: 1.5px; color: #ea580c; margin-bottom: 4px; text-transform: uppercase; }
    .zone-badge { display: inline-block; background: #fff7ed; color: #c2410c; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; border: 1px solid #ffedd5; margin-bottom: 12px; }
    .qr-frame { width: 180px; height: 180px; padding: 10px; border: 1px dashed #cbd5e1; border-radius: 12px; background: #fff; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
    .qr-frame img { width: 100%; height: 100%; object-fit: contain; }
    .table-name { font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
    .subtext { font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 8px; }
    .footer-note { font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 8px; width: 100%; }
  </style>
</head>
<body>
  <div class="header-bar no-print">
    <h1>Abiruchi Hotel — Official Table Tents & Counter QR Codes</h1>
    <p>Printable high-resolution QR cards ready for acrylic stands and table tents</p>
    <button class="print-btn" onclick="window.print()">🖨️ Print All Cards (Ctrl+P)</button>
  </div>
  <div class="grid">
    ${htmlCards.join('\n')}
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(OUT_DIR, 'Printable-Table-Tents-All.html'), printableHtml);
  console.log(`\nSuccessfully exported ${manifest.length} QR files to ${OUT_DIR}`);
  console.log(`Manifest: ${path.join(OUT_DIR, 'QR-MANIFEST.json')}`);
  console.log(`Printable HTML: ${path.join(OUT_DIR, 'Printable-Table-Tents-All.html')}`);
}

run().catch(console.error);
