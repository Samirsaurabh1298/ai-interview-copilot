import { ApiClient } from "./apiClient.js";
import type { SessionEventType } from "@ai-copilot/contracts";

export interface BufferedEvent {
  sequenceNumber: number;
  type: SessionEventType;
  timestamp: Date;
  payload: Record<string, unknown>;
}

export class TelemetryClient {
  private buffer: BufferedEvent[] = [];
  private sequenceCounter = 0;
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;

  constructor(
    private sessionId: string,
    private token?: string
  ) {
    this.startPeriodicFlush();
  }

  public updateSession(sessionId: string, token?: string): void {
    this.sessionId = sessionId;
    if (token) this.token = token;
  }

  public record(
    type: SessionEventType,
    payload: Record<string, unknown> = {},
    immediate = false
  ): void {
    this.sequenceCounter += 1;
    this.buffer.push({
      sequenceNumber: this.sequenceCounter,
      type,
      timestamp: new Date(),
      payload,
    });

    if (immediate) {
      this.flush();
    }
  }

  public async flush(): Promise<void> {
    if (this.buffer.length === 0 || this.isFlushing) return;
    this.isFlushing = true;
    const batch = [...this.buffer];

    try {
      await ApiClient.ingestSessionEvents(
        this.sessionId,
        { events: batch },
        this.token
      );
      // Remove flushed events
      const lastEvent = batch[batch.length - 1];
      if (lastEvent) {
        const maxSeq = lastEvent.sequenceNumber;
        this.buffer = this.buffer.filter((e) => e.sequenceNumber > maxSeq);
      }
    } catch (err) {
      console.warn("Failed to flush session telemetry batch:", err);
    } finally {
      this.isFlushing = false;
    }
  }

  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, 10000);
  }

  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }
}
