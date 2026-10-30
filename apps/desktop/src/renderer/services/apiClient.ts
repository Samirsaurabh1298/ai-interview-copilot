import type {
  AIRequest,
  AIResponse,
  ProvidersResponse,
  QuestionExtractionResponse,
  CodeValidationRequest,
  CodeValidationResponse,
  ToolPolicy,
  SessionBudgetStatus,
  CandidateSubmission,
  AssessmentScorecard,
  Organization,
  OrganizationMember,
  InviteMemberRequest,
  AuthUserContext,
  AssessmentTemplate,
  CreateTemplateRequest,
  AssessmentVersion,
  PublishVersionRequest,
  CandidateInvitation,
  CreateInvitationRequest,
  VerifyInvitationResponse,
  AcceptInvitationResponse,
} from "@ai-copilot/contracts";

const API_BASE_URL = "http://localhost:4000/api/v1";

export class ApiClient {
  public static async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch("http://localhost:4000/health");
      return res.ok;
    } catch {
      return false;
    }
  }

  public static async getProviders(): Promise<ProvidersResponse> {
    const res = await fetch(`${API_BASE_URL}/providers`);
    if (!res.ok) {
      throw new Error(`Failed to fetch providers: ${res.statusText}`);
    }
    return (await res.json()) as ProvidersResponse;
  }

  public static async extractQuestion(
    imageBase64: string,
    userHint?: string
  ): Promise<QuestionExtractionResponse> {
    const res = await fetch(`${API_BASE_URL}/questions/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64,
        userHint,
      }),
    });
    if (!res.ok) {
      throw new Error(`Extraction failed: ${res.statusText}`);
    }
    return (await res.json()) as QuestionExtractionResponse;
  }

  public static async generateAnswer(
    request: AIRequest,
    providerId?: string,
    sessionId?: string
  ): Promise<AIResponse> {
    const params = new URLSearchParams();
    if (providerId) params.append("provider", providerId);
    if (sessionId) params.append("sessionId", sessionId);

    const queryString = params.toString() ? `?${params.toString()}` : "";
    const url = `${API_BASE_URL}/answers/generate${queryString}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const errorData = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      throw new Error(
        errorData.message || errorData.error || `Generation failed: ${res.statusText}`
      );
    }

    return (await res.json()) as AIResponse;
  }

  public static async validateCode(
    request: CodeValidationRequest
  ): Promise<CodeValidationResponse> {
    const res = await fetch(`${API_BASE_URL}/code/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const errorData = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      throw new Error(
        errorData.message || errorData.error || `Validation failed: ${res.statusText}`
      );
    }

    return (await res.json()) as CodeValidationResponse;
  }

  public static async getAssessmentPolicy(sessionId?: string): Promise<ToolPolicy> {
    const url = sessionId
      ? `${API_BASE_URL}/assessment/policy?sessionId=${sessionId}`
      : `${API_BASE_URL}/assessment/policy`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch policy: ${res.statusText}`);
    }
    return (await res.json()) as ToolPolicy;
  }

  public static async getBudgetStatus(sessionId: string): Promise<SessionBudgetStatus> {
    const res = await fetch(`${API_BASE_URL}/assessment/budget/${sessionId}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch budget status: ${res.statusText}`);
    }
    return (await res.json()) as SessionBudgetStatus;
  }

  public static async evaluateAssessment(
    submission: CandidateSubmission
  ): Promise<AssessmentScorecard> {
    const res = await fetch(`${API_BASE_URL}/assessment/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission),
    });

    if (!res.ok) {
      const errorData = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      throw new Error(
        errorData.message || errorData.error || `Evaluation failed: ${res.statusText}`
      );
    }

    return (await res.json()) as AssessmentScorecard;
  }

  public static async getOrganizations(): Promise<{ organizations: Organization[]; total: number }> {
    const res = await fetch(`${API_BASE_URL}/organizations`);
    if (!res.ok) {
      throw new Error(`Failed to fetch organizations: ${res.statusText}`);
    }
    return (await res.json()) as { organizations: Organization[]; total: number };
  }

  public static async getTemplates(
    organizationId: string
  ): Promise<{ templates: AssessmentTemplate[]; total: number }> {
    const res = await fetch(`${API_BASE_URL}/templates?organizationId=${organizationId}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch templates: ${res.statusText}`);
    }
    return (await res.json()) as { templates: AssessmentTemplate[]; total: number };
  }

  public static async createTemplate(req: CreateTemplateRequest): Promise<AssessmentTemplate> {
    const res = await fetch(`${API_BASE_URL}/templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const errorData = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      throw new Error(errorData.message || errorData.error || `Failed to create template`);
    }
    return (await res.json()) as AssessmentTemplate;
  }

  public static async publishTemplate(
    organizationId: string,
    templateId: string
  ): Promise<AssessmentTemplate> {
    const res = await fetch(
      `${API_BASE_URL}/templates/${templateId}/publish?organizationId=${organizationId}`,
      { method: "POST" }
    );
    if (!res.ok) {
      throw new Error(`Failed to publish template: ${res.statusText}`);
    }
    return (await res.json()) as AssessmentTemplate;
  }

  public static async getTemplateVersions(
    organizationId: string,
    templateId: string
  ): Promise<{ versions: AssessmentVersion[]; total: number }> {
    const res = await fetch(
      `${API_BASE_URL}/templates/${templateId}/versions?organizationId=${organizationId}`
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch template versions: ${res.statusText}`);
    }
    return (await res.json()) as { versions: AssessmentVersion[]; total: number };
  }

  public static async publishVersion(
    req: PublishVersionRequest
  ): Promise<AssessmentVersion> {
    const res = await fetch(
      `${API_BASE_URL}/templates/${req.templateId}/versions?organizationId=${req.organizationId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      }
    );
    if (!res.ok) {
      const errorData = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      throw new Error(errorData.message || errorData.error || `Failed to publish version`);
    }
    return (await res.json()) as AssessmentVersion;
  }

  public static async getMembers(
    organizationId: string
  ): Promise<{ members: OrganizationMember[]; total: number }> {
    const res = await fetch(`${API_BASE_URL}/organizations/${organizationId}/members`);
    if (!res.ok) {
      throw new Error(`Failed to fetch organization members: ${res.statusText}`);
    }
    return (await res.json()) as { members: OrganizationMember[]; total: number };
  }

  public static async inviteMember(
    organizationId: string,
    req: InviteMemberRequest
  ): Promise<OrganizationMember> {
    const res = await fetch(`${API_BASE_URL}/organizations/${organizationId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      throw new Error(err.message || err.error || "Failed to invite member");
    }
    return (await res.json()) as OrganizationMember;
  }

  public static async loginMember(
    organizationId: string,
    email: string
  ): Promise<{ token: string; tokenType: string; user: AuthUserContext }> {
    const res = await fetch(`${API_BASE_URL}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId, email }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      throw new Error(err.message || err.error || "Login token exchange failed");
    }
    return (await res.json()) as { token: string; tokenType: string; user: AuthUserContext };
  }

  public static async verifyToken(token: string): Promise<{ user: AuthUserContext }> {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`Invalid authentication token: ${res.statusText}`);
    }
    return (await res.json()) as { user: AuthUserContext };
  }

  public static async createInvitation(
    req: CreateInvitationRequest,
    token?: string
  ): Promise<CandidateInvitation> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE_URL}/invitations`, {
      method: "POST",
      headers,
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      throw new Error(err.message || err.error || "Failed to create candidate invitation");
    }
    return (await res.json()) as CandidateInvitation;
  }

  public static async listInvitations(
    organizationId: string
  ): Promise<{ invitations: CandidateInvitation[]; total: number }> {
    const res = await fetch(`${API_BASE_URL}/invitations?organizationId=${organizationId}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch invitations: ${res.statusText}`);
    }
    return (await res.json()) as { invitations: CandidateInvitation[]; total: number };
  }

  public static async verifyInvitation(token: string): Promise<VerifyInvitationResponse> {
    const res = await fetch(`${API_BASE_URL}/invitations/verify/${token}`);
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      throw new Error(err.message || err.error || "Invalid or expired invitation");
    }
    return (await res.json()) as VerifyInvitationResponse;
  }

  public static async acceptInvitation(token: string): Promise<AcceptInvitationResponse> {
    const res = await fetch(`${API_BASE_URL}/invitations/accept/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agreedToIntegrityPolicy: true }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      throw new Error(err.message || err.error || "Failed to accept invitation");
    }
    return (await res.json()) as AcceptInvitationResponse;
  }
}


