import type { FastifyPluginAsync } from "fastify";
import type { AICostAnalyticsService } from "../services/analytics.js";
import type { AuthService } from "../services/auth.js";
import { isTenantOrAuthForbiddenError } from "../services/auth.js";

export const analyticsRoutes: FastifyPluginAsync<{
  analyticsService: AICostAnalyticsService;
  authService?: AuthService;
}> = async (fastify, opts) => {
  const { analyticsService, authService } = opts;

  // 1. Get Comprehensive AI Cost Analytics & Forecast
  fastify.get("/ai-costs", async (request, reply) => {
    const query = request.query as { organizationId?: string; period?: "7d" | "30d" | "all" };
    let orgId = query?.organizationId;
    const period = query?.period ?? "30d";

    if (authService && request.headers.authorization) {
      try {
        const auth = authService.parseAuthHeader(request.headers.authorization);
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

    try {
      const analytics = analyticsService.getCostAnalytics(orgId, period);
      return reply.status(200).send(analytics);
    } catch (err: unknown) {
      if (isTenantOrAuthForbiddenError(err)) {
        return reply.status(403).send({
          error: "FORBIDDEN",
          message: err instanceof Error ? err.message : "Forbidden",
        });
      }
      const message = err instanceof Error ? err.message : "Failed to compute cost analytics";
      return reply.status(400).send({ error: "ANALYTICS_FAILED", message });
    }
  });

  // 2. Get Burn Rate & Spend Runway Projections
  fastify.get("/burn-rate", async (request, reply) => {
    const query = request.query as { organizationId?: string };
    let orgId = query?.organizationId;

    if (authService && request.headers.authorization) {
      try {
        const auth = authService.parseAuthHeader(request.headers.authorization);
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

    try {
      const analytics = analyticsService.getCostAnalytics(orgId, "30d");
      return reply.status(200).send({
        organizationId: orgId,
        allocatedMonthlyBudgetUsd: analytics.allocatedMonthlyBudgetUsd,
        totalCostUsd: analytics.totalCostUsd,
        projectedMonthlySpendUsd: analytics.projectedMonthlySpendUsd,
        runwayDaysRemaining: analytics.runwayDaysRemaining,
        isOverBudget: analytics.isOverBudget,
        dailyBurnRate: analytics.dailyBurnRate,
      });
    } catch (err: unknown) {
      if (isTenantOrAuthForbiddenError(err)) {
        return reply.status(403).send({
          error: "FORBIDDEN",
          message: err instanceof Error ? err.message : "Forbidden",
        });
      }
      const message = err instanceof Error ? err.message : "Failed to compute burn rate";
      return reply.status(400).send({ error: "ANALYTICS_FAILED", message });
    }
  });

  // 3. Get Cost & Token Anomalies
  fastify.get("/anomalies", async (request, reply) => {
    const query = request.query as { organizationId?: string };
    let orgId = query?.organizationId;

    if (authService && request.headers.authorization) {
      try {
        const auth = authService.parseAuthHeader(request.headers.authorization);
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

    try {
      const analytics = analyticsService.getCostAnalytics(orgId, "all");
      return reply.status(200).send({
        organizationId: orgId,
        anomalies: analytics.anomalies,
        total: analytics.anomalies.length,
      });
    } catch (err: unknown) {
      if (isTenantOrAuthForbiddenError(err)) {
        return reply.status(403).send({
          error: "FORBIDDEN",
          message: err instanceof Error ? err.message : "Forbidden",
        });
      }
      const message = err instanceof Error ? err.message : "Failed to fetch anomalies";
      return reply.status(400).send({ error: "ANALYTICS_FAILED", message });
    }
  });
};

