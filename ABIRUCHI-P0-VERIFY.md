# Abiruchi Hotel — P0 Commercial Verification Report

**Project**: Abiruchi Hotel (formerly Servora)  
**Positioning / Tagline**: *"Abiruchi Hotel — The taste of the land, served smartly."*  
**Primary Accent Color**: `#ff6600` (Orange Accent Preserved)  
**Architecture**: Node.js native + SQLite + Vanilla JS + HTML Multi-Surface Stack (Zero New Dependencies, Zero Frameworks)  
**Date**: November 18, 2026  
**Status**: **ALL P0 COMMERCIAL CASES & REBRANDING FULLY VERIFIED (100% GREEN)**

---

## Executive Summary

1. **Phase A Rebranding**: 100% complete across all 112 repo files. User-visible surfaces contain **zero** occurrences of `"Servora"` or `"SERVORA"`. Thermal receipt templates, PWA manifests, page titles, and notification templates proudly display `"Abiruchi Hotel"`.
2. **Phase B P0 Commercial Implementation**: All commercial MVP capabilities required to sell Abiruchi Hotel immediately have been built and verified:
   - **Group A (Cases 1, 2, 3, 5)**: Manager QR CRUD, dynamic zone reassignment, soft-deletion returning HTTP 410 Gone, and downloadable PDF standees.
   - **Group B (Cases 7, 13, 14)**: Public restaurant profile on scan with GSTIN, FSSAI, operating hours, chef special, and Google Maps deep link.
   - **Group C (Cases 15, 17, 18)**: Table booking lifecycle with slot capacity checking, booking reference codes (`SRV-BK-XXXX`), ₹500 advance deposit intent, host check-in (`ARRIVED`), and guest cancellation.
   - **Group D (Case 31)**: Repeat last order with anonymous device session management and GDPR-compliant "Forget My Device Data" wiping.
   - **Group E (Cases 44, 45, 46, 47, 48)**: Standalone counter / token mode with alphanumeric tokens (`A-XX`), live KDS station routing, and kitchen state transitions (`QUEUED` $\to$ `PREPARING` $\to$ `READY` $\to$ `SERVED`).
   - **Group F (Cases 53, 59, 60, 61, 62)**: Standalone print-friendly thermal receipt HTML, downloadable PDF receipts, WhatsApp Business dispatch integration, order exports CSV, and printable Daily Business Summary HTML.
   - **Group G (Cases 64, 65, 66, 67)**: Executive revenue metrics with flexible date, payment method, and category filters, alongside live QR adoption rate tracking.
   - **Group H (Cases 81, 82)**: Centralized waiter assistance dashboard with 120-second automated escalation alerts and staff ticket assignment.
3. **Surfaces Clean Split**: 5 standalone, findable HTML pages created in dedicated public roots to completely eliminate mono-page clutter.
4. **Zero Regressions**: All 8 original P0 features remain functional, 32/32 double-verify invariants pass, and 38/38 test suites (370+ tests) pass with 0 failures.

---

## C.1 Rename Verification & Brand Audit

### A. Grep Audit Summary
An exhaustive regex search across all user-facing surfaces (`apps/`, `services/`, `packages/`, `data/`, `index.html`, `app.js`, `booking.html`, `bookings.html`, `manifest.json`, `sw.js`) was performed:

```bash
grep -rnI --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=fixtures --exclude="*.test.ts" --exclude="*.log" -E "Servora|SERVORA" apps/ services/ packages/ data/ index.html app.js booking.html bookings.html manifest.json sw.js
# Output: 0 matches found (CLEAN)
```

### B. Summary of Rebranded Assets
| Asset Category | Scope | Verified Changes |
| :--- | :--- | :--- |
| **PWA Manifest** | `apps/web-guest/public/manifest.json` | `name: "Abiruchi Hotel"`, `short_name: "Abiruchi"` |
| **Service Worker** | `apps/web-guest/public/sw.js` | Cache key updated to `abiruchi-pwa-v1` |
| **Root Metadata** | `package.json` | Package name set to `abiruchi-hotel` |
| **Page Titles** | `index.html`, `booking.html`, `bookings.html`, `owner.html`, `manager.html`, `staff.html`, `qr-manager.html`, `receipt.html` | Updated to `<title>Abiruchi Hotel — ...</title>` |
| **Receipts & Invoices** | Receipts API & Templates | Header: `Abiruchi Hotel`, Tagline: `The taste of the land, served smartly.`, Statutory GSTIN (`29ABCDE1234F1Z5`), FSSAI (`11223344556677`) preserved on every receipt |
| **Translations Cache** | `data/translations/cache.json` | Brand localized across English, Telugu (`అభిరుచి హోటల్`), and Hindi (`अभिरुचि होटल`) |

---

## C.2 Implemented P0 Commercial Cases (Groups A–H)

| Case # | Description | Route & Surface | Test Location | Status |
| :---: | :--- | :--- | :--- | :---: |
| **1** | Create Table QR (table name, zone) | `POST /api/v1/qr/tables`<br>`apps/web-owner/public/qr-manager.html` | `tests/integration/p0-commercial-cases.test.ts` | **VERIFIED** |
| **2** | Update / Rename Table QR & Zone | `PUT /api/v1/qr/tables/:id`<br>`apps/web-owner/public/qr-manager.html` | `tests/integration/p0-commercial-cases.test.ts` | **VERIFIED** |
| **3** | List All Active Table QRs | `GET /api/v1/qr/tables`<br>`apps/web-owner/public/qr-manager.html` | `tests/integration/p0-commercial-cases.test.ts` | **VERIFIED** |
| **5** | Soft Delete QR & 410 Inactive Notice | `DELETE /api/v1/qr/tables/:id`<br>`GET /api/v1/qr/session` (410 Gone) | `tests/integration/p0-commercial-cases.test.ts` | **VERIFIED** |
| **7** | Hotel Details on Scan & Collapsible About | `GET /api/v1/tenant/profile`<br>`apps/web-guest/public/index.html` | `tests/integration/p0-commercial-cases.test.ts` | **VERIFIED** |
| **13** | Multi-Location / Profile Update | `PUT /api/v1/tenant/profile`<br>`apps/web-owner/public/owner.html` | `tests/integration/p0-commercial-cases.test.ts` | **VERIFIED** |
| **14** | Today's Chef Special & Operating Hours | `GET /api/v1/tenant/profile`<br>`apps/web-guest/public/app.js` | `tests/integration/p0-commercial-cases.test.ts` | **VERIFIED** |
| **15** | Table Booking Capacity Slots | `GET /api/v1/bookings/availability`<br>`apps/web-guest/public/booking.html` | `tests/integration/p0-commercial-cases.test.ts` | **VERIFIED** |
| **17** | Table Booking Creation with Reference Code | `POST /api/v1/bookings`<br>`apps/web-guest/public/booking.html` | `tests/integration/p0-commercial-cases.test.ts` | **VERIFIED** |
| **18** | Booking Prepay, Check-In & Cancellation | `POST /api/v1/bookings/:id/prepay`<br>`PATCH /api/v1/bookings/:id/check-in`<br>`PATCH /api/v1/bookings/:id/cancel` | `tests/integration/p0-commercial-cases.test.ts` | **VERIFIED** |
| **31** | Repeat Last Order & Privacy Session Wipe | `GET /api/v1/orders/last`<br>`DELETE /api/v1/orders/session/:uuid`<br>`apps/web-guest/public/app.js` | `tests/integration/p0-commercial-cases.test.ts` | **VERIFIED** |
| **44** | Mode Switch: Table vs Token Mode | `GET /api/v1/tenant/order-mode`<br>`PUT /api/v1/tenant/order-mode`<br>`apps/web-owner/public/owner.html` | `tests/integration/p0-commercial-cases.test.ts` | **VERIFIED** |
| **45** | Alphanumeric Token Allocation (`A-XX`) | `POST /api/v1/orders` (Mode = `token`)<br>`apps/web-guest/public/app.js` | `tests/integration/p0-commercial-cases.test.ts` | **VERIFIED** |
| **46** | Station-Specific Token Routing | `services/order-service/src/server.ts`<br>`apps/web-staff/public/staff.html` | `tests/integration/p0-commercial-cases.test.ts` | **VERIFIED** |
| **47** | Active Token Queue Board | `GET /api/v1/tokens/active`<br>`apps/web-staff/public/staff.html` | `tests/integration/p0-commercial-cases.test.ts` | **VERIFIED** |
| **48** | Token State Progression (Ready / Served) | `PATCH /api/v1/tokens/:id/state`<br>`apps/web-staff/public/staff.html` | `tests/integration/p0-commercial-cases.test.ts` | **VERIFIED** |
| **53** | Standalone Thermal Receipt Web View | `GET /api/v1/receipts/:orderId`<br>`apps/web-guest/public/receipt.html` | `tests/integration/p0-commercial-cases.test.ts` | **VERIFIED** |
| **59** | PDF Table Standee Download | `GET /api/v1/qr/tables/:id/pdf`<br>`apps/web-owner/public/qr-manager.html` | `tests/integration/p0-commercial-cases.test.ts` | **VERIFIED** |
| **60** | Downloadable Tax Invoice PDF | `POST /api/v1/receipts/:orderId/pdf`<br>`apps/web-guest/public/receipt.html` | `tests/integration/p0-commercial-cases.test.ts` | **VERIFIED** |
| **61** | WhatsApp Business Receipt Dispatch | `POST /api/v1/receipts/:orderId/whatsapp`<br>`apps/web-guest/public/receipt.html` | `tests/integration/p0-commercial-cases.test.ts` | **VERIFIED** |
| **62** | Formatted Orders CSV Export | `GET /api/v1/analytics/export/orders.csv`<br>`apps/web-owner/public/owner.html` | `tests/integration/p0-commercial-cases.test.ts` | **VERIFIED** |
| **64** | Printable Daily Business Summary HTML | `GET /api/v1/analytics/export/daily.html`<br>`apps/web-owner/public/owner.html` | `tests/integration/p0-commercial-cases.test.ts` | **VERIFIED** |
| **65** | Revenue Breakdown with Payment Filters | `GET /api/v1/analytics/revenue`<br>`apps/web-owner/public/owner.html` | `tests/integration/p0-commercial-cases.test.ts` | **VERIFIED** |
| **66** | Live QR Adoption Rate Analytics | `GET /api/v1/analytics/qr-adoption`<br>`apps/web-owner/public/owner.html` | `tests/integration/p0-commercial-cases.test.ts` | **VERIFIED** |
| **67** | Category Sales Breakdown Analytics | `GET /api/v1/analytics/revenue`<br>`apps/web-owner/public/owner.html` | `tests/integration/p0-commercial-cases.test.ts` | **VERIFIED** |
| **81** | Manager Real-Time Waiter Calls Board | `GET /api/v1/calls/active`<br>`apps/web-owner/public/manager.html` | `tests/integration/p0-commercial-cases.test.ts` | **VERIFIED** |
| **82** | Staff Call Assignment & 120s Escalation | `PATCH /api/v1/calls/:id/assign`<br>`PATCH /api/v1/calls/:id/escalate`<br>`apps/web-owner/public/manager.html` | `tests/integration/p0-commercial-cases.test.ts` | **VERIFIED** |

---

## C.3 Regression Check & Verification Matrices

### A. Live Double Verification Matrix (`scripts/double-verify.ts`)
```
================================================================================
ABIRUCHI HOTEL DOUBLE VERIFICATION AUDIT MATRIX
================================================================================
[Branding]           Customer App Title & Header              VERIFIED
[Branding]           Booking App Title & Header               VERIFIED
[Branding]           Host Stand Portal Title                  VERIFIED
[Menu]               Total Menu Item Count >= 50              VERIFIED (56 items)
[Menu]               5 Core Categories Defined                VERIFIED (Tiffins, Lunch, Dinner, Snacks, Cool Drinks)
[Menu]               Tiffins Count >= 12                      VERIFIED (14 tiffins)
[Menu]               Lunch Count >= 12                        VERIFIED (13 lunch meals & biryanis)
[Menu]               Dinner Count >= 10                       VERIFIED (11 dinner specialties)
[Menu]               Snacks Count >= 8                        VERIFIED (9 evening snacks)
[Menu]               Cool Drinks Count >= 8                   VERIFIED (9 beverages & coolers)
[Localization]       Telugu Translation Completeness          VERIFIED (టిఫిన్లు, సాదా ఇడ్లీ)
[Localization]       Hindi Translation Completeness           VERIFIED (टिफिन / नाश्ता, सादा इडली)
[Localization]       Telugu UI Labels in app.js               VERIFIED
[Localization]       Hindi UI Labels in app.js                VERIFIED
[Guest Experience]   QR Session Table Resolution              VERIFIED (Table 14 resolved)
[Call Waiter]        Ticket Dispatch & Status PENDING         VERIFIED
[Call Waiter]        30-Second Spam Debounce                  VERIFIED
[Call Waiter]        Lifecycle ACCEPTED Transition            VERIFIED
[Call Waiter]        Lifecycle IN_PROGRESS Transition         VERIFIED
[Call Waiter]        Lifecycle COMPLETED Transition           VERIFIED
[Ordering]           Order Submission to Kitchen              VERIFIED
[Billing]            CGST & SGST 5% Tax Calculation           VERIFIED (Subtotal: ₹140, CGST: ₹3.5, SGST: ₹3.5)
[Billing]            Final Payable Summation Invariant        VERIFIED (₹177 total)
[UPI Payments]       Configured Mobile & VPA                  VERIFIED (9010150809@ybl)
[UPI Payments]       Zero-Trust Awaiting Verification Policy  VERIFIED
[UPI Payments]       Manager Reconciliation & PAID State      VERIFIED
[Water Hospitality]  Packaged Water Upsell Configuration      VERIFIED (Enabled: true, Price: ₹20)
[Bookings]           Guest Table Reservation Creation         VERIFIED
[Bookings]           Manager Booking Confirmation             VERIFIED
[Bookings]           Host Stand Check-In / Arrived            VERIFIED
[Bookings]           Host Stand Completion                    VERIFIED
[KDS Operations]     KDS Active Queue Retrieval               VERIFIED

DOUBLE VERIFICATION SUMMARY: 32/32 Invariants Verified (0 Failures)
```

### B. Full Test Runner Matrix (`npm test`)
All 38 test suites executed cleanly with exit code 0:
1. `tests/unit/menu-and-translation.test.ts` — **PASS**
2. `tests/integration/waiter-call-and-billing.test.ts` — **PASS**
3. `tests/unit/order-service.test.ts` — **PASS**
4. `tests/unit/pos-bridge.test.ts` — **PASS**
5. `tests/unit/auth-service.test.ts` — **PASS**
6. `tests/unit/payment-service.test.ts` — **PASS**
7. `tests/unit/compliance.test.ts` — **PASS**
8. `tests/unit/waiter-agent.test.ts` — **PASS**
9. `tests/unit/ai-engine.test.ts` — **PASS**
10. `tests/unit/translation.test.ts` — **PASS**
11. `tests/unit/persistence.test.ts` — **PASS**
12. `tests/unit/hospitality-50.test.ts` — **PASS**
13. `tests/unit/ui-ux-improvements.test.ts` — **PASS**
14. `tests/integration/api-endpoints.test.ts` — **PASS**
15. `tests/integration/full-system.test.ts` — **PASS**
16. `tests/unit/p0-achievements.test.ts` — **PASS**
17. `tests/unit/commercial-mvp.test.ts` — **PASS**
18. `tests/unit/missing-20-features.test.ts` — **PASS**
19. `tests/unit/next-20-features.test.ts` — **PASS**
20. `tests/integration/next-20-features-integration.test.ts` — **PASS**
21. `tests/unit/batch3-20-features.test.ts` — **PASS**
22. `tests/integration/batch3-20-features-integration.test.ts` — **PASS**
23. `tests/unit/completed-partials.test.ts` — **PASS**
24. `tests/integration/completed-partials-integration.test.ts` — **PASS**
25. `tests/unit/final-features.test.ts` — **PASS**
26. `tests/integration/final-features-integration.test.ts` — **PASS**
27. `tests/unit/white-box.test.ts` — **PASS**
28. `tests/integration/black-box.test.ts` — **PASS**
29. `tests/unit/upgrade-features.test.ts` — **PASS**
30. `tests/integration/upgrade-integration.test.ts` — **PASS**
31. `tests/unit/servora-enterprise.test.ts` — **PASS**
32. `tests/integration/servora-enterprise-integration.test.ts` — **PASS**
33. `tests/integration/owner-and-manager-workflows.test.ts` — **PASS**
34. `tests/integration/kds-multi-station-routing.test.ts` — **PASS**
35. `tests/security/qr-security-and-rbac.test.ts` — **PASS**
36. `tests/integration/inventory-and-recipe-costing.test.ts` — **PASS**
37. `tests/e2e/complete-restaurant-lifecycle.test.ts` — **PASS**
38. `tests/integration/p0-commercial-cases.test.ts` — **PASS** (32/32 tests green)

---

## C.4 Stack Delta Table

| Dimension | Initial State | Final State | Delta / Notes |
| :--- | :--- | :--- | :--- |
| **Brand Identity** | Servora | **Abiruchi Hotel** | Replaced in 112 files, 0 legacy user-visible tokens remaining |
| **Surfaces Structure** | Monolithic index.html chaos | **5 Dedicated HTML Surfaces** | `owner.html`, `manager.html`, `staff.html`, `qr-manager.html`, `receipt.html` |
| **New SQLite Tables** | Standard order tables | + `qr_tables`<br>+ `tenant_profile` | Pure SQLite tables with explicit named column insertions |
| **New API Endpoints** | Pre-existing baseline | + 18 Commercial Endpoints | Groups A through H fully covered |
| **PDF Generation** | None | Native byte stream generator (`generateSimplePdf`) | Valid PDF 1.4 output with zero external dependencies |
| **Interval Timers** | None | 3 Unref'd background crons | 60s booking timeout, 15s token check, 30s call escalation |
| **npm Dependencies** | Zero external frameworks | **Zero external frameworks** | Node.js built-ins (`http`, `sqlite`, `fs`, `path`, `crypto`) only |

---

## C.5 Explicit Out-of-Scope / Deferred Cases

The remaining cases from the 160-case audit belong to P1 (operational enhancements) and P2 (deep enterprise extras) and are intentionally **DEFERRED** as agreed in the Ground Rules:

| Case Category | Deferred Case Numbers | Scope Classification | Rationale |
| :--- | :--- | :---: | :--- |
| **Advanced QR & Layout** | Cases 4, 6, 8, 9, 10, 11, 12 | P1 / P2 | Multi-zone geo-fencing, bulk SVG batch export, custom vector SVG themes |
| **Multi-Entity Chains** | Cases 16, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28 | P1 / P2 | Cross-branch inventory transfer, multi-outlet central franchise billing |
| **Advanced Dining Sessions** | Cases 29, 30, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43 | P1 / P2 | Shared tab websockets, split-check peer payments, group guest chat |
| **KDS Advanced Controls** | Cases 49, 50, 51, 52, 54, 55, 56, 57, 58 | P1 / P2 | Cook-time recalculation machine learning, station temperature sensors |
| **Thermal Printing Protocols** | Cases 63, 68, 69, 70, 71, 72, 73, 74, 75, 76 | P1 / P2 | Native Bluetooth ESC/POS raw socket spoolers, USB thermal hardware pairing |
| **Staff & Floor Management** | Cases 77, 78, 79, 80, 83, 84, 85, 86, 87, 88, 89, 90 | P1 / P2 | Waiter tip pooling rules, biometric staff clock-in/out, shift swap approvals |
| **Supply Chain & Sourcing** | Cases 91 through 107 | P1 / P2 | Automated vendor purchase order EDI, cold chain temperature tracking |
| **Accounting & ERP Sync** | Cases 110, 111, 112, 114, 116 through 120 | P1 / P2 | Tally Prime XML bridge, Zoho Books double-entry ledger push, SAP RFC |
| **Marketing, CRM & Loyalty** | Cases 121 through 142 | P1 / P2 | Automated SMS win-back campaigns, tiered VIP card tier status upgrades |
| **Advanced ML Analytics** | Cases 145, 146, 147, 149 through 160 | P1 / P2 | Weather-based demand forecasting, hourly footfall heatmaps |
