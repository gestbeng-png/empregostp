export interface HealthProbe { database(): Promise<boolean>; storage(): Promise<boolean>; queue(): Promise<{ oldestDueAgeMs: number; dead: number }> }
export interface HealthReport { status: 'ok' | 'degraded'; checks: { database: boolean; storage: boolean; queue: boolean }; oldestDueAgeMs: number | null; dead: number | null }
export async function checkHealth(probe: HealthProbe, timeoutMs = 3000): Promise<HealthReport> {
  async function bounded<T>(operation: () => Promise<T>): Promise<T | undefined> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([operation(), new Promise<undefined>((resolve) => { timer = setTimeout(() => resolve(undefined), timeoutMs); })]);
    } catch { return undefined; }
    finally { if (timer) clearTimeout(timer); }
  }
  const [database, storage, queue] = await Promise.all([bounded(() => probe.database()), bounded(() => probe.storage()), bounded(() => probe.queue())]);
  const queueHealthy = Boolean(queue && Number.isFinite(queue.oldestDueAgeMs) && queue.oldestDueAgeMs >= 0 && queue.oldestDueAgeMs <= 900_000 && Number.isSafeInteger(queue.dead) && queue.dead === 0);
  return { status: database === true && storage === true && queueHealthy ? 'ok' : 'degraded', checks: { database: database === true, storage: storage === true, queue: queueHealthy }, oldestDueAgeMs: queue?.oldestDueAgeMs ?? null, dead: queue?.dead ?? null };
}
