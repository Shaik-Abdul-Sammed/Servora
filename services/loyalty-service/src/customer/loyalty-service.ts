import { createHash } from 'node:crypto';
import type { GuestPreferences } from '../../../../packages/shared-types/src/index.ts';
import { auditService } from '../../../audit-service/src/audit-service.ts';

export interface OTPRecord {
  phone: string;
  code: string;
  expiresAt: number;
}

export class LoyaltyCustomerService {
  private otps = new Map<string, OTPRecord>();
  private preferences = new Map<string, GuestPreferences>();

  constructor() {}

  private hashPhone(phone: string): string {
    return createHash('sha256').update(phone.trim()).digest('hex').substring(0, 16);
  }

  public requestOTP(phone: string): { success: boolean; expiresAt: number; devCode?: string } {
    const cleanPhone = phone.trim();
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 mins

    this.otps.set(cleanPhone, { phone: cleanPhone, code, expiresAt });

    auditService.log({
      feature: 'C5_LOYALTY',
      action: 'OTP_REQUESTED',
      actor: cleanPhone,
      outletId: 'system',
      details: { expiresAt },
    });

    return {
      success: true,
      expiresAt,
      devCode: code, // In demo/test environment
    };
  }

  public verifyOTP(phone: string, inputCode: string): { verified: boolean; phoneHash: string; preferences?: GuestPreferences } {
    const cleanPhone = phone.trim();
    const record = this.otps.get(cleanPhone);

    // Accept recorded OTP or standard demo bypass 1234
    const isValid = (record && record.code === inputCode.trim() && Date.now() < record.expiresAt) || inputCode.trim() === '1234';
    if (!isValid) {
      return { verified: false, phoneHash: '' };
    }

    const phoneHash = this.hashPhone(cleanPhone);
    this.otps.delete(cleanPhone);

    let prefs = this.preferences.get(phoneHash);
    const now = new Date().toISOString();

    if (!prefs) {
      prefs = {
        id: `pref_${phoneHash}`,
        phoneHash,
        allergens: [],
        milkPref: 'NONE',
        spiceLevel: 'MEDIUM',
        favoriteItemIds: [],
        visitCount: 1,
        lastVisitAt: now,
        createdAt: now,
        updatedAt: now,
      };
      this.preferences.set(phoneHash, prefs);
    } else {
      prefs.visitCount += 1;
      prefs.lastVisitAt = now;
      prefs.updatedAt = now;
    }

    auditService.log({
      feature: 'C5_LOYALTY',
      action: 'OTP_VERIFIED',
      actor: cleanPhone,
      outletId: 'system',
      details: { phoneHash, visitCount: prefs.visitCount },
    });

    return { verified: true, phoneHash, preferences: prefs };
  }

  public getPreferences(phoneHash: string): GuestPreferences | undefined {
    return this.preferences.get(phoneHash);
  }

  public updatePreferences(
    phoneHash: string,
    updates: Partial<Pick<GuestPreferences, 'allergens' | 'milkPref' | 'spiceLevel' | 'favoriteItemIds'>>
  ): GuestPreferences {
    let prefs = this.preferences.get(phoneHash);
    const now = new Date().toISOString();

    if (!prefs) {
      prefs = {
        id: `pref_${phoneHash}`,
        phoneHash,
        allergens: updates.allergens || [],
        milkPref: updates.milkPref || 'NONE',
        spiceLevel: updates.spiceLevel || 'MEDIUM',
        favoriteItemIds: updates.favoriteItemIds || [],
        visitCount: 1,
        lastVisitAt: now,
        createdAt: now,
        updatedAt: now,
      };
      this.preferences.set(phoneHash, prefs);
    } else {
      if (updates.allergens) prefs.allergens = updates.allergens;
      if (updates.milkPref) prefs.milkPref = updates.milkPref;
      if (updates.spiceLevel) prefs.spiceLevel = updates.spiceLevel;
      if (updates.favoriteItemIds) prefs.favoriteItemIds = updates.favoriteItemIds;
      prefs.updatedAt = now;
    }

    auditService.log({
      feature: 'C5_LOYALTY',
      action: 'PREFERENCES_UPDATED',
      actor: phoneHash,
      outletId: 'system',
      details: { allergens: prefs.allergens, milkPref: prefs.milkPref, spiceLevel: prefs.spiceLevel },
    });

    return prefs;
  }

  /**
   * Identifies repeat guests inactive for > daysThreshold
   */
  public getInactiveGuestsForWinback(daysThreshold: number = 7): GuestPreferences[] {
    const now = Date.now();
    const thresholdMs = daysThreshold * 24 * 60 * 60 * 1000;
    const inactive: GuestPreferences[] = [];

    for (const pref of this.preferences.values()) {
      if (pref.lastVisitAt) {
        const lastMs = new Date(pref.lastVisitAt).getTime();
        if (now - lastMs > thresholdMs) {
          inactive.push(pref);
        }
      }
    }
    return inactive;
  }
}

export const loyaltyCustomerService = new LoyaltyCustomerService();
