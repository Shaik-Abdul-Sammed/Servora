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

function buildBrandedQrSvg(rawSvgContent: string, item: TableDef): string {
  const vbMatch = rawSvgContent.match(/viewBox="([^"]+)"/);
  const viewBox = vbMatch ? vbMatch[1] : '0 0 77 77';
  const elementsMatch = rawSvgContent.match(/<g id="elements">([\s\S]*?)<\/g>/);
  const elements = elementsMatch ? elementsMatch[1] : '';

  const isUpi = item.type === 'UPI';
  const displayName = isUpi ? 'UPI DIRECT PREPAYMENT' : `TABLE ${item.number}`;
  const zoneLabel = isUpi ? 'BILLING & CASHIER STAND' : item.zone.toUpperCase();
  const subText = isUpi ? 'Scan with GPay • PhonePe • Paytm • BHIM • Cred' : 'Scan to View Menu, Order & Call Waiter';
  const footerNote = isUpi ? 'Payee VPA: 9010150809@ybl • Direct Merchant Settlement' : 'Touchless Dining • Instant Waiter Service • Free Wi-Fi: Abiruchi-Guest';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 720" width="500" height="720">
  <defs>
    <style>
      .card-bg { fill: #ffffff; stroke: #e2e8f0; stroke-width: 2; }
      .brand-title { fill: #ea580c; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 15px; font-weight: 900; letter-spacing: 2px; text-anchor: middle; }
      .zone-pill-bg { fill: #fff7ed; stroke: #fed7aa; stroke-width: 1; }
      .zone-pill-text { fill: #c2410c; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 12px; font-weight: 800; text-anchor: middle; }
      .subject-title { fill: #0f172a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 25px; font-weight: 900; letter-spacing: -0.5px; text-anchor: middle; }
      .sub-instruction { fill: #475569; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; font-weight: 600; text-anchor: middle; }
      .qr-quiet-zone { fill: #ffffff; stroke: #cbd5e1; stroke-width: 2; }
      .footer-divider { stroke: #e2e8f0; stroke-width: 1; stroke-dasharray: 4,4; }
      .footer-primary { fill: #334155; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 12px; font-weight: 700; text-anchor: middle; }
      .footer-secondary { fill: #94a3b8; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 11px; text-anchor: middle; }
      
      /* Dark Mode Adaptive Support: Dark theme exterior while preserving 100% optical contrast quiet-zone */
      @media (prefers-color-scheme: dark) {
        .card-bg { fill: #0b0f19; stroke: #1e293b; }
        .zone-pill-bg { fill: #1e293b; stroke: #334155; }
        .zone-pill-text { fill: #fb923c; }
        .subject-title { fill: #f8fafc; }
        .sub-instruction { fill: #94a3b8; }
        .qr-quiet-zone { fill: #ffffff; stroke: #38bdf8; stroke-width: 2.5; }
        .footer-divider { stroke: #1e293b; }
        .footer-primary { fill: #cbd5e1; }
        .footer-secondary { fill: #64748b; }
      }
    </style>
  </defs>

  <!-- Main Card Container -->
  <rect class="card-bg" x="12" y="12" width="476" height="696" rx="24" ry="24" />

  <!-- Top Header Banner: Specifies clearly what this QR refers to -->
  <text x="250" y="52" class="brand-title">🍛 ABIRUCHI HOTEL</text>
  
  <rect x="100" y="66" width="300" height="28" rx="14" ry="14" class="zone-pill-bg" />
  <text x="250" y="85" class="zone-pill-text">${zoneLabel}</text>
  
  <text x="250" y="130" class="subject-title">${displayName}</text>
  <text x="250" y="154" class="sub-instruction">${subText}</text>

  <!-- Quiet-Zone Window: Pure white background ensures flawless scan by phone camera & barcode readers -->
  <rect class="qr-quiet-zone" x="65" y="176" width="370" height="370" rx="18" ry="18" />

  <!-- Inner High-Contrast QR Code Matrix -->
  <svg x="85" y="196" width="330" height="330" viewBox="${viewBox}">
    <rect width="100%" height="100%" fill="#ffffff" />
    <g id="elements">
      ${elements}
    </g>
  </svg>

  <!-- Footer Information -->
  <line x1="45" y1="592" x2="455" y2="592" class="footer-divider" />
  <text x="250" y="626" class="footer-primary">${footerNote}</text>
  <text x="250" y="654" class="footer-secondary">🔒 Signed QR Token • Instant Service • Free Wi-Fi</text>
</svg>`;
}

async function run() {
  console.log(`Generating, enhancing and saving ${items.length} QR codes into ${OUT_DIR}...`);
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

    const svgPath = path.join(OUT_DIR, `${item.filename}.svg`);
    const pngPath = path.join(OUT_DIR, `${item.filename}.png`);

    console.log(`Processing: ${item.filename}...`);
    try {
      let rawSvg = '';
      if (fs.existsSync(svgPath)) {
        rawSvg = fs.readFileSync(svgPath, 'utf-8');
      } else {
        const svgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&format=svg&data=${encodeURIComponent(targetUrl)}`;
        const svgBuf = await fetchBuffer(svgUrl);
        rawSvg = svgBuf.toString('utf-8');
      }

      // Build enhanced standalone SVG with reference header & dark mode adaptability
      const enhancedSvg = buildBrandedQrSvg(rawSvg, item);
      fs.writeFileSync(svgPath, enhancedSvg, 'utf-8');

      // Also ensure PNG exists if not already
      if (!fs.existsSync(pngPath)) {
        const pngUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(targetUrl)}`;
        const pngBuf = await fetchBuffer(pngUrl);
        fs.writeFileSync(pngPath, pngBuf);
      }

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
      const isUpi = item.type === 'UPI';
      const refTitle = isUpi ? 'UPI DIRECT PREPAYMENT' : `TABLE ${item.number}`;
      const refZone = isUpi ? 'CASHIER & BILLING STAND' : item.zone;
      const refSub = isUpi ? 'Scan with GPay / PhonePe / Paytm / BHIM' : 'Scan to View Menu, Order & Call Waiter';

      htmlCards.push(`
        <div class="qr-card">
          <div class="brand">ABIRUCHI HOTEL</div>
          <div class="zone-badge">${refZone}</div>
          <div class="ref-title">${refTitle}</div>
          <div class="qr-frame">
            <img src="./${item.filename}.svg" alt="${item.filename}" />
          </div>
          <div class="subtext">${refSub}</div>
          <div class="footer-note">🔒 Signed QR Token • Touchless Dining • Wi-Fi: Abiruchi-Guest</div>
        </div>
      `);
    } catch (e: any) {
      console.error(`Failed to export ${item.filename}:`, e.message);
    }
  }

  // Write manifest
  fs.writeFileSync(path.join(OUT_DIR, 'QR-MANIFEST.json'), JSON.stringify(manifest, null, 2));

  // Write printable HTML sheet with Dark Mode preview & light print fidelity
  const printableHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Abiruchi Hotel — Official Table Tents & Counter QR Codes</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    
    :root {
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --border: #e2e8f0;
      --text: #0f172a;
      --text-muted: #64748b;
      --primary: #ea580c;
      --qr-frame-bg: #ffffff;
      --qr-frame-border: #cbd5e1;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #090a0f;
        --card-bg: #121520;
        --border: #1e293b;
        --text: #f8fafc;
        --text-muted: #94a3b8;
        --qr-frame-bg: #ffffff;
        --qr-frame-border: #38bdf8;
      }
    }

    body { background: var(--bg); color: var(--text); padding: 24px; min-height: 100vh; }
    .header-bar { text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
    .header-bar h1 { font-size: 24px; font-weight: 800; color: var(--text); letter-spacing: -0.5px; }
    .header-bar p { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    
    .actions-row { display: flex; justify-content: center; gap: 10px; margin-top: 14px; }
    .print-btn { background: #ea580c; color: #fff; border: none; padding: 10px 22px; border-radius: 8px; font-weight: 800; cursor: pointer; }
    .toggle-btn { background: #1e293b; color: #38bdf8; border: 1px solid var(--border); padding: 10px 18px; border-radius: 8px; font-weight: 700; cursor: pointer; }

    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
    .qr-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 22px 18px;
      text-align: center;
      page-break-inside: avoid;
      box-shadow: 0 4px 16px rgba(0,0,0,0.06);
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
    }
    .brand { font-size: 14px; font-weight: 900; letter-spacing: 1.5px; color: #ea580c; margin-bottom: 4px; text-transform: uppercase; }
    .zone-badge { display: inline-block; background: rgba(234, 88, 12, 0.1); color: #ea580c; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; margin-bottom: 8px; }
    .ref-title { font-size: 18px; font-weight: 900; color: var(--text); margin-bottom: 10px; }
    
    .qr-frame { width: 190px; height: 190px; padding: 8px; border: 2px solid var(--qr-frame-border); border-radius: 14px; background: var(--qr-frame-bg); display: flex; align-items: center; justify-content: center; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .qr-frame img { width: 100%; height: 100%; object-fit: contain; }
    .subtext { font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 10px; line-height: 1.4; }
    .footer-note { font-size: 10px; color: var(--text-muted); border-top: 1px solid var(--border); padding-top: 10px; width: 100%; }

    @media print {
      .no-print { display: none !important; }
      body { background: #fff !important; color: #000 !important; padding: 0 !important; }
      .qr-card { background: #fff !important; border: 2px solid #cbd5e1 !important; box-shadow: none !important; }
      .ref-title { color: #000 !important; }
      .subtext, .footer-note { color: #475569 !important; }
    }
  </style>
</head>
<body>
  <div class="header-bar no-print">
    <h1>🍛 Abiruchi Hotel — Official Table Tents & Counter QR Codes</h1>
    <p>Enhanced with prominent reference headers and adaptive dark-mode quiet zones</p>
    <div class="actions-row">
      <button class="print-btn" onclick="window.print()">🖨️ Print All Cards (Ctrl+P)</button>
    </div>
  </div>
  <div class="grid">
    ${htmlCards.join('\n')}
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(OUT_DIR, 'Printable-Table-Tents-All.html'), printableHtml);
  console.log(`\nSuccessfully exported ${manifest.length} enhanced QR files to ${OUT_DIR}`);
}

run().catch(console.error);
