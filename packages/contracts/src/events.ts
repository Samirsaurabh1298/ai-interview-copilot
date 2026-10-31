import { z } from "zod";

export const SessionEventTypeSchema = z.enum([
  "session_started",
  "code_snapshot",
  "test_run",
  "ai_query",
  "ai_patch_proposed",
  "ai_patch_decision",
  "window_blur",
  "window_focus",
  "paste_detected",
  "session_submitted",
]);
export type SessionEventType = z.infer<typeof SessionEventTypeSchema>;

export const SessionEventPayloadSchema = z.record(z.string(), z.unknown());

export const SessionEventSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  sequenceNumber: z.number().int().min(1),
  type: SessionEventTypeSchema,
  timestamp: z.coerce.date().default(() => new Date()),
  payload: SessionEventPayloadSchema.default({}),
});
export type SessionEvent = z.infer<typeof SessionEventSchema>;

export const IngestEventsRequestSchema = z.object({
  events: z.array(
    z.object({
      id: z.string().optional(),
      sequenceNumber: z.number().int().min(1),
      type: SessionEventTypeSchema,
      timestamp: z.coerce.date().optional(),
      payload: SessionEventPayloadSchema.optional(),
    })
  ).min(1, "At least one event is required in an ingestion batch"),
});
export type IngestEventsRequest = z.infer<typeof IngestEventsRequestSchema>;

export const IngestEventsResponseSchema = z.object({
  acceptedCount: z.number().int(),
  latestSequenceNumber: z.number().int(),
});
export type IngestEventsResponse = z.infer<typeof IngestEventsResponseSchema>;

export const GetSessionEventsResponseSchema = z.object({
  sessionId: z.string(),
  events: z.array(SessionEventSchema),
  total: z.number().int(),
});
export type GetSessionEventsResponse = z.infer<typeof GetSessionEventsResponseSchema>;
