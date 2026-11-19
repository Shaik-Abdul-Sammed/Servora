import type { Order } from '../../../packages/shared-types/src/index.ts';
import { formatCurrency } from '../../../packages/utils/src/index.ts';

export class ThermalReceiptFormatter {
  /**
   * Formats a dining order into an ESC/POS binary buffer for thermal printers.
   */
  public static toEscPos(order: Order, venueName: string = 'ABIRUCHI HOTEL'): Buffer {
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
  public static toAsciiReceipt(order: Order, venueName: string = 'ABIRUCHI HOTEL'): string {
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

  /**
   * Generates standard ESC/POS pulse command to kick open the physical cash drawer.
   * Command: ESC p m t1 t2 (0x1B 0x70 0x00 0x19 0xFA)
   */
  public static kickCashDrawer(): Buffer {
    return Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]);
  }

  /**
   * Generates standard ESC/POS sound buzzer alert to notify line cooks of a rush ticket.
   * Command: ESC B n t (0x1B 0x42 0x03 0x02)
   */
  public static soundBuzzer(): Buffer {
    return Buffer.from([0x1b, 0x42, 0x03, 0x02]);
  }

  /**
   * Formats a station-specific order ticket (e.g. Bar station only receives beverage items).
   */
  public static toStationEscPos(order: Order, targetStation: string, venueName: string = 'ABIRUCHI HOTEL'): Buffer {
    const stationItems = order.items.filter((i) => (i.station || 'KITCHEN') === targetStation);
    const filteredOrder: Order = {
      ...order,
      items: stationItems.length ? stationItems : order.items,
    };
    return this.toEscPos(filteredOrder, `${venueName} [${targetStation.toUpperCase()}]`);
  }

  /**
   * Streams raw ESC/POS binary buffer directly to a physical network thermal printer on TCP port 9100.
   */
  public static async printToNetwork(host: string, port = 9100, buffer: Buffer): Promise<boolean> {
    const { Socket } = await import('node:net');
    return new Promise((resolve) => {
      const client = new Socket();
      client.setTimeout(3000);
      client.connect(port, host, () => {
        client.write(buffer, () => {
          client.end();
          resolve(true);
        });
      });
      client.on('error', (err) => {
        console.warn(`[POS Bridge] Direct TCP print error to ${host}:${port}:`, err.message);
        resolve(false);
      });
      client.on('timeout', () => {
        client.destroy();
        resolve(false);
      });
    });
  }
}
