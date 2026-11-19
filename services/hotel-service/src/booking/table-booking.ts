import type { BookingStatus, TableBooking } from '../../../../packages/shared-types/src/index.ts';
import { auditService } from '../../../audit-service/src/audit-service.ts';
import { createSignedQRSession } from '../../../../packages/utils/src/qr-crypto.ts';

export interface BookingSlotConfig {
  outletId: string;
  slotDurationMinutes: number; // e.g. 90
  prepayAmountCents: number; // e.g. 20000 ($200.00 / ₹200)
  maxCapacityPerSlot: number;
}

export class TableBookingService {
  private bookings = new Map<string, TableBooking>();
  private slotConfigs = new Map<string, BookingSlotConfig>();

  constructor() {
    this.slotConfigs.set('demo_outlet_01', {
      outletId: 'demo_outlet_01',
      slotDurationMinutes: 90,
      prepayAmountCents: 2000,
      maxCapacityPerSlot: 10,
    });
  }

  public setSlotConfig(config: BookingSlotConfig) {
    this.slotConfigs.set(config.outletId, config);
  }

  public createBooking(params: {
    outletId: string;
    guestName: string;
    guestPhone?: string;
    partySize: number;
    slotDate: string; // YYYY-MM-DD
    slotTime: string; // HH:mm
    prepayAmountCents?: number;
    tableId?: string;
  }): { booking: TableBooking; qrToken: string } {
    const config = this.slotConfigs.get(params.outletId) || {
      outletId: params.outletId,
      slotDurationMinutes: 90,
      prepayAmountCents: 2000,
      maxCapacityPerSlot: 10,
    };

    const id = `bkg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const booking: TableBooking = {
      id,
      outletId: params.outletId,
      tableId: params.tableId || 'table_01',
      guestName: params.guestName,
      guestPhone: params.guestPhone,
      partySize: params.partySize,
      slotDate: params.slotDate,
      slotTime: params.slotTime,
      durationMinutes: config.slotDurationMinutes,
      prepayAmountCents: params.prepayAmountCents ?? config.prepayAmountCents,
      status: 'RESERVED',
      createdAt: now,
      updatedAt: now,
    };

    this.bookings.set(id, booking);

    // Generate signed QR for this reservation
    const signedPayload = createSignedQRSession({
      tenantId: params.outletId,
      outletId: params.outletId,
      tableId: booking.tableId || 'table_01',
      tableNumber: 1,
      mode: 'BOOKING',
      bookingId: id,
    });
    const qrToken = Buffer.from(JSON.stringify(signedPayload)).toString('base64url');

    auditService.log({
      feature: 'C4_BOOKING',
      action: 'BOOKING_CREATED',
      actor: params.guestName,
      outletId: params.outletId,
      details: {
        bookingId: id,
        slotDate: params.slotDate,
        slotTime: params.slotTime,
        partySize: params.partySize,
        prepayCents: booking.prepayAmountCents,
      },
    });

    return { booking, qrToken };
  }

  public checkIn(bookingId: string, assignedTableId?: string, actor: string = 'host'): TableBooking {
    const booking = this.bookings.get(bookingId);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    booking.status = 'CHECKED_IN';
    if (assignedTableId) {
      booking.tableId = assignedTableId;
    }
    booking.updatedAt = new Date().toISOString();

    auditService.log({
      feature: 'C4_BOOKING',
      action: 'BOOKING_CHECKED_IN',
      actor,
      outletId: booking.outletId,
      details: { bookingId, tableId: booking.tableId },
    });

    return booking;
  }

  /**
   * Auto-releases un-checked-in slots that are > 15 minutes past start time
   */
  public sweepExpiredBookings(nowDate: Date = new Date()): TableBooking[] {
    const released: TableBooking[] = [];
    const nowMs = nowDate.getTime();

    for (const booking of this.bookings.values()) {
      if (booking.status === 'RESERVED') {
        const slotDateTimeStr = `${booking.slotDate}T${booking.slotTime}:00`;
        const slotStartMs = new Date(slotDateTimeStr).getTime();
        // If > 15 minutes past start time
        if (nowMs - slotStartMs > 15 * 60 * 1000) {
          booking.status = 'NO_SHOW';
          booking.updatedAt = new Date().toISOString();
          released.push(booking);

          auditService.log({
            feature: 'C4_BOOKING',
            action: 'BOOKING_AUTO_RELEASED',
            actor: 'system_sweeper',
            outletId: booking.outletId,
            details: { bookingId: booking.id, slotDate: booking.slotDate, slotTime: booking.slotTime },
          });
        }
      }
    }

    return released;
  }

  public getBookingsForDate(outletId: string, dateStr: string): TableBooking[] {
    return Array.from(this.bookings.values())
      .filter((b) => b.outletId === outletId && b.slotDate === dateStr)
      .sort((a, b) => a.slotTime.localeCompare(b.slotTime));
  }

  public getBookingById(bookingId: string): TableBooking | undefined {
    return this.bookings.get(bookingId);
  }
}

export const tableBookingService = new TableBookingService();
