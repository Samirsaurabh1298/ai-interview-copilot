import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";

const testConfig: AppConfig = {
  PORT: 4007,
  HOST: "127.0.0.1",
  NODE_ENV: "test",
  DEFAULT_AI_PROVIDER: "mock",
  JWT_SECRET: "test-secret-key-minimum-32-characters-long-12345",
};

describe("Submission & Immutable Artifact Bundling Routes (Task 14 / AD #9)", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp(testConfig);
    await app.ready();
  });

  async function createTestSession() {
    const orgRes = await app.inject({ method: "GET", url: "/api/v1/organizations" });
    const { organizations } = JSON.parse(orgRes.body);
    const orgId = organizations[0]?.id;

    const tmplRes = await app.inject({
      method: "GET",
      url: `/api/v1/templates?organizationId=${orgId}`,
    });
    const { templates } = JSON.parse(tmplRes.body);
    const templateId = templates[0]?.id;

    const sessRes = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: {
        organizationId: orgId,
        templateId,
        candidateName: "Elena Rostova",
        candidateEmail: "elena@example.com",
        durationMinutes: 60,
      },
    });
    const session = JSON.parse(sessRes.body);

    // Login as interviewer to create candidate token
    const interviewerRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: { organizationId: orgId, email: "priya@acme.corp" },
    });
    const { token: interviewerToken } = JSON.parse(interviewerRes.body);

    const candTokenRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/candidate-token",
      headers: { Authorization: `Bearer ${interviewerToken}` },
      payload: {
        organizationId: orgId,
        sessionId: session.id,
        candidateId: "Elena Rostova",
        candidateEmail: "elena@example.com",
        validitySeconds: 3600,
      },
    });
    const { token: candidateToken } = JSON.parse(candTokenRes.body);

    // Login as reviewer
    const revRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: { organizationId: orgId, email: "marcus@acme.corp" },
    });
    const { token: reviewerToken } = JSON.parse(revRes.body);

    return { orgId, templateId, session, candidateToken, reviewerToken, interviewerToken };
  }

  it("submits candidate solution, executes sandbox verification, and generates canonical SHA-256 artifact", async () => {
    const { session, candidateToken } = await createTestSession();

    // Ingest some telemetry events first
    await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${session.id}/events`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        events: [
          { sequenceNumber: 1, type: "session_started", payload: {} },
          { sequenceNumber: 2, type: "ai_query", payload: { question: "How to fix sort mutation?" } },
          { sequenceNumber: 3, type: "ai_patch_decision", payload: { decision: "accepted" } },
          { sequenceNumber: 4, type: "window_blur", payload: { durationMs: 1500 } },
        ],
      },
    });

    const fixedCode = `
export const PRIORITY_WEIGHTS: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};

export interface Ticket {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in progress" | "resolved" | "closed";
  tags?: string[];
  createdAt: number;
}

export interface FilterOptions {
  searchQuery?: string;
  status?: string[];
  priority?: string[];
  tags?: string[];
}

export interface SortOptions {
  field: "createdAt" | "priority" | "title";
  order: "asc" | "desc";
}

export function filterAndSortTickets(
  tickets: Ticket[],
  filters: FilterOptions,
  sort: SortOptions
): Ticket[] {
  const result = tickets.filter((ticket) => {
    if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
      const q = filters.searchQuery.toLowerCase();
      if (!ticket.title.toLowerCase().includes(q) && !ticket.description.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (filters.status && filters.status.length > 0) {
      if (!filters.status.includes(ticket.status)) return false;
    }
    if (filters.priority && filters.priority.length > 0) {
      if (!filters.priority.includes(ticket.priority)) return false;
    }
    if (filters.tags && filters.tags.length > 0) {
      const ticketTags = ticket.tags || [];
      const matchesAll = filters.tags.every((tag) => ticketTags.includes(tag));
      if (!matchesAll) return false;
    }
    return true;
  });

  return [...result].sort((a, b) => {
    if (sort.field === "createdAt") {
      return sort.order === "asc" ? a.createdAt - b.createdAt : b.createdAt - a.createdAt;
    }
    if (sort.field === "priority") {
      const weightA = PRIORITY_WEIGHTS[a.priority] || 0;
      const weightB = PRIORITY_WEIGHTS[b.priority] || 0;
      return sort.order === "desc" ? weightB - weightA : weightA - weightB;
    }
    return 0;
  });
}
`;

    // Submit solution
    const submitRes = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${session.id}/submit`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        finalCode: fixedCode,
        technicalExplanation: "Fixed priority inversion in comparator and avoided in-place array mutation using spread copy.",
      },
    });

    expect(submitRes.statusCode).toBe(200);
    const body = JSON.parse(submitRes.body);
    expect(body.status).toBe("submitted");
    expect(body.submissionFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(body.artifact).toBeDefined();

    const { artifact } = body;
    expect(artifact.candidateName).toBe("Elena Rostova");
    expect(artifact.candidateEmail).toBe("elena@example.com");
    expect(artifact.technicalExplanation).toContain("Fixed priority inversion");
    expect(artifact.codeDiff.totalChanges).toBeGreaterThan(0);
    expect(artifact.codeDiff.unifiedDiff).toContain("+++ candidateSolution");

    // Authoritative test results from Node 22 sandbox
    expect(artifact.testExecutionLog.success).toBe(true);
    expect(artifact.testExecutionLog.passed).toBe(true);
    expect(artifact.testExecutionLog.passedCount).toBe(3);
    expect(artifact.testExecutionLog.totalCount).toBe(3);

    // Telemetry summary verified
    expect(artifact.telemetrySummary.aiQueriesCount).toBe(1);
    expect(artifact.telemetrySummary.patchDecisions.accepted).toBe(1);
    expect(artifact.telemetrySummary.attentionMetrics.blurCount).toBe(1);

    // Verify session status updated
    const sessCheck = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${session.id}`,
      headers: { Authorization: `Bearer ${candidateToken}` },
    });
    const updatedSess = JSON.parse(sessCheck.body);
    expect(updatedSess.status).toBe("submitted");
  });

  it("allows reviewer to fetch immutable submission artifact via GET", async () => {
    const { session, candidateToken, reviewerToken } = await createTestSession();

    // Candidate submits
    const submitRes = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${session.id}/submit`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        finalCode: "export const answer = 42;",
        technicalExplanation: "Minimal architectural submission.",
      },
    });
    expect(submitRes.statusCode).toBe(200);
    const { submissionFingerprint } = JSON.parse(submitRes.body);

    // Reviewer retrieves submission
    const getRes = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${session.id}/submission`,
      headers: { Authorization: `Bearer ${reviewerToken}` },
    });

    expect(getRes.statusCode).toBe(200);
    const getBody = JSON.parse(getRes.body);
    expect(getBody.artifact.sessionId).toBe(session.id);
    expect(getBody.artifact.submissionFingerprint).toBe(submissionFingerprint);
  });

  it("idempotently returns existing submission when submitted multiple times", async () => {
    const { session, candidateToken } = await createTestSession();

    const submitRes1 = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${session.id}/submit`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        finalCode: "export const x = 1;",
        technicalExplanation: "First submission attempt.",
      },
    });
    expect(submitRes1.statusCode).toBe(200);
    const { submissionFingerprint: fp1 } = JSON.parse(submitRes1.body);

    // Second submit attempt
    const submitRes2 = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${session.id}/submit`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        finalCode: "export const x = 2;",
        technicalExplanation: "Second submission attempt.",
      },
    });
    expect(submitRes2.statusCode).toBe(200);
    const { submissionFingerprint: fp2 } = JSON.parse(submitRes2.body);

    // Fingerprint remains identical (immutable snapshot)
    expect(fp1).toBe(fp2);
  });

  it("prohibits a candidate from viewing another candidate's submission (anti-IDOR)", async () => {
    const { orgId, templateId, session: victimSession, interviewerToken } = await createTestSession();

    // Attacker session
    const attackerSessRes = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: {
        organizationId: orgId,
        templateId,
        candidateName: "Attacker",
        candidateEmail: "attacker@example.com",
        durationMinutes: 60,
      },
    });
    const attackerSession = JSON.parse(attackerSessRes.body);

    const tokenRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/candidate-token",
      headers: { Authorization: `Bearer ${interviewerToken}` },
      payload: {
        organizationId: orgId,
        sessionId: attackerSession.id,
        candidateId: "Attacker",
        validitySeconds: 3600,
      },
    });
    const { token: attackerToken } = JSON.parse(tokenRes.body);

    // Attacker tries to inspect victim's submission
    const getRes = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${victimSession.id}/submission`,
      headers: { Authorization: `Bearer ${attackerToken}` },
    });

    expect(getRes.statusCode).toBe(403);
    const err = JSON.parse(getRes.body);
    expect(err.error).toBe("FORBIDDEN");
  });
});
