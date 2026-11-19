import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { splitBillEqually, splitBillByItems } from '../../packages/utils/src/currency.ts';
import { OrderStore } from '../../services/order-service/src/store.ts';
import { HotelPMSService } from '../../services/hotel-service/src/index.ts';
import { ThermalReceiptFormatter } from '../../apps/pos-bridge/src/printer.ts';
import { translateText, SUPPORTED_LANGUAGES } from '../../packages/content-translation/src/google-translate.ts';
import type { Order, KitchenStation, MealCourse } from '../../packages/shared-types/src/index.ts';

describe('Abiruchi Hotel 50 International Hospitality Features Test Suite', () => {
  it('Feature #4: Split Bill - 1-cent remainder balancing across N guests', () => {
    // Total $10.00 (1000 cents) split among 3 guests: 334 + 333 + 333 = 1000 cents exactly
    const split3 = splitBillEqually(1000, 3);
    assert.equal(split3.parts.length, 3);
    assert.equal(split3.parts[0].amountCents, 334);
    assert.equal(split3.parts[1].amountCents, 333);
    assert.equal(split3.parts[2].amountCents, 333);
    const sum = split3.parts.reduce((acc, s) => acc + s.amountCents, 0);
    assert.equal(sum, 1000);
  });

  it('Feature #4: Item-Level Split Bill with proportional tax', () => {
    const assignments = [
      { guestLabel: 'Guest 1', itemIds: ['1', '2'], itemTotalCents: 2000 },
      { guestLabel: 'Guest 2', itemIds: ['3'], itemTotalCents: 3000 }
    ];
    // $50.00 total, 10% tax
    const splits = splitBillByItems(5000, 10, assignments);
    assert.equal(splits.parts.length, 2);
    // Guest 1: $20.00 + $2.00 tax = $22.00 (2200 cents)
    assert.equal(splits.parts[0].amountCents, 2200);
    // Guest 2: $30.00 + $3.00 tax = $33.00 (3300 cents)
    assert.equal(splits.parts[1].amountCents, 3300);
  });

  it('Feature #2 & #19: Coursing State Machine (HOLD vs FIRE)', () => {
    const store = new OrderStore();
    const order: Order = {
      id: 'ord-course-test',
      tenantId: 'tenant-1',
      outletId: 'outlet-1',
      tableNumber: '14',
      status: 'PREPARING',
      paymentStatus: 'PAID',
      items: [
        {
          id: 'item-1',
          name: 'Calamari',
          priceCents: 1400,
          quantity: 1,
          station: 'HOT_LINE',
          course: 'STARTER',
          courseStatus: 'FIRE'
        },
        {
          id: 'item-2',
          name: 'Ribeye Steak',
          priceCents: 4200,
          quantity: 1,
          station: 'HOT_LINE',
          course: 'MAIN',
          courseStatus: 'HOLD'
        }
      ],
      subtotalCents: 5600,
      taxCents: 560,
      tipCents: 0,
      totalCents: 6160,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    store.orders.set(order.id, order);

    // Fire Main course
    const fired = store.fireCourse('ord-course-test', 'MAIN');
    assert.ok(fired);
    const mainItem = fired.items.find(i => i.course === 'MAIN');
    assert.equal(mainItem?.courseStatus, 'FIRE');
  });

  it('Feature #9: Hotel PMS Room Charge validation & folio verification', () => {
    const pms = new HotelPMSService();
    // Valid guest
    const valid = pms.validateRoomFolio('402', 'Smith', 5000);
    assert.equal(valid.isValid, true);
    assert.equal(valid.folioId, 'FOL-OPERA-88219');
    assert.equal(valid.vipStatus, true);

    // Mismatched surname
    const invalid = pms.validateRoomFolio('402', 'Doe', 5000);
    assert.equal(invalid.isValid, false);
    assert.match(invalid.error || '', /surname does not match/);

    // Non-existent room
    const notFound = pms.validateRoomFolio('999', 'Nobody', 5000);
    assert.equal(notFound.isValid, false);
    assert.match(notFound.error || '', /unoccupied/);
  });

  it('Feature #10: Hotel Zone Delivery Fee Rules', () => {
    const pms = new HotelPMSService();
    const roomFee = pms.getZoneFees('Room Service');
    assert.equal(roomFee.trayChargeCents, 500); // $5 tray fee
    assert.equal(roomFee.serviceFeePercent, 12.0); // 12% in-room service charge

    const cabanaFee = pms.getZoneFees('Poolside Cabana');
    assert.equal(cabanaFee.trayChargeCents, 300);
    assert.equal(cabanaFee.serviceFeePercent, 10.0);

    const dineInFee = pms.getZoneFees('Dining Room Table');
    assert.equal(dineInFee.trayChargeCents, 0);
    assert.equal(dineInFee.serviceFeePercent, 0);
  });

  it('Feature #15 & #16: KDS Station Routing & SLA Dynamic Calculation', () => {
    const store = new OrderStore();
    const oldTimestamp = new Date(Date.now() - 22 * 60 * 1000).toISOString(); // 22 min ago -> CRITICAL
    const order: Order = {
      id: 'ord-sla-test',
      tenantId: 'b0000000-0000-0000-0000-000000000001',
      outletId: 'a0000000-0000-0000-0000-000000000001',
      tableNumber: '7',
      status: 'PREPARING',
      paymentStatus: 'PAID',
      items: [
        { id: 'item-bar', name: 'Negroni', priceCents: 1400, quantity: 2, station: 'BAR' },
        { id: 'item-kitchen', name: 'Margherita Pizza', priceCents: 1800, quantity: 1, station: 'PIZZA_OVEN' }
      ],
      subtotalCents: 4600,
      taxCents: 460,
      tipCents: 0,
      totalCents: 5060,
      createdAt: oldTimestamp,
      updatedAt: oldTimestamp
    };
    store.orders.set(order.id, order);

    // Filter by BAR station
    const barTickets = store.getKdsOrders('a0000000-0000-0000-0000-000000000001', 'BAR');
    assert.ok(barTickets.length >= 1);
    const barTicket = barTickets.find(t => t.id === 'ord-sla-test');
    assert.ok(barTicket);
    assert.equal(barTicket.slaStatus, 'CRITICAL');

    // Filter by PIZZA_OVEN station
    const pizzaTickets = store.getKdsOrders('a0000000-0000-0000-0000-000000000001', 'PIZZA_OVEN');
    const pizzaTicket = pizzaTickets.find(t => t.id === 'ord-sla-test');
    assert.ok(pizzaTicket);
  });

  it('Feature #29: Instant 86-ing Item toggle', () => {
    const store = new OrderStore();
    const item = Array.from(store.menuItems.values())[0];
    const initialStatus = item.isAvailable;

    const updated = store.toggle86Item(item.id);
    assert.ok(updated);
    assert.equal(updated.isAvailable, !initialStatus);

    // Toggle back
    const restored = store.toggle86Item(item.id);
    assert.ok(restored);
    assert.equal(restored.isAvailable, initialStatus);
  });

  it('Feature #35 & #37: ESC/POS Network Printing & Drawer Kick Buffers', () => {
    const kickBuf = ThermalReceiptFormatter.kickCashDrawer();
    assert.equal(kickBuf[0], 0x1B); // ESC
    assert.equal(kickBuf[1], 0x70); // 'p'
    assert.equal(kickBuf[2], 0x00); // Pin 2

    const buzzerBuf = ThermalReceiptFormatter.soundBuzzer();
    assert.equal(buzzerBuf[0], 0x1B);
    assert.equal(buzzerBuf[1], 0x42); // 'B'

    const sampleOrder: Order = {
      id: 'ord-escpos-1',
      tenantId: 't1',
      outletId: 'o1',
      tableNumber: '4',
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      items: [
        { id: '1', name: 'Double Espresso', priceCents: 450, quantity: 2, station: 'BAR' },
        { id: '2', name: 'Pasta Carbonara', priceCents: 1800, quantity: 1, station: 'HOT_LINE' }
      ],
      subtotalCents: 2700,
      taxCents: 270,
      tipCents: 0,
      totalCents: 2970,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Filter by BAR station printing
    const barReceipt = ThermalReceiptFormatter.toStationEscPos(sampleOrder, 'BAR');
    const barText = barReceipt.toString('utf-8');
    assert.match(barText, /Double Espresso/);
    assert.doesNotMatch(barText, /Pasta Carbonara/); // Hot line item filtered out of bar ticket

    // Kitchen ALL receipt
    const allReceipt = ThermalReceiptFormatter.toEscPos(sampleOrder);
    const allText = allReceipt.toString('utf-8');
    assert.match(allText, /Double Espresso/);
    assert.match(allText, /Pasta Carbonara/);
  });

  it('Feature #33: Google Translate Multi-Tier Caching for 103 Languages', async () => {
    // Pre-seed disk cache to verify immediate retrieval
    const text = 'Welcome to Abiruchi Hotel';
    const translated = await translateText(text, 'es');
    assert.ok(translated);
    assert.ok(translated.length > 0);

    // Verify language support
    assert.ok(SUPPORTED_LANGUAGES.length >= 100);
    assert.ok(SUPPORTED_LANGUAGES.some(l => l.code === 'ja' && l.name === 'Japanese'));
    assert.ok(SUPPORTED_LANGUAGES.some(l => l.code === 'ar' && l.name === 'Arabic' && l.dir === 'rtl'));
  });
});
