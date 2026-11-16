import { randomUUID } from 'node:crypto';

export interface TableStatusTelemetry {
  tableId: string;
  tableNumber: string;
  capacity: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'BILL_REQUESTED';
  seatedAtMs?: number;
}

export interface QueueEntry {
  queueId: string;
  tenantId: string;
  outletId: string;
  guestName: string;
  guestPhone: string;
  partySize: number;
  displayToken: string;
  estimatedWaitMinutes: number;
  joinedAtMs: number;
  status: 'WAITING' | 'NOTIFIED' | 'SEATED' | 'NO_SHOW' | 'CANCELLED';
  assignedTableId?: string;
}

export class WaitTimeQueueEstimator {
  private queue = new Map<string, QueueEntry>();
  // Default standard dwell time in minutes (e.g. 45 mins average dining time)
  private standardDwellMinutes = 45;

  /**
   * Computes expected wait for the next walk-in diner:
   * When all tables are Occupied or Bill-Requested, computes:
   * (sum of remaining dining time on 3 fastest-clearing tables) / (rolling average dwell weight)
   */
  public estimateWaitTime(
    tables: TableStatusTelemetry[],
    partySize: number = 2
  ): {
    isFull: boolean;
    availableTableCount: number;
    estimatedWaitMinutes: number;
    recommendedPartySize: number;
    message: string;
  } {
    const availableTables = tables.filter((t) => t.status === 'AVAILABLE');
    if (availableTables.length > 0) {
      return {
        isFull: false,
        availableTableCount: availableTables.length,
        estimatedWaitMinutes: 0,
        recommendedPartySize: partySize,
        message: 'Tables immediately available. Walk-ins welcome!',
      };
    }

    const now = Date.now();
    // Tables suitable for this party size
    const candidateTables = tables.filter((t) => t.capacity >= partySize);
    const pool = candidateTables.length > 0 ? candidateTables : tables;

    // Estimate remaining minutes per occupied table
    const remainingTimes = pool.map((t) => {
      if (t.status === 'BILL_REQUESTED') {
        return 4; // Bill requested clears in ~4 minutes
      }
      const seatedMs = t.seatedAtMs || now - 1000 * 60 * 20; // Default 20 mins seated if unset
      const elapsedMins = (now - seatedMs) / (1000 * 60);
      const remainingMins = Math.max(2, this.standardDwellMinutes - elapsedMins);
      return remainingMins;
    });

    // Sort ascending to get the 3 fastest-clearing tables
    remainingTimes.sort((a, b) => a - b);
    const top3 = remainingTimes.slice(0, 3);
    const sumRemaining = top3.reduce((sum, val) => sum + val, 0);

    // Dynamic wait estimate: average of the 3 fastest clearing tables + queue depth factor
    const waitingQueueCount = Array.from(this.queue.values()).filter((q) => q.status === 'WAITING').length;
    const baseWait = Math.round(sumRemaining / Math.max(1, top3.length));
    const estimatedWaitMinutes = Math.max(5, baseWait + waitingQueueCount * 5);

    return {
      isFull: true,
      availableTableCount: 0,
      estimatedWaitMinutes,
      recommendedPartySize: partySize,
      message: `~${estimatedWaitMinutes} min wait · join queue?`,
    };
  }

  /**
   * Adds a guest to the virtual walk-in waitlist queue.
   */
  public joinQueue(params: {
    tenantId: string;
    outletId: string;
    guestName: string;
    guestPhone: string;
    partySize: number;
    tables: TableStatusTelemetry[];
  }): QueueEntry {
    const wait = this.estimateWaitTime(params.tables, params.partySize);
    const queueNumber = Array.from(this.queue.values()).length + 1;
    const displayToken = `Q-${String(queueNumber).padStart(3, '0')}`;

    const entry: QueueEntry = {
      queueId: `q_${Date.now()}_${randomUUID().slice(0, 4)}`,
      tenantId: params.tenantId,
      outletId: params.outletId,
      guestName: params.guestName,
      guestPhone: params.guestPhone,
      partySize: params.partySize,
      displayToken,
      estimatedWaitMinutes: wait.estimatedWaitMinutes,
      joinedAtMs: Date.now(),
      status: 'WAITING',
    };

    this.queue.set(entry.queueId, entry);
    return entry;
  }

  /**
   * Retrieves active waitlist queue for an outlet.
   */
  public getActiveQueue(outletId: string): QueueEntry[] {
    return Array.from(this.queue.values())
      .filter((q) => q.outletId === outletId && (q.status === 'WAITING' || q.status === 'NOTIFIED'))
      .sort((a, b) => a.joinedAtMs - b.joinedAtMs);
  }

  /**
   * Assigns a freed table to a waiting queue guest and notifies them.
   */
  public notifyTableReady(queueId: string, tableId: string): QueueEntry | null {
    const entry = this.queue.get(queueId);
    if (!entry) return null;
    entry.status = 'NOTIFIED';
    entry.assignedTableId = tableId;
    return entry;
  }

  /**
   * Marks a guest as seated or no-show.
   */
  public updateQueueStatus(queueId: string, status: QueueEntry['status']): QueueEntry | null {
    const entry = this.queue.get(queueId);
    if (!entry) return null;
    entry.status = status;
    return entry;
  }
}
