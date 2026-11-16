import { randomUUID } from 'node:crypto';

export interface DatabaseOfferCoupon {
  code: string;
  tenantId: string;
  guestPhone: string;
  offerType: 'FIRST_VISIT' | 'LOYALTY_TIER' | 'WIN_BACK' | 'CUSTOM';
  title: string;
  description: string;
  discountType: 'PERCENT' | 'FIXED_CENTS';
  discountValue: number; // e.g. 10 for 10%, or 500 for $5.00
  minimumOrderCents: number;
  isRedeemed: boolean;
  redeemedAtOrder?: string;
  expiresAtMs: number;
  createdAtMs: number;
}

export interface GuestVisitTelemetry {
  guestPhone: string;
  name?: string;
  visitCount: number;
  lastVisitAtMs: number;
}

export class ContextualOfferEngine {
  // Coupon code -> coupon record
  private coupons = new Map<string, DatabaseOfferCoupon>();

  /**
   * Evaluates guest visit history upon QR scan and issues a single-use time-boxed coupon.
   */
  public evaluateAndIssueOffer(params: {
    tenantId: string;
    guestPhone: string;
    visitHistory?: GuestVisitTelemetry;
  }): DatabaseOfferCoupon {
    const now = Date.now();
    const guest = params.visitHistory;

    // Check if guest already has an active, unredeemed coupon
    for (const c of this.coupons.values()) {
      if (
        c.tenantId === params.tenantId &&
        c.guestPhone === params.guestPhone &&
        !c.isRedeemed &&
        c.expiresAtMs > now
      ) {
        return c; // Return existing active single-use coupon
      }
    }

    let offerType: DatabaseOfferCoupon['offerType'] = 'FIRST_VISIT';
    let title = 'Welcome Dessert Gift';
    let description = '10% off your artisanal dessert on your first visit';
    let discountType: DatabaseOfferCoupon['discountType'] = 'PERCENT';
    let discountValue = 10; // 10%
    let ttlHours = 24;

    if (guest) {
      const daysSinceVisit = (now - guest.lastVisitAtMs) / (1000 * 60 * 60 * 24);

      if (daysSinceVisit >= 14) {
        // Inactive 14+ days -> Win-back coupon
        offerType = 'WIN_BACK';
        title = 'We Miss You! ₹100 / $10 Welcome Back Gift';
        description = 'Enjoy ₹100 / $10 off your meal today';
        discountType = 'FIXED_CENTS';
        discountValue = 1000; // $10.00 / ₹100.00 in cents
        ttlHours = 72; // Valid for 3 days
      } else if (guest.visitCount >= 3) {
        // 3+ visits -> Loyalty tier
        offerType = 'LOYALTY_TIER';
        title = 'Loyalty Patron: Complimentary Beverage';
        description = '$5.00 / ₹50 off any beverage or cocktail';
        discountType = 'FIXED_CENTS';
        discountValue = 500;
        ttlHours = 48;
      }
    }

    const uniqueSuffix = randomUUID().slice(0, 4).toUpperCase();
    const code = `${offerType.slice(0, 4)}_${uniqueSuffix}`;

    const coupon: DatabaseOfferCoupon = {
      code,
      tenantId: params.tenantId,
      guestPhone: params.guestPhone,
      offerType,
      title,
      description,
      discountType,
      discountValue,
      minimumOrderCents: 1500, // $15 minimum order
      isRedeemed: false,
      expiresAtMs: now + 1000 * 60 * 60 * ttlHours,
      createdAtMs: now,
    };

    this.coupons.set(code, coupon);
    return coupon;
  }

  /**
   * Validates and applies a coupon code against an order total.
   */
  public validateCoupon(
    code: string,
    tenantId: string,
    orderSubtotalCents: number
  ): { isValid: boolean; discountCents: number; error?: string; coupon?: DatabaseOfferCoupon } {
    const coupon = this.coupons.get(code.toUpperCase());
    if (!coupon) {
      return { isValid: false, discountCents: 0, error: 'INVALID_COUPON_CODE' };
    }

    if (coupon.tenantId !== tenantId) {
      return { isValid: false, discountCents: 0, error: 'COUPON_NOT_VALID_FOR_TENANT' };
    }

    if (coupon.isRedeemed) {
      return { isValid: false, discountCents: 0, error: 'COUPON_ALREADY_REDEEMED' };
    }

    if (Date.now() > coupon.expiresAtMs) {
      return { isValid: false, discountCents: 0, error: 'COUPON_EXPIRED' };
    }

    if (orderSubtotalCents < coupon.minimumOrderCents) {
      return {
        isValid: false,
        discountCents: 0,
        error: `MINIMUM_ORDER_NOT_MET: Minimum order is $${(coupon.minimumOrderCents / 100).toFixed(2)}`,
      };
    }

    let discountCents = 0;
    if (coupon.discountType === 'PERCENT') {
      discountCents = Math.round(orderSubtotalCents * (coupon.discountValue / 100));
    } else {
      discountCents = coupon.discountValue;
    }

    // Discount cannot exceed subtotal
    discountCents = Math.min(discountCents, orderSubtotalCents);

    return { isValid: true, discountCents, coupon };
  }

  /**
   * Atomically marks coupon as redeemed when order is finalized.
   */
  public redeemCoupon(code: string, orderId: string): boolean {
    const coupon = this.coupons.get(code.toUpperCase());
    if (!coupon || coupon.isRedeemed) return false;
    coupon.isRedeemed = true;
    coupon.redeemedAtOrder = orderId;
    return true;
  }
}
