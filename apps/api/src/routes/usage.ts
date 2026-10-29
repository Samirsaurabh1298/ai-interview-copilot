import type { FastifyPluginAsync } from "fastify";
import type { UsageLedgerService } from "../services/ledger.js";

export const usageRoutes: FastifyPluginAsync<{
  ledger: UsageLedgerService;
}> = async (fastify, opts) => {
  const { ledger } = opts;

  fastify.get("/", async (_request, reply) => {
    const summary = ledger.getAccountUsageSummary();
    return reply.status(200).send({
      quota: {
        plan: "pro_beta",
        monthlyAllowanceUsd: 25.0,
        remainingUsd: Math.max(0, 25.0 - summary.totalCostUsd),
      },
      usage: summary,
    });
  });

  fastify.get("/sessions", async (request, reply) => {
    const query = request.query as { userId?: string } | undefined;
    const userId = query?.userId ?? "default_local_user";
    const sessions = ledger.listSessions(userId);
    return reply.status(200).send({
      sessions,
      count: sessions.length,
    });
  });
};
