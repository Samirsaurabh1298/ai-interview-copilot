import { z } from "zod";

// ==============================================================================
// Webhook Event Types & Formats
// ==============================================================================

export const WebhookEventTypeSchema = z.enum([
  "candidate.invited",
  "candidate.started",
  "session.submitted",
  "session.expired",
  "calibration.completed",
  "report.finalized",
  "test.ping",
]);
export type WebhookEventType = z.infer<typeof WebhookEventTypeSchema>;

export const WebhookFormatSchema = z.enum([
  "standard",
  "greenhouse",
  "lever",
  "workday",
]);
export type WebhookFormat = z.infer<typeof WebhookFormatSchema>;

export const WebhookSubscriptionStatusSchema = z.enum([
  "active",
  "disabled",
  "failing",
]);
export type WebhookSubscriptionStatus = z.infer<typeof WebhookSubscriptionStatusSchema>;

// ==============================================================================
// Webhook Subscription Schema
// ==============================================================================

export const WebhookSubscriptionSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  targetUrl: z.string().url("Target URL must be a valid HTTP or HTTPS endpoint"),
  secret: z.string().min(16, "Secret key must be at least 16 characters for cryptographic HMAC signing"),
  eventTypes: z.array(z.union([WebhookEventTypeSchema, z.literal("*")])).min(1, "At least one event type or '*' must be selected"),
  format: WebhookFormatSchema.default("standard"),
  status: WebhookSubscriptionStatusSchema.default("active"),
  failureCount: z.number().int().default(0),
  createdAt: z.coerce.date().default(() => new Date()),
  updatedAt: z.coerce.date().default(() => new Date()),
});
export type WebhookSubscription = z.infer<typeof WebhookSubscriptionSchema>;

export const CreateWebhookSubscriptionRequestSchema = z.object({
  organizationId: z.string(),
  targetUrl: z.string().url("Target URL must be a valid HTTP or HTTPS endpoint"),
  secret: z.string().min(16).optional(),
  eventTypes: z.array(z.union([WebhookEventTypeSchema, z.literal("*")])).min(1, "At least one event type or '*' must be selected"),
  format: WebhookFormatSchema.optional().default("standard"),
});
export type CreateWebhookSubscriptionRequest = z.infer<typeof CreateWebhookSubscriptionRequestSchema>;

// ==============================================================================
// Webhook Delivery Log Schema
// ==============================================================================

export const WebhookDeliveryLogSchema = z.object({
  id: z.string(),
  subscriptionId: z.string(),
  organizationId: z.string(),
  eventType: WebhookEventTypeSchema,
  targetUrl: z.string(),
  format: WebhookFormatSchema,
  attemptCount: z.number().int().min(1),
  statusCode: z.number().int().optional(),
  success: z.boolean(),
  error: z.string().optional(),
  durationMs: z.number(),
  timestamp: z.coerce.date().default(() => new Date()),
  requestPayload: z.unknown(),
  responseBody: z.string().optional(),
});
export type WebhookDeliveryLog = z.infer<typeof WebhookDeliveryLogSchema>;

// ==============================================================================
// Webhook Event Payload Schema
// ==============================================================================

export const WebhookEventPayloadSchema = z.object({
  eventId: z.string(),
  eventType: WebhookEventTypeSchema,
  timestamp: z.coerce.date().default(() => new Date()),
  organizationId: z.string(),
  data: z.record(z.string(), z.unknown()),
});
export type WebhookEventPayload = z.infer<typeof WebhookEventPayloadSchema>;

