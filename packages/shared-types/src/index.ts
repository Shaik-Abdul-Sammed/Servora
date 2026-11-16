/**
 * @servora/shared-types
 * Core domain types, DTOs, and session contracts for Servora.
 */

// ----------------------------------------------------------------------------
// Tenancy & Outlets
// ----------------------------------------------------------------------------

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  currency: string;
  defaultLocale: string;
  createdAt: string;
  updatedAt: string;
}

export interface Outlet {
  id: string;
  tenantId: string;
  name: string;
  timezone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Table {
  id: string;
  tenantId: string;
  outletId: string;
  tableNumber: string;
  capacity: number;
  qrCodeUrl: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// QR Session & Security Contracts
// ----------------------------------------------------------------------------

/**
 * Payload encoded inside signed QR codes or ephemeral guest tokens
 */
export interface QRTableSessionPayload {
  tenantId: string;
  outletId: string;
  tableId: string;
  tableNumber: string;
  issuedAt: number; // Unix epoch ms
  expiresAt: number; // Unix epoch ms
  signature: string; // HMAC-SHA256 signature
}

// ----------------------------------------------------------------------------
// Menu & Catalog
// ----------------------------------------------------------------------------

export interface MenuCategory {
  id: string;
  tenantId: string;
  outletId: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ModifierOption {
  id: string;
  name: string;
  priceDeltaCents: number; // Stored in smallest currency unit (cents/pence/paise)
  isDefault: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: ModifierOption[];
}

export interface MenuItem {
  id: string;
  tenantId: string;
  outletId: string;
  categoryId: string;
  name: string;
  description: string;
  basePriceCents: number;
  imageUrl?: string;
  allergens: string[];
  isAvailable: boolean; // "86" state
  modifierGroups?: ModifierGroup[];
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// Orders & Kitchen Display System (KDS)
// ----------------------------------------------------------------------------

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'SERVED'
  | 'CANCELLED';

export interface SelectedModifier {
  modifierGroupId: string;
  modifierGroupName: string;
  optionId: string;
  optionName: string;
  priceDeltaCents: number;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  selectedModifiers: SelectedModifier[];
  itemTotalCents: number;
  notes?: string;
}

export interface Order {
  id: string;
  tenantId: string;
  outletId: string;
  tableId: string;
  tableNumber: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  guestNotes?: string;
  paymentId?: string;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// Payment Orchestration (PCI-DSS SAQ-A Compliant)
// ----------------------------------------------------------------------------

export type PaymentStatus =
  | 'REQUIRES_PAYMENT_METHOD'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REFUNDED';

export type PaymentMethodType = 'CARD' | 'DIGITAL_WALLET' | 'CASH' | 'ROOM_FOLIO';

export interface PaymentIntent {
  id: string;
  tenantId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  paymentMethodType: PaymentMethodType;
  clientSecret?: string; // Token for hosted frontend fields (Stripe/Razorpay)
  createdAt: string;
}

// ----------------------------------------------------------------------------
// Real-time Event Bus Payloads (KDS & Guest Updates)
// ----------------------------------------------------------------------------

export type ServerEventType =
  | 'ORDER_CREATED'
  | 'ORDER_STATUS_CHANGED'
  | 'ITEM_AVAILABILITY_CHANGED'
  | 'TABLE_CALL_WAITER';

export interface ServerEvent<T = unknown> {
  type: ServerEventType;
  tenantId: string;
  outletId: string;
  timestamp: string;
  payload: T;
}
