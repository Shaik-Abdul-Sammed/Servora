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
 * Calculates subtotal, tax, and total from order items in integer cents.
 */
export function calculateOrderTotals(
  items: Array<{ unitPriceCents: number; quantity: number; selectedModifiers?: Array<{ priceDeltaCents: number }> }>,
  taxRatePercent: number = 8.25,
  tipCents: number = 0
): { subtotalCents: number; taxCents: number; tipCents: number; totalCents: number } {
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
  const totalCents = subtotalCents + taxCents + tipCents;

  return {
    subtotalCents,
    taxCents,
    tipCents,
    totalCents,
  };
}
