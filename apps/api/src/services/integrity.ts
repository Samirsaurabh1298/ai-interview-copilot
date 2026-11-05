import crypto from "node:crypto";
import type {
  IntegrityScoreReport,
  IntegrityIncident,
  CreateProctorIncidentRequest,
  IntegrityRiskLevel,
} from "@ai-copilot/contracts";
import type { SessionEventsService } from "./session-events.js";
import type { AssessmentSessionService } from "./session.js";
import { ProctorIncidentRepository } from "../repositories/proctor-incident.repo.js";

export class IntegrityService {
  constructor(
    private sessionEventsService: SessionEventsService,
    private sessionService: AssessmentSessionService,
    private proctorIncidentRepo: ProctorIncidentRepository = new ProctorIncidentRepository()
  ) {}

  public async getIntegrityReport(sessionId: string): Promise<IntegrityScoreReport> {
    const session = this.sessionService.getSession(sessionId);
    const events = this.sessionEventsService.getEvents(sessionId);
    const incidents = await this.proctorIncidentRepo.listBySessionId(sessionId);

    let totalBlurCount = 0;
    let totalOffScreenDurationSeconds = 0;
    let unattributedPasteCount = 0;
    let unattributedPasteChars = 0;
    let aiQueriesCount = 0;
    let patchesAcceptedCount = 0;

    for (const evt of events) {
      if (evt.type === "window_blur") {
        totalBlurCount++;
        const dur = (evt.payload?.durationMs as number) || (evt.payload?.offScreenDurationMs as number) || 0;
        if (dur > 0) {
          totalOffScreenDurationSeconds += Math.round(dur / 1000);
        }
      } else if (evt.type === "window_focus") {
        const dur = (evt.payload?.durationMs as number) || 0;
        if (dur > 0) {
          totalOffScreenDurationSeconds += Math.round(dur / 1000);
        }
      } else if (evt.type === "paste_detected" || evt.type === "unattributed_paste") {
        const length = (evt.payload?.length as number) || (evt.payload?.charactersInserted as number) || 0;
        const isFromPatch = Boolean(evt.payload?.isFromCopilotPatch);
        if (!isFromPatch && length > 50) {
          unattributedPasteCount++;
          unattributedPasteChars += length;
        }
      } else if (evt.type === "ai_query") {
        aiQueriesCount++;
      } else if (evt.type === "ai_patch_decision") {
        if (evt.payload?.decision === "accepted") {
          patchesAcceptedCount++;
        }
      }
    }

    // Phase 3 Proctoring & Integrity Redesign:
    // Behavioral observations (blurs, dwell, paste events) are evidentiary signals for human reviewers,
    // NEVER candidate performance grades, rankings, or automated disqualification bots.
    const totalDurationSec = Math.max(60, (session.durationMinutes || 60) * 60);
    const focusRatePercent = Math.max(
      0,
      Math.min(100, Math.round(((totalDurationSec - totalOffScreenDurationSeconds) / totalDurationSec) * 100))
    );

    const hasUnresolvedCritical = incidents.some((i) => i.severity === "critical" && !i.isResolved);
    const hasUnresolvedWarning = incidents.some((i) => i.severity === "warning" && !i.isResolved);
    const hasUnresolvedTechnical = incidents.some((i) => i.category === "technical_issue" && !i.isResolved);

    let reviewStatus: "verified" | "review_recommended" | "unresolved_incident" = "verified";
    if (hasUnresolvedCritical) {
      reviewStatus = "unresolved_incident";
    } else if (hasUnresolvedWarning || unattributedPasteCount >= 3 || focusRatePercent < 80) {
      reviewStatus = "review_recommended";
    }

    let riskLevel: IntegrityRiskLevel = "clean";
    if (hasUnresolvedCritical || (unattributedPasteCount >= 3 && focusRatePercent < 60)) {
      riskLevel = "high";
    } else if (hasUnresolvedWarning || unattributedPasteCount >= 2 || focusRatePercent < 80) {
      riskLevel = "medium";
    } else if (totalBlurCount > 3 || unattributedPasteCount >= 1 || hasUnresolvedTechnical) {
      riskLevel = "low";
    }

    // Deprecated advisory index maintained for contract backwards-compatibility:
    // Reflects observation clarity, NOT candidate capability or guilt.
    let advisoryIndex = 100;
    if (riskLevel === "high") advisoryIndex = 45;
    else if (riskLevel === "medium") advisoryIndex = 70;
    else if (riskLevel === "low") advisoryIndex = 80;

    return {
      sessionId: session.id,
      candidateName: session.candidateName,
      candidateEmail: session.candidateEmail,
      status: session.status,
      integrityScore: advisoryIndex,
      riskLevel,
      reviewStatus,
      metrics: {
        totalBlurCount,
        totalOffScreenDurationSeconds,
        focusRatePercent,
        unattributedPasteCount,
        unattributedPasteChars,
        incidentFlagsCount: incidents.length,
        aiQueriesCount,
        patchesAcceptedCount,
      },
      incidents,
      evaluatedAt: new Date(),
    };
  }

  public async logIncident(
    sessionId: string,
    req: CreateProctorIncidentRequest,
    proctorName?: string
  ): Promise<IntegrityIncident> {
    const session = this.sessionService.getSession(sessionId);

    const incident: IntegrityIncident = {
      id: `inc_${crypto.randomBytes(8).toString("hex")}`,
      sessionId: session.id,
      organizationId: session.organizationId,
      severity: req.severity,
      category: req.category,
      description: req.description,
      proctorName: proctorName || "Staff Proctor",
      metadata: req.metadata,
      createdAt: new Date(),
      isResolved: false,
    };

    const saved = await this.proctorIncidentRepo.create(incident);

    // Also record as a session event for audit continuity
    this.sessionEventsService.recordEventDirect(
      sessionId,
      session.organizationId,
      "proctor_flag",
      {
        incidentId: incident.id,
        severity: incident.severity,
        category: incident.category,
        description: incident.description,
      }
    );

    return saved;
  }

  public async listIncidents(sessionId: string): Promise<IntegrityIncident[]> {
    this.sessionService.getSession(sessionId);
    return this.proctorIncidentRepo.listBySessionId(sessionId);
  }

  public async resolveIncident(incidentId: string): Promise<IntegrityIncident | null> {
    return this.proctorIncidentRepo.resolve(incidentId);
  }
}

