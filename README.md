# Servora

> Modern, Multi-Tenant QR-Code Restaurant & Hospitality Operating System.

Servora provides an end-to-end dining and ordering experience: from contactless QR table ordering and kitchen display systems (KDS) to real-time inventory tracking, multi-tenant administrative portals, and autonomous operational agents.

---

## Architecture Overview

```
                      ┌─────────────────────────────────────────┐
                      │               Guest Phone               │
                      │       (apps/web-guest: Next.js PWA)     │
                      └────────────────────┬────────────────────┘
                                           │ HTTPS / WSS
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │             API Gateway Engine          │
                      │          (services/api-gateway)         │
                      └───────┬────────────┬────────────┬───────┘
                              │            │            │
             ┌────────────────┘            │            └────────────────┐
             ▼                             ▼                             ▼
┌──────────────────────────┐ ┌──────────────────────────┐ ┌──────────────────────────┐
│   services/auth-service  │ │   services/order-service │ │  services/menu-service   │
│   (JWT, RBAC, Sessions)  │ │ (State Machine, Tickets) │ │  (Catalog, Modifiers)    │
└──────────────────────────┘ └─────────────┬────────────┘ └──────────────────────────┘
                                           │
                         ┌─────────────────┴─────────────────┐
                         ▼                                   ▼
            ┌──────────────────────────┐       ┌──────────────────────────┐
            │        apps/kds          │       │      apps/pos-bridge     │
            │ (Kitchen Display System) │       │ (Local ESC/POS Printing) │
            └──────────────────────────┘       └──────────────────────────┘
```

### Monorepo Structure

- **`apps/`**: Client frontend applications
  - `web-guest`: Guest-facing QR ordering progressive web app (Next.js, WCAG 2.2 AA).
  - `kds`: Real-time Kitchen Display System web application.
  - `web-owner`: Restaurant and outlet operator management dashboard.
  - `web-admin`: Super-admin platform console.
  - `pos-bridge`: Electron bridge for on-premise receipt printers and legacy POS.
  - `mobile-owner`: React Native mobile management app for operators.
  - `mobile-staff`: React Native mobile app for waitstaff table dispatch.
- **`services/`**: Domain microservices & backend engines
  - `order-service`: Core order lifecycle state machine and table dispatch.
  - `menu-service`: Menu catalog, variant modifiers, pricing, and 86 availability.
  - `payment-service`: PCI-DSS SAQ-A compliant payment orchestration.
  - `auth-service`: Tenant-scoped authentication, JWT issuance, and RBAC policies.
  - `tenant-service`: Multi-tenant hierarchy, outlet management, and billing tiers.
  - `sync-service`: Offline-first edge synchronization with POS bridges.
  - `api-gateway`: Unified request routing, rate limiting, and security boundaries.
- **`packages/`**: Shared internal libraries & agent frameworks
  - `shared-types`: Common TypeScript types, DTOs, and event payloads.
  - `config`: Shared TypeScript, ESLint, Prettier, and Tailwind presets.
  - `ui`: Shared design system primitives and accessible UI components.
  - `utils`: Standard currency, timezone, HMAC signature, and validation helpers.
  - `agents/`: Autonomous operational agents (Waiter, Accountant, Inventory, GM Copilot).
- **`data/`**: Migrations, seed fixtures, and analytics schemas.
- **`infra/`**: Kubernetes manifests, Docker environments, and Terraform IaC.
- **`tests/`**: End-to-end, integration, contract (Pact), and accessibility test suites.

---

## Security Model

1. **Tamper-Evident QR Table Sessions:**  
   Table QR codes are cryptographically signed (`HMAC-SHA256`) including tenant, outlet, table ID, and expiration timestamps to prevent table impersonation and unauthenticated order injection.
2. **Multi-Tenant Row-Level Security (RLS):**  
   Every database query enforces tenant scoping (`tenant_id`) at the connection and database engine levels.
3. **PCI-DSS SAQ-A Compliance:**  
   Cardholder data never touches application servers; payments are tokenized via hosted fields (e.g. Stripe Elements / Razorpay).

---

## Getting Started

### Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0 (or pnpm >= 9.0.0)

### Development Workflow
```bash
# Install dependencies across all workspaces
npm install

# Run type check across all workspaces
npm run typecheck

# Run test suites
npm run test

# Run build pipeline
npm run build
```
