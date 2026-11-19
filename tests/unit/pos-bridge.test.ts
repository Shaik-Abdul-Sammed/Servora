import test from 'node:test';
import assert from 'node:assert/strict';
import { ThermalReceiptFormatter } from '../../apps/pos-bridge/src/printer.ts';
import type { Order } from '../../packages/shared-types/src/index.ts';

test('POS Bridge Thermal Receipt Formatting', async (t) => {
  const sampleOrder: Order = {
    id: 'ord_test_888',
    tenantId: 'a0000000-0000-0000-0000-000000000001',
    outletId: 'b0000000-0000-0000-0000-000000000001',
    tableId: 'c0000000-0000-0000-0000-000000000001',
    tableNumber: 'T-01',
    status: 'CONFIRMED',
    items: [
      {
        id: 'item_1',
        menuItemId: 'm_1',
        name: 'Truffle Burrata Pugliese',
        unitPriceCents: 1850,
        quantity: 2,
        selectedModifiers: [],
        itemTotalCents: 3700,
        notes: 'Extra virgin olive oil please',
      },
      {
        id: 'item_2',
        menuItemId: 'm_2',
        name: 'Diavola Piccante',
        unitPriceCents: 2250,
        quantity: 1,
        selectedModifiers: [
          {
            modifierGroupId: 'mod_1',
            modifierGroupName: 'Toppings',
            optionId: 'opt_1',
            optionName: 'Hot Honey (+)',
            priceDeltaCents: 150,
          },
        ],
        itemTotalCents: 2400,
      },
    ],
    subtotalCents: 6100,
    taxCents: 503,
    tipCents: 1000,
    totalCents: 7603,
    guestNotes: 'Sitting by the window',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await t.test('Produces valid ESC/POS byte sequence with cuts and headers', () => {
    const escPosBuffer = ThermalReceiptFormatter.toEscPos(sampleOrder, 'ABIRUCHI HOTEL');
    assert.ok(escPosBuffer.length > 50);

    // Verify ESC @ (init printer: 0x1b, 0x40)
    assert.equal(escPosBuffer[0], 0x1b);
    assert.equal(escPosBuffer[1], 0x40);

    // Verify paper cut at the end (GS V 66 0: 0x1d, 0x56, 0x42, 0x00)
    const len = escPosBuffer.length;
    assert.equal(escPosBuffer[len - 4], 0x1d);
    assert.equal(escPosBuffer[len - 3], 0x56);
    assert.equal(escPosBuffer[len - 2], 0x42);
    assert.equal(escPosBuffer[len - 1], 0x00);
  });

  await t.test('Generates clear ASCII receipt for order dispatch', () => {
    const ascii = ThermalReceiptFormatter.toAsciiReceipt(sampleOrder);
    assert.match(ascii, /TABLE: T-01/);
    assert.match(ascii, /2   Truffle Burrata Pugliese/);
    assert.match(ascii, /Hot Honey/);
    assert.match(ascii, /Total:\s+\$76\.03/);
    assert.match(ascii, /Sitting by the window/);
  });
});
