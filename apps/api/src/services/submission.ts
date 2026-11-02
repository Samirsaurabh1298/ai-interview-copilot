import crypto from "node:crypto";
import type {
  SubmissionArtifact,
  SubmitAssessmentRequest,
  CodeDiffSummary,
} from "@ai-copilot/contracts";
import { executeCodeInSandbox } from "@ai-copilot/code-runner";
import type { AssessmentSessionService } from "./session.js";
import type { AssessmentTemplateService } from "./template.js";
import type { SessionEventsService } from "./session-events.js";
import {
  SessionNotFoundError,
  SessionExpiredError,
  SessionInvalidStateError,
} from "./session.js";

export class SubmissionNotFoundError extends Error {
  constructor(message = "Submission not found for this session") {
    super(message);
    this.name = "SubmissionNotFoundError";
  }
}

/**
 * Computes a unified line-by-line diff between two code strings.
 */
export function computeLineDiff(original: string, modified: string): CodeDiffSummary {
  const origLines = original.split(/\r?\n/);
  const modLines = modified.split(/\r?\n/);

  let additions = 0;
  let deletions = 0;
  const diffChunks: string[] = ["--- starterCode", "+++ candidateSolution"];

  const maxLen = Math.max(origLines.length, modLines.length);
  let chunkStarted = false;

  for (let i = 0; i < maxLen; i++) {
    const orig = origLines[i];
    const mod = modLines[i];

    if (orig !== mod) {
      if (!chunkStarted) {
        diffChunks.push(`@@ -${i + 1},${Math.min(origLines.length - i, 5)} +${i + 1},${Math.min(modLines.length - i, 5)} @@`);
        chunkStarted = true;
      }
      if (orig !== undefined && mod === undefined) {
        deletions++;
        diffChunks.push(`- ${orig}`);
      } else if (orig === undefined && mod !== undefined) {
        additions++;
        diffChunks.push(`+ ${mod}`);
      } else {
        deletions++;
        additions++;
        diffChunks.push(`- ${orig}`);
        diffChunks.push(`+ ${mod}`);
      }
    } else {
      chunkStarted = false;
    }
  }

  return {
    additions,
    deletions,
    totalChanges: additions + deletions,
    unifiedDiff: diffChunks.join("\n"),
  };
}

/**
 * Produces deterministic, canonical JSON representation for cryptographic SHA-256 fingerprinting.
 */
export function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (Array.isArray(value)) {
    return "[" + value.map(canonicalizeJson).join(",") + "]";
  }

  const keys = Object.keys(value as Record<string, unknown>).sort();
  const entries = keys.map((key) => {
    const val = (value as Record<string, unknown>)[key];
    return `${JSON.stringify(key)}:${canonicalizeJson(val)}`;
  });
  return "{" + entries.join(",") + "}";
}

export class SubmissionService {
  private submissionsBySession = new Map<string, SubmissionArtifact>();

  constructor(
    private sessionService: AssessmentSessionService,
    private templateService: AssessmentTemplateService,
    private eventsService: SessionEventsService
  ) { }

  public async submitAssessment(
    sessionId: string,
    req: SubmitAssessmentRequest
  ): Promise<SubmissionArtifact> {
    const session = this.sessionService.getSession(sessionId);

    // If already submitted, return existing immutable artifact
    const existing = this.submissionsBySession.get(sessionId);
    if (existing && session.status === "submitted") {
      return existing;
    }

    if (session.status === "terminated") {
      throw new SessionInvalidStateError("Cannot submit a terminated session");
    }

    // Check expiration deadline against server authoritative clock
    const now = Date.now();
    const hardDeadlineMs =
      new Date(session.expiresAt).getTime() + session.gracePeriodSeconds * 1000;

    if (now > hardDeadlineMs && session.status === "expired") {
      throw new SessionExpiredError("Submission grace period has expired. Solution cannot be submitted.");
    }

    // 1. Fetch template for starterCode and verificationTestCode
    const template = this.templateService.getTemplateById(session.organizationId, session.templateId);
    if (!template) {
      throw new Error(`Template '${session.templateId}' not found in organization '${session.organizationId}'`);
    }

    // 2. Execute final code inside the isolated Node 22 sandbox to get authoritative test results
    const sandboxResult = await executeCodeInSandbox({
      code: req.finalCode,
      testCode: template.verificationTestCode,
      language: "typescript",
      timeoutMs: 5000,
      memoryLimitMb: 128,
    });

    const passedCount = sandboxResult.tests.filter((t) => t.passed).length;
    const totalCount = sandboxResult.tests.length;

    // 3. Compute code diff against template starterCode
    const codeDiff = computeLineDiff(template.starterCode, req.finalCode);

    // 4. Retrieve and aggregate all recorded telemetry events
    const events = this.eventsService.getEvents(sessionId);

    const aiQueriesCount = events.filter((e) => e.type === "ai_query").length;
    let acceptedPatches = 0;
    let rejectedPatches = 0;
    let blurCount = 0;
    let pasteCount = 0;

    for (const evt of events) {
      if (evt.type === "ai_patch_decision") {
        if (evt.payload?.decision === "accepted") acceptedPatches++;
        if (evt.payload?.decision === "rejected") rejectedPatches++;
      } else if (evt.type === "window_blur") {
        blurCount++;
      } else if (evt.type === "paste_detected") {
        pasteCount++;
      }
    }

    const telemetrySummary = {
      totalEvents: events.length,
      aiQueriesCount,
      consumedAiBudgetUsd: session.consumedAiBudgetUsd,
      patchDecisions: {
        accepted: acceptedPatches,
        rejected: rejectedPatches,
      },
      attentionMetrics: {
        blurCount,
        pasteCount,
      },
    };

    // 5. Template Content Hash
    const templateContentHash = crypto
      .createHash("sha256")
      .update(template.starterCode + "\n---TESTS---\n" + template.verificationTestCode)
      .digest("hex");

    const submissionId = `sub_${crypto.randomBytes(8).toString("hex")}_${Date.now()}`;
    const submitDate = new Date();

    // 6. Assemble pre-fingerprint payload
    const artifactDraft: Omit<SubmissionArtifact, "submissionFingerprint"> = {
      id: submissionId,
      sessionId,
      organizationId: session.organizationId,
      templateId: session.templateId,
      candidateName: session.candidateName,
      candidateEmail: session.candidateEmail,
      submittedAt: submitDate,
      finalCode: req.finalCode,
      starterCode: template.starterCode,
      codeDiff,
      testExecutionLog: {
        success: sandboxResult.success,
        passed: sandboxResult.passed,
        passedCount,
        totalCount,
        durationMs: sandboxResult.durationMs,
        tests: sandboxResult.tests,
        stdout: sandboxResult.stdout,
        stderr: sandboxResult.stderr,
        exitCode: sandboxResult.exitCode,
      },
      technicalExplanation: req.technicalExplanation,
      telemetrySummary,
      templateContentHash,
    };

    // 7. Compute cryptographic SHA-256 submission fingerprint
    const canonicalPayload = canonicalizeJson(artifactDraft);
    const submissionFingerprint = crypto
      .createHash("sha256")
      .update(canonicalPayload)
      .digest("hex");

    const finalArtifact: SubmissionArtifact = {
      ...artifactDraft,
      submissionFingerprint,
    };

    // 8. Persist immutable artifact
    this.submissionsBySession.set(sessionId, finalArtifact);

    // 9. Update session status to submitted
    session.status = "submitted";
    session.submittedAt = submitDate;
    session.updatedAt = submitDate;
    session.workspaceSnapshot.currentCode = req.finalCode;
    session.workspaceSnapshot.lastSavedAt = submitDate;
    session.workspaceSnapshot.lastTestPassedCount = passedCount;
    session.workspaceSnapshot.lastTestTotalCount = totalCount;

    // 10. Record submission event into telemetry audit stream
    this.eventsService.recordEventDirect(sessionId, "session_submitted", {
      submissionId,
      submissionFingerprint,
      passedCount,
      totalCount,
      totalChanges: codeDiff.totalChanges,
      aiQueriesCount,
    });

    return finalArtifact;
  }

  public getSubmission(sessionId: string): SubmissionArtifact {
    const artifact = this.submissionsBySession.get(sessionId);
    if (!artifact) {
      throw new SubmissionNotFoundError(`No submission recorded for session '${sessionId}'`);
    }
    return artifact;
  }
}
