export interface TenantShiftConfig {
  tenantId: string;
  happyHourTriggerHours: number[]; // e.g. [15, 18] (3 PM and 6 PM)
  happyHourOccupancyThresholdPercent: number; // e.g. 40%
  happyHourDiscountPercent: number; // e.g. 20%
  lastOrderCutoffTime: string; // e.g. "22:30" (10:30 PM)
  menuClosingMessage: string;
}

export interface ShiftAutomationState {
  isHappyHourActive: boolean;
  happyHourDiscountPercent: number;
  isMenuLocked: boolean;
  lockReason?: string;
  evaluatedAt: string;
}

export class ShiftPeakAutomationEngine {
  private tenantConfigs = new Map<string, TenantShiftConfig>();

  constructor() {
    // Default demo tenant shift config
    this.tenantConfigs.set('a0000000-0000-0000-0000-000000000001', {
      tenantId: 'a0000000-0000-0000-0000-000000000001',
      happyHourTriggerHours: [15, 18], // 3 PM, 6 PM
      happyHourOccupancyThresholdPercent: 40,
      happyHourDiscountPercent: 20,
      lastOrderCutoffTime: '22:30',
      menuClosingMessage: 'Kitchen has completed final service for tonight. We look forward to serving you tomorrow!',
    });
  }

  public setTenantConfig(config: TenantShiftConfig) {
    this.tenantConfigs.set(config.tenantId, config);
  }

  /**
   * Evaluates shift peak rules:
   * 1. If at/past last-order cutoff -> auto-lock guest menu
   * 2. If at 3 PM or 6 PM and occupancy < 40% -> auto-enable Happy Hour
   * 3. If occupancy recovers >= 40% -> auto-disable Happy Hour
   */
  public evaluateShiftState(
    tenantId: string,
    currentOccupancyPercent: number,
    currentTime?: { hour: number; minute: number }
  ): ShiftAutomationState {
    const config = this.tenantConfigs.get(tenantId) || {
      tenantId,
      happyHourTriggerHours: [15, 18],
      happyHourOccupancyThresholdPercent: 40,
      happyHourDiscountPercent: 20,
      lastOrderCutoffTime: '22:30',
      menuClosingMessage: 'Our kitchen is currently closed. See you tomorrow!',
    };

    const now = new Date();
    const currentHour = currentTime ? currentTime.hour : now.getHours();
    const currentMinute = currentTime ? currentTime.minute : now.getMinutes();

    // 1. Check last-order cutoff
    const [cutoffH, cutoffM] = config.lastOrderCutoffTime.split(':').map((s) => parseInt(s, 10));
    const isPastCutoff =
      cutoffH !== undefined && cutoffM !== undefined &&
      (currentHour > cutoffH || (currentHour === cutoffH && currentMinute >= cutoffM));

    if (isPastCutoff) {
      return {
        isHappyHourActive: false,
        happyHourDiscountPercent: 0,
        isMenuLocked: true,
        lockReason: config.menuClosingMessage,
        evaluatedAt: now.toISOString(),
      };
    }

    // 2. Check Happy Hour triggers
    const isHappyHourWindow = config.happyHourTriggerHours.includes(currentHour);
    const isUnderOccupancy = currentOccupancyPercent < config.happyHourOccupancyThresholdPercent;

    if (isHappyHourWindow && isUnderOccupancy) {
      return {
        isHappyHourActive: true,
        happyHourDiscountPercent: config.happyHourDiscountPercent,
        isMenuLocked: false,
        evaluatedAt: now.toISOString(),
      };
    }

    // Default normal service
    return {
      isHappyHourActive: false,
      happyHourDiscountPercent: 0,
      isMenuLocked: false,
      evaluatedAt: now.toISOString(),
    };
  }
}
