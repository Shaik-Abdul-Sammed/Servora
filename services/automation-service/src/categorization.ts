import type { Order, OrderItem } from '../../../packages/shared-types/src/index.ts';
import { randomUUID } from 'node:crypto';

export type OrderCategory = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'PRE_ORDER';
export type KitchenStation = 'GRILL' | 'BEVERAGE' | 'DESSERT' | 'TANDOOR' | 'COLD';

export interface StationTicket {
  ticketId: string;
  parentOrderId: string;
  tenantId: string;
  outletId: string;
  station: KitchenStation;
  displayToken: string;
  tableNumber: string;
  category: OrderCategory;
  items: OrderItem[];
  status: 'PENDING' | 'PREPARING' | 'READY';
  createdAt: string;
}

export class OrderCategorizationEngine {
  // Tenant -> Date (YYYY-MM-DD) -> Sequential counter
  private dailyTokenCounters = new Map<string, number>();

  /**
   * Generates a daily sequential token number reset at midnight per tenant.
   * Format: #001, #002 ...
   */
  public generateDailyToken(tenantId: string, dateStr?: string): { displayToken: string; sequence: number; uuid: string } {
    const today = dateStr || new Date().toISOString().slice(0, 10);
    const key = `${tenantId}:${today}`;
    const current = (this.dailyTokenCounters.get(key) || 0) + 1;
    this.dailyTokenCounters.set(key, current);

    const displayToken = `#${String(current).padStart(3, '0')}`;
    const uuid = randomUUID();

    return { displayToken, sequence: current, uuid };
  }

  /**
   * Maps an item name/category to a designated kitchen station.
   */
  public resolveKitchenStation(item: OrderItem): KitchenStation {
    const name = item.name.toLowerCase();
    if (name.includes('spritz') || name.includes('wine') || name.includes('soda') || name.includes('cocktail') || name.includes('tea') || name.includes('coffee')) {
      return 'BEVERAGE';
    }
    if (name.includes('burrata') || name.includes('salad') || name.includes('cold') || name.includes('carpaccio')) {
      return 'COLD';
    }
    if (name.includes('tiramisu') || name.includes('cake') || name.includes('gelato') || name.includes('dessert') || name.includes('cannoli')) {
      return 'DESSERT';
    }
    if (name.includes('naan') || name.includes('roti') || name.includes('tandoor') || name.includes('kebab')) {
      return 'TANDOOR';
    }
    // Default to main hot line / grill / oven
    return 'GRILL';
  }

  /**
   * Detects the order category based on table session / queue context.
   */
  public determineOrderCategory(order: Partial<Order>, isPreOrderQueue: boolean = false): OrderCategory {
    if (isPreOrderQueue) return 'PRE_ORDER';
    if (!order.tableNumber || order.tableNumber.toLowerCase().includes('takeaway') || order.tableNumber.toLowerCase().includes('parcel')) {
      return 'TAKEAWAY';
    }
    if (order.tableNumber.toLowerCase().includes('delivery')) {
      return 'DELIVERY';
    }
    return 'DINE_IN';
  }

  /**
   * Automatically categorizes an order and splits it into discrete station tickets
   * if items span multiple preparation zones (Grill, Beverage, Cold, Dessert, etc.).
   */
  public processAndSplitOrder(
    order: Order,
    options: { isPreOrderQueue?: boolean; dateStr?: string } = {}
  ): {
    category: OrderCategory;
    displayToken: string;
    tokenUUID: string;
    stationTickets: StationTicket[];
  } {
    const category = this.determineOrderCategory(order, options.isPreOrderQueue);
    const { displayToken, uuid: tokenUUID } = this.generateDailyToken(order.tenantId, options.dateStr);

    // Group items by station
    const stationMap = new Map<KitchenStation, OrderItem[]>();

    for (const item of order.items) {
      const station = this.resolveKitchenStation(item);
      const list = stationMap.get(station) || [];
      list.push(item);
      stationMap.set(station, list);
    }

    const stationTickets: StationTicket[] = [];
    const now = new Date().toISOString();

    for (const [station, items] of stationMap.entries()) {
      stationTickets.push({
        ticketId: `tkt_${station.toLowerCase()}_${order.id.slice(-6)}_${randomUUID().slice(0, 4)}`,
        parentOrderId: order.id,
        tenantId: order.tenantId,
        outletId: order.outletId,
        station,
        displayToken,
        tableNumber: order.tableNumber,
        category,
        items,
        status: 'PENDING',
        createdAt: now,
      });
    }

    return {
      category,
      displayToken,
      tokenUUID,
      stationTickets,
    };
  }

  /**
   * Resets counter for testing or midnight rollover.
   */
  public resetDailyTokens(tenantId?: string) {
    if (tenantId) {
      for (const key of this.dailyTokenCounters.keys()) {
        if (key.startsWith(`${tenantId}:`)) {
          this.dailyTokenCounters.delete(key);
        }
      }
    } else {
      this.dailyTokenCounters.clear();
    }
  }
}
