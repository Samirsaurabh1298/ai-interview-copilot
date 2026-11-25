import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";

describe("LOOP 11.0.2: Weak-AI Copilot Policy & Diff-Anchored Post-Fix Defense", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const config = loadConfig();
    config.NODE_ENV = "test";
    config.DEFAULT_AI_PROVIDER = "mock";
    app = await buildApp(config);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("enforces server-side flawed_junior & restricted_explainer AI policies and seals defenseResponses into SubmissionArtifact", async () => {
    // 1. Create Organization
    const orgRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Code Comprehension Labs",
        slug: "comprehension-labs-" + Date.now(),
        ownerEmail: "architect@cclabs.test",
        ownerName: "Lead Architect",
        plan: "enterprise",
      },
    });
    expect(orgRes.statusCode).toBe(201);
    const { organization: org } = JSON.parse(orgRes.body);

    const authRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: { organizationId: org.id, email: "architect@cclabs.test" },
    });
    expect(authRes.statusCode).toBe(200);
    const adminToken = JSON.parse(authRes.body).token;

    // 2. Author Template with flawed_junior repository task + restricted_explainer task
    const tasks = [
      {
        id: "task_repo_weak_ai",
        type: "repository_task",
        title: "Multi-File Triage Debug (Weak AI Round)",
        description: "Fix the priority sort inversion and array mutation across modules.",
        orderIndex: 0,
        estimatedMinutes: 45,
        points: 70,
        isRequired: true,
        aiPolicy: {
          mode: "flawed_junior",
          allowedModel: "gpt-4o-mini",
          maxBudgetUsd: 0.25,
          disclosureNotice: "Weak Junior AI active: verify every suggestion independently.",
        },
        config: {
          action: "debug",
          targetLanguage: "typescript",
          primaryFilePath: "src/sorter.ts",
          starterFiles: {
            "src/types.ts": "export interface Ticket { id: string; priority: 'P0' | 'P1' | 'P2'; createdAt: number; }",
            "src/sorter.ts": "import type { Ticket } from './types.ts';\nexport function sortTickets(t: Ticket[]) { return t.sort((a,b) => a.createdAt - b.createdAt); }",
          },
          verificationTestCode: `
import assert from "node:assert/strict";
import { sortTickets } from "./src/sorter.ts";
test("prioritizes P0 immutably", () => {
  const arr = [{ id: "2", priority: "P2", createdAt: 1 }, { id: "1", priority: "P0", createdAt: 2 }] as any;
  const snap = JSON.stringify(arr);
  const out = sortTickets(arr);
  assert.equal(out[0].id, "1");
  assert.equal(JSON.stringify(arr), snap);
});
`,
        },
      },
      {
        id: "task_code_explainer",
        type: "coding_challenge",
        title: "Memory Safety Explanation",
        description: "Explain immutability patterns without direct AI code generation.",
        orderIndex: 1,
        estimatedMinutes: 15,
        points: 30,
        isRequired: true,
        aiPolicy: {
          mode: "restricted_explainer",
          maxBudgetUsd: 0.15,
          disclosureNotice: "Explainer only; direct code patches disabled.",
        },
        config: {
          language: "typescript",
          starterCode: "export const clone = (x: number[]) => x;",
          verificationTestCode: "test('clones', () => { const a=[1]; if(clone(a)===a) throw new Error('mut'); });",
        },
      },
    ];

    const tmplRes = await app.inject({
      method: "POST",
      url: "/api/v1/templates",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        organizationId: org.id,
        title: "Code Comprehension Round Template",
        description: "Multi-file bug hunt with degraded junior AI and post-fix defense.",
        targetRole: "Senior Fullstack Engineer",
        difficulty: "senior",
        language: "typescript",
        durationMinutes: 60,
        tasks,
        starterCode: tasks[0]!.config.starterFiles!["src/sorter.ts"],
        verificationTestCode: tasks[0]!.config.verificationTestCode,
        toolPolicy: {
          allowedProvider: "mock",
          allowedModel: "gpt-4o-mini",
          maxBudgetUsd: 0.4,
          warningThresholdPercent: 80,
          timeLimitSeconds: 3600,
          allowInternetSearch: false,
          allowDocumentation: true,
        },
      },
    });
    expect(tmplRes.statusCode).toBe(201);
    const template = JSON.parse(tmplRes.body);

    const pubRes = await app.inject({
      method: "POST",
      url: `/api/v1/templates/${template.id}/versions`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        organizationId: org.id,
        templateId: template.id,
        versionType: "minor",
        changelogNotes: "Initial release for weak AI code comprehension round",
      },
    });
    expect(pubRes.statusCode).toBe(201);
    const version = JSON.parse(pubRes.body);

    const invRes = await app.inject({
      method: "POST",
      url: "/api/v1/invitations",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        organizationId: org.id,
        templateId: template.id,
        versionId: version.id,
        candidateName: "Maya Lin",
        candidateEmail: "maya@candidate.test",
        expiresInDays: 7,
      },
    });
    expect(invRes.statusCode).toBe(201);
    const invitation = JSON.parse(invRes.body);

    const acceptRes = await app.inject({
      method: "POST",
      url: `/api/v1/invitations/accept/${invitation.invitationToken}`,
      payload: { agreedToIntegrityPolicy: true },
    });
    expect(acceptRes.statusCode).toBe(200);
    const { sessionId, candidateToken } = JSON.parse(acceptRes.body);

    // 3. Candidate tries to bypass flawed_junior by sending policyMode: "full_copilot" and ?model=gpt-4o
    const weakAiRes = await app.inject({
      method: "POST",
      url: `/api/v1/answers/generate?sessionId=${sessionId}&taskId=task_repo_weak_ai&model=gpt-4o`,
      headers: { authorization: `Bearer ${candidateToken}` },
      payload: {
        task: "debug",
        question: "Fix the ticket sorting bug",
        policyMode: "full_copilot",
      },
    });
    expect(weakAiRes.statusCode).toBe(200);
    const weakAiBody = JSON.parse(weakAiRes.body);
    // Server locked model to task.aiPolicy.allowedModel ("gpt-4o-mini") and enforced flawed_junior prompt/output
    expect(weakAiBody.model).toBe("gpt-4o-mini");
    expect(weakAiBody.confidence).toBeLessThan(0.75);
    expect(weakAiBody.limitations.join(" ")).toContain("Flawed Junior AI Mode");

    // 4. Restricted Explainer strips code & codeChanges server-side
    const explainerRes = await app.inject({
      method: "POST",
      url: `/api/v1/answers/generate?sessionId=${sessionId}&taskId=task_code_explainer`,
      headers: { authorization: `Bearer ${candidateToken}` },
      payload: {
        task: "debug",
        question: "Give me the exact clone solution",
        policyMode: "full_copilot",
      },
    });
    expect(explainerRes.statusCode).toBe(200);
    const explainerBody = JSON.parse(explainerRes.body);
    expect(explainerBody.code).toBe("");
    expect(explainerBody.codeChanges).toEqual([]);

    // 5. Submit with fixed multi-file repository + Diff-Anchored Post-Fix Defense responses
    const fixedSorter = `import type { Ticket } from './types.ts';
const W: Record<string, number> = { P0: 3, P1: 2, P2: 1 };
export function sortTickets(t: Ticket[]) {
  return [...t].sort((a, b) => (W[b.priority] - W[a.priority]) || (a.createdAt - b.createdAt));
}`;

    const defenseResponses = [
      {
        questionId: "def_root_cause_diff",
        targetFile: "src/sorter.ts",
        anchorType: "modified_file" as const,
        prompt: "You modified [src/sorter.ts]. What specific defect did your diff resolve?",
        answer: "Replaced in-place .sort() with shallow copy [...t].sort() and prioritized P0>P1>P2 before FIFO createdAt tie-breaker.",
      },
      {
        questionId: "def_ai_critical_eval",
        anchorType: "ai_accepted_patch" as const,
        prompt: "What flaw in the Flawed Junior AI output did you reject?",
        answer: "The AI suggested calling items.sort() directly which would still mutate caller arrays and break React state equality.",
      },
    ];

    const submitRes = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/submit`,
      headers: { authorization: `Bearer ${candidateToken}` },
      payload: {
        finalCode: fixedSorter,
        technicalExplanation: "Fixed immutability and multi-key sorting; rejected AI's in-place mutation advice.",
        defenseResponses,
        taskSubmissions: {
          task_repo_weak_ai: {
            taskId: "task_repo_weak_ai",
            taskType: "repository_task",
            status: "completed",
            finalFiles: {
              "src/types.ts": tasks[0]!.config.starterFiles!["src/types.ts"]!,
              "src/sorter.ts": fixedSorter,
            },
            maxPoints: 70,
          },
        },
      },
    });

    expect(submitRes.statusCode).toBe(200);
    const submitData = JSON.parse(submitRes.body);
    expect(submitData.artifact.defenseResponses).toHaveLength(2);
    expect(submitData.artifact.defenseResponses[0].targetFile).toBe("src/sorter.ts");
    expect(submitData.artifact.testExecutionLog.passed).toBe(true);
    expect(submitData.artifact.submissionFingerprint).toMatch(/^[a-f0-9]{64}$/);

    // 6. Verify reviewer retrieval returns identical sealed defenseResponses
    const getSubRes = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${sessionId}/submission`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(getSubRes.statusCode).toBe(200);
    const getSubData = JSON.parse(getSubRes.body);
    expect(getSubData.artifact.defenseResponses).toEqual(defenseResponses);
  }, 20000);
});
