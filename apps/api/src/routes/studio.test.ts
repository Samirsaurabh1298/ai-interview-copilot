import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";

describe("Company Assessment Studio Integration Tests (LOOP 6)", () => {
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

  it("authors, publishes, and delivers a multi-task assessment with hidden test scrubbing and AI policy enforcement", async () => {
    const orgId = "org_studio_test_" + Date.now();

    // 1. Create Organization
    const orgRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Acme Cloud Infrastructure Inc.",
        slug: "acme-cloud-" + Date.now(),
        ownerEmail: "lead@acmecloud.com",
        ownerName: "Tech Lead",
        plan: "enterprise",
      },
    });
    expect(orgRes.statusCode).toBe(201);
    const { organization: org } = JSON.parse(orgRes.body);

    // 2. Author Multi-Task Assessment via Studio
    const studioTasks = [
      {
        id: "task_qset_arch",
        type: "question_set",
        title: "Section 1: Concurrency & State Machine Architecture",
        description: "Verify core distributed state fundamentals.",
        orderIndex: 0,
        estimatedMinutes: 20,
        points: 30,
        isRequired: true,
        aiPolicy: {
          mode: "prohibited",
          disclosureNotice: "AI Copilot is strictly prohibited during architecture questions.",
        },
        config: {
          questions: [
            {
              id: "q1_cas",
              format: "mcq_single",
              prompt: "Which synchronization primitive guarantees wait-free execution?",
              points: 10,
              isRequired: true,
              options: [
                { id: "opt_cas", text: "Atomic CAS with memory barriers", isCorrect: true },
                { id: "opt_lock", text: "Mutex lock", isCorrect: false },
              ],
            },
            {
              id: "q2_inversion",
              format: "short_text",
              prompt: "Explain priority inversion and its standard mitigation in async queues.",
              points: 20,
              isRequired: true,
              charLimit: 500,
              evaluationCriteria: "Should explain lower-priority locking and Priority Inheritance Protocols.",
            },
          ],
        },
      },
      {
        id: "task_code_rate_limiter",
        type: "coding_challenge",
        title: "Section 2: High-Throughput Token Bucket Limiter",
        description: "Implement token bucket rate limiter with lazy refill.",
        orderIndex: 1,
        estimatedMinutes: 40,
        points: 70,
        isRequired: true,
        aiPolicy: {
          mode: "full_copilot",
          maxBudgetUsd: 0.25,
          disclosureNotice: "Full AI Copilot enabled ($0.25 budget).",
        },
        config: {
          language: "typescript",
          starterCode: `export class TokenBucketRateLimiter {\n  public allow() { return true; }\n}`,
          verificationTestCode: `test("basic burst", () => {\n  const tb = new TokenBucketRateLimiter();\n  if (!tb.allow()) throw new Error("Failed");\n});`,
          hiddenTestCode: `test("hidden high-load stress check", () => {\n  const tb = new TokenBucketRateLimiter();\n  if (!tb.allow()) throw new Error("Stress failed");\n});`,
          testCases: [
            { name: "Public burst test", isHidden: false },
            { name: "Hidden high-load stress check", isHidden: true },
          ],
        },
      },
    ];

    const createTemplateRes = await app.inject({
      method: "POST",
      url: "/api/v1/templates",
      payload: {
        organizationId: org.id,
        title: "Staff Distributed Systems Engineer Assessment",
        slug: "staff-distributed-systems-" + Date.now(),
        description: "Multi-stage assessment verifying concurrency, architecture, and rate-limiting implementation.",
        targetRole: "Staff Distributed Systems Engineer",
        difficulty: "staff",
        language: "typescript",
        durationMinutes: 90,
        attemptDurationMinutes: 90,
        submissionDeadlineDays: 14,
        defaultAiBudgetUsd: 0.25,
        tasks: studioTasks,
      },
    });

    if (createTemplateRes.statusCode !== 201) {
      console.log("Create template failed:", createTemplateRes.body);
    }
    expect(createTemplateRes.statusCode).toBe(201);
    const template = JSON.parse(createTemplateRes.body);
    expect(template.tasks.length).toBe(2);
    expect(template.attemptDurationMinutes).toBe(90);
    expect(template.submissionDeadlineDays).toBe(14);

    // 3. Publish Immutable Version
    const publishRes = await app.inject({
      method: "POST",
      url: `/api/v1/templates/${template.id}/versions`,
      payload: {
        organizationId: org.id,
        templateId: template.id,
        versionType: "minor",
        changelogNotes: "Studio release: Multi-stage assessment with separate question set and coding challenge.",
      },
    });

    expect(publishRes.statusCode).toBe(201);
    const publishedVersion = JSON.parse(publishRes.body);
    expect(publishedVersion.contentHash).toBeDefined();
    expect(publishedVersion.versionNumber).toBe("1.0.0");
    expect(publishedVersion.snapshot.tasks.length).toBe(2);

    // 4. Create Candidate Invitation
    const inviteRes = await app.inject({
      method: "POST",
      url: "/api/v1/invitations",
      payload: {
        organizationId: org.id,
        templateId: template.id,
        versionId: publishedVersion.id,
        candidateName: "Devin Engineer",
        candidateEmail: "devin@candidate.com",
        expiresInDays: 14,
      },
    });

    expect(inviteRes.statusCode).toBe(201);
    const invitation = JSON.parse(inviteRes.body);

    // 5. Candidate Verification: Verify Hidden Tests and Solutions are SCRUBBED
    const verifyRes = await app.inject({
      method: "GET",
      url: `/api/v1/invitations/verify/${invitation.invitationToken}`,
    });

    expect(verifyRes.statusCode).toBe(200);
    const verifyData = JSON.parse(verifyRes.body);
    expect(verifyData.tasks.length).toBe(2);

    // Invariant: Hidden tests MUST NOT be exposed to candidate
    const candidateCodeTask = verifyData.tasks.find((t: any) => t.type === "coding_challenge");
    expect(candidateCodeTask).toBeDefined();
    expect(candidateCodeTask.config.hiddenTestCode).toBeUndefined();
    expect(candidateCodeTask.config.solutionTemplate).toBeUndefined();

    // 6. Candidate Accepts Invitation
    const acceptRes = await app.inject({
      method: "POST",
      url: `/api/v1/invitations/accept/${invitation.invitationToken}`,
      payload: {
        agreedToIntegrityPolicy: true,
      },
    });

    expect(acceptRes.statusCode).toBe(200);
    const acceptData = JSON.parse(acceptRes.body);
    const sessionId = acceptData.sessionId;
    const candidateToken = acceptData.candidateToken;
    expect(sessionId).toBeDefined();
    expect(candidateToken).toBeDefined();

    // 7. Verify Task-Level AI Policy Enforcement
    // Section 1 has aiPolicy.mode = "prohibited"
    const aiBlockedRes = await app.inject({
      method: "POST",
      url: `/api/v1/answers/generate?sessionId=${sessionId}&taskId=task_qset_arch`,
      headers: {
        authorization: `Bearer ${candidateToken}`,
      },
      payload: {
        task: "explain",
        question: "Explain CAS algorithm for this question",
      },
    });

    expect(aiBlockedRes.statusCode).toBe(403);
    const aiBlockedBody = JSON.parse(aiBlockedRes.body);
    expect(aiBlockedBody.error).toBe("AI_PROHIBITED_FOR_TASK");

    // Section 2 has aiPolicy.mode = "full_copilot" (Permitted)
    const aiAllowedRes = await app.inject({
      method: "POST",
      url: `/api/v1/answers/generate?sessionId=${sessionId}&taskId=task_code_rate_limiter`,
      headers: {
        authorization: `Bearer ${candidateToken}`,
      },
      payload: {
        task: "debug",
        question: "How do I implement lazy token refill?",
        code: "export class TokenBucketRateLimiter {}",
      },
    });

    expect(aiAllowedRes.statusCode).toBe(200);

    // 8. Multi-Task Final Submission
    const submitRes = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/submit`,
      headers: {
        authorization: `Bearer ${candidateToken}`,
      },
      payload: {
        finalCode: `export class TokenBucketRateLimiter {\n  public allow() { return true; }\n}`,
        technicalExplanation: "Completed questions and implemented token bucket rate limiter.",
        taskSubmissions: {
          task_qset_arch: {
            taskId: "task_qset_arch",
            taskType: "question_set",
            status: "completed",
            answers: {
              q1_cas: { selectedOptionIds: ["opt_cas"] },
              q2_inversion: { textResponse: "Priority inversion happens when a lower priority task holds a lock needed by a higher priority task." },
            },
            maxPoints: 30,
          },
          task_code_rate_limiter: {
            taskId: "task_code_rate_limiter",
            taskType: "coding_challenge",
            status: "completed",
            codeSubmission: {
              code: `export class TokenBucketRateLimiter {\n  public allow() { return true; }\n}`,
              language: "typescript",
            },
            maxPoints: 70,
          },
        },
      },
    });

    expect(submitRes.statusCode).toBe(200);
    const submitResult = JSON.parse(submitRes.body);
    expect(submitResult.status).toBe("submitted");
    expect(submitResult.submissionFingerprint).toBeDefined();

    // Verify taskSubmissions evaluated and persisted in artifact
    const artifact = submitResult.artifact;
    expect(artifact.taskSubmissions).toBeDefined();
    expect(artifact.taskSubmissions.task_qset_arch).toBeDefined();
    expect(artifact.taskSubmissions.task_qset_arch.earnedPoints).toBeGreaterThan(0);
    expect(artifact.taskSubmissions.task_code_rate_limiter).toBeDefined();
    expect(artifact.taskSubmissions.task_code_rate_limiter.codeSubmission.testResults.passed).toBe(true);
  });
});
