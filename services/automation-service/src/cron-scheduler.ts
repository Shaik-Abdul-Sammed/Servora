export interface CronJobExecutionRecord {
  runId: string;
  jobId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: 'SUCCESS' | 'FAILED' | 'RETRY_SUCCESS';
  retryCount: number;
  details: Record<string, unknown>;
  error?: string;
}

export type CronJobHandler = () => Promise<Record<string, unknown>> | Record<string, unknown>;

export interface ScheduledJobConfig {
  jobId: string;
  name: string;
  intervalMinutes: number;
  scheduleDescription: string;
  handler: CronJobHandler;
}

export class ObservableCronScheduler {
  private jobs = new Map<string, ScheduledJobConfig>();
  private executionHistory: CronJobExecutionRecord[] = [];
  private timers = new Map<string, NodeJS.Timeout>();
  private isRunning = false;

  public registerJob(job: ScheduledJobConfig) {
    this.jobs.set(job.jobId, job);
  }

  /**
   * Executes a job with automatic retries, execution duration timing, and structured JSON logs.
   */
  public async executeJob(jobId: string, maxRetries: number = 2): Promise<CronJobExecutionRecord> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not registered: ${jobId}`);
    }

    const runId = `cron_${jobId}_${Date.now()}`;
    const startedAt = new Date().toISOString();
    const startMs = Date.now();
    let retryCount = 0;
    let lastError: Error | null = null;
    let details: Record<string, unknown> = {};
    let status: CronJobExecutionRecord['status'] = 'SUCCESS';

    while (retryCount <= maxRetries) {
      try {
        details = await Promise.resolve(job.handler());
        if (retryCount > 0) status = 'RETRY_SUCCESS';
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        retryCount += 1;
        if (retryCount <= maxRetries) {
          // Exponential backoff wait in real execution or immediate in tests
          await new Promise((r) => setTimeout(r, 20));
        }
      }
    }

    if (retryCount > maxRetries && lastError) {
      status = 'FAILED';
    }

    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - startMs;

    const record: CronJobExecutionRecord = {
      runId,
      jobId,
      startedAt,
      finishedAt,
      durationMs,
      status,
      retryCount: Math.min(retryCount, maxRetries),
      details,
      error: lastError && status === 'FAILED' ? lastError.message : undefined,
    };

    this.executionHistory.unshift(record);
    if (this.executionHistory.length > 100) {
      this.executionHistory.pop(); // Keep last 100 logs
    }

    // Structured JSON log output
    console.log(
      JSON.stringify({
        level: status === 'FAILED' ? 'ERROR' : 'INFO',
        type: 'CRON_EXECUTION',
        record,
      })
    );

    return record;
  }

  /**
   * Starts background timer intervals.
   */
  public startAll() {
    this.isRunning = true;
    for (const [jobId, job] of this.jobs.entries()) {
      const intervalMs = job.intervalMinutes * 60 * 1000;
      const timer = setInterval(() => {
        if (this.isRunning) {
          this.executeJob(jobId).catch((e) => console.error('Cron tick error:', e));
        }
      }, intervalMs);
      this.timers.set(jobId, timer);
    }
  }

  /**
   * Stops all active timer loops.
   */
  public stopAll() {
    this.isRunning = false;
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
  }

  public getHistory(): CronJobExecutionRecord[] {
    return [...this.executionHistory];
  }

  public getRegisteredJobs(): Array<{ jobId: string; name: string; schedule: string }> {
    return Array.from(this.jobs.values()).map((j) => ({
      jobId: j.jobId,
      name: j.name,
      schedule: j.scheduleDescription,
    }));
  }
}
