import crypto from "node:crypto";
import type {
  CandidateInvitation,
  CreateInvitationRequest,
  VerifyInvitationResponse,
  AcceptInvitationResponse,
} from "@ai-copilot/contracts";
import type { AssessmentTemplateService } from "./template.js";
import type { OrganizationService } from "./organization.js";
import type { AuthService } from "./auth.js";

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

  constructor(
    private templateService: AssessmentTemplateService,
    private orgService: OrganizationService,
    private authService: AuthService
  ) {}

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

    return {
      invitation,
      templateTitle: template.title,
      templateDescription: template.description,
      targetRole: template.targetRole,
      difficulty: template.difficulty,
      durationMinutes: template.durationMinutes,
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

    // Provision candidate session ID if not already created
    const sessionId =
      invitation.sessionId ?? "sess_" + crypto.randomBytes(8).toString("hex") + "_" + Date.now();

    const candidateToken = this.authService.createCandidateToken({
      candidateEmail: invitation.candidateEmail,
      candidateName: invitation.candidateName,
      organizationId: invitation.organizationId,
      sessionId,
      durationMinutes: template.durationMinutes,
    });

    const now = new Date();
    invitation.status = "started";
    invitation.sessionId = sessionId;
    invitation.acceptedAt = invitation.acceptedAt ?? now;
    invitation.startedAt = invitation.startedAt ?? now;

    return {
      invitation,
      sessionId,
      candidateToken: candidateToken.token,
      templateId: template.id,
      starterCode: template.starterCode,
      verificationTestCode: template.verificationTestCode,
      toolPolicy: template.toolPolicy,
      durationMinutes: template.durationMinutes,
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
