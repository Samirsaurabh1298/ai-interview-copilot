import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";

const testConfig: AppConfig = {
  PORT: 4001,
  HOST: "127.0.0.1",
  NODE_ENV: "test",
  DEFAULT_AI_PROVIDER: "mock",
  JWT_SECRET: "test-secret-key-32-chars-minimum-safe-12345",
};

describe("Assessment Versioning Routes (Task 9)", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp(testConfig);
    await app.ready();
  });

  it("publishes an immutable version and computes canonical SHA-256 fingerprint", async () => {
    // 1. Fetch organization to get orgId
    const orgRes = await app.inject({
      method: "GET",
      url: "/api/v1/organizations",
    });
    const { organizations } = JSON.parse(orgRes.body);
    const orgId = organizations[0].id;

    // 2. Fetch seeded template
    const tmplRes = await app.inject({
      method: "GET",
      url: `/api/v1/templates?organizationId=${orgId}`,
    });
    const { templates } = JSON.parse(tmplRes.body);
    const templateId = templates[0].id;

    // 3. Publish Version 1.0.0
    const publishRes = await app.inject({
      method: "POST",
      url: `/api/v1/templates/${templateId}/versions`,
      payload: {
        organizationId: orgId,
        templateId,
        versionType: "minor",
        changelogNotes: "Initial challenge baseline publication",
      },
    });

    expect(publishRes.statusCode).toBe(201);
    const version = JSON.parse(publishRes.body);
    expect(version.versionNumber).toBe("1.0.0");
    expect(version.contentHash).toBeDefined();
    expect(version.contentHash.length).toBe(64); // SHA-256 hex string

    // 4. Verify integrity endpoint returns valid
    const verifyRes = await app.inject({
      method: "GET",
      url: `/api/v1/versions/${version.id}/verify`,
    });
    expect(verifyRes.statusCode).toBe(200);
    const verification = JSON.parse(verifyRes.body);
    expect(verification.verified).toBe(true);
    expect(verification.contentHash).toBe(version.contentHash);
  });

  it("lists published immutable versions for a template", async () => {
    const orgRes = await app.inject({ method: "GET", url: "/api/v1/organizations" });
    const { organizations } = JSON.parse(orgRes.body);
    const orgId = organizations[0].id;

    const tmplRes = await app.inject({
      method: "GET",
      url: `/api/v1/templates?organizationId=${orgId}`,
    });
    const { templates } = JSON.parse(tmplRes.body);
    const templateId = templates[0].id;

    // Publish
    const pubRes = await app.inject({
      method: "POST",
      url: `/api/v1/templates/${templateId}/versions`,
      payload: {
        organizationId: orgId,
        templateId,
        versionType: "patch",
        changelogNotes: "Patch update with edge test fix",
      },
    });
    expect(pubRes.statusCode).toBe(201);

    const listRes = await app.inject({
      method: "GET",
      url: `/api/v1/templates/${templateId}/versions?organizationId=${orgId}`,
    });

    expect(listRes.statusCode).toBe(200);
    const data = JSON.parse(listRes.body);
    expect(data.total).toBe(1);
    expect(data.versions[0].templateId).toBe(templateId);
  });
});
