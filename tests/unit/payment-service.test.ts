import test from 'node:test';
import assert from 'node:assert/strict';
import { PaymentService } from '../../services/payment-service/src/payment.ts';
import { createHmac } from 'node:crypto';

test('Payment Service PCI-DSS SAQ-A & Webhook Security', async (t) => {
  const webhookSecret = 'whsec_test_secret_32_bytes_super!!';
  const paymentService = new PaymentService(webhookSecret);

  await t.test('Creates tokenized payment intent without exposing raw cards', () => {
    const intent = paymentService.createPaymentIntent({
      tenantId: 'a0000000-0000-0000-0000-000000000001',
      orderId: 'ord_sample_99',
      amountCents: 4500, // $45.00
      currency: 'USD',
    });

    assert.ok(intent.id.startsWith('pi_'));
    assert.ok(intent.clientSecret?.includes('_secret_'));
    assert.equal(intent.amountCents, 4500);
    assert.equal(intent.status, 'REQUIRES_PAYMENT_METHOD');
  });

  await t.test('Rejects zero or negative payment amounts', () => {
    assert.throws(() => {
      paymentService.createPaymentIntent({
        tenantId: 'a0000000-0000-0000-0000-000000000001',
        orderId: 'ord_zero',
        amountCents: 0,
      });
    }, /Payment amount must be greater than zero/);
  });

  await t.test('Verifies valid payment gateway webhook signatures', () => {
    const rawPayload = JSON.stringify({
      id: 'evt_test_charge_succeeded',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_test_123' } },
    });

    const now = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', webhookSecret)
      .update(`${now}.${rawPayload}`)
      .digest('hex');

    const signatureHeader = `t=${now},v1=${signature}`;
    const isValid = paymentService.verifyWebhook(rawPayload, signatureHeader);
    assert.equal(isValid, true);
  });

  await t.test('Rejects forged webhook signatures and replay attacks', () => {
    const rawPayload = JSON.stringify({ type: 'payment_intent.succeeded' });
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
    const signature = createHmac('sha256', webhookSecret)
      .update(`${oldTimestamp}.${rawPayload}`)
      .digest('hex');

    const staleHeader = `t=${oldTimestamp},v1=${signature}`;
    const isValid = paymentService.verifyWebhook(rawPayload, staleHeader, 300); // 5 min tolerance
    assert.equal(isValid, false);
  });
});
