import test from 'node:test';
import assert from 'node:assert/strict';
import {
  maskEmail,
  maskPhone,
  maskCardNumber,
  executeDSARDataErasure,
} from '../../packages/compliance/src/index.ts';

test('Compliance & Data Protection Sanitizers', async (t) => {
  await t.test('Masks email addresses appropriately', () => {
    assert.equal(maskEmail('guest@example.com'), 'g***t@example.com');
    assert.equal(maskEmail('alex@abiruchi.restaurant'), 'a***x@abiruchi.restaurant');
  });

  await t.test('Masks phone numbers to last 4 digits', () => {
    assert.equal(maskPhone('+1 (555) 234-5678'), '***-***-5678');
    assert.equal(maskPhone('9876543210'), '***-***-3210');
  });

  await t.test('Masks primary account numbers (PAN) for PCI-DSS', () => {
    assert.equal(maskCardNumber('4111 2222 3333 4444'), '•••• •••• •••• 4444');
    assert.equal(maskCardNumber('378282246310005'), '•••• •••• •••• 0005');
  });

  await t.test('Executes GDPR / DPDP right-to-be-forgotten data erasure', () => {
    const record = {
      guestId: 'gst_998',
      name: 'Johnathan Doe',
      email: 'johnathan.doe@example.com',
      phone: '+1 555-432-1098',
      ipAddress: '198.51.100.42',
      orderIds: ['ord_01', 'ord_02'],
    };

    const sanitized = executeDSARDataErasure(record);
    assert.equal(sanitized.guestId, 'gst_998');
    assert.equal(sanitized.name, '[ANONYMIZED_GDPR]');
    assert.equal(sanitized.email, undefined);
    assert.equal(sanitized.phone, undefined);
    assert.equal(sanitized.ipAddress, undefined);
    assert.deepEqual(sanitized.orderIds, ['ord_01', 'ord_02']);
  });
});
