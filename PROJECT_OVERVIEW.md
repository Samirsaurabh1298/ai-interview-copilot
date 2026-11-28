# AI Coding Assessment Platform: Technical Architecture & System Overview

> **Baseline:** `HEAD = Loop 11.0.3` (+ strict TypeScript & desktop smoke hardening)  
> **Workspace Topology:** 13 Packages / Services / Applications  
> **Automated Verification:** **311 / 311 Tests Passing** across 48 Test Files (12 Packages) • **12 / 12 `tsc --noEmit` Green**  
> **Supported Languages:** TypeScript, JavaScript, Python 3, Go, Java, C++, Rust  
> **Supported AI Providers:** Groq LPU, OpenAI, Anthropic, Google Gemini (+ deterministic `mock` provider)  
> **Client Platforms:** Electron 34 Native Desktop & React 19 Web Application (`http://localhost:5173`)  
> **Design Standard:** WCAG 2.2 AA Contrast & Keyboard Accessibility (Light & Dark Themes)  
> **Release History:** See [CHANGELOG.md](./CHANGELOG.md)

---

## Table of Contents

1. [Executive Overview & Architecture](#1-executive-overview--architecture)
2. [Immutable Architectural Invariants](#2-immutable-architectural-invariants)
3. [Monorepo Topology & Package Directory](#3-monorepo-topology--package-directory)
4. [Core Subsystem Architecture](#4-core-subsystem-architecture)
   - [4.1 Auth & Tenancy](#41-auth--tenancy)
   - [4.2 Studio & Authoring](#42-studio--authoring)
   - [4.3 Candidate Runtime & FSM](#43-candidate-runtime--fsm)
   - [4.4 AI Policy & Guardrails](#44-ai-policy--guardrails)
   - [4.5 Runner Isolation](#45-runner-isolation)
   - [4.6 Telemetry & Proctoring](#46-telemetry--proctoring)
   - [4.7 Scoring & Calibration](#47-scoring--calibration)
   - [4.8 Integrations & Data Governance](#48-integrations--data-governance)
5. [End-to-End Persona Workflows](#5-end-to-end-persona-workflows)
6. [API Gateway Endpoints Contract](#6-api-gateway-endpoints-contract)
7. [Security, Privacy & Sandboxing Model](#7-security-privacy--sandboxing-model)
8. [Automated Verification & Test Matrix](#8-automated-verification--test-matrix)

---

## 1. Executive Overview & Architecture

The **AI Coding Assessment Platform** is an enterprise technical evaluation system built to measure how software engineers debug real codebases, collaborate critically with AI, verify edge cases, and explain engineering trade-offs.

### Engineering Problem Solved
- **Unrealistic "No-AI" Interviews:** Forbidding AI in coding rounds diverges from daily software engineering and incentivizes undetectable off-screen usage.
- **Unverified Copy-Paste Signal:** Allowing unrestricted external AI prevents evaluators from distinguishing deep comprehension from blind LLM output acceptance.

### Platform Architecture
An authenticated, company-managed AI assistant is embedded directly inside an instrumented, server-authoritative assessment workspace alongside multi-file debugging, per-task AI policy controls (including intentional `flawed_junior` AI simulation), diff-anchored post-fix comprehension defense, and human-accountable rubric calibration.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 ENTERPRISE MONOREPO                                    │
├───────────────────────────────────┬────────────────────────────────────────────────────┤
│         RECRUITER / ADMIN         │                 CANDIDATE RUNTIME                  │
│  ┌─────────────────────────────┐  │  ┌──────────────────────────────────────────────┐  │
│  │  Company Dashboard & Studio │  │  │         Candidate Onboarding Gateway         │  │
│  │  - Multi-Tenant RBAC        │  │  │  - 32-Byte Invite Verify/Accept            │  │
│  │  - Multi-Task + ZIP Import  │  │  │  - Integrity Policy Consent                  │  │
│  │  - SHA-256 Template Locks   │  │  └──────────────────────┬───────────────────────┘  │
│  │  - Magic Link Email Auth    │  │                         │                          │
│  └──────────────┬──────────────┘  │                         ▼                          │
│                 │                 │  ┌──────────────────────────────────────────────┐  │
│                 ▼                 │  │         AssessmentWorkspace (7-State FSM)    │  │
│  ┌─────────────────────────────┐  │  │  - Server Clock / PostgreSQL clock_timestamp │  │
│  │ Transactional Invite Dispatch│─┼─►│  - Multi-File Virtual Repo + Read-Only Locks │  │
│  │ SMTP STARTTLS / Resend      │  │  │  - Policy-Locked AI + Explicit Diff Modal    │  │
│  └─────────────────────────────┘  │  │  - Idempotent CAS Autosave + Defense Prompts │  │
│                                   │  └──────────────────────┬───────────────────────┘  │
│                                   │                         │                          │
│                                   │                         ▼                          │
│  ┌─────────────────────────────┐  │  ┌──────────────────────────────────────────────┐  │
│  │  Calibration & Decision     │◄─┼──│    Two-Stage Sealed SubmissionArtifact      │  │
│  │  - Blind Multi-Reviewer     │  │  │  - SHA-256 Fingerprint + AST Diff            │  │
│  │  - Factual Integrity Logs   │  │  │  - TestExecutionStatus + Defense Responses   │  │
│  │  - Signed ATS Webhooks      │  │  └──────────────────────────────────────────────┘  │
│  └─────────────────────────────┘  │                                                    │
└───────────────────────────────────┴────────────────────────────────────────────────────┘
```

---

## 2. Immutable Architectural Invariants

| ID | Invariant | System Guarantee | Implementation Enforcement |
| :-: | :--- | :--- | :--- |
| **AD #4** | **Company-Managed AI Budget** | AI token spend is strictly operational cost control and **never** penalizes or inflates candidate scores. | `scoring-engine` awards `isNotApplicable: true` (0 weight) with fair redistribution when candidates solve autonomously without AI queries. |
| **AD #5** | **Atomic Budget Reservation** | Concurrent AI calls cannot overspend a session's configured dollar cap. | Two-phase `reserveBudget` -> `commitUsage` / `releaseReservation` in `gateway.ts` backed by atomic SQL budget updates (`atomicRecordAiUsage`). |
| **AD #7** | **Explicit Diff Patch Review** | AI assistants can propose patches, never silently mutate the candidate's editor buffer. | `AssessmentWorkspace.tsx` renders proposed unified diffs in a decision modal requiring explicit accept or reject actions. |
| **AD #8** | **Fail-Closed Sandbox Gate** | Untrusted candidate code never runs unguarded in the Fastify API process or on Windows hosts without isolation. | `RUNNER_EXECUTION_ENABLED` defaults to `false` outside `NODE_ENV=test` (returning HTTP `403 RUNNER_EXECUTION_DISABLED` and `NOT_RUN`); production targets rootless Linux OCI + gVisor (`runsc`) with mutual `CODE_RUNNER_SECRET` auth. |
| **AD #9** | **Cryptographic Immutability** | Templates, versions, autosave mutations, and submissions are tamper-evident. | Canonical JSON SHA-256 hashing across `assessment_versions`, `session_autosave_mutations`, `submission_artifacts`, and HMAC-signed decision reports. |
| **AD #10** | **Human Reviewer Accountability** | Automated scorecards and proctor observations are strictly advisory; zero auto-disqualification bots. | Blind human evaluator calibration, automated `>15%` spread flags, and strictly factual telemetry (`reviewStatus`, never 0–100 proctor scores). |

---

## 3. Monorepo Topology & Package Directory

Managed with **pnpm workspaces** and TypeScript project references across **13 packages**:

```
ai-interview-copilot/
├── apps/
│   ├── api/                                  # Fastify v5 REST Backend (245 Tests / 35 Suites)
│   │   ├── drizzle/                          # Versioned Drizzle SQL migrations
│   │   └── src/
│   │       ├── db/                           # 13-table Drizzle schema & dual PostgreSQL/PGlite engine
│   │       ├── repositories/                 # Typed transactional & CAS repositories
│   │       ├── routes/                       # Fastify REST route controllers
│   │       └── services/                     # Auth, FSM, expiry sweep, zip ingest, proctor, scoring, email
│   └── desktop/                              # Electron 34 + React 19 UI (4 Smoke Integration Tests)
│       ├── scripts/start-electron.cjs        # Dev watchdog launcher
│       └── src/
│           ├── main/ & preload/              # Electron main process & contextIsolation IPC bridge
│           └── renderer/
│               ├── components/               # AssessmentWorkspace, CandidateOnboarding, CompanyDashboard,
│               │                             # CompanyAssessmentStudio, PracticeStudio, ScorecardModal,
│               │                             # ProductBentoShowcase, ErrorBoundary
│               ├── hooks/                    # useAssessmentLifecycle FSM reducer
│               └── services/                 # ApiClient & Buffered TelemetryClient
├── deploy/linux-runner/                      # Ubuntu 24.04 + Podman + gVisor setup, systemd unit & verify-security.sh
├── images/                                   # Reproducible runtime Containerfiles & runtime-manifest.json
├── packages/
│   ├── contracts/                            # Zod single-source-of-truth contracts & FSM transitions (4 Tests)
│   ├── ai-core/                              # Multi-provider orchestrator, policy prompts & mock provider (5 Tests)
│   ├── ai-provider-anthropic/                # Claude adapter (3 Tests)
│   ├── ai-provider-google/                   # Gemini adapter (3 Tests)
│   ├── ai-provider-groq/                     # Groq LPU adapter (3 Tests)
│   ├── ai-provider-openai/                   # OpenAI adapter (3 Tests)
│   ├── context-engine/                       # AST symbol extraction & secret-excluding context packing (3 Tests)
│   └── scoring-engine/                       # 7-dimension rubric engine & N/A redistribution (6 Tests)
├── services/
│   └── code-runner/                          # Isolated execution daemon, gVisor provider, compilers &
│                                             # workspace-materializer.ts (28 Tests / 3 Suites)
└── tasks/
    └── frontend-ticket-queue/                # Pilot baseline triage challenge & test suite (4 Tests)
```

---

## 4. Core Subsystem Architecture

### 4.1 Auth & Tenancy
- **Multi-Tenant Isolation:** Every organization receives a UUID tenant scope; all queries, mutations, sessions, evaluations, and webhooks enforce organization membership and anti-IDOR ownership validation.
- **Role Hierarchy (RBAC):** `owner` (sole-owner protection prevents self-revocation/demotion), `admin`, `interviewer`, `reviewer`, and `candidate` (strictly scoped to their single `sessionId`).
- **Passwordless Magic Link Authentication (`MagicLinkService`):**
  - `POST /api/v1/auth/magic-link/request` & `POST /api/v1/auth/magic-link/verify` issue 32-byte `crypto.randomBytes(32)` tokens stored exclusively as SHA-256 hashes with a single-use burn and 15-minute TTL.
  - Anti-enumeration: request responses are uniform HTTP `200` regardless of account existence, rate-limited at 5 requests per 15-minute window per email (`429 RATE_LIMIT_EXCEEDED`).
  - `debugToken` is omitted completely (`undefined`) in production and external pilot (`APP_ENV=pilot`) environments.
- **Candidate-to-Company Boundary Enforcement (`assertCompanyMember`):** Candidate bearer tokens attempting to inspect or mutate company endpoints (templates, invitations, member rosters, org sessions, proctor logs, evaluations, webhooks) receive HTTP `403 FORBIDDEN`.
- **Production Auth Hardening:** Timing-safe HMAC-SHA256 JWT verification (`crypto.timingSafeEqual`). Unauthenticated dev helper `POST /api/v1/auth/persona-token` is strictly disabled when `NODE_ENV === "production"`; report exports reject URL query tokens in production; JWT tokens in `CompanyDashboard.tsx` are masked by default.

### 4.2 Studio & Authoring
- **Company Assessment Studio (`CompanyAssessmentStudio.tsx`):** Visual multi-task builder supporting field-level validation, reordering, duplication, candidate preview, and role-level settings (`title`, `targetRole`, `difficulty`, `durationMinutes`, `attemptDurationMinutes`, `submissionDeadlineDays`, `defaultAiBudgetUsd`).
- **3-Family Task Registry (`packages/contracts/src/task.ts`):**
  1. `question_set`: `mcq_single`, `mcq_multi`, and `short_text` items with hidden answer/criteria scrubbing via `scrubTaskForCandidate`.
  2. `coding_challenge`: Single-file coding tasks with polyglot language selection, public tests (`publicTestCode`), and hidden server-only verification suites (`hiddenTestCode`).
  3. `repository_task`: Multi-file virtual project snapshots (`starterFiles` / `fileTree`), `primaryFilePath`, read-only reference locks (`isReadOnly: true` / `readOnlyFiles`), and codebase verification tests.
- **Hardened Streaming ZIP Repository Import (`ZipIngestService`):** Zero-dependency PKZip parser (`POST /api/v1/templates/repository/upload-zip`) enforcing Zip Slip traversal rejection, absolute/Windows path blocking, Unix symlink (`0o120000`) rejection, compression-bomb caps (50:1 max ratio, 1 MB/file, 10 MB total), `.env` / `.git` / `node_modules` stripping, and automatic `isReadOnly` tagging for test/config files.
- **Cryptographic Template Versioning & Invitations:** Publishing locks an immutable canonical SHA-256 snapshot (`POST /api/v1/templates/:templateId/versions`). Candidate invitations (`POST /api/v1/invitations`) issue 32-byte invite tokens with decoupled invite availability windows (`expiresInDays`) vs. active attempt timers (`attemptDurationMinutes`).

### 4.3 Candidate Runtime & FSM
- **Explicit 7-State Lifecycle FSM (`packages/contracts/src/session-fsm.ts`):**
  - States: `CREATED`, `ACTIVE`, `PAUSED`, `GRACE_PERIOD`, `FINALIZING`, `SUBMITTED`, `TERMINATED`.
  - Frontend reducer `useAssessmentLifecycle.ts` synchronizes UI state with 5-second server heartbeats (`GET /api/v1/sessions/:sessionId/heartbeat`).
  - Active sessions entering timeout transition into `GRACE_PERIOD` (`isReadOnly: true`, AI & code edits locked, submission permitted) before server-authoritative finalization seals the last durable snapshot (`FINALIZING -> SUBMITTED`).

| Current State | Event | Target State | Actor | Guard / Effect |
| :--- | :--- | :--- | :---: | :--- |
| `CREATED` | `ACCEPT_INVITATION` | `ACTIVE` | Candidate | Within invite validity window |
| `ACTIVE` | `PROCTOR_PAUSE` | `PAUSED` | Proctor | Freezes countdown & locks workspace |
| `PAUSED` | `PROCTOR_RESUME` | `ACTIVE` | Proctor | Extends `expiresAt` by exact pause ms |
| `ACTIVE` | `SOFT_EXPIRY` | `GRACE_PERIOD` | System | `clock_timestamp() >= expires_at` |
| `ACTIVE` / `GRACE_PERIOD` | `START_FINALIZATION` | `FINALIZING` | Candidate / System | Acquires lease (`finalizing_by`, `state_version` CAS) |
| `FINALIZING` | `RECOVER_STUCK_FINALIZATION` | `FINALIZING` | System | Reclaims expired crash lease |
| `FINALIZING` | `FINALIZE_SUCCESS` | `SUBMITTED` | System | Transactional artifact seal (`UNIQUE(session_id)`) |
| `ACTIVE` / `PAUSED` / `GRACE_PERIOD` / `FINALIZING` | `TERMINATE` | `TERMINATED` | Proctor / System | Terminal lockout |

- **PostgreSQL `clock_timestamp()` Deadlines & CAS Concurrency:** Database-level conditional updates ensure autosaves (`PATCH /api/v1/sessions/:sessionId/workspace`) fail with HTTP `410 SESSION_EXPIRED` after `expires_at` or HTTP `409 INVALID_STATE` outside `ACTIVE`.
- **Durable Autosave Idempotency (`session_autosave_mutations`):** Requires `baseRevision` and `clientMutationId` (`400 VALIDATION_FAILED` if omitted). `UNIQUE(session_id, client_mutation_id)` + SHA-256 `computeCanonicalRequestHash` makes identical network retries idempotent while rejecting stale revisions or conflicting content reuse with HTTP `409`.
- **Background Expiry & Crash Recovery (`SessionExpiryProcessor`):** Sweeps expired sessions and reclaims stuck `FINALIZING` leases cleanly across API restarts.
- **Unified Practice Studio (`PracticeStudio.tsx`) & Pilot Showcase (`ProductBentoShowcase.tsx`):** Practice catalog supports single-file and multi-file `repository_task` challenges, **Weak AI Mode (`flawed_junior`)**, **Strict Exam Mode** countdown with auto-submit, and interactive stakeholder showcase mode.

### 4.4 AI Policy & Guardrails
- **4 Canonical Per-Task AI Policy Modes (`TaskAIPolicyModeSchema`):**
  1. `prohibited`: UI copilot & input disabled; `POST /api/v1/answers/generate` rejects with HTTP `403 AI_PROHIBITED_FOR_TASK`.
  2. `restricted_explainer`: AI answers architectural/syntax questions; server strips generated code/diffs (`code: ""`, `codeChanges: []`).
  3. `full_copilot`: Collaborative explanations and unified diff proposals with mandatory explicit diff review (**AD #7**).
  4. `flawed_junior`: Weak-AI simulation mode enforcing `SYSTEM_FLAWED_JUNIOR_PROMPT` and **server-side `allowedModel` locking** in `answers.ts` (blocking client `?model=` escalation) to test whether candidates critically catch shallow/buggy AI suggestions.
- **Diff-Anchored Post-Fix Comprehension Defense (`DefenseResponseItemSchema`):** Prompts candidates on submission to defend specific modified files, AI-accepted patches, or edge cases (`modified_file`, `ai_accepted_patch`, `test_verification`, `edge_case`), persisted inside `submission_artifacts.defense_responses` and displayed to evaluators in `CompanyDashboard.tsx`.
- **Prompt Injection Defense:** Candidate code and prompts are isolated inside `<untrusted_question>` and `<untrusted_code>` delimiters.

### 4.5 Runner Isolation
- **Fail-Closed Security Gate (`RUNNER_EXECUTION_ENABLED`):**
  - Configured in `apps/api/src/config.ts`: defaults to `false` in `development` and `production`, and `true` only in `NODE_ENV=test` unless explicitly enabled.
  - When closed, `POST /api/v1/code/validate` returns HTTP `403 RUNNER_EXECUTION_DISABLED` and `SubmissionService` records `TestExecutionStatus = NOT_RUN` (`passed: null`, `exitCode: null`), while `AssessmentWorkspace.tsx` renders a non-blocking policy notice and preserves `Submit Solution`.
- **Decoupled Runner Microservice (`services/code-runner` on `:4100`):**
  - Endpoints: public `GET /health`, mutual-token authenticated (`CODE_RUNNER_SECRET`) `GET /environment` and `POST /validate`.
  - Execution worker runs with **zero DB credentials and zero AI provider keys**.
- **Hardened Multi-File `workspace-materializer.ts`:** Validates multi-file virtual payloads (`files`, `entryTestFile`), enforcing POSIX path normalization, traversal/null-byte/drive-letter rejection, reserved harness filename protection (`runner.ts`, `__sandbox_tests__.ts`, etc.), max `50` files, and `512 KB` total workspace byte cap.
- **Production Linux gVisor (`runsc`) & Polyglot Runtimes:** `deploy/linux-runner/` + `images/runtime-manifest.json` target Ubuntu 24.04 + rootless Podman + gVisor with `--network=none`, non-root UID `1000:1000`, per-language CPU/RAM/PID ceilings across Node 22, Python 3.12, Go 1.23, Java 21, GCC 13/14, and Rust, and `verify-security.sh` (12 adversarial container gates). Absent toolchains fail explicitly with `COMPILER_NOT_FOUND`.
- **4-State `TestExecutionStatus` Contract:** `SUCCESS`, `FAILURE`, `NOT_RUN`, and `UNAVAILABLE` (runner unreachable preserves submission artifact without dropping candidate work).

### 4.6 Telemetry & Proctoring
- **Append-Only Monotonic Audit Stream (`SessionEventsService`):** Batch-ingested events (`POST /api/v1/sessions/:sessionId/events`) with client `sequenceNumber` deduplication and candidate `sessionId` anti-IDOR guards, covering candidate UI events (`session_started`, `code_snapshot`, `test_run`, `ai_query`, `ai_patch_proposed`, `ai_patch_decision`, `window_blur`, `window_focus`, `paste_detected`) and server lifecycle/proctor events (`proctor_flag`, `session_paused`, `session_resumed`, `session_soft_expired`, `session_finalization_started`, `session_auto_finalized_by_server`, `session_stuck_finalization_recovered`, `session_submitted`, `session_terminated`).
- **Factual Evidentiary `IntegrityService` (Zero 0–100 Scores):**
  - Reports transparent factual signals: `focusRatePercent`, `totalOffScreenDurationSeconds`, `unattributedPasteCount` & `unattributedPasteChars` (clipboard pastes `>50` chars not matching accepted AI diffs), `incidentFlagsCount`, and operational `reviewStatus` (`verified` | `review_recommended` | `unresolved_incident`).
  - Zero 0–100 composite integrity scores, zero risk bands, zero score deductions, and zero keystroke cadence monitoring.
- **Proctor Controls (`owner`, `admin`, `interviewer` only):** Authenticated emergency `POST /:sessionId/pause` and `POST /:sessionId/resume` extend `expires_at` by the exact paused millisecond delta and record monotonic audit events. Incident creation/resolution is tracked in `proctor_incidents`.

### 4.7 Scoring & Calibration
- **7-Dimension Rubric Engine (`packages/scoring-engine`):** Evaluates Code Comprehension (20%), Problem Framing (10%), AI Collaboration (15%), Critical Evaluation (15%), Debugging & Implementation (20%), Testing & Verification (15%), and Technical Explanation (5%).
- **Fair Dynamic Weight Redistribution:** When candidates work autonomously without AI queries (`aiQueriesCount === 0`) or when a task sets `aiPolicy.mode === "prohibited"`, AI dimensions receive `isNotApplicable: true` (0 weight) and their weights redistribute cleanly across the 5 technical dimensions so scores remain normalized to 100.
- **Blind Multi-Reviewer Calibration & Hiring Reports:** Evaluators submit independent scorecards (`POST /api/v1/sessions/:sessionId/evaluations`); peer scores stay masked until submission, automated spread variance (`>15%`) triggers calibration alerts, and `ReportService` generates tamper-evident evidence-linked HTML/PDF decision reports (`submissionFingerprint` + `templateContentHash` + HMAC signature).

### 4.8 Integrations & Data Governance
- **Dual-Engine Persistence (`apps/api/src/db/`):** Drizzle ORM over 13 normalized tables (`organizations`, `organization_members`, `assessment_templates`, `assessment_versions`, `candidate_invitations`, `assessment_sessions`, `session_events`, `submission_artifacts`, `reviewer_evaluations`, `usage_events`, `webhook_subscriptions`, `proctor_incidents`, `session_autosave_mutations`) supporting pooled production PostgreSQL (`DATABASE_URL`) and zero-daemon embedded `@electric-sql/pglite` with versioned SQL migrations (`apps/api/drizzle/`).
- **Transactional Email Delivery (`EmailDeliveryService`):** Pluggable `SmtpEmailProvider` (native TLS/STARTTLS sockets), `ResendEmailProvider`, masked `ConsoleEmailProvider`, and `TestEmailProvider`.
- **ATS/HRIS Webhooks & AI Cost Analytics:** Organization-scoped webhook subscriptions (`POST /api/v1/webhooks/subscriptions`) signed with HMAC-SHA256 + retry backoff; real-time AI spend ledger, 30-day linear burn forecast, and anomaly detection (`/api/v1/analytics/*`).
- **Multimodal OCR Screen Capture Ingest:** `POST /api/v1/capture/extract-question` (10 MB payload guard, multi-provider vision extraction + offline heuristic fallback across all 7 languages) and Practice presets.
- **Candidate Data Erasure (`DELETE /api/v1/sessions/:sessionId/data`):** Authorized hard-deletion cascade across session, events, submission artifacts, and proctor incidents plus cache eviction.
- **UI Resilience & Accessibility:** Top-level React `ErrorBoundary` with stack recovery, WCAG 2.2 AA Light/Dark contrast tokens, and contextual workspace controls (`Run Tests` shown only on coding/repository tasks).

---

## 5. End-to-End Persona Workflows

### Workflow 1: Company Admin / Recruiter
1. Sign in via single-use Magic Link (`POST /api/v1/auth/magic-link/request` -> email link -> `/magic-link/verify`).
2. Author a multi-task evaluation in **Company Assessment Studio** (`question_set`, `coding_challenge`, `repository_task` with optional ZIP upload and per-task AI policy: `prohibited`, `restricted_explainer`, `full_copilot`, or `flawed_junior`).
3. Publish an immutable SHA-256 version (`POST /api/v1/templates/:templateId/versions`) and dispatch a 32-byte cryptographic invitation email (`POST /api/v1/invitations`) specifying invite validity window and timed attempt duration.

### Workflow 2: Candidate Journey
1. Open `?invite=<token>` -> `CandidateOnboarding.tsx` verifies invitation metadata (`GET /api/v1/invitations/verify/:token`) without exposing hidden tests or answers.
2. Check the integrity agreement and click **Begin Assessment** -> provisions a server-authoritative `ACTIVE` session and isolates navigation tabs during the timed exam.
3. Collaborate inside `AssessmentWorkspace.tsx`: switch multi-file repository tabs, query policy-scoped AI, inspect proposed unified diffs (**Accept** or **Reject**), click **Run Tests** (executing in sandbox when enabled, or showing the fail-closed `RUNNER_EXECUTION_DISABLED` policy notice while preserving code), relying on idempotent 20s CAS autosave (`PATCH /workspace`).
4. Click **Submit Solution**, enter root-cause explanation + diff-anchored defense responses, and lock into `SUBMITTED` receipt view with SHA-256 `submissionFingerprint`.

### Workflow 3: Proctor & Technical Emergency Intervention
1. Open **Live Proctor & Integrity** in `CompanyDashboard.tsx`.
2. Review factual telemetry (`focusRatePercent`, off-screen dwell, unattributed pastes, `reviewStatus`) and log or resolve `proctor_incidents` (annotations only, no composite score penalties).
3. On technical disruptions, click **Pause Session** (`POST /pause`) -> freeze countdown; click **Resume Session** (`POST /resume`) -> extends `expiresAt` by exact paused duration.

### Workflow 4: Reviewer & Hiring Committee
1. Inspect AST diffs, test status (`SUCCESS` | `FAILURE` | `NOT_RUN` | `UNAVAILABLE`), and `defenseResponses`.
2. Submit blind 7-dimension ratings (`POST /evaluations`), resolve >15% variance flags on the **Calibration Board**, and export signed HTML/PDF Decision Reports (`GET /report/export`).

### Workflow 5: Local Developer Verification
```bash
pnpm install
pnpm --filter @ai-copilot/contracts build
pnpm test                # Runs 311 automated Vitest tests across 48 suites (12 packages)
pnpm run typecheck       # Verifies tsc --noEmit across all 12 TypeScript packages (12/12 green)
```
To test live **Run Tests** execution locally on a trusted machine, start the API with `RUNNER_EXECUTION_ENABLED=true` (leaving it `false` for pilot/untrusted sessions).

---

## 6. API Gateway Endpoints Contract

Fastify REST API (`apps/api`, default port `4000`):

| Group | Method & Route | Auth / RBAC | Purpose |
| :--- | :--- | :---: | :--- |
| **Health** | `GET /health` | Public | Server readiness & active AI providers |
| **Auth** | `POST /api/v1/auth/magic-link/request`, `POST /api/v1/auth/magic-link/verify`, `POST /api/v1/auth/logout`, `POST /api/v1/auth/token`, `GET /api/v1/auth/me` | Public / Bearer JWT | Passwordless login, JWT verification & dev-gated `/persona-token` |
| **Orgs** | `GET/POST /api/v1/organizations`, `GET /api/v1/organizations/:orgId`, `GET/POST/PATCH/DELETE .../members` | Bearer JWT (`admin`, `owner`) | Multi-tenant orgs & sole-owner guarded RBAC |
| **Templates & Versions** | `GET/POST/PATCH/DELETE /api/v1/templates`, `POST .../publish`, `POST /api/v1/templates/repository/upload-zip`, `GET/POST /api/v1/templates/:id/versions`, `GET /api/v1/versions/:id(/verify)` | Company Member (`admin`, `owner`) | Multi-task studio CRUD, ZIP repo ingest & SHA-256 version locking |
| **Invitations** | `GET/POST /api/v1/invitations`, `GET /api/v1/invitations/verify/:token`, `POST /api/v1/invitations/accept/:token`, `POST /api/v1/invitations/:id/revoke` | Company / Public Token | Candidate invite dispatch & session ignition |
| **Sessions & Submission** | `GET/POST /api/v1/sessions`, `GET /api/v1/sessions/:id`, `GET .../heartbeat`, `PATCH .../workspace`, `POST .../submit`, `GET .../submission`, `DELETE .../data` | Scoped Candidate / Company | 7-state FSM runtime, CAS autosave idempotency, artifact sealing & GDPR/DPDP erasure |
| **Telemetry & Proctor** | `POST/GET /api/v1/sessions/:id/events`, `POST .../pause`, `POST .../resume`, `POST .../terminate`, `GET .../integrity`, `GET/POST .../incidents`, `POST .../incidents/:incId/resolve` | Candidate (ingest) / Company Proctor | Monotonic telemetry stream, factual integrity signals & pause/resume audit |
| **Calibration & Reports** | `GET/POST /api/v1/sessions/:id/evaluations`, `GET .../calibration`, `GET .../scorecard/ai-draft`, `GET .../report(/export)` | Reviewer / Interviewer / Admin | Blind 7-dimension calibration & tamper-evident reports |
| **AI & Context** | `POST /api/v1/answers/generate`, `GET /api/v1/providers`, `POST /api/v1/context/index`, `POST /api/v1/context/retrieve`, `POST /api/v1/questions/extract`, `GET /api/v1/usage(/sessions)` | Candidate / Bearer | Policy/model-locked AI copilot, AST context & budget usage |
| **Sandbox Gate** | `GET /api/v1/code/validate/status`, `POST /api/v1/code/validate` | Candidate / Bearer | Runner gate status & gVisor/isolated test dispatch (`403` when gated) |
| **Webhooks & Analytics** | `GET/POST/DELETE /api/v1/webhooks/subscriptions`, `POST .../test`, `GET /api/v1/webhooks/logs`, `GET /api/v1/analytics/(ai-costs\|burn-rate\|anomalies)` | Company (`admin`, `owner`) | Signed ATS/HRIS webhooks & AI spend analytics |
| **Practice & Capture** | `GET /api/v1/practice/challenges(/:id)`, `POST /api/v1/practice/evaluate`, `POST /api/v1/capture/extract-question`, `GET /api/v1/capture/sample-presets` | Authenticated / Workspace | Multi-file/Weak-AI practice catalog & OCR challenge import |

---

## 7. Security, Privacy & Sandboxing Model

1. **Secrets Isolation:** AI provider keys (`GROQ_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`), `JWT_SECRET`, `CODE_RUNNER_SECRET`, and `DATABASE_URL` reside solely in backend services, never bundled into Electron/renderer assets and stripped from sandbox runner child processes.
2. **Untrusted Execution Isolation:** Production execution requires Linux rootless Podman + gVisor (`runsc`, `--network=none`, read-only rootfs, non-root UID, cgroups v2); bare-metal Windows hosts keep `RUNNER_EXECUTION_ENABLED=false` by default.
3. **Tenant & Session Scoping:** JWT claims scope candidate access strictly to their single `sessionId` and reject company-route probes with HTTP `403`.
4. **Data Protection (DPDP Act / GDPR):** Candidate sessions and artifacts support hard-deletion (`DELETE /api/v1/sessions/:sessionId/data`) plus immediate in-memory buffer eviction, alongside PII masking in logs and blind evaluator views.

---

## 8. Automated Verification & Test Matrix

Verified across all workspace packages (`pnpm test` and `pnpm run typecheck`):

| Package / Module | Verification Scope | Tests Passed | `tsc --noEmit` | Status |
| :--- | :--- | :---: | :---: | :---: |
| `tasks/frontend-ticket-queue` | Priority sorting, immutability, undefined tag safety | 4 / 4 (1 File) | Pass | **PASS** |
| `packages/contracts` | Zod schemas: FSM, multi-file sandbox, weak-AI defense, practice, reports | 4 / 4 (1 File) | Pass | **PASS** |
| `packages/ai-core` | Orchestrator routing, fallback & `flawed_junior` prompts | 5 / 5 (1 File) | Pass | **PASS** |
| `packages/context-engine` | AST extraction, secret exclusion & token packing | 3 / 3 (1 File) | Pass | **PASS** |
| `services/code-runner` | Multi-file workspace materializer, traversal guards, OCI/gVisor probe, polyglot compilers, mutual runner auth | 28 / 28 (3 Files) | Pass | **PASS** |
| `packages/ai-provider-groq` | Groq LPU adapter & JSON repair | 3 / 3 (1 File) | Pass | **PASS** |
| `packages/ai-provider-openai` | OpenAI adapter & cost tracking | 3 / 3 (1 File) | Pass | **PASS** |
| `packages/ai-provider-anthropic` | Claude adapter & tool parsing | 3 / 3 (1 File) | Pass | **PASS** |
| `packages/ai-provider-google` | Gemini adapter & OCR extraction | 3 / 3 (1 File) | Pass | **PASS** |
| `packages/scoring-engine` | 7-dimension rubric & dynamic N/A weight redistribution | 6 / 6 (1 File) | Pass | **PASS** |
| `apps/api` | Auth/magic links, RBAC/IDOR, email delivery, studio & ZIP import, 7-state FSM, CAS autosave idempotency, expiry sweep, pause/resume audit, factual proctoring, `flawed_junior` lock & defense, calibration, webhooks, analytics, runner gate | 245 / 245 (35 Files) | Pass | **PASS** |
| `apps/desktop` | `CandidateOnboarding`, `AssessmentWorkspace` (AI policy, explicit diff review, runner-disabled notice, submission lock) & `PracticeStudio` (multi-file repo, Weak AI, Strict Exam) Vitest + Testing Library integration suite | 4 / 4 (1 File) | Pass | **PASS** |
| **Monorepo Totals** | **12 Tested Packages • 12 Typechecked Projects** | **311 / 311 (48 Files)** | **12 / 12 Green** | **100% PASS** |
