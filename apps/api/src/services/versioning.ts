import crypto from "node:crypto";
import type {
  AssessmentVersion,
  AssessmentVersionSnapshot,
  PublishVersionRequest,
} from "@ai-copilot/contracts";
import type { AssessmentTemplateService } from "./template.js";

export class VersionNotFoundError extends Error {
  constructor(message = "Assessment version not found") {
    super(message);
    this.name = "VersionNotFoundError";
  }
}

export class VersionImmutableViolationError extends Error {
  constructor(message = "Operation rejected: Published assessment versions are strictly immutable and cannot be modified") {
    super(message);
    this.name = "VersionImmutableViolationError";
  }
}

export class AssessmentVersioningService {
  private versionsById = new Map<string, AssessmentVersion>();
  private versionsByTemplateId = new Map<string, AssessmentVersion[]>();

  public computeContentHash(snapshot: AssessmentVersionSnapshot): string {
    const canonical = {
      durationMinutes: snapshot.durationMinutes,
      language: snapshot.language,
      rubricDimensionWeights: Object.keys(snapshot.rubricDimensionWeights)
        .sort()
        .reduce((acc, key) => {
          acc[key] = snapshot.rubricDimensionWeights[key]!;
          return acc;
        }, {} as Record<string, number>),
      starterCode: snapshot.starterCode.trim(),
      targetRole: snapshot.targetRole.trim(),
      title: snapshot.title.trim(),
      toolPolicy: {
        allowedModel: snapshot.toolPolicy.allowedModel,
        allowedProvider: snapshot.toolPolicy.allowedProvider,
        maxBudgetUsd: snapshot.toolPolicy.maxBudgetUsd,
        timeLimitSeconds: snapshot.toolPolicy.timeLimitSeconds,
        warningThresholdPercent: snapshot.toolPolicy.warningThresholdPercent,
      },
      verificationTestCode: snapshot.verificationTestCode.trim(),
    };

    return crypto
      .createHash("sha256")
      .update(JSON.stringify(canonical))
      .digest("hex");
  }

  public publishVersion(
    req: PublishVersionRequest,
    templateService: AssessmentTemplateService,
    memberId?: string
  ): AssessmentVersion {
    const template = templateService.getTemplateById(req.organizationId, req.templateId);
    if (!template) {
      throw new VersionNotFoundError(
        `Template '${req.templateId}' does not exist in organization '${req.organizationId}'`
      );
    }

    const snapshot: AssessmentVersionSnapshot = {
      title: template.title,
      description: template.description,
      targetRole: template.targetRole,
      difficulty: template.difficulty,
      language: template.language,
      durationMinutes: template.durationMinutes,
      starterCode: template.starterCode,
      solutionCode: template.solutionCode,
      verificationTestCode: template.verificationTestCode,
      toolPolicy: { ...template.toolPolicy },
      rubricDimensionWeights: { ...template.rubricDimensionWeights },
    };

    const contentHash = this.computeContentHash(snapshot);
    const existingVersions = this.versionsByTemplateId.get(req.templateId) ?? [];
    const latestVersion = existingVersions[existingVersions.length - 1];

    const versionNumber = this.computeNextVersionNumber(
      latestVersion?.versionNumber,
      req.versionType
    );
    const versionId = "ver_" + contentHash.substring(0, 12) + "_" + Date.now();
    const now = new Date();

    const version: AssessmentVersion = {
      id: versionId,
      templateId: req.templateId,
      organizationId: req.organizationId,
      versionNumber,
      contentHash,
      changelogNotes: req.changelogNotes,
      snapshot,
      isLocked: true,
      publishedByMemberId: memberId,
      publishedAt: now,
    };

    // Deep freeze snapshot to enforce runtime immutability in Node memory
    Object.freeze(version.snapshot);
    Object.freeze(version.snapshot.toolPolicy);
    Object.freeze(version.snapshot.rubricDimensionWeights);
    Object.freeze(version);

    this.versionsById.set(versionId, version);

    existingVersions.push(version);
    this.versionsByTemplateId.set(req.templateId, existingVersions);

    // Update parent template status to published
    templateService.publishTemplate(req.organizationId, req.templateId);

    return version;
  }

  public getVersionById(versionId: string, orgId?: string): AssessmentVersion | undefined {
    const version = this.versionsById.get(versionId);
    if (!version) return undefined;
    if (orgId && version.organizationId !== orgId) {
      return undefined;
    }
    return version;
  }

  public listVersionsForTemplate(templateId: string, orgId: string): AssessmentVersion[] {
    const versions = this.versionsByTemplateId.get(templateId) ?? [];
    return versions.filter((v) => v.organizationId === orgId);
  }

  public verifyVersionIntegrity(versionId: string): {
    verified: boolean;
    contentHash: string;
    computedHash: string;
  } {
    const version = this.versionsById.get(versionId);
    if (!version) {
      throw new VersionNotFoundError(`Version '${versionId}' not found`);
    }

    const computedHash = this.computeContentHash(version.snapshot);
    return {
      verified: computedHash === version.contentHash,
      contentHash: version.contentHash,
      computedHash,
    };
  }

  private computeNextVersionNumber(
    latestSemver?: string,
    type: "major" | "minor" | "patch" = "minor"
  ): string {
    if (!latestSemver) return "1.0.0";

    const parts = latestSemver.split(".").map(Number);
    let major = parts[0] || 1;
    let minor = parts[1] || 0;
    let patch = parts[2] || 0;

    if (type === "major") {
      major += 1;
      minor = 0;
      patch = 0;
    } else if (type === "patch") {
      patch += 1;
    } else {
      // default minor
      minor += 1;
      patch = 0;
    }

    return `${major}.${minor}.${patch}`;
  }
}

