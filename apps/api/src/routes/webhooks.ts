import type { FastifyPluginAsync } from "fastify";
import {
  CreateWebhookSubscriptionRequestSchema,
} from "@ai-copilot/contracts";
import type { WebhookService } from "../services/webhook.js";
import { WebhookSubscriptionNotFoundError } from "../services/webhook.js";
import type { AuthService } from "../services/auth.js";
import {
  isTenantOrAuthForbiddenError,
} from "../services/auth.js";

export const webhooksRoutes: FastifyPluginAsync<{
  webhookService: WebhookService;
  authService?: AuthService;
}> = async (fastify, opts) => {
  const { webhookService, authService } = opts;

  // 1. Create Webhook Subscription (Owner/Admin only)
  fastify.post("/subscriptions", async (request, reply) => {
    const parse = CreateWebhookSubscriptionRequestSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: "VALIDATION_FAILED",
        issues: parse.error.issues,
      });
    }

    try {
      if (authService && request.headers.authorization) {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        authService.assertTenantAccess(auth, parse.data.organizationId);
        if (!["owner", "admin"].includes(auth.role)) {
          return reply.status(403).send({
            error: "FORBIDDEN",
            message: `Role '${auth.role}' is not authorized to configure webhooks`,
          });
        }
      }

      const subscription = webhookService.createSubscription(parse.data);
      return reply.status(201).send(subscription);
    } catch (err: unknown) {
      if (isTenantOrAuthForbiddenError(err)) {
        return reply.status(403).send({
          error: "FORBIDDEN",
          message: err instanceof Error ? err.message : "Forbidden",
        });
      }
      const message = err instanceof Error ? err.message : "Failed to create webhook subscription";
      return reply.status(400).send({ error: "SUBSCRIPTION_CREATION_FAILED", message });
    }
  });

  // 2. List Webhook Subscriptions for Organization
  fastify.get("/subscriptions", async (request, reply) => {
    const query = request.query as { organizationId?: string };
    let orgId = query?.organizationId;

    if (authService && request.headers.authorization) {
      try {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        authService.assertCompanyMember(auth);
        if (orgId) {
          authService.assertTenantAccess(auth, orgId);
        } else {
          orgId = auth.organizationId;
        }
      } catch (err: unknown) {
        if (isTenantOrAuthForbiddenError(err)) {
          return reply.status(403).send({
            error: "FORBIDDEN",
            message: err instanceof Error ? err.message : "Forbidden",
          });
        }
        return reply.status(401).send({ error: "UNAUTHORIZED", message: "Authentication failed" });
      }
    }

    if (!orgId) {
      return reply.status(400).send({
        error: "MISSING_ORGANIZATION_ID",
        message: "Query parameter 'organizationId' or Authorization header is required",
      });
    }

    const subscriptions = webhookService.listSubscriptions(orgId);
    return reply.status(200).send({ subscriptions, total: subscriptions.length });
  });

  // 3. Delete Webhook Subscription
  fastify.delete("/subscriptions/:subscriptionId", async (request, reply) => {
    const { subscriptionId } = request.params as { subscriptionId: string };
    const query = request.query as { organizationId?: string };
    let orgId = query?.organizationId;

    if (authService && request.headers.authorization) {
      try {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        authService.assertCompanyMember(auth);
        if (orgId) {
          authService.assertTenantAccess(auth, orgId);
        } else {
          orgId = auth.organizationId;
        }

        if (!["owner", "admin"].includes(auth.role)) {
          return reply.status(403).send({
            error: "FORBIDDEN",
            message: `Role '${auth.role}' is not authorized to delete webhooks`,
          });
        }
      } catch (err: unknown) {
        if (isTenantOrAuthForbiddenError(err)) {
          return reply.status(403).send({
            error: "FORBIDDEN",
            message: err instanceof Error ? err.message : "Forbidden",
          });
        }
        return reply.status(401).send({ error: "UNAUTHORIZED", message: "Authentication failed" });
      }
    }

    if (!orgId) {
      return reply.status(400).send({
        error: "MISSING_ORGANIZATION_ID",
        message: "Query parameter 'organizationId' or Authorization header is required",
      });
    }

    const deleted = webhookService.deleteSubscription(orgId, subscriptionId);
    if (!deleted) {
      return reply.status(404).send({
        error: "NOT_FOUND",
        message: `Webhook subscription '${subscriptionId}' not found`,
      });
    }

    return reply.status(204).send();
  });

  // 4. Test Webhook Dispatch (Ping test endpoint)
  fastify.post("/subscriptions/:subscriptionId/test", async (request, reply) => {
    const { subscriptionId } = request.params as { subscriptionId: string };
    const query = request.query as { organizationId?: string };
    let orgId = query?.organizationId;

    if (authService && request.headers.authorization) {
      try {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        authService.assertCompanyMember(auth);
        if (orgId) {
          authService.assertTenantAccess(auth, orgId);
        } else {
          orgId = auth.organizationId;
        }
      } catch (err: unknown) {
        if (isTenantOrAuthForbiddenError(err)) {
          return reply.status(403).send({
            error: "FORBIDDEN",
            message: err instanceof Error ? err.message : "Forbidden",
          });
        }
        return reply.status(401).send({ error: "UNAUTHORIZED", message: "Authentication failed" });
      }
    }

    if (!orgId) {
      return reply.status(400).send({
        error: "MISSING_ORGANIZATION_ID",
        message: "Query parameter 'organizationId' is required",
      });
    }

    const sub = webhookService.getSubscription(orgId, subscriptionId);
    if (!sub) {
      return reply.status(404).send({
        error: "NOT_FOUND",
        message: `Webhook subscription '${subscriptionId}' not found in organization`,
      });
    }

    const testEvent = {
      eventId: "test_ping_" + Date.now(),
      eventType: "test.ping" as const,
      timestamp: new Date(),
      organizationId: orgId,
      data: {
        message: "Webhook delivery test ping from AI Interview Copilot",
        subscriptionId: sub.id,
        targetUrl: sub.targetUrl,
        format: sub.format,
      },
    };

    const deliveryLogs = await webhookService.dispatch(testEvent);
    const log = deliveryLogs.find((l) => l.subscriptionId === subscriptionId);

    return reply.status(200).send({
      success: log?.success ?? false,
      deliveryLog: log,
    });
  });

  // 5. Query Webhook Delivery Logs
  fastify.get("/logs", async (request, reply) => {
    const query = request.query as { organizationId?: string; subscriptionId?: string };
    let orgId = query?.organizationId;

    if (authService && request.headers.authorization) {
      try {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        authService.assertCompanyMember(auth);
        if (orgId) {
          authService.assertTenantAccess(auth, orgId);
        } else {
          orgId = auth.organizationId;
        }
      } catch (err: unknown) {
        if (isTenantOrAuthForbiddenError(err)) {
          return reply.status(403).send({
            error: "FORBIDDEN",
            message: err instanceof Error ? err.message : "Forbidden",
          });
        }
        return reply.status(401).send({ error: "UNAUTHORIZED", message: "Authentication failed" });
      }
    }

    if (!orgId) {
      return reply.status(400).send({
        error: "MISSING_ORGANIZATION_ID",
        message: "Query parameter 'organizationId' or Authorization header is required",
      });
    }

    const logs = webhookService.listDeliveryLogs(orgId, query?.subscriptionId);
    return reply.status(200).send({ logs, total: logs.length });
  });
};

