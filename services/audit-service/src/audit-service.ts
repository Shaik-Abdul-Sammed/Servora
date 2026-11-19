import { appendFileSync as fsAppend, existsSync as fsExists, mkdirSync as fsMkdir } from 'node:fs';
import { join } from 'node:path';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  feature: string; // e.g. 'C1_TOKEN', 'C3_PAYMENT', 'C4_BOOKING', etc.
  action: string;
  actor: string;
  outletId: string;
  details: Record<string, any>;
}

export class AuditService {
  private logPath: string;
  private memoryLogs: AuditLogEntry[] = [];

  constructor(customPath?: string) {
    const dir = join(process.cwd(), 'data', 'agent-runs');
    if (!fsExists(dir)) {
      fsMkdir(dir, { recursive: true });
    }
    this.logPath = customPath || join(dir, 'audit-log.jsonl');
  }

  public log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const fullEntry: AuditLogEntry = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };

    this.memoryLogs.push(fullEntry);
    if (this.memoryLogs.length > 1000) {
      this.memoryLogs.shift();
    }

    try {
      fsAppend(this.logPath, JSON.stringify(fullEntry) + '\n', 'utf-8');
    } catch (err) {
      console.error('[AuditService] Failed to write audit log to disk:', err);
    }

    return fullEntry;
  }

  public getRecentLogs(limit: number = 50): AuditLogEntry[] {
    return this.memoryLogs.slice(-limit).reverse();
  }

  public getLogsByFeature(feature: string): AuditLogEntry[] {
    return this.memoryLogs.filter((l) => l.feature === feature).reverse();
  }
}

export const auditService = new AuditService();
