import type { RecoveryStatus, ReviewCategory } from '../../../../packages/shared-types/src/index.ts';
import { auditService } from '../../../audit-service/src/audit-service.ts';

export interface GuestReviewSubmission {
  id: string;
  outletId: string;
  orderId?: string;
  tableNumber?: number;
  rating: number; // 1 to 5
  category?: ReviewCategory | 'WRONG_ITEM' | 'DELAY' | 'TASTE' | 'SERVICE' | 'BILLING';
  feedbackText?: string;
  createdAt: string;
}

export interface RecoveryTicket {
  id: string;
  outletId: string;
  orderId?: string;
  tableNumber?: number;
  rating: number;
  category: string;
  guestFeedback?: string;
  status: RecoveryStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  closedBy?: string;
  closedAt?: string;
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export class ReviewRecoveryService {
  private reviews: GuestReviewSubmission[] = [];
  private recoveryTickets = new Map<string, RecoveryTicket>();

  constructor() {}

  public submitReview(params: {
    outletId: string;
    rating: number;
    orderId?: string;
    tableNumber?: number;
    category?: string;
    feedbackText?: string;
  }): { review: GuestReviewSubmission; recoveryTicket?: RecoveryTicket; shareGooglePrompt: boolean } {
    const id = `rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const review: GuestReviewSubmission = {
      id,
      outletId: params.outletId,
      orderId: params.orderId,
      tableNumber: params.tableNumber,
      rating: params.rating,
      category: params.category as any,
      feedbackText: params.feedbackText,
      createdAt: now,
    };
    this.reviews.push(review);

    let recoveryTicket: RecoveryTicket | undefined;
    const shareGooglePrompt = params.rating >= 4;

    // Rating 1-3 triggers an immediate recovery ticket
    if (params.rating <= 3) {
      const ticketId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      recoveryTicket = {
        id: ticketId,
        outletId: params.outletId,
        orderId: params.orderId,
        tableNumber: params.tableNumber,
        rating: params.rating,
        category: params.category || 'SERVICE',
        guestFeedback: params.feedbackText,
        status: 'OPEN',
        createdAt: now,
        updatedAt: now,
      };
      this.recoveryTickets.set(ticketId, recoveryTicket);

      auditService.log({
        feature: 'C6_REVIEW',
        action: 'RECOVERY_TICKET_OPENED',
        actor: 'guest_feedback',
        outletId: params.outletId,
        details: { ticketId, rating: params.rating, category: recoveryTicket.category },
      });
    }

    auditService.log({
      feature: 'C6_REVIEW',
      action: 'REVIEW_SUBMITTED',
      actor: 'guest',
      outletId: params.outletId,
      details: { reviewId: id, rating: params.rating, shareGooglePrompt },
    });

    return { review, recoveryTicket, shareGooglePrompt };
  }

  public acknowledgeTicket(ticketId: string, staffId: string = 'staff_01'): RecoveryTicket {
    const ticket = this.recoveryTickets.get(ticketId);
    if (!ticket) throw new Error(`Ticket ${ticketId} not found`);

    ticket.status = 'ACKNOWLEDGED';
    ticket.acknowledgedBy = staffId;
    ticket.acknowledgedAt = new Date().toISOString();
    ticket.updatedAt = ticket.acknowledgedAt;

    auditService.log({
      feature: 'C6_REVIEW',
      action: 'RECOVERY_TICKET_ACKNOWLEDGED',
      actor: staffId,
      outletId: ticket.outletId,
      details: { ticketId },
    });

    return ticket;
  }

  public closeTicket(ticketId: string, closedBy: string = 'manager_sarah', resolutionNote?: string): RecoveryTicket {
    const ticket = this.recoveryTickets.get(ticketId);
    if (!ticket) throw new Error(`Ticket ${ticketId} not found`);

    ticket.status = 'CLOSED';
    ticket.closedBy = closedBy;
    ticket.closedAt = new Date().toISOString();
    ticket.resolutionNote = resolutionNote;
    ticket.updatedAt = ticket.closedAt;

    auditService.log({
      feature: 'C6_REVIEW',
      action: 'RECOVERY_TICKET_CLOSED',
      actor: closedBy,
      outletId: ticket.outletId,
      details: { ticketId, resolutionNote },
    });

    return ticket;
  }

  public getOpenRecoveryTickets(outletId: string): RecoveryTicket[] {
    return Array.from(this.recoveryTickets.values())
      .filter((t) => t.outletId === outletId && t.status !== 'CLOSED')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getAllRecoveryTickets(outletId: string): RecoveryTicket[] {
    return Array.from(this.recoveryTickets.values())
      .filter((t) => t.outletId === outletId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export const reviewRecoveryService = new ReviewRecoveryService();
