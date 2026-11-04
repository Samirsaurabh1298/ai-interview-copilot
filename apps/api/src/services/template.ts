import type {
  AssessmentTemplate,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  AssessmentTask,
} from "@ai-copilot/contracts";
import { TemplateRepository } from "../repositories/template.repo.js";

export class TemplateNotFoundError extends Error {
  constructor(message = "Assessment template not found") {
    super(message);
    this.name = "TemplateNotFoundError";
  }
}

export class TemplateConflictError extends Error {
  constructor(message = "Assessment template with this slug already exists in organization") {
    super(message);
    this.name = "TemplateConflictError";
  }
}

const DEFAULT_FRONTEND_STARTER = `export const PRIORITY_WEIGHTS: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};

export interface Ticket {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed";
  tags?: string[];
  createdAt: number;
}

export interface FilterOptions {
  searchQuery?: string;
  status?: string[];
  priority?: string[];
  tags?: string[];
}

export interface SortOptions {
  field: "createdAt" | "priority" | "title";
  order: "asc" | "desc";
}

export function filterAndSortTickets(
  tickets: Ticket[],
  filters: FilterOptions,
  sort: SortOptions
): Ticket[] {
  const result = tickets.filter((ticket) => {
    if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
      const q = filters.searchQuery.toLowerCase();
      if (!ticket.title.toLowerCase().includes(q) && !ticket.description.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (filters.status && filters.status.length > 0) {
      if (!filters.status.includes(ticket.status)) return false;
    }
    if (filters.priority && filters.priority.length > 0) {
      if (!filters.priority.includes(ticket.priority)) return false;
    }
    if (filters.tags && filters.tags.length > 0) {
      const matchesAll = filters.tags.every((t) => ticket.tags && ticket.tags.includes(t));
      if (!matchesAll) return false;
    }
    return true;
  });

  return [...result].sort((a, b) => {
    if (sort.field === "createdAt") {
      return sort.order === "asc" ? a.createdAt - b.createdAt : b.createdAt - a.createdAt;
    }
    if (sort.field === "priority") {
      const weightA = PRIORITY_WEIGHTS[a.priority] || 0;
      const weightB = PRIORITY_WEIGHTS[b.priority] || 0;
      return sort.order === "desc" ? weightB - weightA : weightA - weightB;
    }
    return 0;
  });
}`;

const DEFAULT_FRONTEND_TESTS = `test("filters tickets by search query", () => {
  const tickets = [
    { id: "1", title: "Login bug", description: "Fails on submit", priority: "high", status: "open", createdAt: 1 },
    { id: "2", title: "Navbar style", description: "Padding issue", priority: "low", status: "open", createdAt: 2 },
  ];
  const res = filterAndSortTickets(tickets, { searchQuery: "login" }, { field: "createdAt", order: "asc" });
  if (res.length !== 1 || res[0].id !== "1") throw new Error("Search filter failed");
});

test("sorts tickets descending by priority (urgent > high > medium > low)", () => {
  const tickets = [
    { id: "1", title: "A", description: "A", priority: "low", status: "open", createdAt: 1 },
    { id: "2", title: "B", description: "B", priority: "urgent", status: "open", createdAt: 2 },
    { id: "3", title: "C", description: "C", priority: "high", status: "open", createdAt: 3 },
  ];
  const res = filterAndSortTickets(tickets, {}, { field: "priority", order: "desc" });
  if (res[0].id !== "2" || res[1].id !== "3" || res[2].id !== "1") {
    throw new Error("Priority sort order failed");
  }
});

test("handles tickets with undefined tags array safely", () => {
  const tickets = [
    { id: "1", title: "No tags", description: "D", priority: "low", status: "open", createdAt: 1 },
    { id: "2", title: "With tag", description: "D", priority: "low", status: "open", tags: ["billing"], createdAt: 2 },
  ];
  const res = filterAndSortTickets(tickets, { tags: ["billing"] }, { field: "createdAt", order: "asc" });
  if (res.length !== 1 || res[0].id !== "2") throw new Error("Undefined tags check failed");
});`;

export class AssessmentTemplateService {
  // Key: orgId -> Map<templateId, AssessmentTemplate>
  private templatesByOrg = new Map<string, Map<string, AssessmentTemplate>>();
  private repo: TemplateRepository;

  constructor(repo?: TemplateRepository) {
    this.repo = repo ?? new TemplateRepository();
  }

  public async loadFromDatabase(orgId?: string): Promise<void> {
    try {
      const templates = orgId ? await this.repo.list(orgId) : await this.repo.listAll();
      for (const tmpl of templates) {
        let orgMap = this.templatesByOrg.get(tmpl.organizationId);
        if (!orgMap) {
          orgMap = new Map();
          this.templatesByOrg.set(tmpl.organizationId, orgMap);
        }
        orgMap.set(tmpl.id, tmpl);
      }
    } catch (err) {
      console.error("[AssessmentTemplateService] Failed to load from database:", err);
    }
  }

  public seedDefaultTemplate(orgId: string): AssessmentTemplate {
    const templateId = "tmpl_default_frontend_" + orgId.slice(-6);
    const now = new Date();

    const defaultTasks: AssessmentTask[] = [
      {
        id: "task_qset_fundamentals",
        type: "question_set",
        title: "Technical Architecture & Frontend Fundamentals",
        description: "Evaluate core React concurrency, async queue lifecycle, and state immutability trade-offs.",
        orderIndex: 0,
        estimatedMinutes: 15,
        points: 30,
        isRequired: true,
        aiPolicy: {
          mode: "prohibited",
          disclosureNotice: "AI assistance is strictly prohibited during technical architecture questions.",
        },
        config: {
          questions: [
            {
              id: "q1_event_loop",
              format: "mcq_single",
              prompt: "In a high-throughput queue UI, which React 18+ primitive prevents urgent user interactions from lagging behind background batch sorting?",
              points: 10,
              isRequired: true,
              options: [
                { id: "opt_a", text: "useTransition or startTransition", isCorrect: true },
                { id: "opt_b", text: "useLayoutEffect synchronously blocking paint", isCorrect: false },
                { id: "opt_c", text: "setInterval with 0ms delay", isCorrect: false },
                { id: "opt_d", text: "Direct DOM mutation via ref.current", isCorrect: false },
              ],
              explanation: "useTransition marks state updates as non-blocking transitions, yielding execution to urgent user events.",
            },
            {
              id: "q2_immutability",
              format: "mcq_multi",
              prompt: "Which array operations directly mutate state in place and violate React immutability invariants? (Select all that apply)",
              points: 10,
              isRequired: true,
              options: [
                { id: "opt_splice", text: "Array.prototype.splice()", isCorrect: true },
                { id: "opt_sort", text: "Array.prototype.sort() without slice/spread", isCorrect: true },
                { id: "opt_filter", text: "Array.prototype.filter()", isCorrect: false },
                { id: "opt_reverse", text: "Array.prototype.reverse()", isCorrect: true },
              ],
              explanation: "splice, sort, and reverse mutate the underlying array in-place, causing stale memoization references.",
            },
            {
              id: "q3_tradeoffs",
              format: "short_text",
              prompt: "Explain why client-side priority inversion occurs when tickets with equal priority are sorted without a secondary deterministic key.",
              points: 10,
              isRequired: true,
              charLimit: 500,
              evaluationCriteria: "Candidate should explain unstable sort behavior, browser engine variance (V8 Timsort), and importance of timestamp secondary ordering.",
            },
          ],
        },
      },
      {
        id: "task_repo_triage",
        type: "repository_task",
        title: "Codebase Comprehension & Triage Queue Debug",
        description: "Investigate and resolve priority inversion and array mutation defects in the support ticket queue module.",
        orderIndex: 1,
        estimatedMinutes: 45,
        points: 70,
        isRequired: true,
        aiPolicy: {
          mode: "full_copilot",
          maxBudgetUsd: 0.25,
          disclosureNotice: "Full AI Copilot assistance is enabled for codebase triage ($0.25 budget). Proposed code patches require explicit review.",
        },
        config: {
          action: "debug",
          primaryFilePath: "src/useTicketQueue.ts",
          fileTree: [
            {
              path: "src/useTicketQueue.ts",
              content: DEFAULT_FRONTEND_STARTER,
              isReadOnly: false,
            },
            {
              path: "src/types.ts",
              content: "export type Priority = 'low' | 'medium' | 'high' | 'urgent';\nexport interface Ticket { id: string; title: string; priority: Priority; }",
              isReadOnly: true,
            },
          ],
          acceptanceCriteria: [
            "sortTickets preserves input array immutability without side effects",
            "Orders tickets descending by priority (urgent > high > medium > low)",
            "Ties in priority are deterministically sorted by createdAt ascending",
            "resolveTicket returns a fresh array reference without in-place mutation",
          ],
          verificationTestCode: DEFAULT_FRONTEND_TESTS,
        },
      },
    ];

    const defaultTemplate: AssessmentTemplate = {
      id: templateId,
      organizationId: orgId,
      title: "Frontend Engineer: Support Triage Queue",
      slug: "frontend-support-triage-queue",
      description:
        "Investigate and resolve 3 core defects in a production React/TypeScript support ticket queue: priority sorting inversion, array mutation side-effects, and undefined tag filtering runtime crashes.",
      targetRole: "Frontend Engineer (React / TypeScript)",
      difficulty: "mid",
      language: "typescript",
      durationMinutes: 60,
      attemptDurationMinutes: 60,
      submissionDeadlineDays: 7,
      defaultAiBudgetUsd: 0.25,
      tasks: defaultTasks,
      starterCode: DEFAULT_FRONTEND_STARTER,
      verificationTestCode: DEFAULT_FRONTEND_TESTS,
      toolPolicy: {
        allowedProvider: "openai",
        allowedModel: "gpt-4o-mini",
        maxBudgetUsd: 0.25,
        warningThresholdPercent: 80,
        timeLimitSeconds: 3600,
        allowInternetSearch: false,
        allowDocumentation: true,
      },
      rubricDimensionWeights: {
        "code-comprehension": 15,
        "problem-framing": 10,
        "ai-collaboration": 15,
        "critical-evaluation": 15,
        "debugging-implementation": 20,
        "testing-verification": 15,
        "explanation-judgment": 10,
      },
      status: "published",
      createdAt: now,
      updatedAt: now,
    };

    let orgMap = this.templatesByOrg.get(orgId);
    if (!orgMap) {
      orgMap = new Map();
      this.templatesByOrg.set(orgId, orgMap);
    }
    orgMap.set(templateId, defaultTemplate);
    this.repo.create(defaultTemplate).catch((err) => {
      console.error("[AssessmentTemplateService] DB default template seed error:", err);
    });
    return defaultTemplate;
  }

  public createTemplate(req: CreateTemplateRequest, memberId?: string): AssessmentTemplate {
    const slug = req.slug ?? this.generateSlug(req.title);
    let orgMap = this.templatesByOrg.get(req.organizationId);
    if (!orgMap) {
      orgMap = new Map();
      this.templatesByOrg.set(req.organizationId, orgMap);
    }

    // Slug uniqueness within organization
    for (const tmpl of orgMap.values()) {
      if (tmpl.slug === slug) {
        throw new TemplateConflictError(
          `Template with slug '${slug}' already exists in organization '${req.organizationId}'`
        );
      }
    }

    const templateId = "tmpl_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now();
    const now = new Date();

    const tasks = req.tasks && req.tasks.length > 0 ? req.tasks : [
      {
        id: "task_challenge_1",
        type: "coding_challenge" as const,
        title: req.title.trim(),
        description: req.description.trim(),
        orderIndex: 0,
        estimatedMinutes: req.attemptDurationMinutes ?? req.durationMinutes ?? 60,
        points: 100,
        isRequired: true,
        aiPolicy: {
          mode: "full_copilot" as const,
          maxBudgetUsd: req.defaultAiBudgetUsd ?? 0.25,
          disclosureNotice: "AI assistance is permitted within your allocated budget.",
        },
        config: {
          language: req.language ?? "typescript",
          starterCode: req.starterCode ?? DEFAULT_FRONTEND_STARTER,
          verificationTestCode: req.verificationTestCode ?? DEFAULT_FRONTEND_TESTS,
          solutionTemplate: req.solutionCode,
          testCases: [
            { name: "Public Test Suite", isHidden: false },
          ],
        },
      },
    ];

    const template: AssessmentTemplate = {
      id: templateId,
      organizationId: req.organizationId,
      title: req.title.trim(),
      slug,
      description: req.description.trim(),
      targetRole: req.targetRole.trim(),
      difficulty: req.difficulty ?? "mid",
      language: req.language ?? "typescript",
      durationMinutes: req.durationMinutes ?? 60,
      attemptDurationMinutes: req.attemptDurationMinutes ?? req.durationMinutes ?? 60,
      submissionDeadlineDays: req.submissionDeadlineDays ?? 7,
      defaultAiBudgetUsd: req.defaultAiBudgetUsd ?? 0.25,
      tasks,
      starterCode: req.starterCode ?? (tasks[0]?.type === "coding_challenge" ? tasks[0].config.starterCode : DEFAULT_FRONTEND_STARTER),
      solutionCode: req.solutionCode,
      verificationTestCode: req.verificationTestCode ?? (tasks[0]?.type === "coding_challenge" ? tasks[0].config.verificationTestCode : DEFAULT_FRONTEND_TESTS),
      toolPolicy: req.toolPolicy ?? {
        allowedProvider: "openai",
        allowedModel: "gpt-4o-mini",
        maxBudgetUsd: req.defaultAiBudgetUsd ?? 0.25,
        warningThresholdPercent: 80,
        timeLimitSeconds: (req.durationMinutes ?? 60) * 60,
        allowInternetSearch: false,
        allowDocumentation: true,
      },
      rubricDimensionWeights: req.rubricDimensionWeights ?? {
        "code-comprehension": 15,
        "problem-framing": 10,
        "ai-collaboration": 15,
        "critical-evaluation": 15,
        "debugging-implementation": 20,
        "testing-verification": 15,
        "explanation-judgment": 10,
      },
      status: "draft",
      createdByMemberId: memberId,
      createdAt: now,
      updatedAt: now,
    };

    orgMap.set(templateId, template);
    this.repo.create(template).catch((err) => {
      console.error("[AssessmentTemplateService] DB template create error:", err);
    });
    return template;
  }

  public listTemplates(orgId: string): AssessmentTemplate[] {
    let orgMap = this.templatesByOrg.get(orgId);
    if (!orgMap) {
      // Auto-seed default template on first query
      this.seedDefaultTemplate(orgId);
      orgMap = this.templatesByOrg.get(orgId)!;
    }
    return Array.from(orgMap.values());
  }

  public getTemplateById(orgId: string, templateId: string): AssessmentTemplate | undefined {
    let orgMap = this.templatesByOrg.get(orgId);
    if (!orgMap) {
      this.seedDefaultTemplate(orgId);
      orgMap = this.templatesByOrg.get(orgId)!;
    }
    return orgMap.get(templateId);
  }

  public getTemplateBySlug(orgId: string, slug: string): AssessmentTemplate | undefined {
    const list = this.listTemplates(orgId);
    return list.find((t) => t.slug === slug.toLowerCase().trim());
  }

  public updateTemplate(
    orgId: string,
    templateId: string,
    req: UpdateTemplateRequest
  ): AssessmentTemplate {
    const tmpl = this.getTemplateById(orgId, templateId);
    if (!tmpl) {
      throw new TemplateNotFoundError(`Template '${templateId}' not found in organization '${orgId}'`);
    }

    if (req.title !== undefined) tmpl.title = req.title.trim();
    if (req.description !== undefined) tmpl.description = req.description.trim();
    if (req.targetRole !== undefined) tmpl.targetRole = req.targetRole.trim();
    if (req.difficulty !== undefined) tmpl.difficulty = req.difficulty;
    if (req.language !== undefined) tmpl.language = req.language;
    if (req.durationMinutes !== undefined) tmpl.durationMinutes = req.durationMinutes;
    if (req.attemptDurationMinutes !== undefined) tmpl.attemptDurationMinutes = req.attemptDurationMinutes;
    if (req.submissionDeadlineDays !== undefined) tmpl.submissionDeadlineDays = req.submissionDeadlineDays;
    if (req.tasks !== undefined) tmpl.tasks = req.tasks;
    if (req.defaultAiBudgetUsd !== undefined) tmpl.defaultAiBudgetUsd = req.defaultAiBudgetUsd;
    if (req.starterCode !== undefined) tmpl.starterCode = req.starterCode;
    if (req.solutionCode !== undefined) tmpl.solutionCode = req.solutionCode;
    if (req.verificationTestCode !== undefined) tmpl.verificationTestCode = req.verificationTestCode;
    if (req.status !== undefined) tmpl.status = req.status;

    tmpl.updatedAt = new Date();
    this.repo.update(orgId, templateId, req).catch((err) => {
      console.error("[AssessmentTemplateService] DB template update error:", err);
    });
    return tmpl;
  }

  public publishTemplate(orgId: string, templateId: string): AssessmentTemplate {
    return this.updateTemplate(orgId, templateId, { status: "published" });
  }

  public deleteTemplate(orgId: string, templateId: string): void {
    const orgMap = this.templatesByOrg.get(orgId);
    if (!orgMap || !orgMap.has(templateId)) {
      throw new TemplateNotFoundError(`Template '${templateId}' not found in organization '${orgId}'`);
    }
    orgMap.delete(templateId);
  }

  private generateSlug(title: string): string {
    const base = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return base || "tmpl-" + Math.random().toString(36).substring(2, 6);
  }
}

