import type { PaymentRecord, PaymentVerificationStatus } from '../../../../packages/shared-types/src/index.ts';
import { auditService } from '../../../audit-service/src/audit-service.ts';

export class PaymentVerificationService {
  private payments = new Map<string, PaymentRecord>();

  constructor() {}

  public createPaymentRecord(
    outletId: string,
    orderId: string,
    amountCents: number,
    method: 'CASH' | 'CARD' | 'ROOM_CHARGE' | 'UPI'
  ): PaymentRecord {
    const id = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const record: PaymentRecord = {
      id,
      outletId,
      orderId,
      amountCents,
      method,
      status: 'UNVERIFIED',
      createdAt: now,
      updatedAt: now,
    };

    this.payments.set(id, record);

    auditService.log({
      feature: 'C3_PAYMENT',
      action: 'PAYMENT_SUBMITTED',
      actor: 'guest',
      outletId,
      details: { paymentId: id, orderId, amountCents, method, status: 'UNVERIFIED' },
    });

    return record;
  }

  public verifyPayment(
    paymentId: string,
    verifiedBy: string = 'manager_sarah',
    notes?: string
  ): PaymentRecord {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Payment record with id ${paymentId} not found`);
    }

    payment.status = 'VERIFIED';
    payment.verifiedBy = verifiedBy;
    payment.verifiedAt = new Date().toISOString();
    payment.notes = notes;
    payment.updatedAt = payment.verifiedAt;

    auditService.log({
      feature: 'C3_PAYMENT',
      action: 'PAYMENT_VERIFIED',
      actor: verifiedBy,
      outletId: payment.outletId,
      details: { paymentId, orderId: payment.orderId, amountCents: payment.amountCents, verifiedAt: payment.verifiedAt },
    });

    return payment;
  }

  public getUnverifiedPayments(outletId: string): (PaymentRecord & { flagOverdue: boolean })[] {
    const now = Date.now();
    const SLA_MS = 10 * 60 * 1000; // 10 minutes overdue threshold

    return Array.from(this.payments.values())
      .filter((p) => p.outletId === outletId && p.status === 'UNVERIFIED')
      .map((p) => ({
        ...p,
        flagOverdue: now - new Date(p.createdAt).getTime() > SLA_MS,
      }));
  }

  public getAllPayments(outletId: string): PaymentRecord[] {
    return Array.from(this.payments.values())
      .filter((p) => p.outletId === outletId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export const paymentVerificationService = new PaymentVerificationService();
