import type { ServiceToken, TokenBucket, TokenState } from '../../../../packages/shared-types/src/index.ts';
import { auditService } from '../../../audit-service/src/audit-service.ts';

export class TokenService {
  private tokens = new Map<string, ServiceToken>();
  private prefixCounters = new Map<string, number>();

  constructor() {}

  public generateToken(
    outletId: string,
    bucket: TokenBucket = 'FOOD',
    orderRef?: string,
    prefix: string = 'A',
    guestPhone?: string
  ): ServiceToken {
    const currentCount = (this.prefixCounters.get(`${outletId}:${prefix}`) || 0) + 1;
    this.prefixCounters.set(`${outletId}:${prefix}`, currentCount);

    const code = `${prefix}-${currentCount}`;
    const id = `tok_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const token: ServiceToken = {
      id,
      outletId,
      code,
      bucket,
      state: 'QUEUED',
      orderRef,
      guestPhone,
      createdAt: now,
      updatedAt: now,
    };

    this.tokens.set(id, token);

    auditService.log({
      feature: 'C1_TOKEN',
      action: 'GENERATE_TOKEN',
      actor: guestPhone || 'system',
      outletId,
      details: { tokenId: id, code, bucket, orderRef },
    });

    return token;
  }

  public advanceState(tokenId: string, nextState?: TokenState, actor: string = 'staff'): ServiceToken {
    const token = this.tokens.get(tokenId);
    if (!token) {
      throw new Error(`Token with id ${tokenId} not found`);
    }

    const stateTransitions: Record<TokenState, TokenState> = {
      QUEUED: 'PREPARING',
      PREPARING: 'READY',
      READY: 'SERVED',
      SERVED: 'CLOSED',
      CLOSED: 'CLOSED',
    };

    const targetState = nextState || stateTransitions[token.state];
    token.state = targetState;
    token.updatedAt = new Date().toISOString();

    auditService.log({
      feature: 'C1_TOKEN',
      action: 'ADVANCE_TOKEN_STATE',
      actor,
      outletId: token.outletId,
      details: { tokenId, code: token.code, newState: targetState },
    });

    return token;
  }

  public getActiveTokens(outletId: string): { preparing: ServiceToken[]; ready: ServiceToken[] } {
    const tokens = Array.from(this.tokens.values()).filter((t) => t.outletId === outletId);
    return {
      preparing: tokens.filter((t) => t.state === 'QUEUED' || t.state === 'PREPARING'),
      ready: tokens.filter((t) => t.state === 'READY'),
    };
  }

  public getAllTokens(outletId: string): ServiceToken[] {
    return Array.from(this.tokens.values())
      .filter((t) => t.outletId === outletId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getTokenById(tokenId: string): ServiceToken | undefined {
    return this.tokens.get(tokenId);
  }
}

export const tokenService = new TokenService();
