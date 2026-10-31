import React, { useState, useEffect } from "react";
import {
  Building2,
  FileCode,
  Plus,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  Code2,
  Check,
  Copy,
  ChevronRight,
  ExternalLink,
  Lock,
  Hash,
  AlertCircle,
  Play,
  RotateCcw,
  Users,
  Shield,
  Key,
  UserCheck,
  Mail,
  UserPlus,
  X,
  Send,
  User,
  ArrowRight,
  Activity,
  Eye,
  RefreshCw,
  Terminal,
} from "lucide-react";
import { ApiClient } from "../services/apiClient.js";
import type {
  Organization,
  OrganizationMember,
  AssessmentTemplate,
  CreateTemplateRequest,
  AssessmentVersion,
  InviteMemberRequest,
  CandidateInvitation,
  CreateInvitationRequest,
  AuthUserContext,
  MembershipRole,
  AssessmentSession,
  SessionEvent,
  SubmissionArtifact,
} from "@ai-copilot/contracts";

interface CompanyDashboardProps {
  onLaunchCandidateView?: () => void;
  onOpenInvitation?: (token: string) => void;
}

export const CompanyDashboard: React.FC<CompanyDashboardProps> = ({
  onLaunchCandidateView,
  onOpenInvitation,
}) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [templates, setTemplates] = useState<AssessmentTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<AssessmentTemplate | null>(null);
  const [versions, setVersions] = useState<AssessmentVersion[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<CandidateInvitation[]>([]);

  // Task 13 & 14: Session Telemetry & Submission State
  const [sessions, setSessions] = useState<AssessmentSession[]>([]);
  const [selectedSessionForAudit, setSelectedSessionForAudit] = useState<AssessmentSession | null>(null);
  const [sessionEvents, setSessionEvents] = useState<SessionEvent[]>([]);
  const [auditSubTab, setAuditSubTab] = useState<"timeline" | "versions">("timeline");
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [selectedSubmissionArtifact, setSelectedSubmissionArtifact] = useState<SubmissionArtifact | null>(null);
  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);

  const [activePersona, setActivePersona] = useState<OrganizationMember | null>(null);
  const [activeAuthUser, setActiveAuthUser] = useState<AuthUserContext | null>(null);
  const [activeJwtToken, setActiveJwtToken] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<"templates" | "rbac" | "audit" | "invitations">("templates");
  const [activeTemplateTab, setActiveTemplateTab] = useState<"brief" | "starter" | "tests" | "rubric">("brief");

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isCandidateInviteModalOpen, setIsCandidateInviteModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Template Form State
  const [formTitle, setFormTitle] = useState("");
  const [formRole, setFormRole] = useState("Frontend Engineer");
  const [formDifficulty, setFormDifficulty] = useState<"junior" | "mid" | "senior" | "staff">("mid");
  const [formDuration, setFormDuration] = useState(60);
  const [formBudget, setFormBudget] = useState(0.25);
  const [formDescription, setFormDescription] = useState("");
  const [formStarterCode, setFormStarterCode] = useState("");
  const [formTestCode, setFormTestCode] = useState("");

  // Member Invite Form State
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MembershipRole>("interviewer");

  // Candidate Invitation Form State
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [candidateExpiresDays, setCandidateExpiresDays] = useState(7);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);

  // Load organizations on mount
  useEffect(() => {
    loadOrganizations();
  }, []);

  // When selectedOrg changes, load its data
  useEffect(() => {
    if (selectedOrg) {
      loadTemplates(selectedOrg.id);
      loadMembers(selectedOrg.id);
      loadInvitations(selectedOrg.id);
      loadSessions(selectedOrg.id);
    }
  }, [selectedOrg]);

  // When selectedTemplate changes, load versions
  useEffect(() => {
    if (selectedOrg && selectedTemplate) {
      loadVersions(selectedOrg.id, selectedTemplate.id);
    }
  }, [selectedOrg, selectedTemplate]);

  const loadOrganizations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await ApiClient.getOrganizations();
      setOrganizations(data.organizations);
      if (data.organizations.length > 0) {
        setSelectedOrg(data.organizations[0]!);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load organizations");
    } finally {
      setIsLoading(false);
    }
  };

  const loadTemplates = async (orgId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await ApiClient.getTemplates(orgId);
      setTemplates(data.templates);
      if (data.templates.length > 0) {
        setSelectedTemplate(data.templates[0]!);
      } else {
        setSelectedTemplate(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load assessment templates");
    } finally {
      setIsLoading(false);
    }
  };

  const loadMembers = async (orgId: string) => {
    try {
      const data = await ApiClient.getMembers(orgId);
      setMembers(data.members);
      if (data.members.length > 0 && !activeAuthUser) {
        const owner = data.members[0]!;
        handleSelectPersona(owner);
      }
    } catch {
      // Non-blocking
    }
  };

  const loadInvitations = async (orgId: string) => {
    try {
      const data = await ApiClient.listInvitations(orgId);
      setInvitations(data.invitations);
    } catch {
      // Non-blocking
    }
  };

  const loadVersions = async (orgId: string, templateId: string) => {
    try {
      const data = await ApiClient.getTemplateVersions(orgId, templateId);
      setVersions(data.versions);
    } catch {
      setVersions([]);
    }
  };

  const loadSessions = async (orgId: string) => {
    try {
      const data = await ApiClient.listSessions(orgId, activeJwtToken || undefined);
      setSessions(data.sessions);
      if (data.sessions.length > 0 && !selectedSessionForAudit) {
        handleSelectSessionForAudit(data.sessions[0]!);
      }
    } catch {
      setSessions([]);
    }
  };

  const handleSelectSessionForAudit = async (session: AssessmentSession) => {
    setSelectedSessionForAudit(session);
    try {
      setIsLoadingEvents(true);
      const data = await ApiClient.getSessionEvents(session.id, activeJwtToken || undefined);
      setSessionEvents(data.events);
    } catch {
      setSessionEvents([]);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const handleInspectSubmission = async (sessionId: string) => {
    try {
      const data = await ApiClient.getSubmission(sessionId, activeJwtToken || undefined);
      setSelectedSubmissionArtifact(data.artifact);
      setIsSubmissionModalOpen(true);
    } catch {
      alert("Submission artifact not available for this session yet.");
    }
  };

  const handleSelectPersona = async (member: OrganizationMember) => {
    if (!selectedOrg) return;
    try {
      setError(null);
      const auth = await ApiClient.loginMember(selectedOrg.id, member.email);
      setActiveAuthUser(auth.user);
      setActivePersona(member);
      setActiveJwtToken(auth.token);
      setSuccessMessage(`Switched active session to ${member.name} (${member.role.toUpperCase()})`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to authenticate persona");
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleOpenCreateModal = () => {
    if (activeAuthUser && !["owner", "admin"].includes(activeAuthUser.role)) {
      setError(`Permission Denied: Your current role '${activeAuthUser.role}' lacks permission to author challenge templates.`);
      return;
    }

    setFormTitle("React Custom Hook: Debounced Fetch & Cache");
    setFormRole("Senior Frontend Engineer");
    setFormDifficulty("senior");
    setFormDuration(60);
    setFormBudget(0.25);
    setFormDescription(
      "Candidates must implement a useDebouncedFetch custom hook with query debouncing, LRU in-memory cache, and abort signal handling for pending asynchronous network requests."
    );
    setFormStarterCode(`export interface FetchOptions<T> {
  debounceMs?: number;
  cacheTtlMs?: number;
  transform?: (raw: unknown) => T;
}

export function useDebouncedFetch<T>(url: string, options: FetchOptions<T> = {}) {
  // TODO: Implement debounced fetch with cache and abort controller
  return { data: null as T | null, loading: false, error: null as Error | null };
}`);
    setFormTestCode(`import { describe, it, expect } from "node:test";

describe("useDebouncedFetch verification suite", () => {
  it("exports useDebouncedFetch function", () => {
    expect(typeof useDebouncedFetch).toBe("function");
  });
});`);
    setIsCreateModalOpen(true);
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg) return;

    try {
      setIsSubmitting(true);
      setError(null);
      const req: CreateTemplateRequest = {
        organizationId: selectedOrg.id,
        title: formTitle.trim(),
        targetRole: formRole.trim(),
        difficulty: formDifficulty,
        durationMinutes: formDuration,
        defaultAiBudgetUsd: formBudget,
        description: formDescription.trim(),
        starterCode: formStarterCode,
        verificationTestCode: formTestCode,
        language: "typescript",
      };

      const newTemplate = await ApiClient.createTemplate(req);
      setTemplates((prev) => [newTemplate, ...prev]);
      setSelectedTemplate(newTemplate);
      setIsCreateModalOpen(false);
      setSuccessMessage(`Assessment template "${newTemplate.title}" created successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create assessment template");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublishVersion = async (template: AssessmentTemplate) => {
    if (!selectedOrg) return;

    if (activeAuthUser && !["owner", "admin"].includes(activeAuthUser.role)) {
      setError(`Permission Denied: Your current role '${activeAuthUser.role}' lacks permission to publish immutable versions.`);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const version = await ApiClient.publishVersion({
        organizationId: selectedOrg.id,
        templateId: template.id,
        versionType: "minor",
        changelogNotes: "Published immutable baseline challenge version.",
      });
      setVersions((prev) => [version, ...prev]);
      await loadTemplates(selectedOrg.id);
      setSuccessMessage(`Immutable Version ${version.versionNumber} locked with SHA-256 fingerprint!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to publish version");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg) return;

    if (activeAuthUser && !["owner", "admin"].includes(activeAuthUser.role)) {
      setError(`Permission Denied: Your current role '${activeAuthUser.role}' lacks permission to invite organization members.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const newMember = await ApiClient.inviteMember(selectedOrg.id, {
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
      });

      setMembers((prev) => [...prev, newMember]);
      setIsInviteModalOpen(false);
      setInviteName("");
      setInviteEmail("");
      setSuccessMessage(`Invited ${newMember.name} as ${newMember.role.toUpperCase()}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to invite member");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenCandidateInvite = (tmpl?: AssessmentTemplate) => {
    if (activeAuthUser && !["owner", "admin", "interviewer"].includes(activeAuthUser.role)) {
      setError(`Permission Denied: Role '${activeAuthUser.role}' is not authorized to issue candidate invitations.`);
      return;
    }

    if (tmpl) {
      setSelectedTemplate(tmpl);
    }
    setCandidateName("Jordan Lee");
    setCandidateEmail("jordan.lee@example.com");
    setCandidateExpiresDays(7);
    setGeneratedInviteUrl(null);
    setIsCandidateInviteModalOpen(true);
  };

  const handleCreateCandidateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg || !selectedTemplate) return;

    try {
      setIsSubmitting(true);
      setError(null);
      const req: CreateInvitationRequest = {
        organizationId: selectedOrg.id,
        templateId: selectedTemplate.id,
        candidateName: candidateName.trim(),
        candidateEmail: candidateEmail.trim(),
        expiresInDays: candidateExpiresDays,
      };

      const inv = await ApiClient.createInvitation(req, activeJwtToken || undefined);
      setInvitations((prev) => [inv, ...prev]);
      const url = `${window.location.origin}/?invite=${inv.invitationToken}`;
      setGeneratedInviteUrl(url);
      setSuccessMessage(`Invitation link generated for candidate ${inv.candidateName}!`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to issue candidate invitation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
      case "admin":
        return "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800";
      case "interviewer":
        return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
      case "reviewer":
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-gray-100 overflow-hidden">
      {/* Top Organization Context Bar */}
      <div className="border-b border-slate-200 dark:border-gray-800 bg-white/80 dark:bg-[#0d131f]/90 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {selectedOrg ? selectedOrg.name : "Company Assessment Hub"}
              </h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 uppercase tracking-wider">
                {selectedOrg?.plan || "Pilot"}
              </span>
              <span className="text-xs text-slate-400 dark:text-gray-500 font-mono">
                {selectedOrg?.slug}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              Enterprise AI Assessment Library, Candidate Invitations, Cryptographic Audit & RBAC
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-3">
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("templates")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "templates"
                  ? "bg-white text-indigo-600 shadow-xs dark:bg-gray-900 dark:text-indigo-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Challenge Templates ({templates.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("invitations")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "invitations"
                  ? "bg-white text-indigo-600 shadow-xs dark:bg-gray-900 dark:text-indigo-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              <Send className="w-3.5 h-3.5 text-emerald-500" />
              <span>Candidates ({invitations.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("rbac")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "rbac"
                  ? "bg-white text-indigo-600 shadow-xs dark:bg-gray-900 dark:text-indigo-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-indigo-500" />
              <span>Auth & RBAC ({members.length})</span>
            </button>
            <button
              onClick={() => {
                setActiveTab("audit");
                if (selectedOrg) loadSessions(selectedOrg.id);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "audit"
                  ? "bg-white text-indigo-600 shadow-xs dark:bg-gray-900 dark:text-indigo-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-indigo-500" />
              <span>Evidence & Audit Log ({sessions.length})</span>
            </button>
          </div>

          {activeTab === "templates" && (
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 font-semibold text-xs text-white shadow-md shadow-indigo-600/20 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <Plus className="w-4 h-4" />
              <span>Create Template</span>
            </button>
          )}

          {activeTab === "invitations" && (
            <button
              onClick={() => handleOpenCandidateInvite(selectedTemplate || undefined)}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 font-semibold text-xs text-white shadow-md shadow-emerald-600/20 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <Send className="w-4 h-4" />
              <span>Invite Candidate</span>
            </button>
          )}

          {activeTab === "rbac" && (
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 font-semibold text-xs text-white shadow-md shadow-indigo-600/20 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <UserPlus className="w-4 h-4" />
              <span>Invite Member</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Persona Banner (RBAC Live Simulation) */}
      <div className="px-6 py-2.5 bg-indigo-50/70 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Active Auth Session:</span>
          </span>
          {activeAuthUser ? (
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 dark:text-white">
                {activePersona?.name || activeAuthUser.email}
              </span>
              <span className="text-slate-500 dark:text-gray-400">({activeAuthUser.email})</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getRoleBadgeClass(activeAuthUser.role)}`}>
                {activeAuthUser.role}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono">
                <CheckCircle2 className="w-3 h-3" />
                Verified JWT
              </span>
            </div>
          ) : (
            <span className="text-slate-500">No active session selected</span>
          )}
        </div>

        {/* Persona quick switch buttons */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-500 dark:text-gray-400 mr-1">Switch Role:</span>
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => handleSelectPersona(m)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                activeAuthUser?.email === m.email
                  ? "bg-indigo-600 text-white shadow-xs font-bold"
                  : "bg-white dark:bg-gray-800 text-slate-700 dark:text-gray-300 border border-slate-200 dark:border-gray-700 hover:border-indigo-400"
              }`}
            >
              {m.role.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mx-6 mt-4 p-3 rounded-lg border border-rose-300 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mx-6 mt-4 p-3 rounded-lg border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === "templates" ? (
          <>
            {/* Left Column: Template List */}
            <div className="w-80 border-r border-slate-200 dark:border-gray-800 flex flex-col bg-white dark:bg-[#0c121e]">
              <div className="p-3 border-b border-slate-200 dark:border-gray-800 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider flex items-center justify-between">
                <span>Assessment Challenges</span>
                <span className="font-mono text-[10px] bg-slate-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                  {templates.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-gray-800/60">
                {templates.map((tmpl) => {
                  const isSelected = selectedTemplate?.id === tmpl.id;
                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => setSelectedTemplate(tmpl)}
                      className={`p-4 cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-indigo-50/80 dark:bg-indigo-950/40 border-l-4 border-indigo-600"
                          : "hover:bg-slate-50 dark:hover:bg-gray-800/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h3 className="font-semibold text-xs text-slate-900 dark:text-white line-clamp-1">
                          {tmpl.title}
                        </h3>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                            tmpl.difficulty === "senior" || tmpl.difficulty === "staff"
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                          }`}
                        >
                          {tmpl.difficulty}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-gray-400 line-clamp-2 mb-2">
                        {tmpl.description}
                      </p>

                      <div className="flex items-center gap-3 text-[10px] text-slate-400 dark:text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {tmpl.durationMinutes}m
                        </span>
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-emerald-500" />
                          ${tmpl.defaultAiBudgetUsd.toFixed(2)}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded font-medium ${
                            tmpl.status === "published"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                          }`}
                        >
                          {tmpl.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Template Detail & Inspector */}
            {selectedTemplate ? (
              <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-[#090d16] overflow-y-auto">
                {/* Detail Header */}
                <div className="p-6 border-b border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700">
                        {selectedTemplate.targetRole}
                      </span>
                      <span className="text-xs font-mono text-slate-400 dark:text-gray-500">
                        slug: {selectedTemplate.slug}
                      </span>
                    </div>
                    <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                      {selectedTemplate.title}
                    </h1>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenCandidateInvite(selectedTemplate)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-all"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Invite Candidate</span>
                    </button>

                    <button
                      onClick={() => handlePublishVersion(selectedTemplate)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-200 text-xs font-semibold transition-all border border-slate-200 dark:border-gray-700"
                    >
                      <Lock className="w-3.5 h-3.5 text-amber-500" />
                      <span>Lock Immutable Version</span>
                    </button>

                    {onLaunchCandidateView && (
                      <button
                        onClick={onLaunchCandidateView}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-200 text-xs font-semibold transition-all border border-slate-200 dark:border-gray-700"
                      >
                        <Play className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Workspace Preview</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub-tab navigation */}
                <div className="flex border-b border-slate-200 dark:border-gray-800 px-6 bg-slate-100/60 dark:bg-[#0b101c] gap-6 text-xs font-semibold">
                  <button
                    onClick={() => setActiveTemplateTab("brief")}
                    className={`py-3 border-b-2 transition-all ${
                      activeTemplateTab === "brief"
                        ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                        : "border-transparent text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white"
                    }`}
                  >
                    Challenge Brief & Rules
                  </button>
                  <button
                    onClick={() => setActiveTemplateTab("starter")}
                    className={`py-3 border-b-2 transition-all ${
                      activeTemplateTab === "starter"
                        ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                        : "border-transparent text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white"
                    }`}
                  >
                    Starter Code
                  </button>
                  <button
                    onClick={() => setActiveTemplateTab("tests")}
                    className={`py-3 border-b-2 transition-all ${
                      activeTemplateTab === "tests"
                        ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                        : "border-transparent text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white"
                    }`}
                  >
                    Verification Tests
                  </button>
                  <button
                    onClick={() => setActiveTemplateTab("rubric")}
                    className={`py-3 border-b-2 transition-all ${
                      activeTemplateTab === "rubric"
                        ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                        : "border-transparent text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white"
                    }`}
                  >
                    Rubric Dimension Weights
                  </button>
                </div>

                {/* Sub-tab content */}
                <div className="p-6 flex-1">
                  {activeTemplateTab === "brief" && (
                    <div className="space-y-4 max-w-3xl">
                      <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] p-5 space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">
                          Problem Statement & Instructions
                        </h4>
                        <p className="text-xs text-slate-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {selectedTemplate.description}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] p-4 space-y-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">
                            Assessment Policies
                          </h4>
                          <ul className="text-xs space-y-1.5 text-slate-600 dark:text-gray-300">
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Enforce explicit AI patch review: <strong>True</strong></span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Model: <strong>{selectedTemplate.toolPolicy.allowedModel}</strong> ({selectedTemplate.toolPolicy.allowedProvider})</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              <span>AI Budget warning threshold: <strong>{selectedTemplate.toolPolicy.warningThresholdPercent}%</strong></span>
                            </li>
                          </ul>
                        </div>

                        <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] p-4 space-y-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">
                            Candidate Experience
                          </h4>
                          <ul className="text-xs space-y-1.5 text-slate-600 dark:text-gray-300">
                            <li className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-indigo-500" />
                              <span>Session Time Limit: <strong>{selectedTemplate.durationMinutes} minutes</strong></span>
                            </li>
                            <li className="flex items-center gap-2">
                              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                              <span>Isolation: <strong>Hardware Node 22 Sandbox</strong></span>
                            </li>
                            <li className="flex items-center gap-2">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                              <span>Language: <strong>{selectedTemplate.language}</strong></span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTemplateTab === "starter" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-gray-400">
                        <span>Starter Code for Candidate Workspace</span>
                        <button
                          onClick={() => handleCopy(selectedTemplate.starterCode, "starter")}
                          className="flex items-center gap-1 hover:text-indigo-500"
                        >
                          {copiedKey === "starter" ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedKey === "starter" ? "Copied!" : "Copy Code"}</span>
                        </button>
                      </div>
                      <pre className="p-4 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed max-h-96">
                        <code>{selectedTemplate.starterCode}</code>
                      </pre>
                    </div>
                  )}

                  {activeTemplateTab === "tests" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-gray-400">
                        <span>Verification Test Suite (Runs inside Ephemeral Sandbox)</span>
                        <button
                          onClick={() => handleCopy(selectedTemplate.verificationTestCode, "tests")}
                          className="flex items-center gap-1 hover:text-indigo-500"
                        >
                          {copiedKey === "tests" ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedKey === "tests" ? "Copied!" : "Copy Code"}</span>
                        </button>
                      </div>
                      <pre className="p-4 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed max-h-96">
                        <code>{selectedTemplate.verificationTestCode}</code>
                      </pre>
                    </div>
                  )}

                  {activeTemplateTab === "rubric" && (
                    <div className="max-w-2xl space-y-4">
                      <div className="text-xs text-slate-500 dark:text-gray-400">
                        Standard 7-dimension scoring weights (totaling 100%). Token economy is excluded from candidate performance per Architectural Decision #4.
                      </div>
                      <div className="space-y-2">
                        {Object.entries(selectedTemplate.rubricDimensionWeights).map(([dim, weight]) => (
                          <div
                            key={dim}
                            className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] text-xs"
                          >
                            <span className="font-semibold capitalize text-slate-800 dark:text-gray-200">
                              {dim.replace(/-/g, " ")}
                            </span>
                            <div className="flex items-center gap-3">
                              <div className="w-32 bg-slate-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                                <div
                                  className="bg-indigo-600 h-full rounded-full"
                                  style={{ width: `${weight * 3.3}%` }}
                                />
                              </div>
                              <span className="font-mono font-bold w-10 text-right text-indigo-600 dark:text-indigo-400">
                                {weight}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
                Select a template to view details
              </div>
            )}
          </>
        ) : activeTab === "invitations" ? (
          /* Candidate Invitations & Pipeline (Task 10) */
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Send className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <span>Candidate Assessment Invitations & Onboarding (Task 10)</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                    Issue signed, cryptographically random invitation tokens. Candidates review rules of engagement and code integrity policies before bootstrapping their isolated workspace.
                  </p>
                </div>
                <button
                  onClick={() => handleOpenCandidateInvite(selectedTemplate || undefined)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Issue New Invitation</span>
                </button>
              </div>

              {/* Invitations Table */}
              <div className="rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] p-5 shadow-xs">
                {invitations.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                    <Mail className="w-8 h-8 mx-auto text-slate-300 dark:text-gray-600" />
                    <p className="font-semibold text-slate-700 dark:text-gray-300">
                      No candidate invitations issued yet
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Click "Issue New Invitation" to generate a signed assessment onboarding link.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-gray-800/60">
                    {invitations.map((inv) => {
                      const inviteUrl = `${window.location.origin}/?invite=${inv.invitationToken}`;
                      return (
                        <div key={inv.id} className="py-4 flex items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-900 dark:text-white">
                                {inv.candidateName}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-gray-400 font-mono">
                                ({inv.candidateEmail})
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  inv.status === "started"
                                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                                    : inv.status === "pending"
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                    : "bg-slate-100 text-slate-700 dark:bg-gray-800 dark:text-gray-400"
                                }`}
                              >
                                {inv.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-3">
                              <span>Expires: {new Date(inv.expiresAt).toLocaleDateString()}</span>
                              <span className="font-mono text-[10px] truncate max-w-xs">
                                Token: {inv.invitationToken.substring(0, 16)}...
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleCopy(inviteUrl, inv.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800 text-xs text-slate-700 dark:text-gray-300 font-medium"
                            >
                              {copiedKey === inv.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              <span>{copiedKey === inv.id ? "Copied!" : "Copy Link"}</span>
                            </button>

                            {onOpenInvitation && (
                              <button
                                onClick={() => onOpenInvitation(inv.invitationToken)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200 dark:border-indigo-800"
                              >
                                <span>Preview Flow</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === "rbac" ? (
          /* Authentication & RBAC Management View (Task 6 & 7) */
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            <div className="max-w-5xl mx-auto space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <span>Authentication, Role-Based Access Control & Membership (Tasks 6 & 7)</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                  Tenant boundaries are strictly checked via cryptographic HMAC-SHA256 JWT tokens. Authorization is enforced per-resource by Fastify hooks preventing Insecure Direct Object References (IDOR).
                </p>
              </div>

              {/* Active JWT Token Claims Inspector Card */}
              <div className="p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-200 uppercase tracking-wider">
                      Current Cryptographic JWT Session Token
                    </h4>
                  </div>
                  <button
                    onClick={() => handleCopy(activeJwtToken || "", "jwt")}
                    className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                  >
                    {copiedKey === "jwt" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === "jwt" ? "Copied Token!" : "Copy Bearer Token"}</span>
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] break-all border border-slate-800">
                  {activeJwtToken || "No token issued. Select a persona above to authenticate."}
                </div>

                {activeAuthUser && (
                  <div className="grid grid-cols-4 gap-3 text-xs pt-1">
                    <div className="p-2.5 rounded-lg bg-white dark:bg-gray-900/60 border border-indigo-100 dark:border-gray-800">
                      <div className="text-[10px] text-slate-400">User ID (sub)</div>
                      <div className="font-mono font-semibold text-slate-800 dark:text-gray-200 truncate">{activeAuthUser.userId}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-gray-900/60 border border-indigo-100 dark:border-gray-800">
                      <div className="text-[10px] text-slate-400">Tenant (orgId)</div>
                      <div className="font-mono font-semibold text-slate-800 dark:text-gray-200 truncate">{activeAuthUser.organizationId}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-gray-900/60 border border-indigo-100 dark:border-gray-800">
                      <div className="text-[10px] text-slate-400">Active Role</div>
                      <div className="font-bold uppercase text-indigo-600 dark:text-indigo-400">{activeAuthUser.role}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-gray-900/60 border border-indigo-100 dark:border-gray-800">
                      <div className="text-[10px] text-slate-400">Signature Alg</div>
                      <div className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">HMAC-SHA256</div>
                    </div>
                  </div>
                )}
              </div>

              {/* RBAC Permission Matrix */}
              <div className="rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Role-Based Access Control (RBAC) Permission Matrix</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">Enforced by Fastify requireRole() hook</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-gray-800 text-[11px] text-slate-400 uppercase">
                        <th className="py-2.5 pr-4">Action / Endpoint Capability</th>
                        <th className="py-2.5 px-3 text-center">Owner</th>
                        <th className="py-2.5 px-3 text-center">Admin</th>
                        <th className="py-2.5 px-3 text-center">Interviewer</th>
                        <th className="py-2.5 px-3 text-center">Reviewer</th>
                        <th className="py-2.5 px-3 text-center">Candidate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-gray-800/60 text-slate-700 dark:text-gray-300">
                      <tr>
                        <td className="py-2.5 pr-4 font-medium">Create & Edit Challenge Templates</td>
                        <td className="text-center text-emerald-600 font-bold">✓</td>
                        <td className="text-center text-emerald-600 font-bold">✓</td>
                        <td className="text-center text-slate-400 font-bold">✕</td>
                        <td className="text-center text-slate-400 font-bold">✕</td>
                        <td className="text-center text-slate-400 font-bold">✕</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 font-medium">Lock Immutable Versions (SHA-256)</td>
                        <td className="text-center text-emerald-600 font-bold">✓</td>
                        <td className="text-center text-emerald-600 font-bold">✓</td>
                        <td className="text-center text-slate-400 font-bold">✕</td>
                        <td className="text-center text-slate-400 font-bold">✕</td>
                        <td className="text-center text-slate-400 font-bold">✕</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 font-medium">Invite & Manage Organization Members</td>
                        <td className="text-center text-emerald-600 font-bold">✓</td>
                        <td className="text-center text-emerald-600 font-bold">✓</td>
                        <td className="text-center text-slate-400 font-bold">✕</td>
                        <td className="text-center text-slate-400 font-bold">✕</td>
                        <td className="text-center text-slate-400 font-bold">✕</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 font-medium">Issue Candidate Assessment Invites</td>
                        <td className="text-center text-emerald-600 font-bold">✓</td>
                        <td className="text-center text-emerald-600 font-bold">✓</td>
                        <td className="text-center text-emerald-600 font-bold">✓</td>
                        <td className="text-center text-slate-400 font-bold">✕</td>
                        <td className="text-center text-slate-400 font-bold">✕</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 font-medium">Inspect Candidate Code & Test Runs</td>
                        <td className="text-center text-emerald-600 font-bold">✓</td>
                        <td className="text-center text-emerald-600 font-bold">✓</td>
                        <td className="text-center text-emerald-600 font-bold">✓</td>
                        <td className="text-center text-emerald-600 font-bold">✓</td>
                        <td className="text-center text-slate-400 font-bold">✕ (Scoped)</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 font-medium">Evaluate & Score 7-Dimension Rubrics</td>
                        <td className="text-center text-emerald-600 font-bold">✓</td>
                        <td className="text-center text-emerald-600 font-bold">✓</td>
                        <td className="text-center text-emerald-600 font-bold">✓</td>
                        <td className="text-center text-emerald-600 font-bold">✓</td>
                        <td className="text-center text-slate-400 font-bold">✕</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 font-medium">Final Hiring Decision / Score Override</td>
                        <td className="text-center text-emerald-600 font-bold">✓</td>
                        <td className="text-center text-emerald-600 font-bold">✓</td>
                        <td className="text-center text-slate-400 font-bold">✕</td>
                        <td className="text-center text-slate-400 font-bold">✕</td>
                        <td className="text-center text-slate-400 font-bold">✕</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Organization Members List */}
              <div className="rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-500" />
                      <span>Organization Team Members & Roster</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400">
                      Sole-owner removal is guarded by TenantOperationForbiddenError (403 Forbidden).
                    </p>
                  </div>
                  <button
                    onClick={() => setIsInviteModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200 dark:border-indigo-800"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Invite Member</span>
                  </button>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-gray-800/60">
                  {members.map((m) => (
                    <div key={m.id} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-gray-800 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-gray-300">
                          {m.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                            <span>{m.name}</span>
                            {activeAuthUser?.email === m.email && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 px-1.5 py-0.2 rounded font-bold">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-gray-400 font-mono">
                            {m.email}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getRoleBadgeClass(m.role)}`}>
                          {m.role}
                        </span>
                        <button
                          onClick={() => handleSelectPersona(m)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-200 text-xs font-medium"
                        >
                          Login as
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Evidence & Audit Log Tab (Task 9 & Task 13) */
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-500" />
                    <span>Evidence, Telemetry & Cryptographic Audit Trails</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                    Inspect the chronological event stream of candidate problem-solving, AI queries, test runs, and immutable assessment hashes.
                  </p>
                </div>

                {/* Sub Tab Controls */}
                <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700 text-xs font-semibold">
                  <button
                    onClick={() => setAuditSubTab("timeline")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                      auditSubTab === "timeline"
                        ? "bg-white text-indigo-600 shadow-xs dark:bg-gray-900 dark:text-indigo-400"
                        : "text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Candidate Telemetry ({sessions.length})</span>
                  </button>
                  <button
                    onClick={() => setAuditSubTab("versions")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                      auditSubTab === "versions"
                        ? "bg-white text-indigo-600 shadow-xs dark:bg-gray-900 dark:text-indigo-400"
                        : "text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Template Hashes ({versions.length})</span>
                  </button>
                </div>
              </div>

              {auditSubTab === "timeline" ? (
                /* Task 13: Candidate Session Telemetry Stream */
                sessions.length === 0 ? (
                  <div className="p-8 border border-dashed border-slate-300 dark:border-gray-700 rounded-2xl text-center space-y-2">
                    <Activity className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-xs font-semibold text-slate-700 dark:text-gray-300">
                      No candidate sessions recorded yet
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400">
                      Launch an assessment or invite a candidate to begin streaming telemetry events.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left Column: Session Selector */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider">
                          Candidate Sessions
                        </span>
                        <button
                          onClick={() => selectedOrg && loadSessions(selectedOrg.id)}
                          className="text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Refresh</span>
                        </button>
                      </div>

                      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                        {sessions.map((sess) => (
                          <div
                            key={sess.id}
                            onClick={() => handleSelectSessionForAudit(sess)}
                            className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                              selectedSessionForAudit?.id === sess.id
                                ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/30 dark:border-indigo-500 shadow-xs"
                                : "border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] hover:border-slate-300 dark:hover:border-gray-700"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-bold text-slate-900 dark:text-white truncate">
                                {sess.candidateName}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                  sess.status === "submitted"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                                    : sess.status === "expired"
                                    ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                                    : "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300"
                                }`}
                              >
                                {sess.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-gray-400 font-mono truncate">
                              {sess.candidateEmail}
                            </div>
                            <div className="mt-2 text-[10px] text-slate-400 dark:text-gray-500 flex items-center justify-between">
                              <span className="font-mono truncate">{sess.id.slice(0, 16)}...</span>
                              <span>{new Date(sess.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right Column: Telemetry Timeline Stream */}
                    <div className="md:col-span-2 space-y-4">
                      {selectedSessionForAudit && (
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] flex items-center justify-between shadow-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-900 dark:text-white">
                                {selectedSessionForAudit.candidateName}
                              </span>
                              <span className="text-[11px] font-mono text-slate-400">
                                ({selectedSessionForAudit.id})
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                              {sessionEvents.length} telemetry checkpoints captured • AI Budget: ${selectedSessionForAudit.consumedAiBudgetUsd.toFixed(3)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedSessionForAudit.status === "submitted" && (
                              <button
                                onClick={() => handleInspectSubmission(selectedSessionForAudit.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors shadow-xs"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                <span>View Submission (SHA-256)</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleSelectSessionForAudit(selectedSessionForAudit)}
                              disabled={isLoadingEvents}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-gray-700 text-xs text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingEvents ? "animate-spin" : ""}`} />
                              <span>Reload Events</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Event Timeline Cards */}
                      {sessionEvents.length === 0 ? (
                        <div className="p-8 border border-dashed border-slate-300 dark:border-gray-700 rounded-2xl text-center space-y-2">
                          <Activity className="w-8 h-8 text-slate-400 mx-auto" />
                          <p className="text-xs font-semibold text-slate-700 dark:text-gray-300">
                            No telemetry checkpoints recorded yet
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-gray-400">
                            Checkpoints will stream in as the candidate edits code, runs verification tests, and prompts AI.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
                          {sessionEvents.map((evt) => (
                            <div
                              key={evt.id}
                              className="p-3.5 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] text-xs space-y-2 shadow-xs transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300">
                                    #{evt.sequenceNumber}
                                  </span>

                                  {/* Badge by type */}
                                  {evt.type === "session_started" && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                                      <Play className="w-3 h-3 text-blue-500" />
                                      <span>Session Started</span>
                                    </span>
                                  )}
                                  {evt.type === "code_snapshot" && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-gray-800 dark:text-gray-300 flex items-center gap-1">
                                      <FileCode className="w-3 h-3 text-slate-500" />
                                      <span>Code Checkpoint</span>
                                    </span>
                                  )}
                                  {evt.type === "test_run" && (
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 ${
                                        evt.payload?.passed
                                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                                          : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                                      }`}
                                    >
                                      <Terminal className="w-3 h-3" />
                                      <span>
                                        Test Run ({String(evt.payload?.passedCount ?? 0)}/{String(evt.payload?.totalCount ?? 0)} passed)
                                      </span>
                                    </span>
                                  )}
                                  {evt.type === "ai_query" && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 flex items-center gap-1">
                                      <Sparkles className="w-3 h-3 text-indigo-500" />
                                      <span>AI Prompt Query</span>
                                    </span>
                                  )}
                                  {evt.type === "ai_patch_proposed" && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 flex items-center gap-1">
                                      <Code2 className="w-3 h-3 text-amber-500" />
                                      <span>AI Patch Proposed</span>
                                    </span>
                                  )}
                                  {evt.type === "ai_patch_decision" && (
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 ${
                                        evt.payload?.decision === "accepted"
                                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                                          : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                                      }`}
                                    >
                                      {evt.payload?.decision === "accepted" ? (
                                        <Check className="w-3 h-3 text-emerald-600" />
                                      ) : (
                                        <X className="w-3 h-3 text-rose-600" />
                                      )}
                                      <span>Candidate {String(evt.payload?.decision).toUpperCase()} Patch</span>
                                    </span>
                                  )}
                                  {evt.type === "window_blur" && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3 text-amber-600" />
                                      <span>Window Focus Lost</span>
                                    </span>
                                  )}
                                  {evt.type === "window_focus" && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-400">
                                      Window Refocused
                                    </span>
                                  )}
                                  {evt.type === "paste_detected" && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300">
                                      Paste Event ({String(evt.payload?.characterCount ?? 0)} chars)
                                    </span>
                                  )}
                                  {evt.type === "session_submitted" && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      <span>Solution Submitted</span>
                                    </span>
                                  )}
                                </div>

                                <span className="text-[11px] text-slate-400 font-mono">
                                  {new Date(evt.timestamp).toLocaleTimeString()}
                                </span>
                              </div>

                              {/* Event Payload Highlights */}
                              {evt.type === "ai_query" && Boolean(evt.payload?.question) && (
                                <div className="p-2 rounded-lg bg-slate-50 dark:bg-gray-900/60 text-slate-700 dark:text-gray-300 font-sans italic border border-slate-100 dark:border-gray-800 text-[11px]">
                                  "{String(evt.payload?.question)}"
                                </div>
                              )}

                              {evt.type === "code_snapshot" && (
                                <div className="text-[11px] text-slate-500 dark:text-gray-400">
                                  Buffer size: {String(evt.payload?.codeLength ?? 0)} characters • {String(evt.payload?.lines ?? 0)} lines
                                </div>
                              )}

                              {evt.type === "test_run" && (
                                <div className="text-[11px] text-slate-500 dark:text-gray-400">
                                  Executed in {String(evt.payload?.durationMs ?? 0)}ms • Sandbox isolated
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              ) : (
                /* Task 9: Cryptographic Immutability Hashes */
                versions.length === 0 ? (
                  <div className="p-8 border border-dashed border-slate-300 dark:border-gray-700 rounded-2xl text-center space-y-2">
                    <Hash className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-xs font-semibold text-slate-700 dark:text-gray-300">
                      No immutable versions published yet
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400">
                      Select a template and click "Lock Immutable Version" to freeze a verifiable baseline snapshot.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {versions.map((ver) => (
                      <div
                        key={ver.id}
                        className="p-5 rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] space-y-3 shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                              Version {ver.versionNumber}
                            </span>
                            <span className="text-xs font-semibold text-slate-800 dark:text-gray-200">
                              {ver.snapshot.title}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 dark:text-gray-500 font-mono">
                            {new Date(ver.publishedAt).toLocaleString()}
                          </span>
                        </div>

                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-gray-900/60 font-mono text-[11px] flex items-center justify-between border border-slate-100 dark:border-gray-800">
                          <div className="flex items-center gap-2 truncate">
                            <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-slate-500 dark:text-gray-400">SHA-256:</span>
                            <span className="text-indigo-600 dark:text-indigo-400 truncate">{ver.contentHash}</span>
                          </div>
                          <button
                            onClick={() => handleCopy(ver.contentHash, ver.id)}
                            className="shrink-0 ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-gray-200"
                          >
                            {copiedKey === ver.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        <div className="text-xs text-slate-600 dark:text-gray-400 italic">
                          "{ver.changelogNotes || "Immutable baseline version."}"
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* Candidate Invitation Modal */}
      {isCandidateInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0d131f] border border-slate-200 dark:border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Issue Candidate Invitation
                </h3>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  Generate signed assessment link for {selectedTemplate?.title}
                </p>
              </div>
              <button
                onClick={() => setIsCandidateInviteModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {generatedInviteUrl ? (
              <div className="p-6 space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Invitation Link Generated!</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    Share this unique link with the candidate. It will take them to their onboarding & integrity verification screen.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-gray-300">
                    Candidate Link (Expires in {candidateExpiresDays} days)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedInviteUrl}
                      className="flex-1 px-3 py-2 font-mono text-[11px] rounded-lg border border-slate-300 dark:border-gray-700 bg-slate-50 dark:bg-gray-900 select-all"
                    />
                    <button
                      onClick={() => handleCopy(generatedInviteUrl, "invite-url")}
                      className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1"
                    >
                      {copiedKey === "invite-url" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === "invite-url" ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-gray-800 flex justify-end gap-2">
                  {onOpenInvitation && (
                    <button
                      type="button"
                      onClick={() => {
                        const token = new URL(generatedInviteUrl).searchParams.get("invite");
                        if (token) {
                          setIsCandidateInviteModalOpen(false);
                          onOpenInvitation(token);
                        }
                      }}
                      className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 text-slate-700 dark:text-gray-300 font-semibold"
                    >
                      Preview Onboarding Flow
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsCandidateInviteModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateCandidateInvite} className="p-5 space-y-4 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                    Candidate Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jordan Lee"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                    Candidate Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. jordan.lee@example.com"
                    value={candidateEmail}
                    onChange={(e) => setCandidateEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                    Expiration (Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={candidateExpiresDays}
                    onChange={(e) => setCandidateExpiresDays(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-gray-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCandidateInviteModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 dark:border-gray-700 text-slate-700 dark:text-gray-300 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-xs"
                  >
                    {isSubmitting ? "Generating..." : "Generate Invitation Link"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Member Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0d131f] border border-slate-200 dark:border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Invite Team Member
                </h3>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  Assign RBAC role and grant tenant access
                </p>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInviteMember} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maya Lin"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. maya@acme.corp"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                  RBAC Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as MembershipRole)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-white"
                >
                  <option value="admin">Admin (Full template & user management)</option>
                  <option value="interviewer">Interviewer (Can invite candidates & score live)</option>
                  <option value="reviewer">Reviewer (Read-only submissions & scoring)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-gray-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-gray-700 text-slate-700 dark:text-gray-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-xs"
                >
                  {isSubmitting ? "Inviting..." : "Send Invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Template Authoring Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0d131f] border border-slate-200 dark:border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Author New Assessment Template
                </h3>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  Define challenge scenarios, starter code, and isolated test suites
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-xs font-semibold"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                    Challenge Title
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                    Target Role
                  </label>
                  <input
                    type="text"
                    required
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                    Difficulty
                  </label>
                  <select
                    value={formDifficulty}
                    onChange={(e) => setFormDifficulty(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-white"
                  >
                    <option value="junior">Junior</option>
                    <option value="mid">Mid</option>
                    <option value="senior">Senior</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={240}
                    value={formDuration}
                    onChange={(e) => setFormDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                    AI Budget Limit ($)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min={0.05}
                    max={5.0}
                    value={formBudget}
                    onChange={(e) => setFormBudget(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                  Candidate Problem Description & Objectives
                </label>
                <textarea
                  rows={3}
                  required
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                  Starter Code (TypeScript)
                </label>
                <textarea
                  rows={4}
                  required
                  value={formStarterCode}
                  onChange={(e) => setFormStarterCode(e.target.value)}
                  className="w-full px-3 py-2 font-mono text-xs rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                  Verification Test Suite (Node test / assertions)
                </label>
                <textarea
                  rows={4}
                  required
                  value={formTestCode}
                  onChange={(e) => setFormTestCode(e.target.value)}
                  className="w-full px-3 py-2 font-mono text-xs rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-gray-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-gray-700 text-slate-700 dark:text-gray-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-xs"
                >
                  {isSubmitting ? "Creating..." : "Save Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reviewer Submission Artifact Modal (Task 14 / AD #9) */}
      {isSubmissionModalOpen && selectedSubmissionArtifact && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0d131f] border border-slate-200 dark:border-gray-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    Immutable Submission Package: {selectedSubmissionArtifact.candidateName}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                    Verified Cryptographic Seal
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                  Submitted at {new Date(selectedSubmissionArtifact.submittedAt).toLocaleString()} • {selectedSubmissionArtifact.candidateEmail}
                </p>
              </div>
              <button
                onClick={() => setIsSubmissionModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* SHA-256 Fingerprint */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-gray-900/60 border border-slate-200 dark:border-gray-800 font-mono flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                  <Hash className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="text-slate-500 dark:text-gray-400">Canonical SHA-256:</span>
                  <span className="text-indigo-600 dark:text-indigo-400 truncate font-bold">
                    {selectedSubmissionArtifact.submissionFingerprint}
                  </span>
                </div>
                <button
                  onClick={() => handleCopy(selectedSubmissionArtifact.submissionFingerprint, "submission_fp")}
                  className="shrink-0 ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-gray-200"
                >
                  {copiedKey === "submission_fp" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#111827]">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Sandbox Tests</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    {selectedSubmissionArtifact.testExecutionLog.passedCount} / {selectedSubmissionArtifact.testExecutionLog.totalCount} Passed
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#111827]">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Diff Stats</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    +{selectedSubmissionArtifact.codeDiff.additions} / -{selectedSubmissionArtifact.codeDiff.deletions}
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#111827]">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">AI Prompts & Budget</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                    {selectedSubmissionArtifact.telemetrySummary.aiQueriesCount} queries (${selectedSubmissionArtifact.telemetrySummary.consumedAiBudgetUsd.toFixed(3)})
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#111827]">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Attention Signals</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {selectedSubmissionArtifact.telemetrySummary.attentionMetrics.blurCount} blurs • {selectedSubmissionArtifact.telemetrySummary.attentionMetrics.pasteCount} pastes
                  </span>
                </div>
              </div>

              {/* Candidate Technical Explanation */}
              <div className="space-y-1.5">
                <span className="font-semibold text-slate-900 dark:text-white text-xs">
                  Candidate Architectural Explanation:
                </span>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-gray-900/60 border border-slate-200 dark:border-gray-800 italic text-slate-700 dark:text-gray-300 leading-relaxed font-sans">
                  "{selectedSubmissionArtifact.technicalExplanation}"
                </div>
              </div>

              {/* Unified Code Diff */}
              <div className="space-y-1.5">
                <span className="font-semibold text-slate-900 dark:text-white text-xs flex items-center justify-between">
                  <span>Unified Code Diff (Starter vs Final):</span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {selectedSubmissionArtifact.codeDiff.totalChanges} changes
                  </span>
                </span>
                <pre className="p-4 rounded-xl bg-[#090d16] font-mono text-[11px] text-slate-200 overflow-x-auto leading-relaxed border border-slate-800 max-h-64">
                  {selectedSubmissionArtifact.codeDiff.unifiedDiff}
                </pre>
              </div>

              {/* Sandbox Test Assertions Output */}
              <div className="space-y-1.5">
                <span className="font-semibold text-slate-900 dark:text-white text-xs">
                  Isolated Sandbox Test Assertions:
                </span>
                <div className="space-y-1.5">
                  {selectedSubmissionArtifact.testExecutionLog.tests.map((t, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#111827] flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        {t.passed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-rose-500" />
                        )}
                        <span className={t.passed ? "text-slate-800 dark:text-gray-200" : "text-rose-600 dark:text-rose-400"}>
                          {t.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">{t.durationMs}ms</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/60 flex justify-end">
              <button
                onClick={() => setIsSubmissionModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-xs transition-colors"
              >
                Close Submission View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
