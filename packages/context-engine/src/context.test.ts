import { describe, it, expect } from "vitest";
import path from "node:path";
import { indexRepository } from "./indexer.js";
import { retrieveRelevantContext } from "./retrieval.js";
import { DEFAULT_EXCLUDED_PATTERNS } from "./filter.js";

describe("Repository Context Engine", () => {
  const repoRoot = path.resolve(__dirname, "../../.."); // root of ai-interview-copilot

  it("indexes repository files while strictly excluding secrets and dependencies", () => {
    const index = indexRepository(repoRoot);
    expect(index.totalFiles).toBeGreaterThan(0);

    // Verify secrets and dependencies were never indexed
    for (const file of index.files) {
      expect(file.relativePath).not.toContain("node_modules/");
      expect(file.relativePath).not.toContain(".git/");
      expect(file.relativePath).not.toContain("dist/");
      if (file.relativePath !== ".env.example") {
        expect(file.relativePath).not.toMatch(/\.env($|\..*)/);
      }
    }
  });

  it("extracts symbols and retrieves relevant files for targeted queries", () => {
    const index = indexRepository(repoRoot);
    const results = retrieveRelevantContext(index, "executeCodeInSandbox runner");

    expect(results.length).toBeGreaterThan(0);
    const hasRunner = results.some((r) => r.path?.includes("runner.ts") || r.path?.includes("runner.js"));
    expect(hasRunner).toBe(true);
    expect(results[0]?.source).toBe("repository");
  });

  it("contains default exclusion patterns for credentials and build outputs", () => {
    expect(DEFAULT_EXCLUDED_PATTERNS).toContain("**/.env");
    expect(DEFAULT_EXCLUDED_PATTERNS).toContain("**/*.pem");
    expect(DEFAULT_EXCLUDED_PATTERNS).toContain("node_modules/**");
  });
});
