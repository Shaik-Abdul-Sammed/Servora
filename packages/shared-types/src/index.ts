/**
 * @abiruchi/shared-types
 * Core domain types, DTOs, and session contracts for Abiruchi Hotel.
 * Production-ready international hospitality standard (Toast / Sunday / me&u / Olo).
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
  zone?: string; // 'Dining Room' | 'Patio Terrace' | 'Cocktail Bar' | 'Cabana' | 'Room Service'
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// QR Session & Security Contracts
// ----------------------------------------------------------------------------

export interface QRTableSessionPayload {
  tenantId: string;
  outletId: string;
  tableId: string;
  tableNumber: string;
  issuedAt: number; // Unix epoch ms
  expiresAt: number; // Unix epoch ms
  signature: string; // HMAC-SHA256 signature
  mode?: 'TABLE' | 'TOKEN' | 'BOOKING' | 'MENU_ONLY';
}

// ----------------------------------------------------------------------------
// Menu & Catalog
// ----------------------------------------------------------------------------

export type MealCourse = 'BEVERAGE' | 'STARTER' | 'MAIN' | 'DESSERT';

export type KitchenStation = 'BAR' | 'GRILL' | 'PIZZA_OVEN' | 'COLD_PREP' | 'HOT_LINE' | 'EXPO';

export interface MenuCategory {
  id: string;
  tenantId: string;
  outletId: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  daypartFrom?: string; // e.g. "06:00"
  daypartUntil?: string; // e.g. "11:30"
  daysOfWeek?: number[]; // e.g. [0, 6] for Sunday, Saturday
}

export interface ModifierOption {
  id: string;
  name: string;
  priceDeltaCents: number;
  isDefault?: boolean;
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
  course?: MealCourse;
  station?: KitchenStation;
  dietaryType?: 'VEG' | 'NON_VEG' | 'EGG' | 'VEGAN';
  prepTimeMinutes?: number;
  modifierGroups?: ModifierGroup[];
  outletPricing?: Record<string, number>;
  isChefSpecial?: boolean;
  specialDate?: string;
  ingredientCostCents?: number;
  nutrition?: NutritionInfo;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// Orders & Kitchen Display System (KDS)
// ----------------------------------------------------------------------------

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PENDING_STAFF_APPROVAL'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'SERVED'
  | 'CANCELLED';

export type ShiftPaymentMode = 'PAY_FIRST' | 'PAY_LATER';

export interface OutletP0Settings {
  outletId: string;
  paymentMode: ShiftPaymentMode;
  isPaused: boolean;
  pauseReason?: string;
  pauseEtaMinutes?: number;
  requireFirstOrderApproval: boolean;
  displayMode?: 'TABLE' | 'TOKEN';
  tokenPrefix?: string;
  tokenCounter?: number;
  minOrderValueCents?: number;
  minSpendPerHeadCents?: number;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// C1 — Token & Queue Engine
// ----------------------------------------------------------------------------

export type TokenState = 'QUEUED' | 'PREPARING' | 'READY' | 'SERVED' | 'CLOSED';
export type TokenBucket = 'FOOD' | 'DRINKS' | 'DESSERTS' | 'TAKEAWAY';

export interface ServiceToken {
  id: string;
  outletId: string;
  code: string;
  bucket: TokenBucket;
  state: TokenState;
  orderRef?: string;
  guestPhone?: string;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// C3 — Payment Verification
// ----------------------------------------------------------------------------

export type PaymentVerificationStatus = 'UNVERIFIED' | 'VERIFIED' | 'DISPUTED';

export interface PaymentRecord {
  id: string;
  outletId: string;
  orderId: string;
  amountCents: number;
  method: 'CASH' | 'CARD' | 'ROOM_CHARGE' | 'UPI';
  status: PaymentVerificationStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// C4 — Table Booking + Prepay
// ----------------------------------------------------------------------------

export type BookingStatus = 'RESERVED' | 'CHECKED_IN' | 'NO_SHOW' | 'CANCELLED';

export interface TableBooking {
  id: string;
  outletId: string;
  tableId?: string;
  guestName: string;
  guestPhone?: string;
  partySize: number;
  slotDate: string;
  slotTime: string;
  durationMinutes: number;
  prepayAmountCents: number;
  status: BookingStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// C5 — Mobile Login + Preferences
// ----------------------------------------------------------------------------

export interface GuestOTPRequest {
  phone: string;
  otpCode: string;
  expiresAt: number;
}

export interface GuestPreferences {
  id: string;
  phoneHash: string;
  allergens: string[];
  milkPref?: 'DAIRY' | 'OAT' | 'SOY' | 'ALMOND' | 'NONE';
  spiceLevel?: 'MILD' | 'MEDIUM' | 'HOT' | 'EXTRA_HOT';
  favoriteItemIds: string[];
  visitCount: number;
  lastVisitAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// C6 — Feedback + Recovery Loop
// ----------------------------------------------------------------------------

export type RecoveryStatus = 'OPEN' | 'ACKNOWLEDGED' | 'CLOSED';
export type ReviewCategory = 'FOOD_QUALITY' | 'SERVICE_SPEED' | 'STAFF_ATTITUDE' | 'CLEANLINESS' | 'VALUE' | 'OTHER';

export interface RecoveryTicket {
  id: string;
  outletId: string;
  orderId: string;
  rating: number;
  category: ReviewCategory;
  comment?: string;
  status: RecoveryStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  closedBy?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// C7 — Unified QR Router
// ----------------------------------------------------------------------------

export type QRMode = 'TABLE' | 'TOKEN' | 'BOOKING' | 'MENU_ONLY';

export type AssistanceCategory = 'WATER' | 'BILL' | 'CUTLERY' | 'MANAGER' | 'SERVER' | 'FOOD_ISSUE' | 'OTHER' | 'ASSISTANCE';
export type AssistanceStatus = 'PENDING' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'RESOLVED';

export interface TableAssistanceCall {
  id: string;
  outletId: string;
  tableId: string;
  tableNumber: string;
  category: AssistanceCategory;
  priority: 'NORMAL' | 'URGENT';
  message?: string;
  assignedStaffId?: string;
  status: AssistanceStatus;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
}

export interface WaterBottleSettings {
  enabled: boolean;
  appliesTo: 'DINE_IN' | 'TAKEAWAY' | 'BOTH';
  itemId: string;
  name: string;
  size: string;
  priceCents: number;
  isAvailable: boolean;
}

export interface BillPreview {
  orderId: string;
  restaurantName: string;
  outletId: string;
  tableNumber: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPriceINR: string;
    totalPriceINR: string;
  }>;
  subtotalINR: string;
  discountINR: string;
  taxBreakdown: {
    cgstINR: string;
    sgstINR: string;
    taxRatePercent: number;
    totalTaxINR: string;
  };
  serviceChargeINR: string;
  packagingChargeINR: string;
  finalPayableINR: string;
  paymentStatus: string;
  paymentMethod?: string;
  isFinal: boolean;
  generatedAt: string;
}

export interface MenuItemAuditLog {
  id: string;
  menuItemId: string;
  outletId: string;
  actorId: string;
  action: 'SOLD_OUT' | 'RESTOCKED';
  reason?: string;
  createdAt: string;
}

export type CourseState = 'HELD' | 'FIRED' | 'READY' | 'SERVED';

export type KdsSlaStatus = 'NORMAL' | 'WARNING' | 'CRITICAL';

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
  course?: MealCourse;
  station?: KitchenStation;
  courseState?: CourseState;
}

export type SplitBillType = 'EQUAL_PARTS' | 'BY_ITEMS' | 'CUSTOM_AMOUNT';

export interface SplitBillPart {
  id: string;
  label: string;
  itemIds?: string[];
  amountCents: number;
  isPaid: boolean;
  paymentMethod?: string;
  paidAt?: string;
}

export interface SplitBillState {
  billType: SplitBillType;
  totalCents: number;
  paidCents: number;
  remainingCents: number;
  parts: SplitBillPart[];
}

export interface HotelFolioCharge {
  roomNumber: string;
  guestLastName: string;
  folioId: string;
  deliveryZone?: string;
  trayChargeCents?: number;
  isVerified: boolean;
  verifiedAt?: string;
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
  serviceChargeCents: number;
  tipCents: number;
  totalCents: number;
  guestNotes?: string;
  paymentId?: string;
  paymentMethod?: string;
  splitBilling?: SplitBillState;
  hotelCharge?: HotelFolioCharge;
  courseStates?: Record<MealCourse, CourseState>;
  slaStatus?: KdsSlaStatus;
  elapsedMinutes?: number;
  managerCompCents?: number;
  managerCompReason?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  scheduledCourseFires?: Record<string, string>;
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

export type PaymentMethodType =
  | 'CARD'
  | 'APPLE_PAY'
  | 'GOOGLE_PAY'
  | 'CASH_TO_WAITER'
  | 'ROOM_FOLIO';

export interface PaymentIntent {
  id: string;
  tenantId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  paymentMethodType: PaymentMethodType;
  clientSecret?: string;
  createdAt: string;
}

// ----------------------------------------------------------------------------
// Reviews & Guest Feedback
// ----------------------------------------------------------------------------

export interface ReviewSubmission {
  id: string;
  orderId: string;
  tenantId: string;
  rating: number; // 1 to 5
  comment?: string;
  guestEmail?: string;
  redirectedToGoogle: boolean;
  internalAlertSent: boolean;
  createdAt: string;
}

// ----------------------------------------------------------------------------
// Real-time Event Bus Payloads (KDS & Guest Updates)
// ----------------------------------------------------------------------------

export type ServerEventType =
  | 'ORDER_CREATED'
  | 'ORDER_STATUS_CHANGED'
  | 'ITEM_AVAILABILITY_CHANGED'
  | 'TABLE_CALL_WAITER'
  | 'COURSE_FIRED'
  | 'BILL_SPLIT_PAYMENT'
  | 'REVIEW_SUBMITTED';

export interface ServerEvent<T = unknown> {
  type: ServerEventType;
  tenantId: string;
  outletId: string;
  timestamp: string;
  payload: T;
}

// ----------------------------------------------------------------------------
// Inventory, Waste & Operations
// ----------------------------------------------------------------------------

export interface InventoryItem {
  id: string;
  outletId: string;
  name: string;
  currentStock: number;
  reorderPoint: number;
  unit: string;
  linkedMenuItemId?: string;
  updatedAt: string;
}

export type WasteReason = 'SPOILAGE' | 'DROPPED' | 'BURNT' | 'EXPIRED' | 'COMP';

export interface WasteRecord {
  id: string;
  outletId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  reason: WasteReason;
  costCents: number;
  reportedBy: string;
  createdAt: string;
}

export interface PromoCode {
  code: string;
  outletId: string;
  discountPercent?: number;
  fixedDiscountCents?: number;
  minOrderCents?: number;
  expiresAt: string;
  active: boolean;
}

export interface TillCloseRecord {
  id: string;
  outletId: string;
  shiftDate: string;
  openingCashCents: number;
  cashSalesCents: number;
  cardSalesCents: number;
  upiSalesCents: number;
  totalSalesCents: number;
  actualCashCountCents: number;
  discrepancyCents: number;
  closedBy: string;
  createdAt: string;
}

export interface StationFreeze {
  station: 'BAR' | 'KITCHEN' | 'PIZZA_OVEN' | 'GRILL';
  frozen: boolean;
  reason?: string;
  etaMinutes?: number;
  updatedAt: string;
}

export interface GSTInvoice {
  invoiceNumber: string;
  orderId: string;
  outletId: string;
  date: string;
  subtotalCents: number;
  cgstCents: number;
  sgstCents: number;
  totalCents: number;
  gstin: string;
  items: Array<{ name: string; quantity: number; unitPriceCents: number; totalCents: number }>;
}

// ----------------------------------------------------------------------------
// Next 20 States Data Models
// ----------------------------------------------------------------------------

export interface GRNRecord {
  id: string;
  outletId: string;
  supplierName: string;
  invoiceRef: string;
  items: Array<{ itemId: string; quantityAdded: number; costCents: number }>;
  receivedBy: string;
  receivedAt: string;
}

export interface RecipeCosting {
  menuItemId: string;
  name: string;
  sellingPriceCents: number;
  ingredientCostCents: number;
  grossMarginCents: number;
  grossMarginPercent: number;
  foodCostPercent: number;
}

export interface WalkoutRiskTable {
  tableId: string;
  tableNumber: string;
  orderId: string;
  seatedMinutes: number;
  unpaidTotalCents: number;
  riskLevel: 'MEDIUM' | 'HIGH';
}

export interface UPIIntentResponse {
  orderId: string;
  upiUri: string;
  amountINR: string;
  payeeVpa: string;
  payeeName: string;
  transactionNote: string;
}

export interface SmartTipSuggestion {
  orderId: string;
  subtotalCents: number;
  tiers: Array<{ label: string; percent: number; amountCents: number; isDefault: boolean }>;
}

// ----------------------------------------------------------------------------
// Batch 3 (Next 20 Missing States) Data Models
// ----------------------------------------------------------------------------

export interface NutritionInfo {
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams?: number;
}

export interface CloneMenuResult {
  sourceOutletId: string;
  targetOutletId: string;
  categoriesCloned: number;
  itemsCloned: number;
  timestamp: string;
}

export interface CategorySortInput {
  id: string;
  sortOrder: number;
}

export interface BulkPriceUpdateInput {
  categoryId?: string;
  percentageDelta?: number;
  fixedDeltaCents?: number;
}

export interface BulkPriceUpdateResult {
  outletId: string;
  itemsUpdated: number;
  updatedItemIds: string[];
}

export interface ItemSplitAssignment {
  guestName: string;
  itemIds: string[];
  allocatedSubtotalCents: number;
  allocatedTaxCents: number;
  allocatedTotalCents: number;
}

export interface BillSplitByItemResult {
  orderId: string;
  splits: ItemSplitAssignment[];
  unallocatedItemCount: number;
}

export interface PartialPaymentRecord {
  id: string;
  orderId: string;
  guestName: string;
  amountCents: number;
  method: PaymentMethod;
  paidAt: string;
  remainingBalanceCents: number;
}

export interface CashVsDigitalBreakdown {
  outletId: string;
  shiftId?: string;
  totalSalesCents: number;
  cashTotalCents: number;
  cashCount: number;
  digitalTotalCents: number;
  digitalCount: number;
  upiTotalCents: number;
  cardTotalCents: number;
  otherTotalCents: number;
}

export interface IngredientStockItem {
  id: string;
  outletId: string;
  name: string;
  currentQuantity: number;
  unit: string;
  minParLevel: number;
  costPerUnitCents: number;
}

export interface BOMRecipe {
  menuItemId: string;
  ingredients: Array<{ ingredientId: string; name: string; quantityNeeded: number; unit: string }>;
}

export interface PurchaseOrderDraft {
  id: string;
  outletId: string;
  generatedAt: string;
  items: Array<{
    ingredientId: string;
    name: string;
    currentStock: number;
    parLevel: number;
    orderQuantity: number;
    estimatedCostCents: number;
  }>;
  totalEstimatedCostCents: number;
  status: 'DRAFT' | 'APPROVED' | 'SENT';
}

export interface WasteCostSummary {
  outletId: string;
  totalWasteCostCents: number;
  wasteCount: number;
  wasteByReason: Record<string, number>;
  topWastedItems: Array<{ itemId: string; reason: string; totalCostCents: number; quantity: number }>;
}

export interface InventoryBatchLot {
  id: string;
  outletId: string;
  ingredientId: string;
  name: string;
  quantity: number;
  expiryDate: string;
  receivedDate: string;
  isExpired: boolean;
  daysRemaining: number;
}

export interface ParLevelAlert {
  ingredientId: string;
  name: string;
  currentQuantity: number;
  minParLevel: number;
  deficit: number;
  unit: string;
  severity: 'WARNING' | 'CRITICAL';
}

export interface InventoryValuation {
  outletId: string;
  asOfDate: string;
  totalItems: number;
  totalValueCents: number;
  items: Array<{
    ingredientId: string;
    name: string;
    quantity: number;
    unitCostCents: number;
    totalValueCents: number;
  }>;
}

export interface StationRoutingResult {
  orderId: string;
  stations: Record<string, Array<{ itemId: string; name: string; quantity: number; notes?: string }>>;
}

export interface PickupNotificationResult {
  orderId: string;
  customerPhone?: string;
  channel: 'WHATSAPP' | 'SMS' | 'IN_APP';
  message: string;
  dispatchedAt: string;
  status: 'SENT' | 'DELIVERED';
}

export interface ShiftTicketTimeAnalytics {
  outletId: string;
  shiftDate: string;
  totalCompletedTickets: number;
  averagePrepMinutes: number;
  averageWaitMinutes: number;
  slowestTicketMinutes: number;
  fastestTicketMinutes: number;
}

export interface WrongItemDispute {
  id: string;
  orderId: string;
  itemId: string;
  photoUrl: string;
  reason: string;
  status: 'PENDING' | 'REPLACEMENT_FIRED' | 'REFUNDED' | 'REJECTED';
  replacementTicketId?: string;
  createdAt: string;
}

export interface LoyaltyStampCard {
  phoneHash: string;
  outletId: string;
  totalStamps: number;
  currentCycleStamps: number;
  stampsNeededForReward: number;
  rewardsEarned: number;
  rewardVoucherCode?: string;
  lastStampedAt: string;
}

export interface ShiftHandoverNote {
  id: string;
  outletId: string;
  authorId: string;
  authorName: string;
  shiftType: 'MORNING' | 'EVENING' | 'NIGHT';
  note: string;
  createdAt: string;
  cashDiscrepancyNotes?: string;
  urgentIssues?: string;
}

export interface ServiceChargeConfig {
  outletId: string;
  dineInPercent: number;
  qrTakeawayPercent: number;
  enabled: boolean;
}

// ----------------------------------------------------------------------------
// Completed Partial Features (Batch 4) Data Models
// ----------------------------------------------------------------------------

export interface RoomFolioChargeResult {
  chargeId: string;
  outletId: string;
  roomNumber: string;
  guestLastName: string;
  amountCents: number;
  orderId: string;
  status: 'POSTED_TO_FOLIO' | 'FAILED';
  pmsConfirmationCode: string;
  postedAt: string;
}

export interface DailyPrepItemForecast {
  menuItemId: string;
  name: string;
  station: KitchenStation;
  projectedOrders: number;
  recommendedPrepUnits: number;
  unit: string;
  prepBatchSize: string;
}

export interface DailyPrepForecastReport {
  outletId: string;
  targetDate: string;
  generatedAt: string;
  items: DailyPrepItemForecast[];
}

export type TicketRailStatus = 'QUEUED' | 'IN_PREP' | 'EXPEDITED' | 'DISPATCHED';

export interface TicketRailTicket {
  orderId: string;
  tableNumber: string;
  railStatus: TicketRailStatus;
  itemsCount: number;
  elapsedMinutes: number;
  updatedAt: string;
}

export interface TranslatedMenuResponse {
  outletId: string;
  detectedLocale: string;
  categories: Array<{ id: string; name: string }>;
  items: Array<{ id: string; name: string; description: string; basePriceCents: number }>;
}

export interface GuestRatingRecoveryAlert {
  id: string;
  orderId: string;
  outletId: string;
  rating: number;
  comment?: string;
  isFlaggedForManager: boolean;
  smsAlertSent: boolean;
  createdAt: string;
}

export interface DigitalBillSummary {
  tableId: string;
  tableNumber: string;
  outletId: string;
  orders: Order[];
  subtotalCents: number;
  taxCents: number;
  serviceChargeCents: number;
  totalDueCents: number;
  isReadyForPayment: boolean;
  generatedAt: string;
}

export interface SessionSplitResult {
  tableId: string;
  splitType: 'EQUAL' | 'BY_HEAD';
  partySize: number;
  totalCents: number;
  amountPerGuestCents: number;
  breakdown: Array<{ guestIndex: number; amountCents: number }>;
}

export interface HourlyRevenueHeatmap {
  outletId: string;
  dayOfWeek: number;
  hourlyData: Array<{ hour: number; revenueCents: number; orderCount: number; intensity: 'LOW' | 'MEDIUM' | 'HIGH' | 'PEAK' }>;
  peakHour: number;
  totalDayRevenueCents: number;
}

export type RbacRole = 'GUEST' | 'WAITER' | 'CHEF' | 'MANAGER' | 'OWNER';

export interface RbacCheckResult {
  role: RbacRole;
  permission: string;
  allowed: boolean;
}

export interface TipPoolDistribution {
  id: string;
  outletId: string;
  shiftId: string;
  totalTipPoolCents: number;
  eligibleStaffCount: number;
  tipPerStaffCents: number;
  staffAllocations: Array<{ staffId: string; amountCents: number }>;
  distributedAt: string;
}

export interface POSSyncResult {
  orderId: string;
  posType: 'LIGHTSPEED' | 'POSTER' | 'DOTYKACKA';
  externalOrderId: string;
  status: 'SYNCED' | 'REJECTED';
  syncedAt: string;
}

export interface PMSSyncResult {
  folioId: string;
  pmsType: 'OPERA' | 'MEWS';
  roomNumber: string;
  guestName: string;
  amountCents: number;
  pmsTransactionId: string;
  status: 'POSTED';
  syncedAt: string;
}

export interface WhiteLabelBrandConfig {
  outletId: string;
  brandName: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string;
  customCss?: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// Final 19 Features & Quantum/AI Engine Data Models
// ----------------------------------------------------------------------------

export interface AIPhotoEnhanceResult {
  originalUrl: string;
  enhancedImageUrl: string;
  adjustments: {
    contrast: number;
    brightness: number;
    saturation: number;
    backgroundCleanup: boolean;
  };
  aiModel: string;
  confidenceScore: number;
}

export interface SupplierPriceComparison {
  ingredientId: string;
  name: string;
  quotations: Array<{
    supplierName: string;
    pricePerUnitCents: number;
    leadTimeDays: number;
    isCheapest: boolean;
  }>;
}

export interface SupplierInvoiceApproval {
  invoiceId: string;
  outletId: string;
  supplierName: string;
  amountCents: number;
  invoicePhotoUrl: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedAt?: string;
}

export interface WhatsAppReceiptAndReorder {
  orderId: string;
  customerPhone: string;
  receiptUrl: string;
  oneClickReorderToken: string;
  reorderUri: string;
  sentAt: string;
}

export interface TakeawayPreOrder {
  preOrderId: string;
  outletId: string;
  customerName: string;
  customerPhone: string;
  items: Array<{ itemId: string; name: string; quantity: number; unitPriceCents: number }>;
  scheduledPickupTime: string;
  prepLeadMinutes: number;
  status: 'SCHEDULED' | 'READY' | 'PICKED_UP';
  token?: string;
  pickupToken?: string;
  createdAt: string;
}

export interface TableAovAnalytics {
  outletId: string;
  averageAovCents: number;
  tableAovMap: Record<string, { tableNumber: string; orderCount: number; totalSalesCents: number; aovCents: number }>;
}

export interface UpsellAcceptanceRate {
  outletId: string;
  impressionsCount: number;
  acceptedCount: number;
  acceptanceRatePercent: number;
  totalUpsellRevenueCents: number;
}

export interface QrAdoptionRate {
  outletId: string;
  qrOrdersCount: number;
  posCounterOrdersCount: number;
  totalOrders: number;
  qrAdoptionRatePercent: number;
}

export interface MarginRankingResult {
  outletId: string;
  top5ByMargin: Array<{ menuItemId: string; name: string; grossMarginPercent: number; grossMarginCents: number }>;
  bottom5ByMargin: Array<{ menuItemId: string; name: string; grossMarginPercent: number; grossMarginCents: number }>;
}

export interface MenuEngineeringBCGMatrix {
  outletId: string;
  stars: string[];
  plowhorses: string[];
  puzzles: string[];
  dogs: string[];
  classificationMap: Record<
    string,
    { name: string; category: 'STAR' | 'PLOWHORSE' | 'PUZZLE' | 'DOG'; popularityIndex: number; marginIndex: number }
  >;
}

export interface MultiOutletBenchmark {
  tenantId: string;
  outlets: Array<{
    outletId: string;
    name: string;
    totalRevenueCents: number;
    totalOrders: number;
    averageTicketCents: number;
    rank: number;
  }>;
}

export interface PriceElasticityImpact {
  menuItemId: string;
  name: string;
  prePriceCents: number;
  postPriceCents: number;
  volumeChangePercent: number;
  priceChangePercent: number;
  elasticityCoefficient: number;
  elasticityType: 'ELASTIC' | 'INELASTIC' | 'UNITARY';
}

export interface AccountingJournalEntry {
  id: string;
  outletId: string;
  entryDate: string;
  debitAccount: string;
  creditAccount: string;
  amountCents: number;
  reference: string;
  syncFormat: 'QUICKBOOKS' | 'XERO' | 'TALLY';
}

export interface LiveLaborCostReport {
  outletId: string;
  currentLaborHours: number;
  hourlyLaborRateCents: number;
  totalLaborCostCents: number;
  currentRevenueCents: number;
  laborCostPercentage: number;
  isWithinTarget: boolean;
}

export interface KitchenSlaNudge {
  outletId: string;
  breachedOrderIds: string[];
  maxWaitMinutes: number;
  recipientStaffRoles: string[];
  message: string;
  dispatchedAt: string;
}

export interface StaffMealDiscount {
  id: string;
  outletId: string;
  staffId: string;
  staffName: string;
  originalAmountCents: number;
  discountedAmountCents: number;
  discountPercent: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  managerApprovedBy?: string;
  approvedAt?: string;
}

export interface PosTerminalLockState {
  outletId: string;
  terminalId: string;
  isLocked: boolean;
  lockedAt?: string;
  unlockedAt?: string;
  unlockedByPin?: string;
}

export interface GoogleBusinessProfileSync {
  outletId: string;
  gbpLocationId: string;
  syncedItemsCount: number;
  menuPayloadXml: string;
  lastSyncedAt: string;
  syncStatus: 'SUCCESS' | 'FAILED';
}

export interface AggregatorOrderInjection {
  externalOrderId: string;
  aggregator: 'UBEREATS' | 'DOORDASH' | 'GRUBHUB' | 'ZOMATO';
  internalOrderId: string;
  status: 'INJECTED_TO_KDS';
  autoConfirmed: boolean;
}

export interface QuantumSeatingPlan {
  outletId: string;
  partySize: number;
  assignedTableId: string;
  assignedTableNumber: string;
  quantumCostScore: number;
  algorithm: 'SIMULATED_QUANTUM_ANNEALING' | 'EIGEN_STATE_MINIMIZATION';
  optimizedAt: string;
}





