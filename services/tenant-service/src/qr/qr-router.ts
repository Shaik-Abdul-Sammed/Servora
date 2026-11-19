import { verifySignedQRSession, createSignedQRSession, type SignedQRSessionPayload } from '../../../../packages/utils/src/qr-crypto.ts';
import { auditService } from '../../../audit-service/src/audit-service.ts';

export type OperatingMode = 'TABLE' | 'TOKEN' | 'BOOKING' | 'MENU_ONLY';

export interface RouteResolution {
  mode: OperatingMode;
  outletId: string;
  tableNumber?: number;
  tableId?: string;
  bookingId?: string;
  initialState: 'MENU' | 'TOKEN_QUEUE' | 'BOOKING_CHECKIN' | 'BROWSE_ONLY';
  callWaiterEnabled: boolean;
  tokenPrefix?: string;
}

export class QRRouterService {
  constructor() {}

  /**
   * Resolves a signed QR token or raw params into the precise operating mode
   */
  public resolveRoute(
    tokenString?: string,
    outletConfig?: { displayMode?: OperatingMode; tokenPrefix?: string }
  ): RouteResolution {
    let payload: Partial<SignedQRSessionPayload> | null = null;

    if (tokenString) {
      try {
        const decodedStr = Buffer.from(tokenString, 'base64url').toString('utf-8');
        const parsed = JSON.parse(decodedStr);
        if (parsed.signature) {
          payload = verifySignedQRSession(parsed);
        } else {
          payload = parsed;
        }
      } catch (e) {
        console.warn('[QRRouterService] Invalid or non-base64 token passed');
      }
    }

    const outletId = payload?.outletId || 'demo_outlet_01';
    const explicitMode = payload?.mode;
    const configMode = outletConfig?.displayMode;

    let finalMode: OperatingMode = explicitMode || configMode || 'TABLE';
    if (!payload?.tableNumber && finalMode === 'TABLE' && !payload?.tableId) {
      finalMode = 'MENU_ONLY';
    }

    let initialState: RouteResolution['initialState'] = 'MENU';
    if (finalMode === 'TOKEN') {
      initialState = 'MENU'; // In token mode, guests order then get token
    } else if (finalMode === 'BOOKING') {
      initialState = payload?.bookingId ? 'BOOKING_CHECKIN' : 'MENU';
    } else if (finalMode === 'MENU_ONLY') {
      initialState = 'BROWSE_ONLY';
    }

    const resolution: RouteResolution = {
      mode: finalMode,
      outletId,
      tableNumber: payload?.tableNumber,
      tableId: payload?.tableId,
      bookingId: payload?.bookingId,
      initialState,
      callWaiterEnabled: true, // Always available across all modes
      tokenPrefix: outletConfig?.tokenPrefix || (finalMode === 'TOKEN' ? 'A' : undefined),
    };

    auditService.log({
      feature: 'C7_QR_ROUTER',
      action: 'ROUTE_RESOLVED',
      actor: 'guest_scan',
      outletId,
      details: { mode: resolution.mode, initialState: resolution.initialState, tableNumber: resolution.tableNumber },
    });

    return resolution;
  }
}

export const qrRouterService = new QRRouterService();
