import type { SplitBillPart, SplitBillState, SplitBillType } from '../../shared-types/src/index.ts';

/**
 * Formats monetary amounts in cents/smallest currency unit into human-readable strings.
 */
export function formatCurrency(
  amountCents: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amountCents / 100);
}

/**
 * Calculates subtotal, tax, service charge, and total from order items in integer cents.
 */
export function calculateOrderTotals(
  items: Array<{ unitPriceCents: number; quantity: number; selectedModifiers?: Array<{ priceDeltaCents: number }> }>,
  taxRatePercent: number = 8.25,
  tipCents: number = 0,
  serviceChargePercent: number = 0,
  trayChargeCents: number = 0
): {
  subtotalCents: number;
  taxCents: number;
  serviceChargeCents: number;
  tipCents: number;
  totalCents: number;
} {
  let subtotalCents = 0;

  for (const item of items) {
    let itemPrice = item.unitPriceCents;
    if (item.selectedModifiers) {
      for (const mod of item.selectedModifiers) {
        itemPrice += mod.priceDeltaCents;
      }
    }
    subtotalCents += itemPrice * item.quantity;
  }

  const taxCents = Math.round(subtotalCents * (taxRatePercent / 100));
  const serviceChargeCents = Math.round(subtotalCents * (serviceChargePercent / 100)) + trayChargeCents;
  const totalCents = subtotalCents + taxCents + serviceChargeCents + tipCents;

  return {
    subtotalCents,
    taxCents,
    serviceChargeCents,
    tipCents,
    totalCents,
  };
}

/**
 * International Bill Splitting Engine: Splits order equally across N guests.
 * Accurately balances single-cent rounding discrepancies on the last guest.
 */
export function splitBillEqually(totalCents: number, guestCount: number): SplitBillState {
  if (guestCount <= 1) {
    return {
      billType: 'EQUAL_PARTS',
      totalCents,
      paidCents: 0,
      remainingCents: totalCents,
      parts: [
        {
          id: 'split_1',
          label: 'Full Bill',
          amountCents: totalCents,
          isPaid: false,
        },
      ],
    };
  }

  const baseAmount = Math.floor(totalCents / guestCount);
  const remainder = totalCents % guestCount;
  const parts: SplitBillPart[] = [];

  for (let i = 1; i <= guestCount; i++) {
    // Add 1 cent to early parts until remainder is exhausted
    const amountCents = baseAmount + (i <= remainder ? 1 : 0);
    parts.push({
      id: `split_guest_${i}`,
      label: `Guest ${i} (${formatCurrency(amountCents)})`,
      amountCents,
      isPaid: false,
    });
  }

  return {
    billType: 'EQUAL_PARTS',
    totalCents,
    paidCents: 0,
    remainingCents: totalCents,
    parts,
  };
}

/**
 * International Bill Splitting Engine: Splits order by selected individual dishes.
 */
export function splitBillByItems(
  totalCents: number,
  taxRatePercent: number,
  assignments: Array<{ guestLabel: string; itemIds: string[]; itemTotalCents: number }>
): SplitBillState {
  const parts: SplitBillPart[] = [];
  let allocatedSubtotal = 0;

  for (let i = 0; i < assignments.length; i++) {
    const a = assignments[i];
    // Proportionate tax
    const taxShare = Math.round(a.itemTotalCents * (taxRatePercent / 100));
    const amountCents = a.itemTotalCents + taxShare;
    allocatedSubtotal += amountCents;

    parts.push({
      id: `split_item_${i + 1}`,
      label: a.guestLabel,
      itemIds: a.itemIds,
      amountCents,
      isPaid: false,
    });
  }

  return {
    billType: 'BY_ITEMS',
    totalCents,
    paidCents: 0,
    remainingCents: totalCents,
    parts,
  };
}
