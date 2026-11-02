import type {
  UsageEventRecord,
  SessionRecord,
  SessionMessageRecord,
} from "@ai-copilot/contracts";

export class UsageLedgerService {
  private events: UsageEventRecord[] = [];
  private sessions = new Map<string, SessionRecord>();
  private messages: SessionMessageRecord[] = [];

  public recordUsage(event: Omit<UsageEventRecord, "id" | "createdAt">): UsageEventRecord {
    const record: UsageEventRecord = {
      ...event,
      id: `usage_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date(),
    };
    this.events.push(record);
    return record;
  }

  public getAccountUsageSummary(userId?: string) {
    const userEvents = userId
      ? this.events.filter((e) => e.userId === userId)
      : this.events;

    const totalCost = userEvents.reduce((acc, e) => acc + (e.estimatedCostUsd || 0), 0);
    const totalRequests = userEvents.length;
    const totalInputUnits = userEvents.reduce((acc, e) => acc + e.inputUnits, 0);
    const totalOutputUnits = userEvents.reduce((acc, e) => acc + e.outputUnits, 0);

    return {
      totalRequests,
      totalInputUnits,
      totalOutputUnits,
      totalCostUsd: Number(totalCost.toFixed(5)),
      recentEvents: userEvents.slice(-10),
    };
  }

  public createSession(
    userId: string,
    title: string,
    taskType: string,
    provider: string
  ): SessionRecord {
    const session: SessionRecord = {
      id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId,
      title,
      taskType,
      provider,
      createdAt: new Date(),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  public listSessions(userId: string): SessionRecord[] {
    return Array.from(this.sessions.values()).filter((s) => s.userId === userId);
  }

  public getEventsForOrg(orgId: string): UsageEventRecord[] {
    return this.events.filter((e) => e.userId === orgId || (e.userId && e.userId.startsWith(`${orgId}:`)));
  }

  public getAllEvents(): UsageEventRecord[] {
    return [...this.events];
  }
}
