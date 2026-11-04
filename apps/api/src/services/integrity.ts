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

    // Deterministic Score Calculation
    // Base 100
    let penalty = 0;

    // Window blur penalty (3 pts each, max 20)
    penalty += Math.min(20, totalBlurCount * 3);

    // Off-screen dwell penalty (1 pt per 15s away, max 25)
    penalty += Math.min(25, Math.floor(totalOffScreenDurationSeconds / 15));

    // Unattributed paste penalty (10 pts per paste > 50 chars, max 30)
    penalty += Math.min(30, unattributedPasteCount * 10);

    // Proctor incident penalty
    for (const inc of incidents) {
      if (!inc.isResolved) {
        if (inc.severity === "critical") penalty += 25;
        else if (inc.severity === "warning") penalty += 10;
        else penalty += 3;
      }
    }

    const rawScore = Math.max(0, Math.min(100, 100 - penalty));

    let riskLevel: IntegrityRiskLevel = "clean";
    if (rawScore < 50 || incidents.some((i) => i.severity === "critical" && !i.isResolved)) {
      riskLevel = "high";
    } else if (rawScore < 70) {
      riskLevel = "medium";
    } else if (rawScore < 85) {
      riskLevel = "low";
    }

    return {
      sessionId: session.id,
      candidateName: session.candidateName,
      candidateEmail: session.candidateEmail,
      status: session.status,
      integrityScore: rawScore,
      riskLevel,
      metrics: {
        totalBlurCount,
        totalOffScreenDurationSeconds,
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
