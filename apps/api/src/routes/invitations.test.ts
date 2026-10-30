import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";

const testConfig: AppConfig = {
  PORT: 4002,
  HOST: "127.0.0.1",
  NODE_ENV: "test",
  DEFAULT_AI_PROVIDER: "mock",
  JWT_SECRET: "test-secret-key-minimum-32-characters-long-12345",
};

describe("Candidate Invitation & Onboarding Routes (Task 10)", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp(testConfig);
    await app.ready();
  });

  it("allows interviewer to issue candidate invitation with secure token", async () => {
    // 1. Get organization and member
    const orgRes = await app.inject({ method: "GET", url: "/api/v1/organizations" });
    const { organizations } = JSON.parse(orgRes.body);
    const orgId = organizations[0].id;

    const tmplRes = await app.inject({
      method: "GET",
      url: `/api/v1/templates?organizationId=${orgId}`,
    });
    const { templates } = JSON.parse(tmplRes.body);
    const templateId = templates[0].id;

    // Login as interviewer
    const authRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: { organizationId: orgId, email: "priya@acme.corp" },
    });
    const { token: interviewerToken } = JSON.parse(authRes.body);

    // 2. Issue invitation
    const inviteRes = await app.inject({
      method: "POST",
      url: "/api/v1/invitations",
      headers: { Authorization: `Bearer ${interviewerToken}` },
      payload: {
        organizationId: orgId,
        templateId,
        candidateName: "Jordan Lee",
        candidateEmail: "jordan.lee@example.com",
        expiresInDays: 7,
      },
    });

    expect(inviteRes.statusCode).toBe(201);
    const invitation = JSON.parse(inviteRes.body);
    expect(invitation.id).toMatch(/^inv_/);
    expect(invitation.candidateEmail).toBe("jordan.lee@example.com");
    expect(invitation.invitationToken.length).toBe(64); // 32 bytes hex
    expect(invitation.status).toBe("pending");
  });

  it("rejects invitation creation if member has reviewer role (RBAC)", async () => {
    const orgRes = await app.inject({ method: "GET", url: "/api/v1/organizations" });
    const { organizations } = JSON.parse(orgRes.body);
    const orgId = organizations[0].id;

    const tmplRes = await app.inject({
      method: "GET",
      url: `/api/v1/templates?organizationId=${orgId}`,
    });
    const { templates } = JSON.parse(tmplRes.body);
    const templateId = templates[0].id;

    // Login as reviewer
    const authRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: { organizationId: orgId, email: "marcus@acme.corp" },
    });
    const { token: reviewerToken } = JSON.parse(authRes.body);

    const inviteRes = await app.inject({
      method: "POST",
      url: "/api/v1/invitations",
      headers: { Authorization: `Bearer ${reviewerToken}` },
      payload: {
        organizationId: orgId,
        templateId,
        candidateName: "Alex Mercer",
        candidateEmail: "alex@example.com",
      },
    });

    expect(inviteRes.statusCode).toBe(403);
    const err = JSON.parse(inviteRes.body);
    expect(err.error).toBe("FORBIDDEN");
  });

  it("verifies invitation token and returns candidate challenge brief", async () => {
    const orgRes = await app.inject({ method: "GET", url: "/api/v1/organizations" });
    const { organizations } = JSON.parse(orgRes.body);
    const orgId = organizations[0].id;

    const tmplRes = await app.inject({
      method: "GET",
      url: `/api/v1/templates?organizationId=${orgId}`,
    });
    const { templates } = JSON.parse(tmplRes.body);
    const templateId = templates[0].id;

    // Create invitation
    const inviteRes = await app.inject({
      method: "POST",
      url: "/api/v1/invitations",
      payload: {
        organizationId: orgId,
        templateId,
        candidateName: "Samir Dev",
        candidateEmail: "samir@example.com",
      },
    });
    const { invitationToken } = JSON.parse(inviteRes.body);

    // Verify token
    const verifyRes = await app.inject({
      method: "GET",
      url: `/api/v1/invitations/verify/${invitationToken}`,
    });

    expect(verifyRes.statusCode).toBe(200);
    const details = JSON.parse(verifyRes.body);
    expect(details.templateTitle).toBe("Frontend Engineer: Support Triage Queue");
    expect(details.durationMinutes).toBe(60);
    expect(details.organizationName).toBe("Acme Corp (Engineering)");
  });

  it("accepts invitation with integrity agreement and provisions candidate assessment session", async () => {
    const orgRes = await app.inject({ method: "GET", url: "/api/v1/organizations" });
    const { organizations } = JSON.parse(orgRes.body);
    const orgId = organizations[0].id;

    const tmplRes = await app.inject({
      method: "GET",
      url: `/api/v1/templates?organizationId=${orgId}`,
    });
    const { templates } = JSON.parse(tmplRes.body);
    const templateId = templates[0].id;

    const inviteRes = await app.inject({
      method: "POST",
      url: "/api/v1/invitations",
      payload: {
        organizationId: orgId,
        templateId,
        candidateName: "Taylor Swift",
        candidateEmail: "taylor@example.com",
      },
    });
    const { invitationToken } = JSON.parse(inviteRes.body);

    // Accept invitation
    const acceptRes = await app.inject({
      method: "POST",
      url: `/api/v1/invitations/accept/${invitationToken}`,
      payload: { agreedToIntegrityPolicy: true },
    });

    expect(acceptRes.statusCode).toBe(200);
    const session = JSON.parse(acceptRes.body);
    expect(session.sessionId).toMatch(/^sess_/);
    expect(session.candidateToken).toBeDefined();
    expect(session.starterCode).toBeDefined();
    expect(session.verificationTestCode).toBeDefined();
    expect(session.durationMinutes).toBe(60);
    expect(session.invitation.status).toBe("started");
  });
});

