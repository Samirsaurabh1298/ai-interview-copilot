import crypto from "node:crypto";
import type {
  SessionEvent,
  IngestEventsRequest,
  IngestEventsResponse,
} from "@ai-copilot/contracts";
import type { AssessmentSessionService } from "./session.js";
import { SessionEventsRepository } from "../repositories/session-events.repo.js";

export class SessionEventsInvalidSequenceError extends Error {
  constructor(message = "Event sequence number is invalid or out of order") {
    super(message);
    this.name = "SessionEventsInvalidSequenceError";
  }
}

export class SessionEventsService {
  // Key: sessionId -> Array of SessionEvent (append-only log)
  private eventsBySession = new Map<string, SessionEvent[]>();
  private repo: SessionEventsRepository;

  constructor(
    private sessionService?: AssessmentSessionService,
    repo?: SessionEventsRepository
  ) {
    this.repo = repo ?? new SessionEventsRepository();
  }

  public async loadFromDatabase(sessionId: string): Promise<void> {
    try {
      const events = await this.repo.listBySession(sessionId);
      this.eventsBySession.set(sessionId, events);
    } catch (err) {
      console.error("[SessionEventsService] Failed to load from database:", err);
    }
  }

  public ingestEvents(
    sessionId: string,
    req: IngestEventsRequest
  ): IngestEventsResponse {
    if (this.sessionService) {
      // Verify session exists and is active/valid
      const session = this.sessionService.getSession(sessionId);
      if (session.status === "terminated") {
        throw new Error("Cannot record events: Assessment session has been terminated");
      }
    }

    let sessionEvents = this.eventsBySession.get(sessionId);
    if (!sessionEvents) {
      sessionEvents = [];
      this.eventsBySession.set(sessionId, sessionEvents);
    }

    let acceptedCount = 0;
    const existingSeq = new Set(sessionEvents.map((e) => e.sequenceNumber));

    // Sort incoming batch by sequenceNumber ascending
    const sortedBatch = [...req.events].sort(
      (a, b) => a.sequenceNumber - b.sequenceNumber
    );

    for (const item of sortedBatch) {
      // Skip duplicate sequence numbers (idempotent delivery)
      if (existingSeq.has(item.sequenceNumber)) {
        continue;
      }

      const event: SessionEvent = {
        id: item.id || `evt_${crypto.randomBytes(6).toString("hex")}_${Date.now()}`,
        sessionId,
        sequenceNumber: item.sequenceNumber,
        type: item.type,
        timestamp: item.timestamp ?? new Date(),
        payload: item.payload ?? {},
      };

      sessionEvents.push(event);
      existingSeq.add(item.sequenceNumber);
      acceptedCount++;
    }

    // Keep events strictly sorted by sequenceNumber
    sessionEvents.sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    // Durable write-through to PostgreSQL
    const insertedEvents = sessionEvents.slice(-acceptedCount);
    if (insertedEvents.length > 0) {
      this.repo.insertBatch(insertedEvents).catch((err) => {
        console.error("[SessionEventsService] DB events batch insert error:", err);
      });
    }

    const latestEvent = sessionEvents[sessionEvents.length - 1];
    const latestSeq = latestEvent ? latestEvent.sequenceNumber : 0;

    return {
      acceptedCount,
      latestSequenceNumber: latestSeq,
    };
  }

  public getEvents(sessionId: string): SessionEvent[] {
    if (this.sessionService) {
      this.sessionService.getSession(sessionId);
    }

    const events = this.eventsBySession.get(sessionId) || [];
    return [...events].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }

  public recordEventDirect(
    sessionId: string,
    type: SessionEvent["type"],
    payload: Record<string, unknown> = {}
  ): SessionEvent {
    let sessionEvents = this.eventsBySession.get(sessionId);
    if (!sessionEvents) {
      sessionEvents = [];
      this.eventsBySession.set(sessionId, sessionEvents);
    }

    const lastEvent = sessionEvents[sessionEvents.length - 1];
    const nextSeq = lastEvent ? lastEvent.sequenceNumber + 1 : 1;

    const event: SessionEvent = {
      id: `evt_${crypto.randomBytes(6).toString("hex")}_${Date.now()}`,
      sessionId,
      sequenceNumber: nextSeq,
      type,
      timestamp: new Date(),
      payload,
    };

    sessionEvents.push(event);

    // Durable write-through to PostgreSQL
    this.repo.insertBatch([event]).catch((err) => {
      console.error("[SessionEventsService] DB direct event insert error:", err);
    });

    return event;
  }
}

