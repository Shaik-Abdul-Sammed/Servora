import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

export type UserRole = 'SUPER_ADMIN' | 'OWNER' | 'MANAGER' | 'KITCHEN_STAFF' | 'WAITER';

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  tenantId: string;
  outletId?: string;
  iat: number;
  exp: number;
}

export class AuthService {
  private jwtSecret: string;

  constructor(jwtSecret: string = process.env.JWT_SECRET || 'servora-dev-jwt-secret-min-32-chars') {
    this.jwtSecret = jwtSecret;
  }

  /**
   * Hashes a plain password with a unique cryptographic salt using PBKDF2.
   */
  public hashPassword(password: string): { salt: string; hash: string } {
    const salt = randomBytes(16).toString('hex');
    const hash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return { salt, hash };
  }

  /**
   * Verifies password against salt and stored hash.
   */
  public verifyPassword(password: string, salt: string, storedHash: string): boolean {
    const hash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    const hashBuf = Buffer.from(hash, 'hex');
    const storedBuf = Buffer.from(storedHash, 'hex');
    return hashBuf.length === storedBuf.length && timingSafeEqual(hashBuf, storedBuf);
  }

  /**
   * Generates a signed JWT Bearer token.
   */
  public generateToken(
    params: {
      userId: string;
      email: string;
      role: UserRole;
      tenantId: string;
      outletId?: string;
      expiresInSeconds?: number;
    }
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (params.expiresInSeconds ?? 60 * 60 * 24); // 24 hours

    const payload: AuthTokenPayload = {
      userId: params.userId,
      email: params.email,
      role: params.role,
      tenantId: params.tenantId,
      outletId: params.outletId,
      iat: now,
      exp,
    };

    const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.jwtSecret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    return `${headerB64}.${payloadB64}.${signature}`;
  }

  /**
   * Validates and decodes a signed JWT Bearer token.
   */
  public verifyToken(token: string): { valid: boolean; payload?: AuthTokenPayload; error?: string } {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'MALFORMED_JWT' };
    }

    const [headerB64, payloadB64, signature] = parts;
    const expectedSig = createHmac('sha256', this.jwtSecret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expSigBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expSigBuf.length || !timingSafeEqual(sigBuf, expSigBuf)) {
      return { valid: false, error: 'INVALID_SIGNATURE' };
    }

    try {
      const payload: AuthTokenPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
      const now = Math.floor(Date.now() / 1000);
      if (now > payload.exp) {
        return { valid: false, error: 'TOKEN_EXPIRED' };
      }
      return { valid: true, payload };
    } catch {
      return { valid: false, error: 'INVALID_PAYLOAD' };
    }
  }
}
