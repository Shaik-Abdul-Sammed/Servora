# Abiruchi Hotel

> **The Intelligent Operating System for Modern Restaurants, Cafes & Hospitality Venues.**

Abiruchi Hotel is an enterprise-grade, multi-tenant restaurant and hospitality operating platform designed to unite contactless QR ordering, kitchen display workflows (KDS), table reservations, advance-order scheduling, recipe costing, inventory depletion, and AI operational assistance into a single unified architecture.

---

## Table of Contents

1. [Abiruchi Hotel Introduction](#1-abiruchi-introduction)
2. [Product Vision](#2-product-vision)
3. [Main Capabilities](#3-main-capabilities)
4. [Screenshots & UI Showcase](#4-screenshots--ui-showcase)
5. [Architecture Diagram](#5-architecture-diagram)
6. [Technology Stack](#6-technology-stack)
7. [Repository Structure](#7-repository-structure)
8. [Prerequisites](#8-prerequisites)
9. [Installation Instructions](#9-installation-instructions)
10. [Development Setup](#10-development-setup)
11. [Environment Variables](#11-environment-variables)
12. [Database Setup](#12-database-setup)
13. [Database Migrations](#13-database-migrations)
14. [Demo Data Setup](#14-demo-data-setup)
15. [Authentication & RBAC Configuration](#15-authentication--rbac-configuration)
16. [Payment Gateway & UPI Configuration](#16-payment-gateway--upi-configuration)
17. [Cryptographic QR Security Model](#17-cryptographic-qr-security-model)
18. [PWA Installation & Offline Support](#18-pwa-installation--offline-support)
19. [Customer Workflow (4 Global Journeys)](#19-customer-workflow-4-global-journeys)
20. [Manager Workflow & Operations](#20-manager-workflow--operations)
21. [Waiter Workflow & Table Service](#21-waiter-workflow--table-service)
22. [Kitchen Workflow & Multi-Station Routing](#22-kitchen-workflow--multi-station-routing)
23. [Receipt Printer Configuration (ESC/POS & Thermal)](#23-receipt-printer-configuration-escpos--thermal)
24. [Deployment Instructions](#24-deployment-instructions)
25. [Self-Hosted Deployment (Lifetime Licence)](#25-self-hosted-deployment-lifetime-licence)
26. [Managed Cloud Deployment (Multi-Tenant SaaS)](#26-managed-cloud-deployment-multi-tenant-saas)
27. [Backup and Restore Procedures](#27-backup-and-restore-procedures)
28. [Testing Framework & Commands](#28-testing-framework--commands)
29. [Security Considerations & PCI-DSS SAQ-A](#29-security-considerations--pci-dss-saq-a)
30. [Troubleshooting Guide](#30-troubleshooting-guide)
31. [Known Limitations](#31-known-limitations)
32. [Roadmap](#32-roadmap)
33. [Contribution Guidelines](#33-contribution-guidelines)
34. [Licence and Commercial Terms](#34-licence-and-commercial-terms)

---

## 1. Abiruchi Hotel Introduction

Abiruchi Hotel is engineered from the ground up for independent restaurants, cafes, luxury dining rooms, and multi-location franchises. It eliminates fragmented subscriptions by combining digital guest ordering, waitstaff mobile POS, split kitchen ticketing, table turnaround tracking, recipe margin intelligence, and stock replenishment into an integrated system.

Unlike legacy POS hardware or closed proprietary marketplaces, Abiruchi Hotel runs natively on standard browsers, consumer tablets, thermal receipt printers, and smartphones.

---

## 2. Product Vision

The hospitality technology industry is saturated with high-commission marketplaces and clunky, localized hardware terminals. Abiruchi Hotel's mission is to:
- **Democratize Restaurant Technology**: Offer a functional **Free Base Plan** for single-outlet operators (1 outlet, 1 owner, up to 3 waiters, free QR codes, guest ordering).
- **Eliminate Customer Friction**: Allow customers to scan, browse, customize, and order without mandatory app store downloads or forced account creation.
- **Protect Operational Integrity**: Provide cryptographic protection against QR screenshot fraud and table spoofing.
- **Maximize Profitability**: Give restaurateurs automated recipe-level cost of goods sold (COGS) visibility, Boston Consulting Group (BCG) menu engineering (Stars, Plowhorses, Puzzles, Dogs), and real-time stock depletion.

---

## 3. Main Capabilities

### Customer Experience
* **4 Core Journeys**:
  1. `⚡ Order Now`: Instant dine-in or counter ordering with zero forced registration.
  2. `🕒 For Later`: Scheduled pickup orders with 15-minute kitchen capacity slots and preparation windows.
  3. `📅 Reserve a Table`: Full reservation engine with adult/child headcounts, seating preferences, high-chairs, and special occasions.
  4. `🍽️ Dine-In QR`: Cryptographically signed table sessions with countdown validity and re-scan refresh.
* **Human Service Bridge**: 1-tap option to call servers for guests who prefer traditional human hospitality over digital screens.
* **Visual Menu & Dietary Clarity**: High-res dish photography, zoom views, verified FSSAI dietary badges (Veg, Non-Veg, Egg), preparation times, and verified allergen notices.
* **International Currencies & Locales**: Multi-currency support (INR `₹`, USD `$`, EUR `€`, GBP `£`) and bilingual English/Hindi localization.
* **Smart Cart & Deals Engine**: Real-time coupon application (`ABIRUCHI HOTEL20`, `BOGO`, `FLAT50`), gratuity tip toggles, item customizations, and order notes.

### Manager & Kitchen Operations
* **Free Base Plan**: 1 outlet, 1 owner, up to 3 waiters with automated limits and upgrade prompts.
* **Manager QR Studio (`/owner/tokens`)**: Single and bulk generation for tables, takeaway, and booking check-ins, token revocation/rotation, and printable standee cards.
* **Staff RBAC (`/owner/staff`)**: Role permissions (`OWNER`, `MANAGER`, `WAITER`, `KITCHEN`, `BAR`, `CASHIER`), active toggles, table transfers, and PIN resets.
* **Order Management & Dispatch (`/owner/orders`)**: Advanced search, station filters, CSV export, multi-format receipt printing, and split ticket inspection.
* **Smart Kitchen Routing (KDS)**: Automatic order splitting into station tickets (`PIZZA_OVEN`, `COLD_PREP`, `HOT_LINE`, `BAR`, `COFFEE`) with preparation timers and SLA delay warnings.
* **Inventory & Recipe Costing (`/owner/inventory`)**: Real-time stock per ingredient, unit of measure, BOM deductions on orders, par-level threshold alerts, expiry tracking, and BCG menu engineering matrix.
* **Abiruchi Hotel AI Operations Copilot**: Grounded deterministic question-answering on margins, demand forecasting, stock replenishment, and operational safeguards.

---

## 4. Screenshots & UI Showcase

| Customer Dining Web App | Manager QR Studio & Tokens |
|:---:|:---:|
| Mobile-first responsive guest ordering with Light/Dark/System themes, FSSAI dietary indicators, and Indian Rupee (`₹`) pricing. | Single & bulk QR code generator, live scan history, token revocation, and printable standees. |

| KDS Multi-Station Split Routing | Inventory & Recipe Costing |
|:---:|:---:|
| Automatic station ticket dispatch to pizza ovens, hot lines, and bars with prep timers. | Live BOM contribution margins, ingredient par alerts, and BCG matrix (Stars, Plowhorses, Puzzles, Dogs). |

---

## 5. Architecture Diagram

```
                              ┌─────────────────────────────────────────┐
                              │               Guest Phone               │
                              │          (apps/web-guest PWA)           │
                              └────────────────────┬────────────────────┘
                                                   │ HTTPS / WSS
                                                   ▼
                              ┌─────────────────────────────────────────┐
                              │            API Gateway Engine           │
                              │          (Node.js 22 / SQLite)          │
                              └───────┬────────────┬────────────┬───────┘
                                      │            │            │
                     ┌────────────────┘            │            └────────────────┐
                     ▼                             ▼                             ▼
        ┌──────────────────────────┐ ┌──────────────────────────┐ ┌──────────────────────────┐
        │   services/auth-service  │ │   services/order-service │ │  services/menu-service   │
        │   (JWT, PBKDF2, RBAC)    │ │ (State Machine, Tickets) │ │ (BOM, Pricing, Specials) │
        └──────────────────────────┘ └─────────────┬────────────┘ └──────────────────────────┘
                                                   │
                                 ┌─────────────────┴─────────────────┐
                                 ▼                                   ▼
                    ┌──────────────────────────┐       ┌──────────────────────────┐
                    │         apps/kds         │       │      apps/pos-bridge     │
                    │ (Kitchen Display System) │       │ (ESC/POS Thermal Print)  │
                    └──────────────────────────┘       └──────────────────────────┘
```

---

## 6. Technology Stack

- **Runtime**: Node.js 22 (LTS) with native `--experimental-strip-types` TypeScript execution.
- **Database**: SQLite `DatabaseSync` (in-memory test mode, persistent `.sqlite` in production) with foreign key constraints and transactional integrity.
- **Frontend Architecture**: Responsive Vanilla Web Components, CSS Variables, PWA Service Worker, and Manifest V3 standard.
- **Security & Cryptography**: Native Node.js `node:crypto` (`HMAC-SHA256`, PBKDF2 with 100,000 iterations).
- **Testing Engine**: Native Node.js Test Runner (`node:test` and `node:assert/strict`) — zero external testing bloat.
- **Printing**: Native ESC/POS binary buffer generator supporting standard 58mm and 80mm thermal printers.

---

## 7. Repository Structure

```
Abiruchi Hotel/
├── apps/
│   ├── web-guest/               # Progressive Web App for guest QR ordering & reservations
│   │   └── public/              # index.html, styles.css, app.js, sw.js, manifest.json
│   ├── web-owner/               # Restaurant Owner & Manager operations suite
│   │   └── public/              # orders.html, tokens.html, staff.html, menu.html, inventory.html
│   ├── kds/                     # Kitchen Display System station ticket app
│   └── pos-bridge/              # Thermal ESC/POS receipt printing bridge
├── services/
│   ├── order-service/           # Order state machine, SQLite store, and HTTP server
│   │   └── src/                 # server.ts, store.ts, audit-service.ts
│   ├── auth-service/            # Tenant scoped auth and PBKDF2 token issuance
│   ├── payment-service/         # UPI QR code and payment verification adapter
│   └── menu-service/            # Recipe BOM costing and category catalog
├── packages/
│   ├── shared-types/            # Shared TypeScript contracts and interfaces
│   └── utils/                   # qr-crypto.ts, currency.ts, dates.ts
├── tests/
│   ├── unit/                    # 17 unit test suites
│   └── integration/             # 13 integration test suites
├── data/                        # SQLite schemas, migrations, and seed scripts
└── package.json                 # Monorepo configuration and test scripts
```

---

## 8. Prerequisites

- **Node.js**: Version 22.0.0 or higher.
- **npm**: Version 10.0.0 or higher.
- **Operating System**: Linux (Ubuntu/Debian recommended), macOS, or Windows (WSL2).

---

## 9. Installation Instructions

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-org/Abiruchi Hotel.git
cd Abiruchi Hotel
npm install
```

---

## 10. Development Setup

Start the unified Abiruchi Hotel application server:

```bash
npm start
```

The server binds to port `3001` by default:
- **Guest Experience**: `http://localhost:3001`
- **Table Booking**: `http://localhost:3001/booking`
- **Manager Orders**: `http://localhost:3001/owner/orders`
- **Manager QR Studio**: `http://localhost:3001/owner/tokens`
- **Manager Staff RBAC**: `http://localhost:3001/owner/staff`
- **Manager Menu Studio**: `http://localhost:3001/owner/menu`
- **Manager Inventory & BOM**: `http://localhost:3001/owner/inventory`
- **Kitchen Display (KDS)**: `http://localhost:3001/kds`

---

## 11. Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3001
NODE_ENV=production
SQLITE_DB_PATH=./data/abiruchi.sqlite
QR_SIGNING_SECRET=your-secure-hex-signing-key-here
JWT_SECRET=your-secure-jwt-secret-here
DEFAULT_TENANT_ID=a0000000-0000-0000-0000-000000000001
DEFAULT_OUTLET_ID=b0000000-0000-0000-0000-000000000001
UPI_VPA=merchant@upi
UPI_MERCHANT_NAME=Trattoria Abiruchi Hotel
```

---

## 12. Database Setup

Abiruchi Hotel uses Node.js 22's native SQLite `DatabaseSync` engine.
- In test environments (`NODE_ENV=test`), databases initialize in `:memory:` for instant isolation and zero disk footprint.
- In persistent environments, schemas and initial seeds are verified automatically on startup in `./data/abiruchi.sqlite`.

---

## 13. Database Migrations

Database tables are verified on startup through `store.ts`:
- Core tables: `tenants`, `outlets`, `tables`, `categories`, `menu_items`, `orders`.
- Hospitality & P0 tables: `outlet_p0_settings`, `table_assistance_calls`, `recovery_tickets`, `guest_preferences`.
- Enterprise upgrade tables: `subscription_plans`, `staff_members`, `qr_codes`, `qr_scans`, `station_routing_rules`, `table_bookings`, `specials`, `offers`, `offer_redemptions`, `beverage_config`, `water_preferences`.

---

## 14. Demo Data Setup

Initial seed data includes:
- **Venue**: Trattoria Abiruchi Hotel (Outlet ID: `b0000000-0000-0000-0000-000000000001`)
- **Tables**: Tables 1 through 20 across Main Dining, Patio, and Bar Counter.
- **Menu Items**: Wood-fired Neapolitan pizzas, artisanal pastas, and handcrafted mocktails.
- **Ingredients & BOM**: Caputo 00 Flour, Mozzarella di Bufala, San Marzano Tomatoes, Fresh Basil, Truffle Butter.

---

## 15. Authentication & RBAC Configuration

Abiruchi Hotel enforces role-based access control with scoped permissions:
- **`OWNER`**: Complete tenant control, financial settlements, subscription management, staff creation.
- **`MANAGER`**: Menu editing, table assignments, discounts, and inventory adjustments.
- **`WAITER`**: Assigned table order entry, status updates, and customer assistance calls.
- **`KITCHEN`**: Station ticket fulfillment, delay alerts, and 86 sold-out toggles.
- **`BAR`**: Cocktail and beverage dispatch queue.
- **`CASHIER`**: Payment receipts, till closing, and invoice generation.

Passwords are salted and hashed using PBKDF2 (100,000 iterations, SHA-512).

---

## 16. Payment Gateway & UPI Configuration

- **Dynamic UPI QR Generation**: Abiruchi Hotel dynamically generates `upi://pay` strings containing the verified order reference and exact amount in Indian Rupees (`₹`).
- **Zero Trust Frontend Payment**: Payments are never marked as `PAID` based on client claims; order state updates require signed gateway webhooks or manager till clearance.

---

## 17. Cryptographic QR Security Model

Printed physical QR codes encode a signed session URL:
```
https://abiruchi.app/?t=TABLE&tid=c0000000...&ts=1794916200&sig=a8f4c...
```
- **HMAC-SHA256 Signatures**: Verifies `tenantId`, `outletId`, `tableId`, and `timestamp`.
- **Short-Lived Customer Sessions**: Scanning yields a 120-minute operational session token.
- **Replay & Tamper Protection**: Forging the table ID in the URL breaks the cryptographic signature, rejecting the request with HTTP 403.
- **Session Expiration**: Expired tokens trigger an immediate expired session dialog with a 1-tap re-scan button.

---

## 18. PWA Installation & Offline Support

- **Service Worker (`/sw.js`)**: Caches critical UI assets (`/guest/styles.css`, `/guest/app.js`, `/manifest.json`) using a Stale-While-Revalidate caching pattern.
- **Manifest (`/manifest.json`)**: Configured for standalone full-screen operation on Android, iOS, Windows, and macOS.
- **Offline Fallback**: Displays clear network status notifications and preserves cart contents across connection drops.

---

## 19. Customer Workflow (4 Global Journeys)

1. **Guest Scans QR**: Instantly opens menu for their assigned table without login.
2. **Browsing & Customization**: Inspects ingredients, verified allergens, dietary tags, and spice levels.
3. **Cart & Coupons**: Adds items, enters promo code, chooses course timing (All Together, Starters First, Mains).
4. **Checkout & Order Token**: Receives unique 6-character order code, pickup token, and real-time 4-stage tracking stepper.

---

## 20. Manager Workflow & Operations

1. **Dashboard Overview**: Monitor active orders, kitchen station queues, and table occupancy.
2. **QR Code Studio**: Generate single or batch QR standees for tables, takeaways, or promo check-ins.
3. **Staff Access Control**: Enforce Free Plan limit (up to 3 waiters); invite staff and assign table sections.
4. **Menu & Photo Studio**: Upload dish photos with 1-tap presets, set prices, and configure dietary tags.

---

## 21. Waiter Workflow & Table Service

1. **Station Login**: Login with numeric PIN on any mobile or tablet browser.
2. **Assigned Tables**: View live orders and customer assistance requests (Water Refill, Bill, Server Call).
3. **Order Placement**: Place orders on behalf of guests who prefer human hospitality.
4. **Table Transfers**: Reassign orders and guests between tables with automatic audit trails.

---

## 22. Kitchen Workflow & Multi-Station Routing

1. **Order Splitting**: Orders containing pizzas, pastas, and drinks automatically split into separate tickets.
2. **Station Displays**:
   - `PIZZA_OVEN`: Displays wood-fired pizza tickets with dough and crust preferences.
   - `HOT_LINE`: Displays handmade pasta tickets with cooking timers.
   - `BAR`: Displays cocktail and beverage orders.
3. **Ticket Actions**: Start Prep → Mark Ready → Recall. Preparation timers turn amber and red when approaching SLA thresholds.

---

## 23. Receipt Printer Configuration (ESC/POS & Thermal)

Abiruchi Hotel provides native formatting for thermal and standard printers via `/api/v1/orders/:id/receipt?format=...`:
- `thermal58`: Compact 32-column format for 58mm POS receipt printers.
- `thermal80`: Standard 48-column format for 80mm commercial thermal printers.
- `standard`: Full invoice format for standard A4/Letter laser printers.
- `takeaway`: Large-type pickup token format with customer name and phone.

---

## 24. Deployment Instructions

Abiruchi Hotel can be deployed via Docker or standard systemd services.

```bash
# Build and run with Docker
docker build -t abiruchi:latest .
docker run -p 3001:3001 -v $(pwd)/data:/app/data abiruchi:latest
```

---

## 25. Self-Hosted Deployment (Lifetime Licence)

For restaurateurs deploying on their own VPS (e.g. DigitalOcean, Hetzner, AWS EC2):
1. Provision Ubuntu 24.04 LTS server.
2. Install Node.js 22 LTS.
3. Clone repository, configure `.env`, and start with `pm2`:
   ```bash
   npm install -g pm2
   pm2 start npm --name "abiruchi" -- start
   pm2 startup
   ```
4. Configure Nginx with Let's Encrypt SSL certificates.

---

## 26. Managed Cloud Deployment (Multi-Tenant SaaS)

For multi-tenant SaaS operators:
- Abiruchi Hotel enforces strict tenant scoping on every route via `tenant_id`.
- Subscription tiers (`FREE_BASE`, `PRO_RESTAURANT`, `ENTERPRISE_GROUP`) configure allowed outlets and staff quotas dynamically.

---

## 27. Backup and Restore Procedures

### Backup
```bash
# Safely snapshot the SQLite database file
sqlite3 ./data/abiruchi.sqlite ".backup './backups/abiruchi_$(date +%F_%T).bak'"
```

### Restore
```bash
cp ./backups/abiruchi_backup_file.bak ./data/abiruchi.sqlite
npm start
```

---

## 28. Testing Framework & Commands

Abiruchi Hotel maintains a comprehensive, zero-dependency test suite covering **30 test suites and over 300 automated assertions**:

```bash
# Run all unit, integration, and security test suites
npm test

# Run specific test suites
node --experimental-strip-types tests/unit/abiruchi-enterprise.test.ts
node --experimental-strip-types tests/integration/abiruchi-enterprise-integration.test.ts
node --experimental-strip-types tests/unit/upgrade-features.test.ts
node --experimental-strip-types tests/integration/upgrade-integration.test.ts
```

---

## 29. Security Considerations & PCI-DSS SAQ-A

1. **Cardholder Data Isolation**: Abiruchi Hotel never receives, stores, or transmits raw credit card numbers.
2. **Replay Protection**: Expired tokens and reused transaction IDs are rejected by the server ledger.
3. **Rate Limiting**: API routes apply rate limits to prevent brute-force attacks on PINs or OTPs.
4. **SQL Injection Prevention**: All queries utilize parameterized statements via SQLite `DatabaseSync`.

---

## 30. Troubleshooting Guide

- **Port in Use**: If port 3001 is already bound, release it with `fuser -k 3001/tcp`.
- **Cached Styles in Browser**: Hard-refresh with `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (macOS).
- **Plan Limit Reached**: Free plan allows up to 3 waiters; upgrading plan unblocks additional staff.

---

## 31. Known Limitations

- Direct Bluetooth and raw USB thermal printing requires the on-premise `pos-bridge` daemon or browser print dialog.
- Multi-currency display converts visual presentation; backend settlement uses the outlet's base currency.

---

## 32. Roadmap

- [x] Complete Swiggy reference purge and distinct Abiruchi Hotel brand identity.
- [x] Recipe costing & BCG menu engineering matrix.
- [x] Deterministic AI Operations Copilot.
- [x] PWA offline caching and Service Worker.
- [ ] Offline local-mesh peer synchronization for edge kitchen printers.
- [ ] Direct WhatsApp Business Cloud API automated messaging webhook.

---

## 33. Contribution Guidelines

1. Fork repository and create a feature branch (`git checkout -b feature/amazing-feature`).
2. Verify all test suites pass with zero failures: `npm test`.
3. Submit a Pull Request with complete test coverage.

---

## 34. Licence and Commercial Terms

Copyright (c) 2026 Abiruchi Hotel Operating Systems. All rights reserved.
Distributed under dual commercial licensing: Managed Cloud SaaS and Self-Hosted Enterprise Lifetime License.
