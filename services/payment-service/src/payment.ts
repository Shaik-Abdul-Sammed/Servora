import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { PaymentIntent, PaymentStatus } from '../../../packages/shared-types/src/index.ts';

export class PaymentService {
  private webhookSecret: string;
  private paymentIntents = new Map<string, PaymentIntent>();

  constructor(webhookSecret: string = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_demo_secret_32_bytes') {
    this.webhookSecret = webhookSecret;
  }

  /**
   * Creates a PCI-DSS SAQ-A compliant tokenized payment intent.
   * Client card details NEVER touch Servora application servers.
   */
  public createPaymentIntent(params: {
    tenantId: string;
    orderId: string;
    amountCents: number;
    currency?: string;
  }): PaymentIntent {
    if (params.amountCents <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    const intentId = `pi_${Date.now()}_${randomBytes(8).toString('hex')}`;
    const clientSecret = `${intentId}_secret_${randomBytes(12).toString('hex')}`;

    const intent: PaymentIntent = {
      id: intentId,
      tenantId: params.tenantId,
      orderId: params.orderId,
      amountCents: params.amountCents,
      currency: params.currency || 'USD',
      status: 'REQUIRES_PAYMENT_METHOD',
      paymentMethodType: 'CARD',
      clientSecret,
      createdAt: new Date().toISOString(),
    };

    this.paymentIntents.set(intentId, intent);
    return intent;
  }

  /**
   * Verifies incoming gateway webhook signature (Stripe/Razorpay standard).
   */
  public verifyWebhook(payloadRaw: string, signatureHeader: string, toleranceSeconds: number = 300): boolean {
    const parts = signatureHeader.split(',');
    let timestamp = '';
    let expectedSig = '';

    for (const part of parts) {
      const [key, val] = part.trim().split('=');
      if (key === 't') timestamp = val ?? '';
      if (key === 'v1') expectedSig = val ?? '';
    }

    if (!timestamp || !expectedSig) return false;

    // Replay attack prevention
    const now = Math.floor(Date.now() / 1000);
    const ts = parseInt(timestamp, 10);
    if (Math.abs(now - ts) > toleranceSeconds) {
      return false; // Signature expired
    }

    const computedSig = createHmac('sha256', this.webhookSecret)
      .update(`${timestamp}.${payloadRaw}`)
      .digest('hex');

    const compBuf = Buffer.from(computedSig, 'hex');
    const expBuf = Buffer.from(expectedSig, 'hex');

    return compBuf.length === expBuf.length && timingSafeEqual(compBuf, expBuf);
  }

  /**
   * Transition payment status on settlement webhook.
   */
  public markSucceeded(intentId: string): PaymentIntent | null {
    const intent = this.paymentIntents.get(intentId);
    if (!intent) return null;
    intent.status = 'SUCCEEDED';
    return intent;
  }
}
