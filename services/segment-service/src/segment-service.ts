import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { auditService } from '../../audit-service/src/audit-service.ts';

export interface SegmentPreset {
  segment: 'COFFEE' | 'RESTAURANT' | 'BAR';
  displayMode: 'TABLE' | 'TOKEN' | 'BOOKING' | 'MENU_ONLY';
  tokenMode: boolean;
  tableNumbers: boolean;
  bookingEnabled: boolean;
  payFirst: boolean;
  requireFirstOrderApproval: boolean;
  tokenPrefix: string;
  tippingEnabled: boolean;
  categoryPresets: string[];
  categories: string[];
}

export class SegmentService {
  private presets = new Map<string, SegmentPreset>();
  private activeOutletPresets = new Map<string, SegmentPreset>();

  constructor() {
    this.loadPresetsFromDisk();
  }

  private loadPresetsFromDisk() {
    const configDir = join(process.cwd(), 'config', 'segments');
    const segments = ['coffee', 'restaurant', 'bar'];

    for (const seg of segments) {
      const p = join(configDir, `${seg}.json`);
      if (existsSync(p)) {
        try {
          const data = JSON.parse(readFileSync(p, 'utf-8')) as SegmentPreset;
          this.presets.set(data.segment.toUpperCase(), data);
        } catch (e) {
          console.error(`[SegmentService] Error loading preset ${seg}:`, e);
        }
      }
    }
  }

  public getPreset(segment: string): SegmentPreset | undefined {
    return this.presets.get(segment.toUpperCase());
  }

  public listPresets(): SegmentPreset[] {
    return Array.from(this.presets.values());
  }

  public applyPresetToOutlet(outletId: string, segment: 'COFFEE' | 'RESTAURANT' | 'BAR', actor: string = 'manager_sarah'): SegmentPreset {
    const preset = this.getPreset(segment);
    if (!preset) {
      throw new Error(`Segment preset ${segment} not found`);
    }

    this.activeOutletPresets.set(outletId, preset);

    auditService.log({
      feature: 'C8_SEGMENT',
      action: 'PRESET_APPLIED',
      actor,
      outletId,
      details: {
        segment: preset.segment,
        tokenMode: preset.tokenMode,
        tableNumbers: preset.tableNumbers,
        bookingEnabled: preset.bookingEnabled,
        payFirst: preset.payFirst,
      },
    });

    return preset;
  }

  public getActivePresetForOutlet(outletId: string): SegmentPreset {
    return (
      this.activeOutletPresets.get(outletId) ||
      this.getPreset('RESTAURANT') || {
        segment: 'RESTAURANT',
        displayMode: 'TABLE',
        tokenMode: false,
        tableNumbers: true,
        bookingEnabled: true,
        payFirst: false,
        requireFirstOrderApproval: true,
        tokenPrefix: 'R',
        tippingEnabled: true,
        categoryPresets: ['STARTER', 'MAIN', 'DESSERT', 'BEVERAGE'],
        categories: ['Starters', 'Mains', 'Desserts', 'Beverages'],
      }
    );
  }
}

export const segmentService = new SegmentService();
