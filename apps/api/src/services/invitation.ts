import crypto from "node:crypto";
import type {
  CandidateInvitation,
  CreateInvitationRequest,
  VerifyInvitationResponse,
  AcceptInvitationResponse,
} from "@ai-copilot/contracts";
import { scrubTaskForCandidate } from "@ai-copilot/contracts";
import type { AssessmentTemplateService } from "./template.js";
import type { OrganizationService } from "./organization.js";
import type { AuthService } from "./auth.js";
import type { AssessmentSessionService } from "./session.js";
import { InvitationRepository } from "../repositories/invitation.repo.js";
import type { EmailDeliveryService } from "./email.js";

export class InvitationNotFoundError extends Error {
  constructor(message = "Candidate invitation not found") {
    super(message);
    this.name = "InvitationNotFoundError";
  }
}

export class InvitationExpiredError extends Error {
  constructor(message = "Candidate invitation has expired") {
    super(message);
    this.name = "InvitationExpiredError";
  }
}

export class InvitationInvalidStateError extends Error {
  constructor(message = "Candidate invitation is not in a valid state") {
    super(message);
    this.name = "InvitationInvalidStateError";
  }
}

export class CandidateInvitationService {
  // Key: invitationId -> CandidateInvitation
  private invitationsById = new Map<string, CandidateInvitation>();
  // Key: token -> invitationId
  private tokenToId = new Map<string, string>();
  // Key: orgId -> Set<invitationId>
  private orgInvitations = new Map<string, Set<string>>();
  private repo: InvitationRepository;

  constructor(
    private templateService: AssessmentTemplateService,
    private orgService: OrganizationService,
    private authService: AuthService,
    private sessionService?: AssessmentSessionService,
    private emailService?: EmailDeliveryService,
    private baseUrl?: string,
    repo?: InvitationRepository
  ) {
    this.repo = repo ?? new InvitationRepository();
  }

  public async loadFromDatabase(orgId?: string): Promise<void> {
    try {
      if (orgId) {
        const list = await this.repo.listByOrg(orgId);
        let orgSet = this.orgInvitations.get(orgId);
        if (!orgSet) {
          orgSet = new Set();
          this.orgInvitations.set(orgId, orgSet);
        }
        for (const inv of list) {
          this.invitationsById.set(inv.id, inv);
          this.tokenToId.set(inv.invitationToken, inv.id);
          orgSet.add(inv.id);
        }
      }
    } catch (err) {
      console.error("[CandidateInvitationService] Failed to load from database:", err);
    }
  }

  public createInvitation(
    req: CreateInvitationRequest,
    invitedByMemberId?: string
  ): CandidateInvitation {
    const org = this.orgService.getOrganizationById(req.organizationId);
    if (!org) {
      throw new Error(`Organization '${req.organizationId}' does not exist`);
    }

    const template = this.templateService.getTemplateById(req.organizationId, req.templateId);
    if (!template) {
      throw new Error(`Assessment template '${req.templateId}' does not exist in organization`);
    }

    const invitationId = "inv_" + crypto.randomBytes(6).toString("hex") + "_" + Date.now();
    const invitationToken = crypto.randomBytes(32).toString("hex");

    const expiresInDays = req.expiresInDays ?? 7;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    const now = new Date();

    const invitation: CandidateInvitation = {
      id: invitationId,
      organizationId: req.organizationId,
      templateId: req.templateId,
      versionId: req.versionId,
      candidateEmail: req.candidateEmail.toLowerCase().trim(),
      candidateName: req.candidateName.trim(),
      invitationToken,
      status: "pending",
      expiresAt,
      invitedByMemberId,
      createdAt: now,
    };

    this.invitationsById.set(invitationId, invitation);
    this.tokenToId.set(invitationToken, invitationId);

    let orgSet = this.orgInvitations.get(req.organizationId);
    if (!orgSet) {
      orgSet = new Set();
      this.orgInvitations.set(req.organizationId, orgSet);
    }
    orgSet.add(invitationId);

    // Durable write-through to PostgreSQL
    this.repo.create(invitation).catch((err) => {
      console.error("[CandidateInvitationService] DB invitation create error:", err);
    });

    // Transactional candidate invitation email dispatch
    const baseUrl = this.baseUrl || process.env.APP_BASE_URL || "http://localhost:5173";
    const assessmentUrl = `${baseUrl}/?invite=${invitationToken}`;

    if (this.emailService) {
      this.emailService
        .sendCandidateInvitation({
          to: invitation.candidateEmail,
          candidateName: invitation.candidateName,
          organizationName: org.name,
          roleTitle: template.targetRole || "Software Engineer",
          challengeTitle: template.title,
          assessmentUrl,
          durationMinutes: template.attemptDurationMinutes ?? template.durationMinutes ?? 90,
          deadlineDays: expiresInDays,
        })
        .catch((err) => {
          console.error("[CandidateInvitationService] Invitation email dispatch error:", err);
        });
    }

    return invitation;
  }

  public getInvitationByToken(token: string): CandidateInvitation {
    const invitationId = this.tokenToId.get(token);
    if (!invitationId) {
      throw new InvitationNotFoundError("Invalid invitation link or token");
    }

    const invitation = this.invitationsById.get(invitationId);
    if (!invitation) {
      throw new InvitationNotFoundError("Invitation not found");
    }

    if (new Date() > new Date(invitation.expiresAt) && invitation.status === "pending") {
      invitation.status = "expired";
      throw new InvitationExpiredError("This candidate assessment invitation has expired");
    }

    if (invitation.status === "revoked") {
      throw new InvitationInvalidStateError("This assessment invitation has been revoked by the company");
    }

    return invitation;
  }

  public verifyInvitation(token: string): VerifyInvitationResponse {
    const invitation = this.getInvitationByToken(token);
    const org = this.orgService.getOrganizationById(invitation.organizationId);
    const template = this.templateService.getTemplateById(
      invitation.organizationId,
      invitation.templateId
    );

    if (!template || !org) {
      throw new InvitationNotFoundError("Associated assessment challenge or organization not found");
    }

    const tasks = (template.tasks && template.tasks.length > 0 ? template.tasks : []).map(scrubTaskForCandidate);

    return {
      invitation,
      templateTitle: template.title,
      templateDescription: template.description,
      targetRole: template.targetRole,
      difficulty: template.difficulty,
      durationMinutes: template.durationMinutes,
      attemptDurationMinutes: template.attemptDurationMinutes ?? template.durationMinutes ?? 90,
      submissionDeadlineDays: template.submissionDeadlineDays ?? 7,
      tasks,
      toolPolicy: template.toolPolicy,
      organizationName: org.name,
    };
  }

  public acceptInvitation(token: string): AcceptInvitationResponse {
    const invitation = this.getInvitationByToken(token);

    if (invitation.status === "completed") {
      throw new InvitationInvalidStateError("This assessment session has already been completed and submitted");
    }

    const template = this.templateService.getTemplateById(
      invitation.organizationId,
      invitation.templateId
    );

    if (!template) {
      throw new InvitationNotFoundError("Assessment challenge template not found");
    }

    const tasks = (template.tasks && template.tasks.length > 0 ? template.tasks : []).map(scrubTaskForCandidate);
    const durationMinutes = template.attemptDurationMinutes ?? template.durationMinutes ?? 90;

    // Provision candidate session if not already created
    let sessionId = invitation.sessionId;
    if (!sessionId) {
      if (this.sessionService) {
        const session = this.sessionService.createSession({
          organizationId: invitation.organizationId,
          templateId: invitation.templateId,
          versionId: invitation.versionId,
          invitationId: invitation.id,
          candidateEmail: invitation.candidateEmail,
          candidateName: invitation.candidateName,
          durationMinutes,
        });
        sessionId = session.id;
      } else {
        sessionId = "sess_" + crypto.randomBytes(8).toString("hex") + "_" + Date.now();
      }
    }

    const candidateToken = this.authService.createCandidateToken({
      candidateId: invitation.candidateName,
      candidateEmail: invitation.candidateEmail,
      organizationId: invitation.organizationId,
      sessionId,
      validitySeconds: durationMinutes * 60,
    });

    const now = new Date();
    invitation.status = "started";
    invitation.sessionId = sessionId;
    invitation.acceptedAt = invitation.acceptedAt ?? now;
    invitation.startedAt = invitation.startedAt ?? now;

    // Durable write-through to PostgreSQL
    this.repo
      .update(invitation.id, {
        status: "started",
        sessionId,
        acceptedAt: invitation.acceptedAt,
        startedAt: invitation.startedAt,
      })
      .catch((err) => {
        console.error("[CandidateInvitationService] DB invitation status update error:", err);
      });

    return {
      invitation,
      sessionId,
      candidateToken: candidateToken.token,
      templateId: template.id,
      starterCode: template.starterCode,
      verificationTestCode: template.verificationTestCode,
      toolPolicy: template.toolPolicy,
      durationMinutes,
      attemptDurationMinutes: durationMinutes,
      submissionDeadlineDays: template.submissionDeadlineDays ?? 7,
      tasks,
    };
  }

  public listInvitations(organizationId: string): CandidateInvitation[] {
    const orgSet = this.orgInvitations.get(organizationId);
    if (!orgSet) return [];

    const list: CandidateInvitation[] = [];
    const now = new Date();

    for (const id of orgSet) {
      const inv = this.invitationsById.get(id);
      if (inv) {
        if (now > new Date(inv.expiresAt) && inv.status === "pending") {
          inv.status = "expired";
        }
        list.push(inv);
      }
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public revokeInvitation(organizationId: string, invitationId: string): CandidateInvitation {
    const invitation = this.invitationsById.get(invitationId);
    if (!invitation || invitation.organizationId !== organizationId) {
      throw new InvitationNotFoundError(`Invitation '${invitationId}' not found`);
    }

    invitation.status = "revoked";
    return invitation;
  }
}

