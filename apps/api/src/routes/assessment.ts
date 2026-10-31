import type { FastifyPluginAsync } from "fastify";
import {
  CandidateSubmissionSchema,
  type CandidateSubmission,
  type ToolPolicy,
} from "@ai-copilot/contracts";
import { AssessmentEvaluator } from "@ai-copilot/scoring-engine";
import type { AIUsageGatewayService } from "../services/gateway.js";
import type { UsageLedgerService } from "../services/ledger.js";

export const assessmentRoutes: FastifyPluginAsync<{
  gateway: AIUsageGatewayService;
  ledger: UsageLedgerService;
}> = async (fastify, opts) => {
  const { gateway, ledger } = opts;
  const evaluator = new AssessmentEvaluator();

  fastify.get("/policy", async (request, reply) => {
    const query = request.query as { sessionId?: string } | undefined;
    const policy = gateway.getPolicy(query?.sessionId);
    return reply.status(200).send(policy);
  });

  fastify.post("/session", async (request, reply) => {
    const body = request.body as {
      sessionId: string;
      policy?: Partial<ToolPolicy>;
      createdAt?: string;
    };
    if (!body?.sessionId) {
      return reply.status(400).send({ error: "sessionId is required" });
    }
    const createdDate = body.createdAt ? new Date(body.createdAt) : undefined;
    gateway.initializeSession(body.sessionId, body.policy, createdDate);
    return reply.status(201).send({
      sessionId: body.sessionId,
      policy: gateway.getPolicy(body.sessionId),
      budget: gateway.getBudgetStatus(body.sessionId),
    });
  });

  fastify.get("/budget/:sessionId", async (request, reply) => {
    const params = request.params as { sessionId: string };
    const budget = gateway.getBudgetStatus(params.sessionId);
    return reply.status(200).send(budget);
  });

  fastify.post("/evaluate", async (request, reply) => {
    const parseResult = CandidateSubmissionSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "INVALID_REQUEST_BODY",
        message: parseResult.error.message,
        issues: parseResult.error.issues,
      });
    }

    const submission: CandidateSubmission = parseResult.data;
    const sessionBudget = gateway.getBudgetStatus(submission.sessionId);
    const ledgerSummary = ledger.getAccountUsageSummary();

    const scorecard = evaluator.evaluateSubmission(submission, {
      totalCostUsd: sessionBudget.consumedBudgetUsd,
      aiPromptCount: ledgerSummary.totalRequests,
    });

    return reply.status(200).send(scorecard);
  });
};
