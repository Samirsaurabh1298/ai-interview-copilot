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
  Pause,
  Award,
  Scale,
  AlertTriangle,
  FileCheck,
  Sliders,
  CheckSquare,
  FileText,
  Printer,
  DollarSign,
  TrendingUp,
  BarChart3,
  Webhook,
  Trash2,
  Zap,
  ShieldAlert,
  Flag,
  ShieldX,
  ShieldOff,
} from "lucide-react";
import { ApiClient } from "../services/apiClient.js";
import { CompanyAssessmentStudio } from "./CompanyAssessmentStudio.js";
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
  ReviewerEvaluation,
  CalibrationConsensus,
  HiringRecommendation,
  RubricDimensionId,
  AssessmentScorecard,
  DimensionCalibration,
  HiringDecisionReport,
  AiCostAnalytics,
  ModelCostBreakdown,
  TrackCostBreakdown,
  DailyBurnRateItem,
  CostAnomalyItem,
  WebhookSubscription,
  WebhookDeliveryLog,
  WebhookFormat,
  WebhookEventType,
  CreateWebhookSubscriptionRequest,
  IntegrityScoreReport,
  IntegrityIncident,
  IntegrityCategory,
  IntegritySeverity,
  CreateProctorIncidentRequest,
  IntegrityRiskLevel,
} from "@ai-copilot/contracts";

const RUBRIC_DIMENSIONS: {
  id: RubricDimensionId;
  name: string;
  weight: number;
  description: string;
  anchors: Record<1 | 2 | 3 | 4, { label: string; desc: string }>;
}[] = [
  {
    id: "code-comprehension",
    name: "Code Comprehension & Localization",
    weight: 20,
    description: "Ability to navigate codebase, trace execution, and localize bugs precisely.",
    anchors: {
      1: { label: "Developing", desc: "Struggled to identify root cause; made speculative edits across codebase." },
      2: { label: "Competent", desc: "Understood broad components but required broad delta to localize defect." },
      3: { label: "Advanced", desc: "Navigated abstractions efficiently; targeted edits localized to affected modules." },
      4: { label: "Exemplary", desc: "Laser-focused root-cause fix; preserved invariants and existing design patterns." },
    },
  },
  {
    id: "problem-framing",
    name: "Problem Framing & Architecture Strategy",
    weight: 10,
    description: "Clarifying requirements, decomposing edge cases, and planning algorithmic changes.",
    anchors: {
      1: { label: "Developing", desc: "Jumped directly into coding without planning; overlooked clear edge cases." },
      2: { label: "Competent", desc: "Understood basic problem statement but needed multiple restarts." },
      3: { label: "Advanced", desc: "Articulated reproduction criteria and formulated sound algorithmic strategy." },
      4: { label: "Exemplary", desc: "Methodical breakdown of failure modes, edge constraints, and complexity." },
    },
  },
  {
    id: "ai-collaboration",
    name: "AI Collaboration & Prompt Formulation",
    weight: 15,
    description: "Constructing high-signal, iterative inquiries with contextual precision.",
    anchors: {
      1: { label: "Developing", desc: "Passive copy-pasting of whole files or generic 'fix this' queries." },
      2: { label: "Competent", desc: "Used prompts to generate basic syntax, with occasional trial-and-error churn." },
      3: { label: "Advanced", desc: "Targeted queries focusing on tricky comparators, edge conditions, or API types." },
      4: { label: "Exemplary", desc: "High-leverage prompts providing architectural context and interrogating trade-offs." },
    },
  },
  {
    id: "critical-evaluation",
    name: "Critical Evaluation of AI Suggestions",
    weight: 15,
    description: "Scrutinizing proposed AI patches, catching subtle bugs and rejecting hallucinations.",
    anchors: {
      1: { label: "Developing", desc: "Blindly accepted proposed patches without reading diffs; introduced syntax errors." },
      2: { label: "Competent", desc: "Caught obvious failures after running tests, but missed subtle regressions." },
      3: { label: "Advanced", desc: "Carefully reviewed diffs in review modal; adjusted variable names and edge logic." },
      4: { label: "Exemplary", desc: "Spotted subtle off-by-one errors and hallucinated APIs before accepting patches." },
    },
  },
  {
    id: "debugging-implementation",
    name: "Debugging & Solution Implementation",
    weight: 20,
    description: "Disciplined debugging, clean defensive coding, and algorithmic correctness.",
    anchors: {
      1: { label: "Developing", desc: "Introduced regressions; solution fails core requirements or crashes on inputs." },
      2: { label: "Competent", desc: "Passed happy path but struggled with corner cases or introduced tight coupling." },
      3: { label: "Advanced", desc: "Robust, clean implementation passing standard tests and handling common anomalies." },
      4: { label: "Exemplary", desc: "Production-grade, idiomatic code with defensive guards and optimal complexity." },
    },
  },
  {
    id: "testing-verification",
    name: "Testing & Verification Discipline",
    weight: 10,
    description: "Verification rigor, isolated test execution, and comprehensive test coverage.",
    anchors: {
      1: { label: "Developing", desc: "Never ran verification tests or ignored red test assertion failures." },
      2: { label: "Competent", desc: "Ran tests only at the very end; did not write or verify custom edge cases." },
      3: { label: "Advanced", desc: "Iterative test cadence; verified assertions after every meaningful code delta." },
      4: { label: "Exemplary", desc: "Relentless verification discipline; systematically validated boundary cases." },
    },
  },
  {
    id: "explanation-judgment",
    name: "Technical Explanation & Engineering Judgment",
    weight: 10,
    description: "Ability to articulate trade-offs, root-cause mechanisms, and production impact.",
    anchors: {
      1: { label: "Developing", desc: "Minimal or missing explanation; unable to justify architectural decisions." },
      2: { label: "Competent", desc: "Summarized what was changed without explaining why or discussing trade-offs." },
      3: { label: "Advanced", desc: "Clear architectural narrative explaining the bug mechanism and fix rationale." },
      4: { label: "Exemplary", desc: "Executive-grade technical explanation with production considerations." },
    },
  },
];

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
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [studioTemplateToEdit, setStudioTemplateToEdit] = useState<AssessmentTemplate | null>(null);
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

  // Task 15: Proctor Controls State
  const [sessionToPause, setSessionToPause] = useState<AssessmentSession | null>(null);
  const [pauseReasonInput, setPauseReasonInput] = useState("Candidate network disconnection / technical incident");
  const [isProctorActionInProgress, setIsProctorActionInProgress] = useState(false);

  // Task 16: Multi-Reviewer Calibration State
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [isConsensusModalOpen, setIsConsensusModalOpen] = useState(false);
  const [sessionForCalibration, setSessionForCalibration] = useState<AssessmentSession | null>(null);
  const [evalScores, setEvalScores] = useState<Record<RubricDimensionId, { rating: 1 | 2 | 3 | 4; rationale: string }>>({
    "code-comprehension": { rating: 3, rationale: "" },
    "problem-framing": { rating: 3, rationale: "" },
    "ai-collaboration": { rating: 3, rationale: "" },
    "critical-evaluation": { rating: 3, rationale: "" },
    "debugging-implementation": { rating: 3, rationale: "" },
    "testing-verification": { rating: 3, rationale: "" },
    "explanation-judgment": { rating: 3, rationale: "" },
  });
  const [evalRecommendation, setEvalRecommendation] = useState<HiringRecommendation>("hire");
  const [evalSummaryRationale, setEvalSummaryRationale] = useState("");
  const [isLoadingAiDraft, setIsLoadingAiDraft] = useState(false);
  const [calibrationConsensus, setCalibrationConsensus] = useState<CalibrationConsensus | null>(null);
  const [evaluationsList, setEvaluationsList] = useState<ReviewerEvaluation[]>([]);
  const [isEvaluationsMasked, setIsEvaluationsMasked] = useState(false);
  const [isLoadingCalibration, setIsLoadingCalibration] = useState(false);

  // Task 17: Evidence-Linked Hiring Decision Report State
  const [selectedReport, setSelectedReport] = useState<HiringDecisionReport | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  // Task 20: AI Cost Analytics State
  const [analyticsData, setAnalyticsData] = useState<AiCostAnalytics | null>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<"7d" | "30d" | "all">("30d");
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  // Task 19: Enterprise ATS & HRIS Webhooks State
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([]);
  const [isLoadingWebhooks, setIsLoadingWebhooks] = useState(false);
  const [isCreateWebhookModalOpen, setIsCreateWebhookModalOpen] = useState(false);
  const [webhookTargetUrl, setWebhookTargetUrl] = useState("");
  const [webhookFormat, setWebhookFormat] = useState<WebhookFormat>("standard");
  const [webhookEvents, setWebhookEvents] = useState<string[]>(["*"]);
  const [isTestingWebhookId, setIsTestingWebhookId] = useState<string | null>(null);
  const [lastTestDeliveryLog, setLastTestDeliveryLog] = useState<WebhookDeliveryLog | null>(null);
  const [isTestLogModalOpen, setIsTestLogModalOpen] = useState(false);

  const [activePersona, setActivePersona] = useState<OrganizationMember | null>(null);
  const [activeAuthUser, setActiveAuthUser] = useState<AuthUserContext | null>(null);
  const [activeJwtToken, setActiveJwtToken] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // LOOP 7: Real-Time Proctoring & Passive Anti-Cheat State
  const [selectedSessionForProctor, setSelectedSessionForProctor] = useState<AssessmentSession | null>(null);
  const [integrityReport, setIntegrityReport] = useState<IntegrityScoreReport | null>(null);
  const [proctorIncidents, setProctorIncidents] = useState<IntegrityIncident[]>([]);
  const [isLoadingIntegrity, setIsLoadingIntegrity] = useState(false);
  const [isLogIncidentModalOpen, setIsLogIncidentModalOpen] = useState(false);
  const [incidentCategory, setIncidentCategory] = useState<IntegrityCategory>("manual_flag");
  const [incidentSeverity, setIncidentSeverity] = useState<IntegritySeverity>("warning");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [isSubmittingIncident, setIsSubmittingIncident] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<"templates" | "rbac" | "audit" | "invitations" | "analytics" | "webhooks" | "proctor">("templates");
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
      loadAnalytics(selectedOrg.id, analyticsPeriod);
      loadWebhooks(selectedOrg.id);
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

  const loadAnalytics = async (orgId?: string, period: "7d" | "30d" | "all" = analyticsPeriod) => {
    const targetOrgId = orgId || selectedOrg?.id;
    if (!targetOrgId) return;
    try {
      setIsLoadingAnalytics(true);
      const data = await ApiClient.getAiCostAnalytics(targetOrgId, period, activeJwtToken || undefined);
      setAnalyticsData(data);
    } catch (err: unknown) {
      console.error("Failed to load analytics:", err);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  const loadWebhooks = async (orgId?: string) => {
    const targetOrgId = orgId || selectedOrg?.id;
    if (!targetOrgId) return;
    try {
      setIsLoadingWebhooks(true);
      const data = await ApiClient.getWebhookSubscriptions(targetOrgId, activeJwtToken || undefined);
      setWebhooks(data.subscriptions);
    } catch (err: unknown) {
      console.error("Failed to load webhooks:", err);
    } finally {
      setIsLoadingWebhooks(false);
    }
  };

  const handlePeriodChange = async (newPeriod: "7d" | "30d" | "all") => {
    setAnalyticsPeriod(newPeriod);
    if (selectedOrg) {
      await loadAnalytics(selectedOrg.id, newPeriod);
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg) return;
    try {
      setIsSubmitting(true);
      setError(null);
      const newSub = await ApiClient.createWebhookSubscription(
        {
          organizationId: selectedOrg.id,
          targetUrl: webhookTargetUrl.trim(),
          format: webhookFormat,
          eventTypes: webhookEvents as any,
        },
        activeJwtToken || undefined
      );
      setWebhooks((prev) => [newSub, ...prev]);
      setIsCreateWebhookModalOpen(false);
      setWebhookTargetUrl("");
      setSuccessMessage(`Webhook subscription registered for ${newSub.targetUrl}`);
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create webhook subscription");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!selectedOrg) return;
    try {
      await ApiClient.deleteWebhookSubscription(selectedOrg.id, webhookId, activeJwtToken || undefined);
      setWebhooks((prev) => prev.filter((w) => w.id !== webhookId));
      setSuccessMessage("Webhook subscription deleted successfully.");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete webhook subscription");
    }
  };

  const handleTestWebhook = async (webhookId: string) => {
    if (!selectedOrg) return;
    try {
      setIsTestingWebhookId(webhookId);
      setError(null);
      const res = await ApiClient.testWebhookSubscription(selectedOrg.id, webhookId, activeJwtToken || undefined);
      setLastTestDeliveryLog(res.deliveryLog);
      setIsTestLogModalOpen(true);
      setSuccessMessage(`Test dispatch returned HTTP ${res.deliveryLog.statusCode || 200} in ${res.deliveryLog.durationMs}ms`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Webhook test dispatch failed");
    } finally {
      setIsTestingWebhookId(null);
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

  const handleSelectSessionForProctor = async (session: AssessmentSession) => {
    setSelectedSessionForProctor(session);
    try {
      setIsLoadingIntegrity(true);
      const [report, incResp] = await Promise.all([
        ApiClient.getIntegrityReport(session.id, activeJwtToken || undefined),
        ApiClient.getProctorIncidents(session.id, activeJwtToken || undefined),
      ]);
      setIntegrityReport(report);
      setProctorIncidents(incResp.incidents);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load session integrity data");
    } finally {
      setIsLoadingIntegrity(false);
    }
  };

  const handleRefreshProctorData = async () => {
    if (!selectedSessionForProctor) return;
    await handleSelectSessionForProctor(selectedSessionForProctor);
  };

  const handleLogProctorIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSessionForProctor) return;
    if (!incidentDescription.trim()) {
      setError("Please describe the observed incident.");
      return;
    }
    try {
      setIsSubmittingIncident(true);
      setError(null);
      await ApiClient.logProctorIncident(
        selectedSessionForProctor.id,
        {
          category: incidentCategory,
          severity: incidentSeverity,
          description: incidentDescription.trim(),
        },
        activeJwtToken || undefined
      );
      setIsLogIncidentModalOpen(false);
      setIncidentDescription("");
      setSuccessMessage(`Proctor incident logged: ${incidentCategory} (${incidentSeverity})`);
      setTimeout(() => setSuccessMessage(null), 3500);
      await handleRefreshProctorData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to log proctor incident");
    } finally {
      setIsSubmittingIncident(false);
    }
  };

  const handleResolveIncident = async (incidentId: string) => {
    if (!selectedSessionForProctor) return;
    try {
      setError(null);
      await ApiClient.resolveProctorIncident(selectedSessionForProctor.id, incidentId, activeJwtToken || undefined);
      setSuccessMessage("Proctor incident marked as resolved.");
      setTimeout(() => setSuccessMessage(null), 3000);
      await handleRefreshProctorData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resolve proctor incident");
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

  const handlePauseSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToPause) return;
    try {
      setIsProctorActionInProgress(true);
      setError(null);
      const updated = await ApiClient.pauseSession(sessionToPause.id, pauseReasonInput, activeJwtToken || undefined);
      setSuccessMessage(`Assessment session paused: ${updated.id.slice(0, 8)}... Countdown frozen.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      setSessionToPause(null);
      if (selectedOrg) {
        await loadSessions(selectedOrg.id);
      }
      setSelectedSessionForAudit(updated);
      await handleSelectSessionForAudit(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to pause assessment session");
    } finally {
      setIsProctorActionInProgress(false);
    }
  };

  const handleResumeSession = async (sessionId: string) => {
    try {
      setIsProctorActionInProgress(true);
      setError(null);
      const updated = await ApiClient.resumeSession(sessionId, activeJwtToken || undefined);
      setSuccessMessage(`Assessment session resumed. Candidate timer extended by elapsed pause duration.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      if (selectedOrg) {
        await loadSessions(selectedOrg.id);
      }
      setSelectedSessionForAudit(updated);
      await handleSelectSessionForAudit(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resume assessment session");
    } finally {
      setIsProctorActionInProgress(false);
    }
  };

  // Task 16: Multi-Reviewer Calibration Handlers
  const handleOpenScoreModal = async (session: AssessmentSession) => {
    setSessionForCalibration(session);
    setIsScoreModalOpen(true);
    try {
      const data = await ApiClient.getEvaluations(session.id, activeJwtToken || undefined);
      if (data.evaluations.length > 0 && activePersona) {
        const myEval = data.evaluations.find((e) => e.reviewerEmail === activePersona.email);
        if (myEval) {
          const loadedScores = { ...evalScores };
          for (const s of myEval.scores) {
            loadedScores[s.dimensionId] = { rating: s.rating, rationale: s.rationale };
          }
          setEvalScores(loadedScores);
          setEvalRecommendation(myEval.recommendation);
          setEvalSummaryRationale(myEval.summaryRationale);
        }
      }
    } catch {
      // Non-blocking
    }
  };

  const handleAutoFillFromAiDraft = async (sessionId: string) => {
    try {
      setIsLoadingAiDraft(true);
      setError(null);
      const draft = await ApiClient.getAiDraftScorecard(sessionId, activeJwtToken || undefined);
      const updatedScores = { ...evalScores };
      for (const dim of draft.dimensions) {
        updatedScores[dim.dimensionId] = {
          rating: dim.rating,
          rationale: dim.reviewerNotes || (dim.evidenceCitations.length > 0 ? dim.evidenceCitations.join(" ") : "AI Baseline Evaluation recommendation."),
        };
      }
      setEvalScores(updatedScores);
      setEvalSummaryRationale(draft.summaryNotes || "Automated baseline evaluation suggests solid engineering competence.");
      setSuccessMessage("Imported baseline rubric ratings from AI Assessment Evaluator (Groq / OpenAI).");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate AI draft scorecard");
    } finally {
      setIsLoadingAiDraft(false);
    }
  };

  const handleSubmitEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionForCalibration) return;
    try {
      setIsProctorActionInProgress(true);
      setError(null);

      const scoresPayload = RUBRIC_DIMENSIONS.map((dim) => ({
        dimensionId: dim.id,
        name: dim.name,
        rating: evalScores[dim.id]?.rating ?? 3,
        rationale: evalScores[dim.id]?.rationale?.trim() || "Observed solid engineering performance.",
        evidenceCitations: [],
      }));

      await ApiClient.submitReviewerEvaluation(
        sessionForCalibration.id,
        {
          scores: scoresPayload,
          recommendation: evalRecommendation,
          summaryRationale: evalSummaryRationale.trim() || "Overall solid candidate execution and communication.",
        },
        activeJwtToken || undefined
      );

      setSuccessMessage(`Evaluation submitted successfully! Scored 7 rubric dimensions.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      setIsScoreModalOpen(false);

      // Refresh consensus
      await handleOpenConsensusModal(sessionForCalibration);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit evaluation");
    } finally {
      setIsProctorActionInProgress(false);
    }
  };

  const handleOpenConsensusModal = async (session: AssessmentSession) => {
    setSessionForCalibration(session);
    setIsConsensusModalOpen(true);
    setIsLoadingCalibration(true);
    try {
      const [consensusData, evalsData] = await Promise.all([
        ApiClient.getCalibrationConsensus(session.id, activeJwtToken || undefined),
        ApiClient.getEvaluations(session.id, activeJwtToken || undefined),
      ]);
      setCalibrationConsensus(consensusData);
      setEvaluationsList(evalsData.evaluations);
      setIsEvaluationsMasked(evalsData.isMasked);
    } catch {
      // Non-blocking
    } finally {
      setIsLoadingCalibration(false);
    }
  };

  const handleOpenHiringReport = async (session: AssessmentSession) => {
    try {
      setIsLoadingReport(true);
      setError(null);
      const report = await ApiClient.getHiringDecisionReport(session.id, activeJwtToken ?? undefined);
      setSelectedReport(report);
      setIsReportModalOpen(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load hiring decision report");
    } finally {
      setIsLoadingReport(false);
    }
  };

  const handleCopyReportJson = () => {
    if (!selectedReport) return;
    navigator.clipboard.writeText(JSON.stringify(selectedReport, null, 2));
    setCopiedKey("report_json");
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleExportPrintReport = () => {
    if (!selectedReport) return;
    const url = ApiClient.getReportExportUrl(selectedReport.sessionId, activeJwtToken ?? undefined);
    window.open(url, "_blank");
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
        attemptDurationMinutes: formDuration,
        submissionDeadlineDays: 7,
        defaultAiBudgetUsd: formBudget,
        description: formDescription.trim(),
        starterCode: formStarterCode,
        verificationTestCode: formTestCode,
        language: "typescript",
        tasks: [],
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

  if (isStudioOpen && selectedOrg) {
    return (
      <CompanyAssessmentStudio
        organization={selectedOrg}
        initialTemplate={studioTemplateToEdit}
        onClose={() => {
          setIsStudioOpen(false);
          setStudioTemplateToEdit(null);
        }}
        onSaved={(tmpl) => {
          loadTemplates(selectedOrg.id);
          setSelectedTemplate(tmpl);
          setSuccessMessage(`Assessment "${tmpl.title}" saved successfully!`);
        }}
        onPublished={(tmpl) => {
          loadTemplates(selectedOrg.id);
          setSelectedTemplate(tmpl);
          setSuccessMessage(`Assessment "${tmpl.title}" published as immutable version!`);
        }}
      />
    );
  }

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
            <button
              onClick={() => {
                setActiveTab("analytics");
                if (selectedOrg) loadAnalytics(selectedOrg.id, analyticsPeriod);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "analytics"
                  ? "bg-white text-indigo-600 shadow-xs dark:bg-gray-900 dark:text-indigo-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
              <span>AI Cost & Budget</span>
            </button>
            <button
              onClick={() => {
                setActiveTab("webhooks");
                if (selectedOrg) loadWebhooks(selectedOrg.id);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "webhooks"
                  ? "bg-white text-indigo-600 shadow-xs dark:bg-gray-900 dark:text-indigo-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              <Webhook className="w-3.5 h-3.5 text-violet-500" />
              <span>Webhooks & ATS ({webhooks.length})</span>
            </button>
            <button
              onClick={() => {
                setActiveTab("proctor");
                if (selectedOrg) {
                  loadSessions(selectedOrg.id);
                  if (sessions.length > 0 && !selectedSessionForProctor) {
                    handleSelectSessionForProctor(sessions[0]!);
                  }
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "proctor"
                  ? "bg-white text-indigo-600 shadow-xs dark:bg-gray-900 dark:text-indigo-400 font-bold"
                  : "text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
              <span>Live Proctor & Integrity</span>
            </button>
          </div>

          {activeTab === "templates" && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setStudioTemplateToEdit(null);
                  setIsStudioOpen(true);
                }}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 px-4 py-2 font-bold text-xs text-white shadow-md shadow-indigo-600/25 transition-all cursor-pointer"
                title="Open Role-Specific Assessment Builder Studio"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Assessment Studio (Custom Builder)</span>
              </button>
              <button
                onClick={handleOpenCreateModal}
                className="flex items-center gap-2 rounded-xl border border-slate-300 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-gray-800 px-3 py-2 font-semibold text-xs text-slate-700 dark:text-gray-200 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Quick Template</span>
              </button>
            </div>
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

          {activeTab === "analytics" && (
            <button
              onClick={() => selectedOrg && loadAnalytics(selectedOrg.id, analyticsPeriod)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800 px-3 py-2 font-semibold text-xs text-slate-700 dark:text-gray-200 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAnalytics ? "animate-spin text-indigo-600" : ""}`} />
              <span>Refresh Analytics</span>
            </button>
          )}

          {activeTab === "webhooks" && (
            <button
              onClick={() => setIsCreateWebhookModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2 font-semibold text-xs text-white shadow-md shadow-violet-600/20 transition-all focus:outline-none focus:ring-2 focus:ring-violet-400"
            >
              <Plus className="w-4 h-4" />
              <span>Add Webhook</span>
            </button>
          )}

          {activeTab === "proctor" && selectedSessionForProctor && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefreshProctorData}
                className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800 px-3 py-2 font-semibold text-xs text-slate-700 dark:text-gray-200 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingIntegrity ? "animate-spin text-indigo-600" : ""}`} />
                <span>Refresh Telemetry</span>
              </button>
              <button
                onClick={() => setIsLogIncidentModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2 font-semibold text-xs text-white shadow-md shadow-rose-600/20 transition-all focus:outline-none focus:ring-2 focus:ring-rose-400"
              >
                <Flag className="w-4 h-4" />
                <span>Log Incident</span>
              </button>
            </div>
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
                      onClick={() => {
                        setStudioTemplateToEdit(selectedTemplate);
                        setIsStudioOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                      title="Open in Assessment Studio"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Edit in Studio</span>
                    </button>

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
        ) : activeTab === "audit" ? (
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
                                    : sess.status === "paused"
                                    ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 font-bold"
                                    : "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300"
                                }`}
                              >
                                {sess.status.toUpperCase()}
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
                            {selectedSessionForAudit.status === "in_progress" && (
                              <button
                                onClick={() => setSessionToPause(selectedSessionForAudit)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors shadow-xs"
                                title="Pause session due to candidate technical difficulty or proctor intervention"
                              >
                                <Pause className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                <span>Pause Session</span>
                              </button>
                            )}
                            {selectedSessionForAudit.status === "paused" && (
                              <button
                                onClick={() => handleResumeSession(selectedSessionForAudit.id)}
                                disabled={isProctorActionInProgress}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white border border-emerald-500 text-xs font-semibold hover:bg-emerald-500 transition-colors shadow-xs disabled:opacity-50"
                                title="Resume session and extend candidate timer by exact pause duration"
                              >
                                <Play className="w-3.5 h-3.5 text-white" />
                                <span>Resume Session</span>
                              </button>
                            )}
                            {selectedSessionForAudit.status === "submitted" && (
                              <>
                                <button
                                  onClick={() => handleInspectSubmission(selectedSessionForAudit.id)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors shadow-xs"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                  <span>View Submission (SHA-256)</span>
                                </button>
                                <button
                                  onClick={() => handleOpenScoreModal(selectedSessionForAudit)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white border border-indigo-500 text-xs font-semibold hover:bg-indigo-500 transition-colors shadow-xs"
                                  title="Grade candidate across the 7 rubric dimensions"
                                >
                                  <Award className="w-3.5 h-3.5 text-white" />
                                  <span>Score Rubric</span>
                                </button>
                                <button
                                  onClick={() => handleOpenConsensusModal(selectedSessionForAudit)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 text-xs font-semibold hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors shadow-xs"
                                  title="View multi-reviewer calibration consensus and variance flags"
                                >
                                  <Scale className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                                  <span>Calibration Board</span>
                                </button>
                                <button
                                  onClick={() => handleOpenHiringReport(selectedSessionForAudit)}
                                  disabled={isLoadingReport}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white border border-blue-500 text-xs font-semibold hover:bg-blue-500 transition-colors shadow-xs"
                                  title="View evidence-linked candidate hiring decision report"
                                >
                                  <FileText className="w-3.5 h-3.5 text-white" />
                                  <span>Decision Report</span>
                                </button>
                              </>
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

                      {/* Proctor Paused Banner */}
                      {selectedSessionForAudit?.status === "paused" && (
                        <div className="p-3.5 rounded-xl border border-amber-300 dark:border-amber-800/80 bg-amber-50/80 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 flex items-center justify-between text-xs shadow-xs">
                          <div className="flex items-center gap-2.5">
                            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <div>
                              <div className="font-bold flex items-center gap-2">
                                <span>Assessment Paused by Proctor</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 uppercase tracking-wider font-semibold">
                                  Timer Frozen
                                </span>
                              </div>
                              <div className="text-[11px] text-amber-700 dark:text-amber-300/80 mt-0.5">
                                Reason: <span className="italic">{selectedSessionForAudit.pauseReason || "Proctor incident pause"}</span> • Candidate countdown is frozen. Upon resumption, deadline will be automatically extended.
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleResumeSession(selectedSessionForAudit.id)}
                            disabled={isProctorActionInProgress}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-xs flex items-center gap-1.5 shrink-0"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Resume Now</span>
                          </button>
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
                                  {evt.type === "session_paused" && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 flex items-center gap-1">
                                      <Pause className="w-3 h-3 text-amber-600" />
                                      <span>Session Paused by Proctor</span>
                                    </span>
                                  )}
                                  {evt.type === "session_resumed" && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1">
                                      <Play className="w-3 h-3 text-emerald-600" />
                                      <span>Session Resumed (Timer Extended)</span>
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

                              {evt.type === "session_paused" && Boolean(evt.payload?.reason) && (
                                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-sans border border-amber-200 dark:border-amber-800 text-[11px]">
                                  Proctor Incident Reason: <span className="font-semibold">{String(evt.payload?.reason)}</span>
                                </div>
                              )}

                              {evt.type === "session_resumed" && Boolean(evt.payload?.pauseDurationMs) && (
                                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-sans border border-emerald-200 dark:border-emerald-800 text-[11px]">
                                  Timer Extended: <span className="font-semibold">+{Math.round(Number(evt.payload?.pauseDurationMs) / 1000)}s</span> added to candidate deadline
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
        ) : activeTab === "analytics" ? (
          /* Task 20: AI Cost Analytics & Token Budget Forecasting Board */
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Header with period toggle and budget cap summary */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <span>AI Cost Analytics & Token Budget Forecasting (Task 20)</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                    Real-time consumption ledger, 30-day linear regression burn rate, runway estimation, and automated runaway prompt anomaly alerts.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700 text-xs font-semibold">
                    <button
                      onClick={() => handlePeriodChange("7d")}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        analyticsPeriod === "7d"
                          ? "bg-white text-indigo-600 shadow-xs dark:bg-gray-900 dark:text-indigo-400 font-bold"
                          : "text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
                      }`}
                    >
                      Last 7 Days
                    </button>
                    <button
                      onClick={() => handlePeriodChange("30d")}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        analyticsPeriod === "30d"
                          ? "bg-white text-indigo-600 shadow-xs dark:bg-gray-900 dark:text-indigo-400 font-bold"
                          : "text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
                      }`}
                    >
                      Last 30 Days
                    </button>
                    <button
                      onClick={() => handlePeriodChange("all")}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        analyticsPeriod === "all"
                          ? "bg-white text-indigo-600 shadow-xs dark:bg-gray-900 dark:text-indigo-400 font-bold"
                          : "text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
                      }`}
                    >
                      All Time
                    </button>
                  </div>
                </div>
              </div>

              {isLoadingAnalytics && !analyticsData ? (
                <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>Computing token consumption & burn rate projections...</span>
                </div>
              ) : analyticsData ? (
                <>
                  {/* Top 4 Financial KPI Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Total Spend */}
                    <div className="p-5 rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] shadow-xs space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-gray-400">
                        <span className="font-semibold uppercase tracking-wider text-[10px]">Total AI Spend</span>
                        <DollarSign className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                        ${analyticsData.totalCostUsd.toFixed(4)}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-gray-400 flex items-center justify-between">
                        <span>{analyticsData.totalTokens.toLocaleString()} tokens</span>
                        <span>{analyticsData.totalQueries} LLM queries</span>
                      </div>
                    </div>

                    {/* Allocated Monthly Budget & Utilization */}
                    <div className="p-5 rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] shadow-xs space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-gray-400">
                        <span className="font-semibold uppercase tracking-wider text-[10px]">Monthly Budget Cap</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          analyticsData.budgetUtilizationPercent > 85
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                            : analyticsData.budgetUtilizationPercent > 60
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        }`}>
                          {analyticsData.budgetUtilizationPercent.toFixed(1)}% Used
                        </span>
                      </div>
                      <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                        ${analyticsData.allocatedMonthlyBudgetUsd.toFixed(2)}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-gray-400">
                        Remaining: ${(Math.max(0, analyticsData.allocatedMonthlyBudgetUsd - analyticsData.totalCostUsd)).toFixed(2)}
                      </div>
                    </div>

                    {/* Projected 30-Day Spend */}
                    <div className="p-5 rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] shadow-xs space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-gray-400">
                        <span className="font-semibold uppercase tracking-wider text-[10px]">Projected 30-Day Spend</span>
                        <TrendingUp className="w-4 h-4 text-indigo-500" />
                      </div>
                      <div className={`text-2xl font-extrabold ${
                        analyticsData.isOverBudget
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-slate-900 dark:text-white"
                      }`}>
                        ${analyticsData.projectedMonthlySpendUsd.toFixed(2)}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-gray-400">
                        {analyticsData.isOverBudget ? "⚠️ Forecast exceeds budget cap" : "Forecasted from daily burn rate"}
                      </div>
                    </div>

                    {/* Estimated Runway & Unit Economics */}
                    <div className="p-5 rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] shadow-xs space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-gray-400">
                        <span className="font-semibold uppercase tracking-wider text-[10px]">Runway & Unit Cost</span>
                        <Zap className="w-4 h-4 text-amber-500" />
                      </div>
                      <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                        {analyticsData.runwayDaysRemaining >= 999 ? "∞ Stable" : `${analyticsData.runwayDaysRemaining} Days`}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-gray-400">
                        Avg: ${analyticsData.avgCostPerSessionUsd.toFixed(3)} / candidate
                      </div>
                    </div>
                  </div>

                  {/* Budget Utilization Progress Bar */}
                  <div className="p-5 rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] shadow-xs space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900 dark:text-white">
                        Monthly AI Token Allocation Progress
                      </span>
                      <span className="font-mono text-slate-500 dark:text-gray-400">
                        ${analyticsData.totalCostUsd.toFixed(3)} / ${analyticsData.allocatedMonthlyBudgetUsd.toFixed(2)} USD
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-gray-800 rounded-full h-3 overflow-hidden flex">
                      <div
                        className={`h-full transition-all duration-500 ${
                          analyticsData.budgetUtilizationPercent > 85
                            ? "bg-rose-500"
                            : analyticsData.budgetUtilizationPercent > 60
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(1, analyticsData.budgetUtilizationPercent))}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Threshold: 0%</span>
                      <span>Warning: 60% ($30.00)</span>
                      <span>Critical: 85% ($42.50)</span>
                      <span>Cap: 100% (${analyticsData.allocatedMonthlyBudgetUsd.toFixed(0)}.00)</span>
                    </div>
                  </div>

                  {/* Cost Anomaly Outlier Detection Banner */}
                  <div className="rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={`w-4 h-4 ${analyticsData.anomalies.length > 0 ? "text-amber-500" : "text-emerald-500"}`} />
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                          Automated Cost Anomaly & Outlier Guard
                        </h4>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        {analyticsData.anomalies.length} Anomaly Flags Detected
                      </span>
                    </div>

                    {analyticsData.anomalies.length === 0 ? (
                      <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>All candidate sessions operating within normal variance parameters. No runaway prompt loops or unexpected cost spikes detected.</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {analyticsData.anomalies.map((a) => (
                          <div
                            key={a.id}
                            className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-4 ${
                              a.severity === "critical"
                                ? "bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300"
                                : "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300"
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  a.severity === "critical" ? "bg-rose-200 text-rose-800" : "bg-amber-200 text-amber-800"
                                }`}>
                                  {a.anomalyType.replace(/_/g, " ")}
                                </span>
                                <span className="font-bold">{a.candidateEmail}</span>
                                <span className="font-mono text-[10px] opacity-75">Session: {a.sessionId.slice(0, 16)}...</span>
                              </div>
                              <p className="text-[11px] opacity-90">{a.description}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-mono font-bold block">{a.metricValue} (vs {a.thresholdValue} limit)</span>
                              <span className="text-[10px] opacity-70">{new Date(a.detectedAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Two Column Breakdown: Model Breakdown vs Track Breakdown */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column: LLM Model Cost Breakdown */}
                    <div className="rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] p-5 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                          <Layers className="w-4 h-4 text-indigo-500" />
                          <span>LLM Model & Provider Breakdown</span>
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {analyticsData.modelsBreakdown.length} Models Active
                        </span>
                      </div>

                      {analyticsData.modelsBreakdown.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-4">No AI queries recorded in this period.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 dark:border-gray-800 text-[10px] uppercase text-slate-400 font-semibold">
                                <th className="pb-2">Model</th>
                                <th className="pb-2">Provider</th>
                                <th className="pb-2 text-right">Tokens</th>
                                <th className="pb-2 text-right">Cost</th>
                                <th className="pb-2 text-right">Share</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-gray-800/60 font-mono">
                              {analyticsData.modelsBreakdown.map((m) => (
                                <tr key={m.modelId} className="hover:bg-slate-50/50 dark:hover:bg-gray-800/30">
                                  <td className="py-2.5 font-bold text-slate-800 dark:text-gray-200 text-[11px] truncate max-w-[140px]">
                                    {m.modelId}
                                  </td>
                                  <td className="py-2.5 uppercase text-[10px] text-slate-500">
                                    {m.providerId}
                                  </td>
                                  <td className="py-2.5 text-right text-slate-600 dark:text-gray-400 text-[11px]">
                                    {m.totalTokens.toLocaleString()}
                                  </td>
                                  <td className="py-2.5 text-right font-bold text-slate-900 dark:text-white text-[11px]">
                                    ${m.costUsd.toFixed(4)}
                                  </td>
                                  <td className="py-2.5 text-right text-indigo-600 dark:text-indigo-400 font-bold text-[11px]">
                                    {m.percentageOfTotal.toFixed(1)}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Engineering Track Cost Breakdown */}
                    <div className="rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] p-5 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                          <Code2 className="w-4 h-4 text-emerald-500" />
                          <span>Cost by Target Role & Track</span>
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {analyticsData.tracksBreakdown.length} Tracks
                        </span>
                      </div>

                      {analyticsData.tracksBreakdown.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-4">No track usage recorded in this period.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 dark:border-gray-800 text-[10px] uppercase text-slate-400 font-semibold">
                                <th className="pb-2">Track</th>
                                <th className="pb-2 text-right">Sessions</th>
                                <th className="pb-2 text-right">Total Cost</th>
                                <th className="pb-2 text-right">Avg / Session</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-gray-800/60 font-mono">
                              {analyticsData.tracksBreakdown.map((t) => (
                                <tr key={t.track} className="hover:bg-slate-50/50 dark:hover:bg-gray-800/30">
                                  <td className="py-2.5 font-bold text-slate-800 dark:text-gray-200 text-[11px]">
                                    {t.track}
                                  </td>
                                  <td className="py-2.5 text-right text-slate-600 dark:text-gray-400 text-[11px]">
                                    {t.sessionCount}
                                  </td>
                                  <td className="py-2.5 text-right font-bold text-slate-900 dark:text-white text-[11px]">
                                    ${t.totalCostUsd.toFixed(4)}
                                  </td>
                                  <td className="py-2.5 text-right text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                                    ${t.avgCostPerSessionUsd.toFixed(4)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Daily Burn Rate & Activity Series */}
                  <div className="rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <Clock className="w-4 h-4 text-indigo-500" />
                        <span>Daily Spend Velocity & Burn Rate Series</span>
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {analyticsData.dailyBurnRate.length} Days Recorded
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-gray-800 text-[10px] uppercase text-slate-400 font-semibold">
                            <th className="pb-2">Date</th>
                            <th className="pb-2 text-right">Daily Cost</th>
                            <th className="pb-2 text-right">Tokens</th>
                            <th className="pb-2 text-right">Queries</th>
                            <th className="pb-2 text-right">Active Sessions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-gray-800/60 font-mono">
                          {analyticsData.dailyBurnRate.slice(-14).reverse().map((d) => (
                            <tr key={d.date} className="hover:bg-slate-50/50 dark:hover:bg-gray-800/30">
                              <td className="py-2 font-bold text-slate-700 dark:text-gray-300 text-[11px]">
                                {d.date}
                              </td>
                              <td className="py-2 text-right font-extrabold text-slate-900 dark:text-white text-[11px]">
                                ${d.costUsd.toFixed(4)}
                              </td>
                              <td className="py-2 text-right text-slate-600 dark:text-gray-400 text-[11px]">
                                {d.tokens.toLocaleString()}
                              </td>
                              <td className="py-2 text-right text-slate-600 dark:text-gray-400 text-[11px]">
                                {d.queryCount}
                              </td>
                              <td className="py-2 text-right text-indigo-600 dark:text-indigo-400 font-bold text-[11px]">
                                {d.sessionsActive}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                  <BarChart3 className="w-8 h-8 mx-auto text-slate-300 dark:text-gray-600" />
                  <p className="font-semibold text-slate-700 dark:text-gray-300">
                    No analytics data loaded
                  </p>
                  <button
                    onClick={() => selectedOrg && loadAnalytics(selectedOrg.id, analyticsPeriod)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold text-xs"
                  >
                    Load Analytics
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === "webhooks" ? (
          /* Task 19: Enterprise ATS & HRIS Webhooks Dispatcher */
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Webhook className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    <span>Enterprise ATS & HRIS Webhooks Dispatcher (Task 19)</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                    Deliver cryptographically signed HMAC-SHA256 event payloads to Greenhouse, Lever, Workday, or custom endpoints with automatic exponential retry backoff.
                  </p>
                </div>
                <button
                  onClick={() => setIsCreateWebhookModalOpen(true)}
                  className="flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2 font-semibold text-xs text-white shadow-md shadow-violet-600/20 transition-all shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Webhook</span>
                </button>
              </div>

              {/* Subscriptions List */}
              <div className="space-y-3">
                {webhooks.length === 0 ? (
                  <div className="p-8 border border-dashed border-slate-300 dark:border-gray-700 rounded-2xl text-center space-y-2">
                    <Webhook className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-xs font-semibold text-slate-700 dark:text-gray-300">
                      No webhook endpoints registered
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400">
                      Connect your Greenhouse, Lever, or Workday ATS endpoint to automatically sync assessment submissions and candidate hiring reports.
                    </p>
                  </div>
                ) : (
                  webhooks.map((sub) => (
                    <div
                      key={sub.id}
                      className="p-5 rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] space-y-3 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            sub.format === "greenhouse"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : sub.format === "lever"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                              : sub.format === "workday"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                              : "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                          }`}>
                            {sub.format.toUpperCase()} ADAPTER
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            sub.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300"
                              : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-300"
                          }`}>
                            {sub.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTestWebhook(sub.id)}
                            disabled={isTestingWebhookId === sub.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 text-xs font-semibold transition-colors"
                          >
                            <Zap className={`w-3.5 h-3.5 text-amber-500 ${isTestingWebhookId === sub.id ? "animate-spin" : ""}`} />
                            <span>{isTestingWebhookId === sub.id ? "Dispatching..." : "Send Test Ping"}</span>
                          </button>
                          <button
                            onClick={() => handleDeleteWebhook(sub.id)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                            title="Delete Webhook"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-gray-900/60 font-mono text-[11px] border border-slate-100 dark:border-gray-800 space-y-1">
                        <div className="text-slate-900 dark:text-white font-bold truncate">
                          {sub.targetUrl}
                        </div>
                        <div className="flex items-center justify-between text-slate-400 text-[10px]">
                          <span>HMAC Secret: {sub.secret.slice(0, 10)}••••••••</span>
                          <span>Registered: {new Date(sub.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Subscribed Events:</span>
                        {sub.eventTypes.map((evt) => (
                          <span
                            key={evt}
                            className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-gray-800 text-slate-700 dark:text-gray-300 font-mono text-[10px]"
                          >
                            {evt}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : activeTab === "proctor" ? (
          /* LOOP 7: Live Proctoring & Passive Anti-Cheat Evidence Pipeline */
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Header & Policy Notice */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-rose-500" />
                    <span>Live Proctoring & Passive Anti-Cheat Evidence Pipeline</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
                      LOOP 7
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                    Passive, server-authoritative integrity telemetry: window blur tracking, unattributed paste detection, and real-time interviewer intervention controls.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 text-[11px] font-medium flex items-center gap-1.5 max-w-md">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>
                      <strong>Human Accountability:</strong> Integrity metrics are evidentiary audit aids. Human interviewers remain strictly accountable for hiring decisions; candidates are never auto-disqualified algorithmically.
                    </span>
                  </div>
                </div>
              </div>

              {/* Two-Column Monitor */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left: Active Session List */}
                <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">
                        Candidate Sessions
                      </h4>
                      <p className="text-[11px] text-slate-400 dark:text-gray-500">
                        Select a session to inspect live integrity signals
                      </p>
                    </div>
                    <button
                      onClick={() => selectedOrg && loadSessions(selectedOrg.id)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors"
                      title="Refresh Sessions"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-gray-800/60 max-h-[640px] overflow-y-auto">
                    {sessions.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400 space-y-1">
                        <Users className="w-8 h-8 mx-auto text-slate-300 dark:text-gray-600" />
                        <p className="font-semibold text-slate-700 dark:text-gray-300">No active sessions</p>
                        <p>Invite a candidate to start monitoring live integrity.</p>
                      </div>
                    ) : (
                      sessions.map((sess) => {
                        const isSelected = selectedSessionForProctor?.id === sess.id;
                        return (
                          <div
                            key={sess.id}
                            onClick={() => handleSelectSessionForProctor(sess)}
                            className={`p-4 transition-all cursor-pointer ${
                              isSelected
                                ? "bg-indigo-50/70 dark:bg-indigo-950/30 border-l-4 border-indigo-600 dark:border-indigo-500"
                                : "hover:bg-slate-50 dark:hover:bg-gray-800/30 border-l-4 border-transparent"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h5 className="font-bold text-xs text-slate-900 dark:text-white">
                                  {sess.candidateName}
                                </h5>
                                <p className="text-[11px] text-slate-500 dark:text-gray-400">{sess.candidateEmail}</p>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  sess.status === "in_progress"
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                    : sess.status === "paused"
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                    : sess.status === "submitted"
                                    ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                    : "bg-slate-100 text-slate-700 dark:bg-gray-800 dark:text-gray-300"
                                }`}
                              >
                                {sess.status.replace("_", " ")}
                              </span>
                            </div>

                            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 dark:text-gray-500 font-mono">
                              <span>ID: {sess.id.slice(0, 8)}...</span>
                              <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold">
                                <span>Inspect Signals</span>
                                <ChevronRight className="w-3 h-3" />
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right: Real-Time Risk Gauge, Evidentiary Cards & Incident Feed */}
                <div className="lg:col-span-8 space-y-6">
                  {!selectedSessionForProctor ? (
                    <div className="p-12 rounded-2xl border border-dashed border-slate-300 dark:border-gray-800 bg-white/50 dark:bg-gray-900/20 text-center text-xs text-slate-400 space-y-2">
                      <ShieldAlert className="w-10 h-10 mx-auto text-slate-300 dark:text-gray-600" />
                      <h4 className="font-bold text-sm text-slate-700 dark:text-gray-300">
                        No Session Selected
                      </h4>
                      <p>Select a candidate session on the left to inspect passive integrity telemetry and proctor events.</p>
                    </div>
                  ) : isLoadingIntegrity ? (
                    <div className="p-12 rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] text-center text-xs text-slate-400 space-y-3">
                      <RefreshCw className="w-8 h-8 mx-auto animate-spin text-indigo-600" />
                      <p className="font-semibold text-slate-700 dark:text-gray-300">
                        Computing real-time integrity risk report...
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Live Risk Score Hero Card */}
                      <div className="p-6 rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] shadow-xs space-y-5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            {/* Score Dial */}
                            <div
                              className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center font-mono border-2 shadow-inner shrink-0 ${
                                integrityReport?.riskLevel === "clean"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                  : integrityReport?.riskLevel === "low"
                                  ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                                  : integrityReport?.riskLevel === "medium"
                                  ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                                  : "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                              }`}
                            >
                              <span className="text-2xl font-black leading-none">
                                {integrityReport?.integrityScore ?? 100}
                              </span>
                              <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5 opacity-80">
                                / 100
                              </span>
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
                                    integrityReport?.riskLevel === "clean"
                                      ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                                      : integrityReport?.riskLevel === "low"
                                      ? "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300"
                                      : integrityReport?.riskLevel === "medium"
                                      ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300"
                                      : "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300"
                                  }`}
                                >
                                  {integrityReport?.riskLevel} Risk
                                </span>
                                <span className="text-xs text-slate-400 font-mono">
                                  Session: {selectedSessionForProctor.id.slice(0, 8)}...
                                </span>
                              </div>
                              <h4 className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                                {selectedSessionForProctor.candidateName}
                              </h4>
                              <p className="text-xs text-slate-500 dark:text-gray-400">
                                {selectedSessionForProctor.candidateEmail} • Status:{" "}
                                <span className="font-semibold text-slate-800 dark:text-gray-200 capitalize">
                                  {selectedSessionForProctor.status.replace("_", " ")}
                                </span>
                              </p>
                            </div>
                          </div>

                          {/* Quick Intervention Buttons */}
                          <div className="flex items-center gap-2 shrink-0">
                            {selectedSessionForProctor.status === "in_progress" ? (
                              <button
                                onClick={() => setSessionToPause(selectedSessionForProctor)}
                                disabled={isProctorActionInProgress}
                                className="px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                <Pause className="w-3.5 h-3.5" />
                                <span>Pause Session</span>
                              </button>
                            ) : selectedSessionForProctor.status === "paused" ? (
                              <button
                                onClick={async () => {
                                  await handleResumeSession(selectedSessionForProctor.id);
                                  await handleRefreshProctorData();
                                }}
                                disabled={isProctorActionInProgress}
                                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                              >
                                <Play className="w-3.5 h-3.5" />
                                <span>Resume with Credit</span>
                              </button>
                            ) : null}

                            <button
                              onClick={() => setIsLogIncidentModalOpen(true)}
                              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-rose-600/20 cursor-pointer"
                            >
                              <Flag className="w-3.5 h-3.5" />
                              <span>Log Incident</span>
                            </button>
                          </div>
                        </div>

                        {/* Four Key Metrics Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-2 border-t border-slate-100 dark:border-gray-800">
                          <div className="p-3 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/60 dark:bg-gray-900/40">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Window Focus Shifts
                            </span>
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                                {integrityReport?.metrics.totalBlurCount ?? 0}
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium">blurs</span>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                              {integrityReport?.metrics.totalOffScreenDurationSeconds ?? 0}s off-screen
                            </span>
                          </div>

                          <div className="p-3 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/60 dark:bg-gray-900/40">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              External Paste Bursts
                            </span>
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                                {integrityReport?.metrics.unattributedPasteCount ?? 0}
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium">&gt;50 chars</span>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                              {integrityReport?.metrics.unattributedPasteChars ?? 0} chars inserted
                            </span>
                          </div>

                          <div className="p-3 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/60 dark:bg-gray-900/40">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Copilot AI Queries
                            </span>
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">
                                {integrityReport?.metrics.aiQueriesCount ?? 0}
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium">queries</span>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              {integrityReport?.metrics.patchesAcceptedCount ?? 0} patches reviewed
                            </span>
                          </div>

                          <div className="p-3 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/60 dark:bg-gray-900/40">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Active Proctor Flags
                            </span>
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-lg font-black text-rose-600 dark:text-rose-400 font-mono">
                                {proctorIncidents.filter((i) => !i.isResolved).length}
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium">unresolved</span>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              {proctorIncidents.length} total logged
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Proctor Incident Log & Resolution Feed */}
                      <div className="rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] shadow-xs overflow-hidden">
                        <div className="p-4 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300 flex items-center gap-2">
                              <Flag className="w-4 h-4 text-rose-500" />
                              <span>Interviewer Incident Stream ({proctorIncidents.length})</span>
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-gray-400">
                              Official evidentiary audit log of manually flagged and automatically recorded security incidents
                            </p>
                          </div>
                          <button
                            onClick={() => setIsLogIncidentModalOpen(true)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center gap-1.5 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Incident</span>
                          </button>
                        </div>

                        <div className="divide-y divide-slate-100 dark:divide-gray-800/60 max-h-[400px] overflow-y-auto">
                          {proctorIncidents.length === 0 ? (
                            <div className="p-8 text-center text-xs text-slate-400 space-y-1">
                              <ShieldCheck className="w-8 h-8 mx-auto text-emerald-500" />
                              <p className="font-semibold text-slate-700 dark:text-gray-300">Clean Incident Log</p>
                              <p>No proctor incidents or security flags have been recorded for this session.</p>
                            </div>
                          ) : (
                            proctorIncidents.map((inc) => (
                              <div key={inc.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-gray-800/20 text-xs">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                        inc.severity === "critical"
                                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                          : inc.severity === "warning"
                                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                          : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                      }`}
                                    >
                                      {inc.severity}
                                    </span>
                                    <span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-gray-300 uppercase">
                                      {inc.category.replace("_", " ")}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      {new Date(inc.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                    </span>
                                  </div>
                                  <p className="text-slate-800 dark:text-slate-200 font-sans leading-relaxed">
                                    {inc.description}
                                  </p>
                                  <span className="text-[10px] text-slate-400 font-mono block">
                                    Flagged by: {inc.proctorName || "System / Proctor"}
                                  </span>
                                </div>

                                <div className="shrink-0 flex items-center gap-2">
                                  {inc.isResolved ? (
                                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1 font-mono">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      Resolved
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => handleResolveIncident(inc.id)}
                                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-gray-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 dark:hover:bg-emerald-950/30 text-slate-700 dark:text-gray-300 font-semibold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                                      title="Mark this incident as investigated and resolved"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Resolve</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Proctor Incident Logging Modal */}
      {isLogIncidentModalOpen && selectedSessionForProctor && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0d131f] border border-slate-200 dark:border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Flag className="w-4 h-4 text-rose-500" />
                  <span>Log Proctor Incident</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  Candidate: {selectedSessionForProctor.candidateName}
                </p>
              </div>
              <button
                onClick={() => setIsLogIncidentModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLogProctorIncident} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                  Incident Category
                </label>
                <select
                  value={incidentCategory}
                  onChange={(e) => setIncidentCategory(e.target.value as IntegrityCategory)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-white"
                >
                  <option value="manual_flag">Manual Interviewer Flag</option>
                  <option value="window_blur">Excessive Window Blur / Tab Switching</option>
                  <option value="unattributed_paste">Unattributed External Paste Burst</option>
                  <option value="devtools_open">Browser DevTools Inspected</option>
                  <option value="multiple_ips">Multiple Concurrently Active IP Addresses</option>
                  <option value="rapid_keystrokes">Anomalous Macro / Keystroke Pattern</option>
                  <option value="technical_issue">Technical / Hardware Incident</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                  Severity Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["info", "warning", "critical"] as const).map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setIncidentSeverity(sev)}
                      className={`py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${
                        incidentSeverity === sev
                          ? sev === "critical"
                            ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                            : sev === "warning"
                            ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                            : "bg-blue-600 text-white border-blue-600 shadow-xs"
                          : "bg-slate-50 dark:bg-gray-800 text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-700"
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                  Incident Description & Observations
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe observed candidate action, off-screen duration, or reason for manual flag..."
                  value={incidentDescription}
                  onChange={(e) => setIncidentDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-gray-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsLogIncidentModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-gray-700 text-slate-700 dark:text-gray-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingIncident}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>{isSubmittingIncident ? "Logging..." : "Confirm & Log Incident"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

            <div className="p-4 border-t border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedSessionForAudit && (
                  <>
                    <button
                      onClick={() => {
                        setIsSubmissionModalOpen(false);
                        handleOpenScoreModal(selectedSessionForAudit);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-xs flex items-center gap-1.5 transition-colors"
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>Score Candidate Rubric</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsSubmissionModalOpen(false);
                        handleOpenConsensusModal(selectedSessionForAudit);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/50 font-semibold text-xs shadow-xs flex items-center gap-1.5 transition-colors"
                    >
                      <Scale className="w-3.5 h-3.5 text-purple-500" />
                      <span>View Calibration</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsSubmissionModalOpen(false);
                        handleOpenHiringReport(selectedSessionForAudit);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-xs flex items-center gap-1.5 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>View Decision Report</span>
                    </button>
                  </>
                )}
              </div>
              <button
                onClick={() => setIsSubmissionModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-gray-700 text-slate-700 dark:text-gray-300 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
              >
                Close Submission View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task 15: Proctor Pause Incident Modal */}
      {sessionToPause && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0d131f] border border-slate-200 dark:border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/50 text-amber-600">
                  <Pause className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Pause Assessment Session
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    Freeze timer & handle technical incident
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSessionToPause(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePauseSession} className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 text-amber-800 dark:text-amber-200 space-y-1">
                <p className="font-semibold">Candidate: {sessionToPause.candidateName}</p>
                <p className="text-[11px] opacity-90">
                  Freezing this session locks the candidate's Monaco editor and stops the timer. When resumed, the deadline is dynamically extended by the exact paused duration.
                </p>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                  Incident Reason (Audit Log)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Candidate experienced network disconnection"
                  value={pauseReasonInput}
                  onChange={(e) => setPauseReasonInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Quick Reason Chips */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-gray-400">
                  Quick Incident Presets:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Network / Wi-Fi Glitch",
                    "Hardware Reconnect Issue",
                    "Accommodated Break",
                    "Proctor Environment Check",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPauseReasonInput(preset)}
                      className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 text-[10px] transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-gray-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSessionToPause(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-gray-700 text-slate-700 dark:text-gray-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProctorActionInProgress}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-xs flex items-center gap-1.5"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>{isProctorActionInProgress ? "Pausing..." : "Confirm & Freeze Session"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task 16: Reviewer 7-Dimension Rubric Scorecard Modal */}
      {isScoreModalOpen && sessionForCalibration && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0d131f] border border-slate-200 dark:border-gray-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Reviewer Rubric Scorecard
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-gray-400">
                      Candidate: <span className="font-semibold text-slate-800 dark:text-gray-200">{sessionForCalibration.candidateName}</span> ({sessionForCalibration.candidateEmail})
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAutoFillFromAiDraft(sessionForCalibration.id)}
                  disabled={isLoadingAiDraft}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors shadow-xs disabled:opacity-50"
                  title="Import baseline score generated by AI Assessment Evaluator"
                >
                  <Sparkles className={`w-3.5 h-3.5 text-indigo-500 ${isLoadingAiDraft ? "animate-spin" : ""}`} />
                  <span>{isLoadingAiDraft ? "Evaluating..." : "Auto-fill from AI Draft"}</span>
                </button>
                <button
                  onClick={() => setIsScoreModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white ml-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSubmitEvaluation} className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
              {/* Score Live Composite Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/30 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                    Weighted Composite Score
                  </span>
                  <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                    {Math.round(
                      RUBRIC_DIMENSIONS.reduce((acc, dim) => {
                        const r = evalScores[dim.id]?.rating ?? 3;
                        return acc + (r / 4) * dim.weight;
                      }, 0) * 10
                    ) / 10}{" "}
                    <span className="text-xs font-normal text-slate-500 dark:text-gray-400">/ 100 pts</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-500 dark:text-gray-400 block">
                    Reviewer Persona:
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-gray-200">
                    {activePersona?.name || "Active Reviewer"} ({activePersona?.role.toUpperCase() || "REVIEWER"})
                  </span>
                </div>
              </div>

              {/* 7 Dimensions List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-gray-800 pb-2">
                  <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                    7 Rubric Dimensions (Strict Anchors 1–4)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Weights sum to 100%
                  </span>
                </div>

                {RUBRIC_DIMENSIONS.map((dim) => {
                  const currentRating = evalScores[dim.id]?.rating ?? 3;
                  const currentRationale = evalScores[dim.id]?.rationale ?? "";

                  return (
                    <div
                      key={dim.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0b101b] space-y-3 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white text-xs">
                              {dim.name}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-300">
                              {dim.weight}% Weight
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5">
                            {dim.description}
                          </p>
                        </div>

                        <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          {Math.round((currentRating / 4) * dim.weight * 10) / 10} / {dim.weight} pts
                        </span>
                      </div>

                      {/* 4 Anchor Buttons */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {([1, 2, 3, 4] as const).map((anchor) => {
                          const isSelected = currentRating === anchor;
                          const meta = dim.anchors[anchor];

                          return (
                            <button
                              key={anchor}
                              type="button"
                              onClick={() =>
                                setEvalScores({
                                  ...evalScores,
                                  [dim.id]: {
                                    ...evalScores[dim.id],
                                    rating: anchor,
                                    rationale: currentRationale || meta.desc,
                                  },
                                })
                              }
                              className={`p-2.5 rounded-lg border text-left transition-all ${
                                isSelected
                                  ? "border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/50 dark:border-indigo-500 ring-1 ring-indigo-500"
                                  : "border-slate-200 dark:border-gray-800 hover:border-slate-300 dark:hover:border-gray-700 bg-white dark:bg-gray-900/60"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className={`font-bold text-[11px] ${isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-slate-800 dark:text-gray-200"}`}>
                                  {anchor}. {meta.label}
                                </span>
                                {isSelected && <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />}
                              </div>
                              <p className="text-[10px] text-slate-500 dark:text-gray-400 line-clamp-2 leading-snug">
                                {meta.desc}
                              </p>
                            </button>
                          );
                        })}
                      </div>

                      {/* Rationale Input */}
                      <div>
                        <input
                          type="text"
                          required
                          value={currentRationale}
                          placeholder={`Evidence rationale for ${dim.name}...`}
                          onChange={(e) =>
                            setEvalScores({
                              ...evalScores,
                              [dim.id]: {
                                ...evalScores[dim.id],
                                rating: currentRating,
                                rationale: e.target.value,
                              },
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Hiring Recommendation Selector */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0b101b] space-y-3">
                <span className="font-bold text-slate-900 dark:text-white text-xs block">
                  Overall Hiring Recommendation
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { val: "strong_hire" as const, label: "Strong Hire" },
                    { val: "hire" as const, label: "Hire" },
                    { val: "lean_hire" as const, label: "Lean Hire" },
                    { val: "no_hire" as const, label: "No Hire" },
                  ].map((opt) => {
                    const isSelected = evalRecommendation === opt.val;
                    return (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setEvalRecommendation(opt.val)}
                        className={`p-3 rounded-xl border text-center font-bold text-xs transition-all ${
                          isSelected
                            ? opt.val === "strong_hire"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-300 ring-2 ring-emerald-500"
                              : opt.val === "hire"
                              ? "bg-blue-50 text-blue-800 border-blue-500 dark:bg-blue-950/50 dark:text-blue-300 ring-2 ring-blue-500"
                              : opt.val === "lean_hire"
                              ? "bg-amber-50 text-amber-800 border-amber-500 dark:bg-amber-950/50 dark:text-amber-300 ring-2 ring-amber-500"
                              : "bg-rose-50 text-rose-800 border-rose-500 dark:bg-rose-950/50 dark:text-rose-300 ring-2 ring-rose-500"
                            : "border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Summary Rationale Textarea */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-gray-300 block">
                  Executive Summary Rationale (for Hiring Committee & Hiring Manager)
                </label>
                <textarea
                  required
                  rows={3}
                  value={evalSummaryRationale}
                  onChange={(e) => setEvalSummaryRationale(e.target.value)}
                  placeholder="Articulate overall candidate strengths, problem decomposition velocity, AI leverage efficiency, and areas of concern..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed font-sans"
                />
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-4 border-t border-slate-200 dark:border-gray-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsScoreModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-gray-700 text-slate-700 dark:text-gray-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProctorActionInProgress}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Award className="w-4 h-4" />
                  <span>{isProctorActionInProgress ? "Submitting..." : "Submit Reviewer Evaluation"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task 16: Multi-Reviewer Calibration Consensus Board Modal */}
      {isConsensusModalOpen && sessionForCalibration && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0d131f] border border-slate-200 dark:border-gray-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Multi-Reviewer Calibration Consensus Board
                    </h3>
                    {calibrationConsensus && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          calibrationConsensus.status === "calibrated"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : calibrationConsensus.status === "requires_calibration"
                            ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 animate-pulse"
                            : "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300"
                        }`}
                      >
                        {calibrationConsensus.status.toUpperCase().replace("_", " ")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    Candidate: <span className="font-semibold text-slate-800 dark:text-gray-200">{sessionForCalibration.candidateName}</span> • {sessionForCalibration.candidateEmail}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenConsensusModal(sessionForCalibration)}
                  disabled={isLoadingCalibration}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-gray-700 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  title="Refresh calibration data"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCalibration ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={() => setIsConsensusModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
              {/* Blind Calibration Notice */}
              {isEvaluationsMasked && (
                <div className="p-3.5 rounded-xl border border-amber-300 dark:border-amber-800/80 bg-amber-50/80 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <span className="font-bold">Blind Calibration Active: </span>
                    <span>To eliminate anchoring bias, other reviewers' evaluations and calibration divergence remain masked until you submit your own evaluation.</span>
                  </div>
                </div>
              )}

              {/* Requires Discussion Banner */}
              {calibrationConsensus?.requiresDiscussion && (
                <div className="p-4 rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50/80 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs text-rose-800 dark:text-rose-300">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Calibration Committee Discussion Required (Anchor Variance Δ ≥ 2 or Recommendation Split)</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-rose-800/90 dark:text-rose-200/90 pl-1">
                    {calibrationConsensus.discussionTopics.map((topic, idx) => (
                      <li key={idx}>{topic}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Consensus Recommendation Summary */}
              {calibrationConsensus && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-gray-900/60 border border-slate-200 dark:border-gray-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      Aggregated Hiring Consensus ({calibrationConsensus.evaluationsCount} Evaluators)
                    </span>
                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-2">
                      {calibrationConsensus.consensusRecommendation ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {calibrationConsensus.consensusRecommendation.toUpperCase().replace("_", " ")}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          SPLIT RECOMMENDATION — COMMITTEE MEETING NEEDED
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIsConsensusModalOpen(false);
                      handleOpenScoreModal(sessionForCalibration);
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-xs flex items-center gap-1.5"
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>Grade / Update My Score</span>
                  </button>
                </div>
              )}

              {/* Side-by-Side Reviewer Dimension Comparison */}
              {calibrationConsensus && calibrationConsensus.dimensions.length > 0 && (
                <div className="space-y-3">
                  <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] block">
                    7-Dimension Reviewer Variance Matrix
                  </span>

                  <div className="space-y-2.5">
                    {calibrationConsensus.dimensions.map((dim) => (
                      <div
                        key={dim.dimensionId}
                        className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                          dim.alignment === "high_variance"
                            ? "border-rose-300 bg-rose-50/40 dark:border-rose-900 dark:bg-rose-950/20"
                            : dim.alignment === "moderate"
                            ? "border-amber-200 bg-amber-50/20 dark:border-amber-900/40 dark:bg-amber-950/10"
                            : "border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0b101b]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {dim.name}
                            </span>
                            <span className="text-[10px] text-slate-400">({dim.weight}%)</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                dim.alignment === "high_variance"
                                  ? "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300"
                                  : dim.alignment === "moderate"
                                  ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300"
                                  : "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300"
                              }`}
                            >
                              {dim.alignment === "high_variance"
                                ? `High Divergence (Δ = ${dim.variance})`
                                : dim.alignment === "moderate"
                                ? `Minor Spread (Δ = ${dim.variance})`
                                : `Aligned (Consensus)`}
                            </span>
                          </div>
                        </div>

                        {/* Reviewer Breakdown Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {Object.entries(dim.ratingsByReviewer).map(([revId, data]) => (
                            <div
                              key={revId}
                              className="p-2 rounded-lg bg-slate-50 dark:bg-gray-900/60 border border-slate-100 dark:border-gray-800 text-[11px]"
                            >
                              <div className="flex items-center justify-between font-semibold text-slate-700 dark:text-gray-300 mb-0.5">
                                <span>{data.reviewerName}:</span>
                                <span className="font-mono text-indigo-600 dark:text-indigo-400">
                                  Anchor {data.rating} / 4
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 dark:text-gray-400 italic">
                                "{data.rationale}"
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submitted Reviewer Scorecards Summary Cards */}
              <div className="space-y-3">
                <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] block">
                  Individual Reviewer Evaluations ({evaluationsList.length})
                </span>

                {evaluationsList.length === 0 ? (
                  <p className="text-slate-400 text-xs italic">No reviewer evaluations visible.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {evaluationsList.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-4 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0b101b] space-y-2 shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {ev.reviewerName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {ev.reviewerEmail}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400 block">
                              {ev.weightedTotalScore} / 100
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                ev.recommendation === "strong_hire"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : ev.recommendation === "hire"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                  : ev.recommendation === "lean_hire"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                  : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              }`}
                            >
                              {ev.recommendation.replace("_", " ")}
                            </span>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-gray-900/60 border border-slate-100 dark:border-gray-800 text-[11px] text-slate-700 dark:text-gray-300 italic">
                          "{ev.summaryRationale}"
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/60 flex items-center justify-between">
              <div>
                {sessionForCalibration && (
                  <button
                    onClick={() => {
                      setIsConsensusModalOpen(false);
                      handleOpenHiringReport(sessionForCalibration);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-xs transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>View Hiring Decision Report</span>
                  </button>
                )}
              </div>
              <button
                onClick={() => setIsConsensusModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-gray-700 hover:bg-slate-300 dark:hover:bg-gray-600 text-slate-800 dark:text-gray-200 font-semibold text-xs transition-colors"
              >
                Close Calibration Board
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task 17: Evidence-Linked Hiring Decision Report Modal */}
      {isReportModalOpen && selectedReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0d131f] border border-slate-200 dark:border-gray-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between bg-slate-50/50 dark:bg-gray-900/40">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Candidate Hiring Decision Report
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 uppercase tracking-wide">
                      Tamper-Evident
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    Evidence-Linked Rubric Citations &bull; Multi-Reviewer Calibration &bull; ATS Ready
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsReportModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Top Overview & Outcome Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Candidate & Challenge Details */}
                <div className="md:col-span-2 p-4 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/60 dark:bg-gray-900/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Assessment Details
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      ID: {selectedReport.reportId.slice(0, 18)}...
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {selectedReport.candidateName}
                  </div>
                  <div className="text-slate-500 dark:text-gray-400 text-xs">
                    {selectedReport.candidateEmail} &bull; {selectedReport.targetRole} ({selectedReport.difficulty.toUpperCase()})
                  </div>
                  <div className="pt-1 flex items-center gap-3 text-[11px] text-slate-600 dark:text-gray-400">
                    <span>Challenge: <strong>{selectedReport.templateTitle}</strong></span>
                    <span>&bull;</span>
                    <span>Duration: <strong>{selectedReport.telemetrySummary.totalDurationSeconds}s</strong></span>
                  </div>
                </div>

                {/* Calibrated Recommendation & Composite Score */}
                <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                      Calibrated Outcome
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        selectedReport.calibrationStatus === "calibrated"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : selectedReport.calibrationStatus === "requires_calibration"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-slate-200 text-slate-700 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                    >
                      {selectedReport.calibrationStatus.replace("_", " ")}
                    </span>
                  </div>

                  <div className="my-2">
                    <div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
                      {selectedReport.calibratedCompositeScore}
                      <span className="text-sm text-slate-400 font-normal"> / 100 pts</span>
                    </div>
                    <div className="w-full bg-indigo-200 dark:bg-indigo-950/80 rounded-full h-1.5 mt-1 overflow-hidden">
                      <div
                        className="bg-indigo-600 dark:bg-indigo-400 h-1.5 rounded-full"
                        style={{ width: `${Math.min(100, selectedReport.calibratedCompositeScore)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <span
                      className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide ${
                        selectedReport.consensusRecommendation === "strong_hire"
                          ? "bg-emerald-600 text-white"
                          : selectedReport.consensusRecommendation === "hire"
                          ? "bg-blue-600 text-white"
                          : selectedReport.consensusRecommendation === "lean_hire"
                          ? "bg-amber-500 text-white"
                          : selectedReport.consensusRecommendation === "no_hire"
                          ? "bg-rose-600 text-white"
                          : "bg-slate-500 text-white"
                      }`}
                    >
                      {selectedReport.consensusRecommendation.replace("_", " ")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cryptographic Tamper-Evident Verification Seal */}
              <div className="p-4 rounded-xl border border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-bold text-emerald-900 dark:text-emerald-200 text-xs">
                      Cryptographic Tamper-Evident Verification Seal
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-200/80 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 uppercase">
                    {selectedReport.verificationSeal.tamperCheckStatus}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800/90 dark:text-emerald-300/80">
                  This report is cryptographically bound to candidate submission SHA-256 digests and server HMAC signatures. Any post-submission modification invalidates this seal.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 font-mono text-[10px] text-slate-600 dark:text-gray-300">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white/70 dark:bg-gray-900/50 border border-emerald-200 dark:border-emerald-900">
                    <span className="truncate mr-2">SHA-256: {selectedReport.verificationSeal.submissionFingerprint}</span>
                    <button
                      onClick={() => handleCopy(selectedReport.verificationSeal.submissionFingerprint, "seal_sub")}
                      className="text-emerald-600 hover:text-emerald-800 shrink-0"
                      title="Copy Submission Fingerprint"
                    >
                      {copiedKey === "seal_sub" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white/70 dark:bg-gray-900/50 border border-emerald-200 dark:border-emerald-900">
                    <span className="truncate mr-2">HMAC: {selectedReport.verificationSeal.reportSignature}</span>
                    <button
                      onClick={() => handleCopy(selectedReport.verificationSeal.reportSignature, "seal_hmac")}
                      className="text-emerald-600 hover:text-emerald-800 shrink-0"
                      title="Copy HMAC Digital Signature"
                    >
                      {copiedKey === "seal_hmac" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Executive Summary Narrative */}
              <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/20 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 block">
                  Executive Evaluation Summary
                </span>
                <p className="text-slate-800 dark:text-gray-200 leading-relaxed text-xs">
                  {selectedReport.executiveSummary}
                </p>
                {selectedReport.varianceAlerts.length > 0 && (
                  <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-[11px] space-y-1">
                    <span className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Reviewer Committee Variance Alerts:
                    </span>
                    <ul className="list-disc pl-5 space-y-0.5">
                      {selectedReport.varianceAlerts.map((alert, idx) => (
                        <li key={idx}>{alert}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* 7-Dimension Rubric Scorecards & Citations */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                    7-Dimension Rubric Scorecard & Evidence Citations
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Weighted Sum: {selectedReport.calibratedCompositeScore} / 100 pts
                  </span>
                </div>

                <div className="space-y-3">
                  {selectedReport.dimensions.map((dim) => (
                    <div
                      key={dim.dimensionId}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white text-xs">
                            {dim.name}
                          </span>
                          <span className="text-slate-400 text-[11px] ml-2">
                            Weight: {dim.weight}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              dim.calibratedRating === 4
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : dim.calibratedRating === 3
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                : dim.calibratedRating === 2
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            }`}
                          >
                            {dim.calibratedRating}/4 &bull; {dim.calibratedLabel}
                          </span>
                          <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-xs">
                            +{dim.weightedScoreContribution} pts
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-600 dark:text-gray-400">
                        <strong>Consensus Rationale:</strong> {dim.consensusRationale}
                      </p>

                      {/* Evidence Citations */}
                      <div className="space-y-1.5 pt-1">
                        {dim.evidenceCitations.map((ev) => (
                          <div
                            key={ev.id}
                            className={`flex items-start gap-2 p-2 rounded-lg text-[11px] border-l-3 ${
                              ev.significance === "positive"
                                ? "border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 text-slate-800 dark:text-gray-200"
                                : ev.significance === "concerning"
                                ? "border-l-rose-500 bg-rose-50/40 dark:bg-rose-950/20 text-slate-800 dark:text-gray-200"
                                : "border-l-slate-400 bg-slate-50 dark:bg-gray-800/40 text-slate-800 dark:text-gray-200"
                            }`}
                          >
                            <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-gray-800 text-[9px] font-extrabold text-slate-600 dark:text-gray-300 uppercase shrink-0 mt-0.5">
                              {ev.type.replace("_", " ")}
                            </span>
                            <div>
                              <strong>{ev.title}:</strong> {ev.citation}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Execution & Proctor Integrity Audit Table */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                  Execution & Proctor Integrity Audit
                </h4>
                <div className="border border-slate-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-50 dark:bg-gray-800/60 text-slate-500 dark:text-gray-400 font-semibold border-b border-slate-200 dark:border-gray-800">
                      <tr>
                        <th className="p-2.5">Category</th>
                        <th className="p-2.5">Observed Metric</th>
                        <th className="p-2.5">Verification Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-gray-800/60">
                      <tr>
                        <td className="p-2.5 font-medium text-slate-800 dark:text-gray-200">Unit Tests</td>
                        <td className="p-2.5">
                          {selectedReport.telemetrySummary.testsSummary.passedCount} of {selectedReport.telemetrySummary.testsSummary.totalCount} tests passed ({selectedReport.telemetrySummary.testsSummary.durationMs}ms)
                        </td>
                        <td className="p-2.5">
                          {selectedReport.telemetrySummary.testsSummary.passed ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Passed Verified</span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400 font-bold">Assertion Failures</span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-medium text-slate-800 dark:text-gray-200">AI Budget Stewardship</td>
                        <td className="p-2.5">
                          ${selectedReport.telemetrySummary.aiBudgetConsumedUsd.toFixed(3)} consumed of ${selectedReport.telemetrySummary.aiBudgetCapUsd.toFixed(2)} cap ({selectedReport.telemetrySummary.aiQueriesCount} queries)
                        </td>
                        <td className="p-2.5 text-emerald-600 dark:text-emerald-400 font-semibold">Compliant</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-medium text-slate-800 dark:text-gray-200">AI Patch Scrutiny</td>
                        <td className="p-2.5">
                          {selectedReport.telemetrySummary.patchDecisions.accepted} accepted, {selectedReport.telemetrySummary.patchDecisions.rejected} rejected after diff review
                        </td>
                        <td className="p-2.5 text-slate-600 dark:text-gray-400">Explicit Diff Verification</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-medium text-slate-800 dark:text-gray-200">Proctor Controls</td>
                        <td className="p-2.5">
                          {selectedReport.telemetrySummary.technicalIncidentsCount} technical incident pauses ({selectedReport.telemetrySummary.totalPausedMs}ms paused)
                        </td>
                        <td className="p-2.5 text-slate-600 dark:text-gray-400">Dynamic Deadline Extension</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Reviewer Committee Sign-offs */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                  Reviewer Committee Sign-offs
                </h4>
                {selectedReport.committeeSignoffs.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedReport.committeeSignoffs.map((s) => (
                      <div
                        key={s.reviewerId}
                        className="p-3 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/60 dark:bg-gray-900/40 text-[11px] space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-white">{s.reviewerName}</span>
                          <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{s.weightedScore} pts</span>
                        </div>
                        <div className="text-slate-400 text-[10px]">{s.reviewerEmail}</div>
                        <div className="pt-1 flex items-center justify-between">
                          <span className="font-semibold uppercase text-slate-700 dark:text-gray-300">
                            {s.recommendation.replace("_", " ")}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Signed {new Date(s.submittedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic text-xs">
                    No human reviewer evaluations submitted yet. Automated advisory baseline is displayed.
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportPrintReport}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-xs transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / Save to PDF</span>
                </button>
                <button
                  onClick={handleCopyReportJson}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-gray-700 text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-800 font-semibold text-xs transition-colors"
                >
                  {copiedKey === "report_json" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-600">Copied ATS JSON</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy ATS/HRIS JSON</span>
                    </>
                  )}
                </button>
              </div>
              <button
                onClick={() => setIsReportModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-gray-700 hover:bg-slate-300 dark:hover:bg-gray-600 text-slate-800 dark:text-gray-200 font-semibold text-xs transition-colors"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task 19: Register Webhook Subscription Modal */}
      {isCreateWebhookModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0d131f] border border-slate-200 dark:border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Webhook className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Register Webhook Endpoint
                </h3>
              </div>
              <button
                onClick={() => setIsCreateWebhookModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateWebhook} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                  Destination Target URL (HTTPS Recommended)
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://api.greenhouse.io/v1/partner/candidates/webhook"
                  value={webhookTargetUrl}
                  onChange={(e) => setWebhookTargetUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-white font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                  Payload Format Adapter
                </label>
                <select
                  value={webhookFormat}
                  onChange={(e) => setWebhookFormat(e.target.value as WebhookFormat)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-white"
                >
                  <option value="standard">Standard JSON (Full assessment telemetry & evidence)</option>
                  <option value="greenhouse">Greenhouse ATS (Partner Candidate Ingest Schema)</option>
                  <option value="lever">Lever ATS (Candidate Opportunity Schema)</option>
                  <option value="workday">Workday HRIS (Recruiting Assessment Ingest Schema)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                  Subscribed Event Triggers
                </label>
                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-gray-900/60 border border-slate-200 dark:border-gray-800">
                  {[
                    { id: "*", label: "All Events (*)" },
                    { id: "session.submitted", label: "Session Submitted" },
                    { id: "report.finalized", label: "Report Finalized" },
                    { id: "calibration.completed", label: "Calibration Completed" },
                    { id: "candidate.invited", label: "Candidate Invited" },
                    { id: "candidate.started", label: "Candidate Started" },
                  ].map((evt) => (
                    <label key={evt.id} className="flex items-center gap-2 cursor-pointer text-[11px]">
                      <input
                        type="checkbox"
                        checked={webhookEvents.includes(evt.id)}
                        onChange={(e) => {
                          if (evt.id === "*") {
                            setWebhookEvents(e.target.checked ? ["*"] : ["session.submitted"]);
                          } else {
                            const withoutWildcard = webhookEvents.filter((x) => x !== "*");
                            if (e.target.checked) {
                              setWebhookEvents([...withoutWildcard, evt.id]);
                            } else {
                              const remaining = withoutWildcard.filter((x) => x !== evt.id);
                              setWebhookEvents(remaining.length === 0 ? ["session.submitted"] : remaining);
                            }
                          }
                        }}
                        className="rounded text-violet-600 focus:ring-violet-500"
                      />
                      <span className="text-slate-700 dark:text-gray-300 font-mono">{evt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-violet-50/60 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-900/40 text-[11px] text-violet-800 dark:text-violet-300">
                🔒 A cryptographically secure HMAC secret key will be generated. All outgoing dispatches will include an <code>X-Webhook-Signature: sha256=...</code> header to verify authenticity and prevent tampering.
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-gray-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateWebhookModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-gray-700 text-slate-700 dark:text-gray-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? "Registering..." : "Register Webhook"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task 19: Webhook Delivery Log Modal */}
      {isTestLogModalOpen && lastTestDeliveryLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0d131f] border border-slate-200 dark:border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Webhook Dispatch Delivery Verification
                </h3>
              </div>
              <button
                onClick={() => setIsTestLogModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#111827]">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">HTTP Status</span>
                  <span className={`font-mono font-bold text-sm ${lastTestDeliveryLog.success ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {lastTestDeliveryLog.statusCode || 200} {lastTestDeliveryLog.success ? "OK" : "Failed"}
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#111827]">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Round-Trip Latency</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                    {lastTestDeliveryLog.durationMs} ms
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#111827]">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Attempt</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                    #{lastTestDeliveryLog.attemptCount} of 3
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-gray-900/60 border border-slate-200 dark:border-gray-800 font-mono text-[11px] space-y-1">
                <div className="text-slate-500">Destination: <span className="text-slate-900 dark:text-white font-bold">{lastTestDeliveryLog.targetUrl}</span></div>
                <div className="text-slate-500">Format Adapter: <span className="text-indigo-600 dark:text-indigo-400 font-bold uppercase">{lastTestDeliveryLog.format}</span></div>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-slate-900 dark:text-white text-xs">
                  Transmitted Payload (Formatted for Adapter):
                </span>
                <pre className="p-3 rounded-xl bg-[#0a0f1d] font-mono text-[10px] text-slate-200 overflow-x-auto max-h-48 border border-slate-800">
                  {JSON.stringify(lastTestDeliveryLog.requestPayload, null, 2)}
                </pre>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/60 flex justify-end">
              <button
                onClick={() => setIsTestLogModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-gray-700 hover:bg-slate-300 dark:hover:bg-gray-600 text-slate-800 dark:text-gray-200 font-semibold text-xs transition-colors"
              >
                Close Delivery Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
