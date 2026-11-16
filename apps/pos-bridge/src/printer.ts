import type { Order } from '../../../packages/shared-types/src/index.ts';
import { formatCurrency } from '../../../packages/utils/src/index.ts';

export class ThermalReceiptFormatter {
  /**
   * Formats a dining order into an ESC/POS binary buffer for thermal printers.
   */
  public static toEscPos(order: Order, venueName: string = 'TRATTORIA SERVORA'): Buffer {
    const ESC = 0x1b;
    const GS = 0x1d;

    const parts: Buffer[] = [];

    // Initialize printer
    parts.push(Buffer.from([ESC, 0x40]));

    // Center alignment
    parts.push(Buffer.from([ESC, 0x61, 0x01]));

    // Double-height & double-width text for header
    parts.push(Buffer.from([GS, 0x21, 0x11]));
    parts.push(Buffer.from(`${venueName}\n`, 'utf-8'));

    // Normal text
    parts.push(Buffer.from([GS, 0x21, 0x00]));
    parts.push(Buffer.from(`KITCHEN ORDER DISPATCH\n`, 'utf-8'));
    parts.push(Buffer.from(`Order: ${order.id}\n`, 'utf-8'));
    parts.push(Buffer.from(`Time: ${new Date(order.createdAt).toLocaleTimeString()}\n\n`, 'utf-8'));

    // Big Table Number
    parts.push(Buffer.from([GS, 0x21, 0x22])); // 2x size
    parts.push(Buffer.from(`TABLE ${order.tableNumber}\n\n`, 'utf-8'));

    // Left alignment
    parts.push(Buffer.from([GS, 0x21, 0x00]));
    parts.push(Buffer.from([ESC, 0x61, 0x00]));
    parts.push(Buffer.from('------------------------------------------------\n', 'utf-8'));

    // Items
    for (const item of order.items) {
      parts.push(Buffer.from(`${item.quantity}x  ${item.name}\n`, 'utf-8'));
      if (item.selectedModifiers && item.selectedModifiers.length > 0) {
        for (const mod of item.selectedModifiers) {
          parts.push(Buffer.from(`    * ${mod.optionName}\n`, 'utf-8'));
        }
      }
      if (item.notes) {
        parts.push(Buffer.from(`    [NOTE: ${item.notes}]\n`, 'utf-8'));
      }
    }

    parts.push(Buffer.from('------------------------------------------------\n', 'utf-8'));

    if (order.guestNotes) {
      parts.push(Buffer.from(`GUEST NOTE: ${order.guestNotes}\n`, 'utf-8'));
      parts.push(Buffer.from('------------------------------------------------\n', 'utf-8'));
    }

    // Totals
    parts.push(Buffer.from(`Subtotal: ${formatCurrency(order.subtotalCents)}\n`, 'utf-8'));
    parts.push(Buffer.from(`Tax:      ${formatCurrency(order.taxCents)}\n`, 'utf-8'));
    parts.push(Buffer.from(`Gratuity: ${formatCurrency(order.tipCents)}\n`, 'utf-8'));
    parts.push(Buffer.from(`Total:    ${formatCurrency(order.totalCents)}\n\n`, 'utf-8'));

    // Feed and cut paper (GS V 66 0)
    parts.push(Buffer.from([GS, 0x56, 0x42, 0x00]));

    return Buffer.concat(parts);
  }

  /**
   * Formats receipt as human-readable ASCII text for terminals / preview.
   */
  public static toAsciiReceipt(order: Order, venueName: string = 'TRATTORIA SERVORA'): string {
    const line = '='.repeat(44);
    const subLine = '-'.repeat(44);

    let receipt = `\n${line}\n`;
    receipt += `          ${venueName}\n`;
    receipt += `        KITCHEN ORDER DISPATCH\n`;
    receipt += `   Order ID: ${order.id}\n`;
    receipt += `   Time:     ${new Date(order.createdAt).toLocaleTimeString()}\n`;
    receipt += `${subLine}\n`;
    receipt += `   >>> TABLE: ${order.tableNumber} (DINE-IN) <<<\n`;
    receipt += `${subLine}\n`;

    for (const item of order.items) {
      receipt += ` ${String(item.quantity).padEnd(3)} ${item.name}\n`;
      if (item.selectedModifiers && item.selectedModifiers.length > 0) {
        for (const mod of item.selectedModifiers) {
          receipt += `     * ${mod.optionName} (${formatCurrency(mod.priceDeltaCents)})\n`;
        }
      }
      if (item.notes) {
        receipt += `     [Note: ${item.notes}]\n`;
      }
    }

    receipt += `${subLine}\n`;
    if (order.guestNotes) {
      receipt += ` Special Request: "${order.guestNotes}"\n`;
      receipt += `${subLine}\n`;
    }

    receipt += ` Subtotal: ${formatCurrency(order.subtotalCents).padStart(33)}\n`;
    receipt += ` Tax:      ${formatCurrency(order.taxCents).padStart(33)}\n`;
    receipt += ` Gratuity: ${formatCurrency(order.tipCents).padStart(33)}\n`;
    receipt += ` Total:    ${formatCurrency(order.totalCents).padStart(33)}\n`;
    receipt += `${line}\n[CUT PAPER]\n`;

    return receipt;
  }
}
