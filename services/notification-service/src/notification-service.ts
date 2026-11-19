import type { ServiceToken, TokenBucket } from '../../../packages/shared-types/src/index.ts';
import { auditService } from '../../audit-service/src/audit-service.ts';

export interface StaffNotification {
  id: string;
  outletId: string;
  targetRole: 'STAFF' | 'WAITER' | 'MANAGER' | 'BAR' | 'KITCHEN';
  targetBucket?: TokenBucket;
  channel: 'IN_APP' | 'WHATSAPP';
  title: string;
  message: string;
  tokenId?: string;
  tokenCode?: string;
  read: boolean;
  createdAt: string;
}

export class NotificationService {
  private notifications: StaffNotification[] = [];
  private whatsAppEnabled: boolean = process.env.ENABLE_WHATSAPP_NOTIFICATIONS === 'true';

  constructor() {}

  public setWhatsAppEnabled(enabled: boolean) {
    this.whatsAppEnabled = enabled;
  }

  /**
   * Dispatches targeted notification when a token becomes READY.
   * If bucket is specified, it targets staff monitoring that station.
   */
  public notifyTokenReady(token: ServiceToken, assignedWaiterId?: string): StaffNotification[] {
    const notificationsCreated: StaffNotification[] = [];
    const now = new Date().toISOString();

    const roleTarget = token.bucket === 'DRINKS' ? 'BAR' : 'KITCHEN';

    // In-app station notification
    const stationNotif: StaffNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      outletId: token.outletId,
      targetRole: roleTarget,
      targetBucket: token.bucket,
      channel: 'IN_APP',
      title: `Token ${token.code} READY`,
      message: `Order for ${token.bucket} is ready for handoff/pickup.`,
      tokenId: token.id,
      tokenCode: token.code,
      read: false,
      createdAt: now,
    };
    this.notifications.push(stationNotif);
    notificationsCreated.push(stationNotif);

    // Waiter or manager notification
    const staffTargetRole = assignedWaiterId ? 'WAITER' : 'MANAGER';
    const staffNotif: StaffNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      outletId: token.outletId,
      targetRole: staffTargetRole,
      targetBucket: token.bucket,
      channel: this.whatsAppEnabled ? 'WHATSAPP' : 'IN_APP',
      title: `Order Ready: ${token.code}`,
      message: `Token ${token.code} (${token.bucket}) is ready for delivery to guest.`,
      tokenId: token.id,
      tokenCode: token.code,
      read: false,
      createdAt: now,
    };
    this.notifications.push(staffNotif);
    notificationsCreated.push(staffNotif);

    auditService.log({
      feature: 'C2_NOTIFY',
      action: 'NOTIFY_TOKEN_READY',
      actor: 'token-dispatcher',
      outletId: token.outletId,
      details: {
        tokenId: token.id,
        code: token.code,
        bucket: token.bucket,
        targets: notificationsCreated.map((n) => ({ role: n.targetRole, channel: n.channel })),
      },
    });

    return notificationsCreated;
  }

  public getNotificationsForStation(outletId: string, role?: string, bucket?: TokenBucket): StaffNotification[] {
    return this.notifications
      .filter((n) => n.outletId === outletId)
      .filter((n) => !role || n.targetRole === role || n.targetRole === 'STAFF')
      .filter((n) => !bucket || !n.targetBucket || n.targetBucket === bucket)
      .reverse();
  }

  public markAsRead(notificationId: string): boolean {
    const notif = this.notifications.find((n) => n.id === notificationId);
    if (notif) {
      notif.read = true;
      return true;
    }
    return false;
  }
}

export const notificationService = new NotificationService();
