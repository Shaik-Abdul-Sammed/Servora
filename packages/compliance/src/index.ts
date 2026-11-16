/**
 * Servora Privacy, GDPR, DPDP & PCI-DSS SAQ-A Compliance Utilities
 */

export function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const [local, domain] = parts;
  if (!local || !domain) return '***';
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  const lastFour = digits.slice(-4);
  return `***-***-${lastFour}`;
}

export function maskCardNumber(cardNumber: string): string {
  const clean = cardNumber.replace(/\D/g, '');
  if (clean.length < 4) return '•••• •••• •••• ••••';
  const lastFour = clean.slice(-4);
  return `•••• •••• •••• ${lastFour}`;
}

export interface GuestDataRecord {
  guestId: string;
  name?: string;
  email?: string;
  phone?: string;
  ipAddress?: string;
  orderIds: string[];
}

export function executeDSARDataErasure(record: GuestDataRecord): GuestDataRecord {
  return {
    guestId: record.guestId,
    name: '[ANONYMIZED_GDPR]',
    email: undefined,
    phone: undefined,
    ipAddress: undefined,
    orderIds: record.orderIds, // Transaction ledger retained for accounting/tax compliance
  };
}
