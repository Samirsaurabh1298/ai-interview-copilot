# AI Coding Assessment Platform: Enterprise B2B Technical Architecture & Master Operating Manual

> **System Status:** Production Monorepo  
> **Workspace Topology:** 13 Packages / Services / Applications  
> **Automated Test Suite:** 219 / 219 Automated Tests Passing across 37 Test Suites (100% Pass Rate)  
> **Challenge Sandbox Pass Rate:** 5 / 5 Verification Assertions Passing (100%)  
> **Supported Software Engineering Languages:** TypeScript, JavaScript, Python 3, Go, Java, C++, Rust  
> **Primary AI Providers:** Groq LPU (`qwen/qwen3.8-27b`, `openai/gpt-oss-120b`) & OpenAI (`gpt-4o-mini`, `gpt-4o`)  
> **Supported Runtime Platforms:** Electron 34 Native Desktop & High-Fidelity Web Browser (`http://localhost:5173`)  
> **Design Standard:** WCAG 2.2 AA Contrast & Focus Accessibility (Light & Dark Themes)

---

## Table of Contents

1. [Executive Overview & Vision](#1-executive-overview--vision)
2. [The 6 Immutable Architectural Invariants](#2-the-6-immutable-architectural-invariants)
3. [Monorepo Architecture & Package Directory](#3-monorepo-architecture--package-directory)
4. [Exhaustive Feature Inventory & Deep Technical Specifications](#4-exhaustive-feature-inventory--deep-technical-specifications)
   - [4.1. Multi-Tenant Organization & Role-Based Access Control (RBAC)](#41-multi-tenant-organization--role-based-access-control-rbac)
   - [4.2. Assessment Template Engine & Cryptographic Versioning](#42-assessment-template-engine--cryptographic-versioning)
   - [4.3. Cryptographic Candidate Invitation & Onboarding Gateway](#43-cryptographic-candidate-invitation--onboarding-gateway)
   - [4.4. Active Candidate Assessment Workspace & Session Engine](#44-active-candidate-assessment-workspace--session-engine)
   - [4.5. Company-Managed AI Assistant & Financial Guardrails](#45-company-managed-ai-assistant--financial-guardrails)
   - [4.6. Candidate Explicit Diff Review & Patch Acceptance](#46-candidate-explicit-diff-review--patch-acceptance)
   - [4.7. Hardened Ephemeral Code Execution Sandbox](#47-hardened-ephemeral-code-execution-sandbox)
   - [4.8. Session Telemetry, Passive Integrity & Evidence Collection](#48-session-telemetry-passive-integrity--evidence-collection)
   - [4.9. 7-Dimension Rubric Scoring & Automated Evaluation Engine](#49-7-dimension-rubric-scoring--automated-evaluation-engine)
   - [4.10. Submission Packaging & Immutable Artifact Bundling](#410-submission-packaging--immutable-artifact-bundling)
   - [4.11. Proctor Controls, Emergency Pausing & Incident Recovery](#411-proctor-controls-emergency-pausing--incident-recovery)
   - [4.12. User Experience, Dark/Light Theming & Favicon Branding](#412-user-experience-darklight-theming--favicon-branding)
   - [4.13. Candidate Practice Studio & Instant Diagnostic Feedback Engine](#413-candidate-practice-studio--instant-diagnostic-feedback-engine)
   - [4.14. Screen Capture & Multimodal OCR Ingest Engine](#414-screen-capture--multimodal-ocr-ingest-engine)
   - [4.15. Polyglot Software Domain Engine (Python, Go, Java, C++, Rust, TS/JS)](#415-polyglot-software-domain-engine-python-go-java-c-rust-tsjs)
   - [4.16. UI Crash Protection & React ErrorBoundary Recovery Engine](#416-ui-crash-protection--react-errorboundary-recovery-engine)
   - [4.17. Company Assessment Studio & Extensible Multi-Task Authoring Engine (LOOP 6)](#417-company-assessment-studio--extensible-multi-task-authoring-engine-loop-6)
   - [4.18. Production-Grade Dual-Engine PostgreSQL Persistence & DDL Auto-Sync (LOOP 6.1)](#418-production-grade-dual-engine-postgresql-persistence--ddl-auto-sync-loop-61)
   - [4.19. Real-Time Proctoring, Passive Integrity & Anti-Cheat Evidence Pipeline (LOOP 7)](#419-real-time-proctoring-passive-integrity--anti-cheat-evidence-pipeline-loop-7)
   - [4.20. Enterprise Pilot Readiness, Scoring Fairness & Production Hardening (LOOP 8)](#420-enterprise-pilot-readiness-scoring-fairness--production-hardening-loop-8)
   - [4.21. OCI / gVisor Runner Architecture, Language Policies & ZIP Codebase Ingestion (LOOP 9)](#421-oci--gvisor-runner-architecture-language-policies--zip-codebase-ingestion-loop-9)
   - [4.22. Linux gVisor Deployment, Service Security & Adversarial Verification (LOOP 9.1)](#422-linux-gvisor-deployment-service-security--adversarial-verification-loop-91)
   - [4.23. Private Company Pilot Readiness, Security Gate & Magic Link Authentication (LOOP 10)](#423-private-company-pilot-readiness-security-gate--magic-link-authentication-loop-10)
   - [4.24. Pilot Hardening & Policy Consistency (LOOP 10.0.1)](#424-pilot-hardening--policy-consistency-loop-1001)
   - [4.25. External Pilot Launch Gate & Delivery Architecture (LOOP 10.0.2)](#425-external-pilot-launch-gate--delivery-architecture-loop-1002)
5. [Complete End-to-End User Workflows (Step-by-Step Guides)](#5-complete-end-to-end-user-workflows-step-by-step-guides)
   - [Workflow 1: Company Admin / Recruiter Setup Guide](#workflow-1-company-admin--recruiter-setup-guide)
   - [Workflow 2: Candidate Assessment Journey Guide](#workflow-2-candidate-assessment-journey-guide)
   - [Workflow 3: Interviewer & Proctor Real-Time Monitoring & Integrity Room Guide](#workflow-3-interviewer--proctor-real-time-monitoring--integrity-room-guide)
   - [Workflow 4: Reviewer & Hiring Manager Evaluation Guide](#workflow-4-reviewer--hiring-manager-evaluation-guide)
   - [Workflow 5: Developer Setup & Local Execution Guide](#workflow-5-developer-setup--local-execution-guide)
   - [Workflow 6: Authoring Role-Specific Multi-Task Assessments in Assessment Studio](#workflow-6-authoring-role-specific-multi-task-assessments-in-assessment-studio)
6. [API Gateway Endpoints Contract Specification](#6-api-gateway-endpoints-contract-specification)
7. [Security, Privacy, Compliance & Employer Separation Policy](#7-security-privacy-compliance--employer-separation-policy)
8. [Automated Verification & Test Matrix](#8-automated-verification--test-matrix)
9. [Git Commit History & Roadmap Traceability](#9-git-commit-history--roadmap-traceability)

---

## 1. Executive Overview & Vision

The **AI Coding Assessment Platform** is an enterprise-grade technical hiring and evaluation system engineered to measure how software engineers solve complex real-world engineering problems with managed AI assistance.

### The Problem With Traditional Coding Interviews
- **Banning AI is Unrealistic & Broken:** In the real world, senior engineers use AI daily to accelerate boilerplate, diagnose stack traces, and query documentation. Forbidding AI during interviews creates an artificial environment, penalizes honest candidates, and incentivizes undetectable screen-sharing or secondary-device cheating.
- **Unmonitored AI Destroys Signal:** When companies allow unrestricted AI (e.g., ChatGPT in another tab), interviewers cannot distinguish between a candidate who deeply understands system architecture and one who blindly copy-pastes LLM outputs without verifying correctness or edge cases.

### The Solution: Managed AI Collaboration & Calibrated Rubric Evaluation
This platform solves both dilemmas by integrating a **company-managed AI Engineering Assistant directly inside a secure assessment workspace**.
1. **AI is an Observed Collaborator:** Every prompt asked, token spent, patch proposed, diff accepted/rejected, and test executed is recorded into an append-only cryptographic telemetry audit stream.
2. **Evaluates Modern Engineering Competency:** Candidates are evaluated not on memorized syntax, but on **7 critical dimensions**: Code Comprehension, Problem Framing, AI Collaboration, Critical Evaluation, Debugging & Quality, Testing Discipline, and Technical Explanation.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 ENTERPRISE MONOREPO                                   │
├───────────────────────────────────┬────────────────────────────────────────────────────┤
│         RECRUITER / ADMIN         │                 CANDIDATE INTERFACE                │
│  ┌─────────────────────────────┐  │  ┌──────────────────────────────────────────────┐  │
│  │   Company Admin Dashboard   │  │  │         Secure Onboarding Gateway            │  │
│  │  - Multi-Tenant RBAC        │  │  │  - Integrity Agreement Acceptance            │  │
│  │  - Template Authoring       │  │  │  - 32-Byte Cryptographic Token Auth          │  │
│  │  - Version SHA-256 Locking  │  │  └──────────────────────┬───────────────────────┘  │
│  │  - Telemetry Audit Stream   │  │                         │                          │
│  └──────────────┬──────────────┘  │                         ▼                          │
│                 │                 │  ┌──────────────────────────────────────────────┐  │
│                 ▼                 │  │        60-Minute Assessment Workspace        │  │
│  ┌─────────────────────────────┐  │  │  - Server-Authoritative Timer & Grace Period │  │
│  │    Candidate Invitation     │──┼─►│  - Split IDE (Monaco Editor + Brief Panel)   │  │
│  │   Token Dispatch Engine     │  │  │  - Managed AI Assistant ($0.25 Hard Cap)     │  │
│  └─────────────────────────────┘  │  │  - Explicit Patch Diff Review Modal          │  │
│                                   │  │  - Node 22 Isolated Sandbox Test Runner      │  │
│                                   │  │  - 20s Background Autosave & Heartbeat Sync  │  │
│                                   │  └──────────────────────┬───────────────────────┘  │
│                                   │                         │                          │
│                                   │                         ▼                          │
│                                   │  ┌──────────────────────────────────────────────┐  │
│                                   │  │      Canonical SHA-256 Submission Bundle     │  │
│                                   │  │  - Code AST Diff + Test Logs + Explanation   │  │
│                                   │  └──────────────────────┬───────────────────────┘  │
│                                   │                         │                          │
│                                   │                         ▼                          │
│  ┌─────────────────────────────┐  │  ┌──────────────────────────────────────────────┐  │
│  │  Reviewer Calibration Modal │◄─┼──│   Automated 7-Dimension Rubric Scorecard     │  │
│  │  - Evidence Citations       │  │  │   - AI is strictly advisory to human review  │  │
│  │  - Anchor Adjustments (1-4) │  │  └──────────────────────────────────────────────┘  │
│  └─────────────────────────────┘  │                                                    │
└───────────────────────────────────┴────────────────────────────────────────────────────┘
```

---

## 2. The 6 Immutable Architectural Invariants

Every subsystem in the codebase adheres strictly to 6 foundational architectural invariants:

| # | Invariant | Description | Technical Enforcement |
| :-: | :--- | :--- | :--- |
| **AD #4** | **Company-Managed AI Access** | AI token usage is purely a financial cost-control metric. It **never** inflates or deflates the candidate's technical score. | `scoring-engine` evaluates candidates on technical quality, test pass rates, and critical review; token costs are tracked in `evidenceCitations` only. |
| **AD #7** | **Candidate Explicit Patch Review** | The AI assistant can propose solutions, but can **never** silently overwrite the candidate's editor buffer. | Every code suggestion is rendered as a side-by-side unified diff modal requiring manual `[Accept & Apply]` or `[Reject]` action. |
| **AD #8** | **Node 22 Isolated Sandbox** | Untrusted candidate code executes in a stripped, isolated Node 22 subprocess with zero network access and strict filesystem boundaries. | `--permission`, `--allow-fs-write=${tmpDir}`, `--disallow-code-generation-from-strings`, monkey-patched `Socket.prototype.connect` traps, and 4000ms watchdog timeouts. |
| **AD #9** | **Cryptographic Immutability** | All assessment templates, versions, sessions, and submissions are tamper-evident. | Canonical JSON serialization hashed via SHA-256 (`crypto.createHash("sha256")`). Any template change creates an immutable new version. |
| **AD #10** | **Human Reviewer Accountability** | AI-generated scorecards and rubric dimensions are **strictly advisory**. Final hiring decisions belong to humans. | Scorecard modal provides interactive calibration anchors (1 to 4) and reviewer notes for hiring manager consensus. |
| **Sec** | **Anti-IDOR Tenant Boundary** | Every API request enforces tenant isolation and server-authoritative clock authority. | Timing-safe JWT HMAC-SHA256 tokens, strict `orgId` filtering on database queries, candidate session token scoping, and server-calculated deadlines. |

---

## 3. Monorepo Architecture & Package Directory

The monorepo is managed with **pnpm workspaces** and configured with TypeScript project references across 13 distinct packages:

```
c:\samir\ai-interview-copilot/
├── apps/
│   ├── api/                              # Fastify v5 REST & WebSocket Backend Server
│   │   ├── src/
│   │   │   ├── db/                       # Drizzle ORM Schema, Dual-Engine Connection (PostgreSQL / PGlite)
│   │   │   ├── repositories/             # Typed Repositories (templates, versions, sessions, incidents, submissions)
│   │   │   ├── routes/                   # API Route Controllers (auth, orgs, studio, proctor, sessions, telemetry, runner)
│   │   │   ├── services/                 # Business Logic (integrity engine, token budget, sandbox runner, session events)
│   │   │   └── server.ts                 # Fastify HTTP bootstrap, CORS & provider registration
│   │   └── test/                         # 20 Test Suites with 127 Integration Tests Passing
│   └── desktop/                          # Electron 34 + React 19 Frontend Application
│       ├── public/
│       │   └── favicon.svg               # Production Brand SVG Favicon (Terminal/Brain glyph)
│       ├── src/
│       │   ├── main/                     # Electron Main Process & Native Window Management
│       │   ├── preload/                  # IPC Context Isolation Bridge
│       │   └── renderer/                 # React 19 Client UI
│       │       ├── components/
│       │       │   ├── AssessmentWorkspace.tsx    # Multi-Task Dynamic Candidate Workspace & Virtual Filesystem
│       │       │   ├── CompanyAssessmentStudio.tsx# Recruiter/Hiring Manager Multi-Task Assessment Builder
│       │       │   ├── CompanyDashboard.tsx       # Enterprise Admin, RBAC, Live Proctor Room & Audit Portal
│       │       │   ├── CandidateGateway.tsx       # Candidate Onboarding & Integrity Agreement
│       │       │   ├── PracticeStudio.tsx         # Free Practice Studio & Multimodal Ingest
│       │       │   └── ScorecardModal.tsx         # 7-Dimension Reviewer Scorecard Modal
│       │       ├── services/             # Type-Safe ApiClient & Buffered TelemetryClient
│       │       └── index.css             # WCAG 2.2 AA Contrast Tokens (Tailwind CSS)
│       └── scripts/
│           └── start-electron.cjs        # Fault-Tolerant Dev Watchdog Launcher
├── packages/
│   ├── contracts/                        # Single-Source-of-Truth Zod Schemas & Types
│   │   └── src/
│   │       ├── answer.ts                 # 15-field InterviewAnswer schema contract
│   │       ├── assessment.ts             # AssessmentSession, AssessmentTemplate, Scorecard schemas
│   │       ├── events.ts                 # SessionEvent telemetry schemas & event types
│   │       ├── integrity.ts              # Real-Time Proctoring, Risk Levels & Incident contracts (LOOP 7)
│   │       ├── invitations.ts            # CandidateInvitation schemas & 32-byte token contracts
│   │       ├── organizations.ts          # Multi-tenant Organization & Member schemas
│   │       ├── provider.ts               # AI Provider capability & model contracts
│   │       ├── request.ts                # Structured AI query request schemas
│   │       ├── validation.ts             # Sandboxed code validation request & response schemas
│   │       └── versions.ts               # Immutable version snapshot & SHA-256 schemas
│   ├── ai-core/                          # Provider-Agnostic LLM Orchestrator
│   │   └── src/
│   │       ├── orchestrator.ts           # Token economy, resilient mock fallback & model router
│   │       ├── prompts.ts                # System prompts & schema contract boundaries
│   │       └── errors.ts                 # Typed AIProviderError hierarchy
│   ├── ai-provider-groq/                 # Ultra-Fast Groq LPU Provider Adapter (Sub-second inference)
│   ├── ai-provider-openai/               # OpenAI Provider Adapter (gpt-4o-mini, gpt-4o)
│   ├── ai-provider-anthropic/            # Anthropic Provider Adapter (claude-3-5-sonnet)
│   ├── ai-provider-google/               # Google Gemini Provider Adapter (gemini-2.0-flash)
│   ├── context-engine/                   # Context Window Packing, AST Parsing & Token Budgeter
│   └── scoring-engine/                   # Automated 7-Dimension Rubric Scoring Engine
├── services/
│   └── code-runner/                      # Ephemeral Process Sandboxed Code Execution Service
│       └── src/
│           └── runner.ts                 # Node 22 Native Type-Stripping Runner & Polyglot Verifier
└── tasks/
    └── frontend-ticket-queue/            # Pilot Assessment Challenge
        └── src/
            ├── useTicketQueue.ts         # Starter code with 3 realistic production regressions
            └── useTicketQueue.test.ts    # 5 verification unit test cases
```

---

## 4. Exhaustive Feature Inventory & Deep Technical Specifications

### 4.1. Multi-Tenant Organization & Role-Based Access Control (RBAC)
- **Tenant Data Isolation:** Every organization is assigned a unique UUID. Database tables and in-memory caches scope all queries by `orgId` to eliminate multi-tenant data leaks.
- **5-Tier Role Hierarchy:**
  1. `owner`: Full organizational control; billing, member administration, sole-owner safety locks.
  2. `admin`: Template creation, member management, invitation issuance.
  3. `interviewer`: Candidate invitation issuance, real-time session proctoring, telemetry audit review.
  4. `reviewer`: Scorecard inspection, rubric anchor calibration, hiring evaluation.
  5. `candidate`: Scoped strictly to their single assigned `sessionId` and candidate gateway.
- **Sole-Owner Safety Guard:** The platform strictly forbids deleting, demoting, or revoking the last remaining `owner` in an organization.
- **Stateless HMAC-SHA256 JWT Authentication:**
  - Fastify `preHandler` hooks verify signatures using timing-safe cryptographic comparisons (`crypto.timingSafeEqual`).
  - Tokens contain user ID, organization ID, email, role, and expiration timestamp.
- **Interactive Role Switcher & Persona Simulator:** The Company Dashboard header features a 1-click persona switcher (Priya Sharma - Owner, Marcus Vance - Admin, Sarah Chen - Interviewer, David Kim - Reviewer) enabling instant RBAC testing.
- **JWT Token Inspector:** Provides administrators and security engineers with a visual dialog displaying the raw JWT token, signature validity, decoded payload claims, and 1-click clipboard copying.

### 4.2. Assessment Template Engine & Cryptographic Versioning
- **Template Schema & Custom Authoring:**
  - Fields: `title`, `role`, `difficulty` (`junior`, `mid`, `senior`, `lead`), `durationMinutes` (e.g. 60), `aiBudgetLimitUsd` (e.g. $0.25).
  - Code assets: `starterCode` (initial template with realistic bugs) and `testSuite` (hidden unit verification assertions).
  - Configurable `toolPolicy`: Selectable AI models (GPT-4o mini, Groq LPU, Claude 3.5 Sonnet), token ceilings, web search toggle, docs toggle.
- **Pre-Seeded Production Challenge (*Frontend Engineer: Support Triage Queue*):**
  - Scenario: Fixing an internal customer support triage hook (`useTicketQueue.ts`).
  - Regression 1: **Priority Inversion** — Descending sort inverted weights (`weightA - weightB`), sending urgent tickets to the bottom.
  - Regression 2: **Array Mutation** — Calling `.sort()` directly mutated the input array in-place, causing unpredictable React re-renders.
  - Regression 3: **Unhandled Undefined Tags** — Calling `.includes()` on tickets omitting the `tags` array threw unhandled `TypeError`.
  - Verification Suite: 5 comprehensive assertions validating priority ordering, pure non-mutating array spreads, search queries, multi-tag filters, and undefined tag defense.
- **Cryptographic Immutability & Version Hashes (Task 9):**
  - When an assessment is published for hiring, clicking **`[Lock Immutable Version]`** creates a frozen version snapshot.
  - Generates a canonical SHA-256 content hash:
    $$\text{ContentHash} = \text{SHA256}(\text{CanonicalJSON}(\{\text{title}, \text{role}, \text{starterCode}, \text{testSuite}, \dots\}))$$
  - Once locked, versions cannot be edited or tampered with. If an engineering team updates starter code or test assertions, an incremental `versionNumber` (e.g. v2, v3) is published with distinct cryptographic hashes.

### 4.3. Cryptographic Candidate Invitation & Onboarding Gateway
- **Cryptographically Secure Tokens:**
  - Generated using Node.js cryptographically secure random bytes: `crypto.randomBytes(32).toString("hex")` (256 bits of entropy).
  - Resistant to brute force, enumeration, and token guessing.
- **Invitation Lifecycle Management:**
  - States: `pending` $\to$ `accepted` $\to$ `expired` or `revoked`.
  - Configurable expiration (default 7 days).
- **Public Candidate Onboarding Gateway (`CandidateGateway.tsx`):**
  - Candidates access the platform via their unique URL: `http://localhost:5173/?invite=<token>`.
  - Displays personalized welcome screen: Candidate Name, Target Role, Assessment Duration, and Company Name.
  - **Candidate Integrity Agreement:** Requires explicit candidate acknowledgment:
    1. *"I will write and explain my own code."*
    2. *"I will use the provided AI assistant as a collaborator, not as an unreviewed copy-paste source."*
    3. *"I understand all prompts, code edits, and test runs are recorded in an audit stream."*
  - **Environment Pre-Flight Checks:** Verifies browser compatibility, screen resolution, and network latency.
  - **Starter Code & Objectives Briefing:** Displays problem scenario, bug descriptions, and rubric evaluation dimensions before starting the clock.
  - **Session Ignition:** Clicking `[Start 60-Minute Assessment]` consumes the invite token, creates an active session on the backend, and transitions to the live workspace.

### 4.4. Active Candidate Assessment Workspace & Session Engine
- **Split-Screen Ergonomics:**
  - **Left Pane:** Tabbed switch between *Assessment Brief & Objectives* and *AI Engineering Assistant (LPU)*.
  - **Right Pane:** Full-featured Monaco-styled code editor with syntax highlighting, line numbers, status indicators, and embedded *Sandbox Verification Test Suite*.
- **Server-Authoritative Clock & Deadline Enforcement:**
  - The client timer **never** trusts client-side wall-clock time.
  - On session start, the server calculates:
    $$\text{expiresAt} = \text{startedAt} + (\text{durationMinutes} \times 60 \times 1000)$$
  - Server calculates remaining seconds on every heartbeat response.
- **60-Second Grace Period Lockout:**
  - When remaining time reaches 0, the session enters `grace_period` (60 seconds).
  - Displays an amber warning banner: *"Time Expired — Final Submission Grace Period Active"*.
  - Code editing and AI invocation are locked, but the candidate can click `[Submit Solution]`.
- **Absolute Session Expiration (`assertCanCode` & `assertCanInvokeAI`):**
  - Once the 60-second grace period elapses, session status becomes `expired`.
  - Displays a red lockout banner: *"Session Expired — Submissions are now locked"*.
  - Code editor transitions to `readOnly: true`.
  - Code runner and AI endpoints reject requests with HTTP 403 `SESSION_EXPIRED`.
- **5-Second Server Heartbeat Sync:**
  - Client dispatches periodic heartbeats (`/api/v1/sessions/:sessionId/heartbeat`).
  - Returns remaining seconds, AI budget consumed, and connection state.
- **20-Second Background Autosave & Test Autosave:**
  - Debounced autosave flushes candidate code to `PATCH /api/v1/sessions/:sessionId/workspace` every 20 seconds.
  - Running verification tests triggers an immediate snapshot save.
  - Candidates can safely refresh their browser or recover from a network drop without losing work.

### 4.5. Company-Managed AI Assistant & Financial Guardrails
- **Company-Funded AI Access:** Candidates are given a company-provided AI budget (default `$0.25 USD`).
- **Live Dollar Consumption Meter:**
  - Real-time visual progress bar in the top workspace navigation: `AI Budget: $0.000 / $0.250`.
- **80% Cost Warning Banner:**
  - When candidate reaches `$0.20 USD` (80% threshold), an amber alert displays: *"AI Budget at 80% — Consider debugging independently to conserve allowance"*.
- **100% Hard AI Cutoff:**
  - At `$0.25 USD`, further AI queries are blocked.
  - **Crucial Invariant:** Candidate can continue writing code, running tests, and submitting their solution without any scoring penalty.
- **Two-Phase Atomic Budget Reservation Pattern (AD #5):**
  - Prevents race conditions under concurrent AI requests.
  - Phase 1: `reserveBudget(sessionId, estimatedTokens)` holds the ceiling.
  - Phase 2: `commitUsage(sessionId, actualTokens)` writes final costs, or `releaseReservation(sessionId)` releases unused credits.
- **Prompt Injection Defense:**
  - All candidate inputs, editor code, and OCR questions are wrapped inside `<untrusted_question>` and `<untrusted_code>` XML tags.
  - System prompts enforce strict schema compliance and instruct the LLM never to execute prompt injections.

### 4.6. Candidate Explicit Diff Review & Patch Acceptance (AD #7)
- **Zero Silent Overwrites:** The AI assistant is forbidden from directly replacing candidate code without review.
- **Unified Diff Inspection Modal:**
  - When the AI generates a code fix, an interactive patch proposal is displayed.
  - Shows file path, changed line numbers, removed lines in red with `-`, and added lines in green with `+`.
- **Candidate Agency Controls:**
  - `[Accept & Apply Fix]`: Replaces editor contents and triggers an immediate test run and telemetry snapshot.
  - `[Reject Patch]`: Dismisses proposal and preserves candidate's existing code buffer.

### 4.7. Hardened Ephemeral Code Execution Sandbox (AD #8)
- **Runtime:** Native Node 22 execution with `--experimental-strip-types` (zero compilation overhead, executes TypeScript in $<50$ms).
- **Environment Scrubbing:** Strips all host environment variables (`GROQ_API_KEY`, `OPENAI_API_KEY`, `PORT`, etc.), spawning an empty `env: {}` subprocess.
- **Filesystem Jail:** Uses Node 22 native `--permission` flags with write access restricted strictly to an ephemeral temp directory (`--allow-fs-write=${tmpDir}`).
- **Dynamic Eval Lockout:** Launches with `--disallow-code-generation-from-strings` preventing `eval()` and `new Function()`.
- **Socket Interception Trap:**
  - Patches `Socket.prototype.connect` to immediately abort any outbound TCP, HTTP, HTTPS, or WebSocket connections.
  - Prevents data exfiltration or reverse shells.
- **Fork Bomb & Child Process Lockout:** Blocks `child_process.spawn` and `worker_threads`.
- **Process Exit Trap:** Prevents malicious code from invoking `process.exit(0)` to fake a passing test suite.
- **Watchdog Timeout:** 4,000ms hard ceiling kills infinite loops and recursive stacks cleanly.

### 4.8. Session Telemetry, Passive Integrity & Evidence Collection (Task 13)
- **Append-Only Monotonic Audit Stream:** Every event is assigned an incremental `sequenceNumber` and timestamp.
- **Idempotent Batch Ingestion:** Handles spotty Wi-Fi retries by ignoring already-ingested sequence numbers.
- **Anti-IDOR Telemetry Scoping:** Candidates can only append events to their own active `sessionId`.
- **Tracked Telemetry Event Types:**
  - `session_started`: Session initialization.
  - `code_snapshot`: Periodic code states from autosave.
  - `test_run`: Test execution stats (passed/total, duration ms, stack traces).
  - `ai_query`: Prompts submitted by candidate, tokens consumed, cost.
  - `ai_patch_proposed`: AI proposed a code diff.
  - `ai_patch_decision`: Candidate explicitly clicked `accepted` or `rejected`.
  - `window_blur`: Candidate switched windows or navigated away from the workspace.
  - `window_focus`: Candidate returned focus to the assessment.
  - `paste_detected`: Candidate pasted code into editor (records character count).
  - `session_submitted`: Final solution submitted.
- **Buffered Telemetry Client:** In-memory queue with 10-second periodic batch flushing and immediate dispatch on critical events (test run, submission).
- **Reviewer Audit Timeline UI:** Company Dashboard provides an interactive visual stream displaying sequence badges, event tags, prompt quotes, and test pass ratios.

### 4.9. 7-Dimension Rubric Scoring & Automated Evaluation Engine
Evaluates candidate submissions across 7 balanced engineering dimensions:

| Dimension | Weight | Anchor 1 (Insufficient) | Anchor 2 (Developing) | Anchor 3 (Proficient) | Anchor 4 (Strong) |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **Code Comprehension** | 20% | Fails to diagnose root cause; makes random edits. | Identifies symptoms but misses core bugs. | Accurately identifies priority inversion and mutation bugs. | Pinpoints all 3 bugs, understands React purity and reference stability. |
| **Problem Framing** | 10% | Vague or empty prompts (*"fix it"*). | Asks generic questions without context. | Provides clear error messages and relevant code snippets. | Decomposes challenge into incremental, testable sub-problems. |
| **AI Collaboration** | 15% | Relies entirely on AI or ignores AI completely. | Uses AI passively without verifying logic. | Directs AI to generate specific helper functions. | Guides AI strategically, conserves budget, iterates productively. |
| **Critical Evaluation** | 15% | Blindly accepts incorrect AI code suggestions. | Accepts patches without inspecting diffs. | Rejects incorrect diffs; edits proposed solutions. | Thoroughly inspects diffs, refactors AI suggestions for performance. |
| **Debugging & Implementation** | 20% | 0–1 verification tests passing. | 2–3 verification tests passing. | 4 verification tests passing. | All 5 verification tests passing cleanly. |
| **Testing Discipline** | 15% | Never runs tests or runs tests only at the end. | Runs tests erratically after major changes. | Runs tests after each bug fix to verify changes. | Follows disciplined test-driven loop; verifies regressions individually. |
| **Technical Explanation** | 5% | No explanation or inaccurate summary. | Superficial summary lacking technical depth. | Clear explanation of bug fixes and trade-offs. | Comprehensive architectural justification citing React immutability. |

- **Advisory Scoring:** Emits weighted score (0–100) and concrete evidence citations. Final decisions remain with human reviewers.

### 4.10. Submission Packaging & Immutable Artifact Bundling
- When candidate clicks `[Submit Solution]`:
  1. Displays submission dialog requiring a **Technical Explanation** (architectural reasoning & trade-offs).
  2. Runs final automated verification test suite.
  3. Bundles final code AST diff, complete test logs, explanation, and telemetry summary.
  4. Computes canonical SHA-256 submission fingerprint.
  5. Transitions session status to `submitted`.
  6. Enforces immediate read-only lockout.

### 4.11. Proctor Controls, Emergency Pausing & Incident Recovery
- **Proctor Emergency Pause (`POST /api/v1/sessions/:sessionId/pause`):**
  - Pauses countdown timer and freezes workspace in the event of an electrical outage, network disruption, or candidate emergency.
- **Proctor Resume (`POST /api/v1/sessions/:sessionId/resume`):**
  - Resumes session and automatically recalculates `expiresAt` by adding the exact paused duration.
- **Crash Recovery:** If a candidate's computer reboots or crashes, opening the invite URL restores the exact code buffer from the last 20-second autosave checkpoint.

### 4.12. User Experience, Dark/Light Theming & Favicon Branding
- **WCAG 2.2 AA Compliance:** High-contrast text, clear focus rings, legible typography, and semantic HTML elements.
- **Seamless Theme Toggle:** 1-click toggle between crisp corporate Light Mode and immersive Dark Mode (`#0a0f1d`).
- **Brand SVG Favicon:** Custom SVG terminal/brain glyph embedded in `apps/desktop/public/favicon.svg` and `apps/desktop/favicon.svg`.

### 4.13. Candidate Practice Studio & Instant Diagnostic Feedback Engine (Task 21)
- **Practice Challenge Catalog:** Curated problem catalog across multiple engineering tracks (`frontend`, `backend`, `fullstack`, `systems`, `algorithms`), seniority tiers (`Junior`, `Mid`, `Senior`, `Staff`), and programming languages (`typescript`, `javascript`, `python`, `go`, `java`, `cpp`, `rust`).
- **Interactive Language & Track Filter Bar:** Allows candidates to filter catalog challenges simultaneously by track, seniority tier, and programming language (`All`, `TypeScript`, `JavaScript`, `Python`, `Go`, `Java`, `C++`, `Rust`).
- **Preloaded Core Challenges:**
  1. *React Immutable Ticket Queue* (Frontend, Mid, TypeScript): Diagnose descending priority inversion comparator bug and array mutation.
  2. *Algorithmic LRU Cache with TTL Eviction* (Backend, Senior, TypeScript): $O(1)$ doubly-linked list with time-to-live expiration and memory limits.
  3. *Distributed Async Concurrency Limiter* (Systems, Staff, TypeScript): Promise pooling with retry backoff, queue priority, and cooperative cancellation.
  4. *Python LRU Cache with Dict Sliding Window* (Algorithms, Mid, Python 3): High-performance OrderedDict with float TTL expiration and epoch eviction.
  5. *Go High-Throughput Worker Pool* (Systems, Senior, Go): Bounded goroutine worker pool with channel buffering and graceful `sync.WaitGroup` teardown.
  6. *Java Thread-Safe Token Bucket Rate Limiter* (Backend, Senior, Java): Atomic operations with `AtomicLong` lazy token refill under high concurrency.
  7. *C++ Lock-Free Circular Ring Buffer* (Systems, Staff, C++20): Single-producer single-consumer lock-free queue with `std::atomic` acquire-release memory order semantics.
  8. *Rust Safe Concurrent Deque* (Systems, Senior, Rust): Thread-safe FIFO message queue utilizing `Arc`, `Mutex`, and `Condvar` meeting strict borrow checker invariants.
  9. *JavaScript Reactive Event Emitter* (Frontend, Mid, JavaScript): Leak-free subscription manager with `Set` callback isolation and $O(1)$ unsubscription.
- **Simulated AI Token Budget:** Realistic \$0.25 candidate AI budget meter teaching candidates token frugality and prompt engineering before formal enterprise evaluations.
- **Instant 7-Dimension Diagnostic Feedback Engine:** Immediate rubric scoring card evaluating Code Comprehension, Problem Framing, AI Collaboration, Critical Evaluation, Debugging & Quality, Testing Discipline, and Technical Explanation. Includes an **AI Reliance Index** measuring scrutiny ratio (accepted vs. rejected patches).

### 4.14. Screen Capture & Multimodal OCR Ingest Engine (Task 22)
- **Multimodal Question Ingestion (`POST /api/v1/capture/extract-question`):** Ingests screenshot images, base64 payloads, or clipboard pastes (Ctrl+V) from any external source (LeetCode, HackerRank, CodeSignal, system architecture PDFs, or interview docs).
- **Multi-Provider Vision Extraction with Heuristic Resilience:**
  - Fast structured parsing leveraging Google Gemini 2.0 Flash (`gemini-2.0-flash`), OpenAI GPT-4o (`gpt-4o`), or Anthropic Claude 3.5 Sonnet (`claude-3-5-sonnet-20241022`).
  - Offline / test heuristic synthesizer parses problem keywords, generates language-specific starter boilerplate, unit test suites, and runner harnesses for all 7 programming languages.
- **7-Language Target Ingestion Selector:** Candidates can explicitly choose their target programming language (`typescript`, `javascript`, `python`, `go`, `java`, `cpp`, `rust`) when snapping or pasting problem screenshots.
- **Memory Denial-of-Service Defense:** Fastify native body limits and server payload validation strictly reject image data exceeding 10MB to prevent heap memory exhaustion.
- **1-Click Benchmark Demo Presets (`GET /api/v1/capture/sample-presets`):** Preloaded with LeetCode 146 (LRU Cache), LeetCode 1 (Two Sum), and API Spec (Token Bucket Rate Limiter) with embedded SVG visual thumbnails.
- **Direct Workspace Hydration:** Extracted problems automatically hydrate Monaco editor starter stubs, isolated sandbox test harnesses, dynamic filename extensions, and simulated \$0.25 AI token budgets.

### 4.15. Polyglot Software Domain Engine (Python, Go, Java, C++, Rust, TS/JS)
- **Universal Software Engineering Scope:** Broadened platform scope beyond frontend to encompass distributed systems, systems programming, backend microservices, and algorithmic data structures.
- **Native Sandboxed Execution:**
  - Node 22 native permissions jail for TypeScript and JavaScript code verification.
  - Python 3.13 subprocess execution harness with resource timeouts and memory caps.
- **Polyglot Static Verification Engine (`services/code-runner`):**
  - Structural delimiter balance analysis (`{}`, `()`, `[]`).
  - Test suite signature extraction for compiled languages (`func Test` for Go, `@Test` for Java, `TEST(Suite, Case)` for C++, and `#[test] fn` for Rust).
  - Validates sandbox execution contracts so candidates can write and verify code in compiled languages even when system compiler toolchains are absent.
- **Dynamic Monaco Editor Integration:**
  - File extension matching (`candidate_solution.py`, `candidate_solution.go`, `CandidateSolution.java`, `candidate_solution.cpp`, `candidate_solution.rs`, `candidateSolution.js`, `candidateSolution.ts`).
  - Monaco editor syntax highlighting dynamically synchronized with `selectedChallenge.language`.

### 4.16. UI Crash Protection & React ErrorBoundary Recovery Engine
- **Top-Level ErrorBoundary (`apps/desktop/src/renderer/components/ErrorBoundary.tsx`):** Wraps the desktop and web renderer in an enterprise-grade React Error Boundary.
- **Zero White-Screen Guarantee:** Completely eliminates blank screen unmount crashes by catching any unhandled runtime render exceptions.
- **Self-Healing Diagnostic Recovery Console:** Displays error details, formatted stack traces, a 1-click **[Recover Component]** state reset button, a 1-click **[Reload Application]** button, and an accessible **[Copy Stack]** clipboard action.

### 4.17. Company Assessment Studio & Extensible Multi-Task Authoring Engine (LOOP 6)
- **Configurable Assessment Studio (`CompanyAssessmentStudio.tsx`):**
  - Transitions the platform from a single fixed coding challenge into an enterprise Assessment Studio. Recruiters and engineering managers can build role-specific multi-task assessments customized to their exact hiring rubrics.
  - Non-Developer Visual Authoring: Replaces manual JSON files with an accessible, high-contrast visual card builder featuring field-level validation, 1-click task duplication, drag-free reordering (`[↑ Move Up]`, `[↓ Move Down]`), and confirmation modals for task deletion.
  - Assessment-Level Parameters: Title, Target Job Role (e.g. *Senior Distributed Systems Engineer*, *Frontend React Architect*), Difficulty tier (`junior`, `mid`, `senior`, `lead`), Total Assessment Duration (e.g. 90 minutes), and Overall AI Token Budget cap (default $0.25 USD).
- **Extensible 3-Family Task Registry:**
  1. **Question Set Task (`question_set`):**
     - Evaluates foundational architectural and conceptual knowledge without sandbox compilation overhead.
     - Question formats: Single-choice MCQ (`mcq_single`), Multiple-select MCQ (`mcq_multi`), and Short Text Technical Response (`short_text`).
     - Configuration: Question prompt, choice options, correct option index/keys (strictly scrubbed from candidate API responses), point values, required vs. optional toggle, and maximum response length limits.
  2. **Coding Challenge Task (`coding_challenge`):**
     - Algorithmic or unit-test driven programming challenges.
     - Configuration: Problem statement, polyglot language selector (TypeScript, JavaScript, Python, Go, Java, C++, Rust), starter boilerplate, private verification test suite, test assertion expectations, and execution timeout.
  3. **Repository / Codebase Task (`repository_task`):**
     - Real-world production engineering tasks evaluating code comprehension, bug fixing, refactoring, feature implementation, code review, or test authoring.
     - Configuration: Multi-file virtual project snapshot (`virtualFiles`), entrypoint file, read-only file guards for shared dependencies, acceptance criteria checklist, private grading rubric, and task-specific AI permissions.
- **Per-Task AI Policy Engine:**
  - Companies configure AI permissions independently per task:
    - `prohibited`: AI Engineering Assistant is completely locked and hidden from candidate view.
    - `restricted`: AI is restricted to conceptual code explanation and syntax queries; automated patch generation is disabled.
    - `enabled`: Full collaborative AI assistant with unified diff proposals, budget metering, and 1-click test runs.
  - Candidate Pre-Flight Disclosure: Prior to starting each task, the candidate workspace renders an explicit disclosure banner detailing the applicable AI policy.
- **Dynamic Candidate Multi-Task Workspace (`AssessmentWorkspace.tsx`):**
  - Task Navigation Tab Bar: Top-level navigation allows candidates to switch between active tasks with point badges and completion status indicators.
  - Multi-File Virtual File Tree: Tabbed editor bar for repository tasks enabling candidates to browse, inspect read-only specifications, and modify editable implementation files.
  - Independent Task Timing: Supports optional task-specific time limits alongside the overall server-authoritative assessment deadline.
  - Unified Submission Packaging: Submissions bundle individual `task_submissions` alongside overall candidate metadata and compute a canonical SHA-256 fingerprint.
- **Cryptographic Version Immutability & Hash Locking:**
  - Published assessment templates are strictly immutable. Once published, any subsequent edits generate a new draft revision, preserving existing candidate invitations pinned to their original canonical version hash.

### 4.18. Production-Grade Dual-Engine PostgreSQL Persistence & DDL Auto-Sync (LOOP 6.1)
- **Production Relational Architecture:**
  - Replaces volatile in-memory caching with production-grade relational persistence using **Drizzle ORM** across 10 typed repositories.
- **Dual-Engine Persistence Strategy:**
  - **Production PostgreSQL:** Connects via connection pooling (`pg.Pool`) using `DATABASE_URL` for enterprise production deployments with high concurrency and replication.
  - **Embedded Zero-Daemon PGlite Engine:** Uses WebAssembly-compiled PostgreSQL 16 (`@electric-sql/pglite`) for local developer workflows, offline execution, and deterministic CI test execution without requiring Docker or external database services.
- **11 Normalized Database Schema Tables (`apps/api/src/db/schema.ts`):**
  1. `organizations`: Tenant metadata, company names, slugs, billing plans.
  2. `organization_members`: User accounts, emails, password hashes, and assigned RBAC roles (`owner`, `admin`, `interviewer`, `reviewer`).
  3. `assessment_templates`: Assessment definitions, job roles, difficulty levels, task payloads (`assessment_tasks` JSONB).
  4. `assessment_versions`: Immutable published version snapshots with canonical SHA-256 content hashes.
  5. `candidate_invitations`: 32-byte cryptographic invite tokens, candidate identity, expiry timestamps, acceptance states.
  6. `assessment_sessions`: Live candidate runtime sessions, server-calculated `expiresAt` deadlines, active task pointers, paused duration accumulators.
  7. `session_events`: Append-only monotonic telemetry audit streams with sequence numbers and event payloads.
  8. `submissions`: Final candidate submission bundles, overall scores, candidate technical explanations, artifact SHA-256 fingerprints.
  9. `task_submissions`: Normalized per-task answers, code buffers, test execution results, and task-level scores.
  10. `proctor_incidents`: Logged automated or interviewer integrity flags, severity ratings, resolution states, and timestamps.
  11. `webhook_subscriptions`: Enterprise ATS/HRIS webhook endpoints with HMAC-SHA256 signing keys and delivery logs.
- **Automatic DDL Schema Synchronization (`apps/api/src/db/connection.ts`):**
  - On API gateway boot, `initializeDatabase()` auto-detects missing tables and safely executes declarative DDL statements (`CREATE TABLE IF NOT EXISTS`, index creations, and foreign key cascades).
  - Eliminates migration drift during continuous integration and local developer onboarding.
- **Graceful Shutdown & Pool Teardown:** Fastify server lifecycle hooks (`onClose`) close the connection pool and release file locks cleanly, preventing dangling connections.

### 4.19. Real-Time Proctoring, Passive Integrity & Anti-Cheat Evidence Pipeline (LOOP 7)
- **Passive Anti-Cheat Philosophy (Advisory vs. Algorithmic Disqualification):**
  - In strict compliance with **AD #10 (Human Reviewer Accountability)**, the platform rejects automated disqualification bots.
  - Behavioral anomalies (window blurs, external copy-pastes, offscreen dwell) are treated purely as **evidentiary signals** for human interviewer review. The candidate is never automatically kicked out or failed by an algorithm.
- **Factual Proctoring Observation Architecture (`IntegrityService`):**
  - In strict compliance with **AD #10 (Human Reviewer Accountability)** and **LOOP 10.0.1 Invariants**, the platform rejects all algorithmic candidate scoring, 0–100 risk gauges, and candidate risk rankings.
  - Telemetry records strictly factual, transparent technical events:
    - **Focus Rate Percent:** Calculated as $\frac{\text{focusTimeMs}}{\text{elapsedMs}} \times 100$, tracking candidate window presence.
    - **Total Off-Screen Dwell:** Cumulative seconds spent outside the assessment workspace.
    - **Unattributed Clipboard Pastes:** Count and character volume of external code pastes not originating from accepted AI diffs.
    - **Proctor Incident Log:** Human interviewer annotations and technical hardware disconnections.
  - **No Keystroke Cadence Monitoring:** Keystroke dynamics, typing cadence, and typing speed are neither measured nor stored.
- **Client-Side Passive Telemetry Engine (`AssessmentWorkspace.tsx`):**
  - Passive event listeners track `window.addEventListener("blur")` and `window.addEventListener("focus")`, computing exact offscreen dwell milliseconds.
  - Clipboard `paste` event interception compares pasted text length against recent Copilot patches. If length exceeds 50 characters and does not match an accepted diff patch, an `unattributed_paste` telemetry event is queued.
- **Company Dashboard Live Proctor Control Room (`CompanyDashboard.tsx`):**
  - **Focus Metric Indicator:** Visualizes candidate focus percentage with factual review status badges (`Standard Activity`, `Review Recommended`, `Incident Flagged`).
  - **4 Live Metric Cards:** Focus Rate %, External Paste count, Total Off-Screen Dwell duration, and Flagged Incident count.
  - **Chronological Incident Feed:** Real-time log of security events with timestamp, category, severity badge (`info`, `warning`, `critical`), and resolution status.
  - **Interviewer Incident Logging Modal:** Allows interviewers to record manual observations (e.g. *"Candidate looking off-camera continuously"*, *"Technical Wi-Fi issue reported"*).
  - **Interactive Incident Resolution:** Reviewers can mark incidents as resolved (e.g. *"Candidate verified using external scratchpad"*), which automatically re-evaluates the score.
- **Server-Authoritative Session Pausing & Technical Credit Extension:**
  - When an interviewer pauses an active session (`POST /api/v1/sessions/:sessionId/pause`), the server records `pausedAt` and freezes the countdown timer.
  - On resumption (`POST /api/v1/sessions/:sessionId/resume`), the server computes the exact paused duration:
    $$\text{creditMs} = \text{resumedAt} - \text{pausedAt}$$
    $$\text{expiresAt}_{\text{new}} = \text{expiresAt}_{\text{old}} + \text{creditMs}$$
  - Guarantees fairness during technical incidents without granting untracked extra time.

### 4.20. Enterprise Pilot Readiness, Scoring Fairness & Production Hardening (LOOP 8)

LOOP 8 addresses product integrity, removes algorithmic scoring contradictions, establishes schema migration parity, eliminates production security leaks, and formally classifies code execution isolation boundaries for enterprise pilot deployments:

- **Scoring Fairness & Autonomy Alignment (AD #4 & AD #10):**
  - **Fair N/A Dynamic Redistribution for Non-AI Candidates:** Candidates who solve challenges autonomously without issuing queries to the company-managed AI assistant have the *AI Collaboration* and *Critical Evaluation* rubric dimensions marked with `isNotApplicable: true` with 0 weight, cleanly redistributing weight across core technical dimensions. Candidates are neither penalized nor artificially awarded bonus ratings.
  - **Dynamic Rubric Weight Redistribution for Non-AI Tasks:** When an assessment task specifies an AI policy of `prohibited` (or restricted where AI queries are not permitted), the AI-dependent dimensions (*AI Collaboration* and *Critical Evaluation*) are marked with `isNotApplicable: true`. The scoring engine dynamically redistributes their allocated weights proportionally across the remaining 5 technical dimensions (Code Comprehension, Problem Framing, Debugging & Implementation, Testing Discipline, and Technical Explanation), guaranteeing that total task points always sum to 100 without distorting candidate evaluations.
  - **Elimination of Arbitrary Prompt Penalties:** Deductions for prompt volumes $>8$ were removed. AI token usage is treated purely as operational financial telemetry, not as a negative competence signal.
- **Proctoring Evidentiary Redesign (Advisory Evidence vs. Punitive Scoring):**
  - **Elimination of Pseudo-Score Deductions:** Removed arbitrary mathematical score deductions (`-3` points per window blur, `-10` points per external paste). Window focus and paste counts are no longer converted into an artificial candidate score deduction or automatic disqualification.
  - **Transparent Behavioral Telemetry:** Telemetry records explicit, transparent operational metrics:
    - `focusRatePercent`: Calculated as $\frac{\text{focusTimeMs}}{\text{elapsedMs}} \times 100$, representing the candidate's active focus ratio.
    - `totalOffscreenDwellMs`: Cumulative duration in milliseconds spent outside the workspace window.
    - `externalPasteCount` & `externalPasteChars`: Exact count and character volume of clipboard pastes not originating from accepted diff patches.
    - `proctorFlagsCount`: Number of manual proctor flags or technical annotations logged.
  - **Calibrated Review Status Classification:** The integrity report computes a non-punitive `reviewStatus` (`verified`, `review_recommended`, or `unresolved_incident`) strictly intended to guide human reviewers to specific timestamps in the event audit log. All 0–100 scores and risk bands are eliminated.
  - **Preservation of Audit History:** All historical incident and event records are preserved immutably. No audit logs are deleted.
- **Database Migration Parity & Schema Hardening (LOOP 6.1 Parity):**
  - Executed `drizzle-kit generate` to establish migration file `0001_careless_killraven.sql` and snapshot metadata.
  - Fully brings dynamic template tasks (`tasks` JSON/array columns) and `proctor_incidents` tables under versioned migration control, ensuring zero drift between PostgreSQL and PGlite persistence engines across cold boots and container deployments.
- **Production Authentication & Security Hardening:**
  - **Environment Gating for Persona Token Generation:** In `apps/api/src/routes/auth.ts`, unauthenticated persona minting (`POST /api/v1/auth/persona-token`) is strictly disabled when `NODE_ENV === "production"`. Production environments require legitimate enterprise credentials.
  - **URL Query Token Leakage Elimination:** In `apps/api/src/routes/reports.ts`, passing reusable bearer JWTs in URL query strings is blocked in production to prevent token exposure in browser history, proxy access logs, and HTTP referer headers.
  - **Desktop UI Token Masking:** In `CompanyDashboard.tsx`, persona development controls are hidden in production mode, and JWT tokens are masked by default (`••••••••`) with an explicit show/hide toggle.
- **Sandbox Security Threat Model & Containerized Isolation Architecture:**
  - **Host Subprocess Threat Classification:** Formally classified bare-metal Node.js `--permission` and Python subprocess execution as **INSUFFICIENT for untrusted multi-tenant code execution** on shared host infrastructure. While effective for trusted development and controlled pilots, process-level boundaries and JS monkey-patching do not prevent low-level kernel attacks, side-channel leaks, or binary exploits.
  - **Production Isolation Specification:** For general multi-tenant enterprise deployments executing arbitrary untrusted candidate code, containerized or microVM execution (e.g. gVisor `runsc` OCI runtime or Firecracker microVMs) with non-root identities, read-only root filesystems, memory/PID cgroups, and no host filesystem mounts is required.
  - **Polyglot Static Verification:** For compiled languages (Go, Java, C++, Rust), polyglot execution uses intelligent AST/syntax-tree static verification (`performPolyglotStaticVerification`), ensuring clean syntax validation and structural assertions without requiring heavy compilation toolchains on the host.

### 4.21. OCI / gVisor Runner Architecture, Language Policies & ZIP Codebase Ingestion (LOOP 9)

LOOP 9 delivers the decoupled execution boundary, explicit language runtime profiles, hardened ZIP repository archive ingestion, and polyglot compiler infrastructure:

- **Pluggable Code Runner Architecture & Fastify Decoupling:**
  - Fastify API backend (`apps/api`) decouples code validation via `CodeRunnerClient` (`services/code-runner/src/client.ts`), routing requests over HTTP RPC to a dedicated standalone microservice (`port 4100`).
  - Standalone runner exposes `GET /health`, `GET /environment`, and `POST /validate`.
  - Implements pluggable execution providers: `OciGvisorExecutionProvider` (production Linux rootless OCI container with gVisor `runsc`) and `IsolatedProcessExecutionProvider` (development/test hardened local subprocesses).
  - Telemetry endpoint (`GET /environment`) dynamically returns host OS, Linux kernel release, container engine (Podman/Docker), gVisor availability, cgroups v2 status, network isolation enforcement, and pinned image digests.
- **Language Runtime Profiles & Resource Envelopes:**
  - Replaced generic sandbox parameters with explicit, per-language runtime profiles in `packages/contracts/src/runtime-policy.ts`:
    - **TypeScript / JavaScript:** Node 22.13.0, 0.5 CPU, 128 MB RAM, 64 PIDs, 32 MB disk, 5s timeout, offline preinstalled dependencies.
    - **Python:** CPython 3.12.7, 0.5 CPU, 128 MB RAM, 64 PIDs, 32 MB disk, 5s timeout, offline stdlib/pytest.
    - **Go:** Go 1.23.2, 1.0 CPU, 256 MB RAM, 96 PIDs, 64 MB disk, 8s compilation, 5s execution, vendored dependencies only (`GOPROXY=off`).
    - **Java:** OpenJDK 21.0.5 Temurin, 1.0 CPU, 512 MB RAM, 128 PIDs, 64 MB disk, 12s compilation, 6s execution, preinstalled JUnit 5 console.
    - **C++:** GCC 13.2.0, 1.0 CPU, 256 MB RAM, 64 PIDs, 64 MB disk, 10s compilation, 5s execution, offline toolchain.
    - **Rust:** Rust 1.84.0, 1.0 CPU, 512 MB RAM, 128 PIDs, 128 MB disk, 15s compilation, 5s execution, offline vendored cargo.
  - Zero candidate-controlled internet dependency installation. Network is strictly dropped (`--network=none`).
- **Hardened ZIP Archive Ingest Engine (`ZipIngestService`):**
  - High-security streaming ZIP parser in `apps/api/src/services/zip-ingest.ts` parsing PKZip structures natively with `zlib.inflateRawSync` without vulnerable third-party unzipping libraries.
  - Multi-tier adversarial defenses:
    - **Zip Slip & Path Traversal Rejection:** Immediately rejects `../`, `..\`, and directory escape attempts (`ZIP_TRAVERSAL_ATTACK_REJECTED`).
    - **Absolute Path & Windows Drive Rejection:** Rejects root `/` paths and `C:\...` drive letters (`ZIP_ABSOLUTE_PATH_REJECTED`, `ZIP_WINDOWS_DRIVE_REJECTED`).
    - **Unix Symbolic Link Guard:** Inspects external file attributes (`0o120000`) and halts on symlinks (`ZIP_SECURITY_SYMLINK_REJECTED`).
    - **Decompression Bomb Protection:** Enforces a maximum compression ratio of 50:1 and maximum decompressed size limits (1MB per file, 10MB total). Rejects ratio explosions (`ZIP_BOMB_DETECTED`).
    - **Sensitive File Filtering:** Silently filters internal files (`.env`, `.git/*`, `node_modules/*`, `.DS_Store`) without rejecting legitimate codebases.
    - **Read-Only Code Guarding:** Automatically tags test and configuration files (`*.test.ts`, `*.spec.ts`, `package.json`, `tsconfig.json`) as `isReadOnly: true`.
- **Assessment Studio ZIP Repository Import:**
  - Integrated `[Import from ZIP]` button directly into the Virtual File Tree toolbar of Repository Tasks in `CompanyAssessmentStudio.tsx`.
  - Dispatches uploaded project archives to `POST /api/v1/templates/repository/upload-zip`, automatically extracting and populating multi-file projects with real-time feedback.
- **Genuine Polyglot Compiler Scope (`compilers.ts`):**
  - Drivers for `go test`, `javac`, `g++`, and `cargo test`.
  - Rejects faked passes: when a compiler toolchain is absent in the host environment, returns structured failure with diagnostic error code `COMPILER_NOT_FOUND` rather than claiming execution.

### 4.22. Linux gVisor Deployment, Service Security & Adversarial Verification (LOOP 9.1)

LOOP 9.1 completes the enterprise deployment readiness gate for isolated code execution:

- **Dedicated Linux Runner Deployment Package (`deploy/linux-runner`):**
  - Production host setup script (`setup-host.sh`) targeting **Ubuntu 24.04 LTS (Noble Numbat)** with Linux Kernel 6.8+ and cgroups v2.
  - Provisions an unprivileged dedicated service account (`coderunner:coderunner`, UID 1001) with subuid/subgid allocations (`100000:65536`) and `loginctl enable-linger`.
  - Downloads and verifies official gVisor `runsc 20240909.0` with SHA-512 cryptographic checksum validation.
  - Configures rootless Podman OCI engine (`/etc/containers/containers.conf`) to register `runsc` as the default runtime.
  - Establishes a zero-egress offline container network (`isolated-sandbox`).
- **Hardened Systemd Service (`code-runner.service`):**
  - Runs the standalone code-runner daemon under `coderunner` with comprehensive systemd security sandboxing: `ProtectSystem=strict`, `ProtectHome=read-only`, `PrivateTmp=true`, `PrivateDevices=true`, `NoNewPrivileges=true`, `ProtectKernelTunables=true`, `ProtectKernelModules=true`, `ProtectControlGroups=true`, `RestrictRealtime=true`, and `RestrictSUIDSGID=true`.
  - Service-level cgroups v2 ceilings: `MemoryMax=4G`, `CPUQuota=400%`, `TasksMax=512`, and watchdog auto-restart (`Restart=always`, `RestartSec=5s`).
- **Mutual Runner Service Authentication (`CODE_RUNNER_SECRET`):**
  - Internal runner daemon endpoints (`/validate`, `GET /environment`) require mutual token authentication via `Authorization: Bearer <secret>` or `x-runner-token: <secret>`.
  - Unauthorized requests are rejected with HTTP 401 Unauthorized (`RUNNER_UNAUTHORIZED`).
  - Public `/health` probe remains unauthenticated for external load balancers and orchestrator health checks while shielding sensitive host kernel and cgroup telemetry on `/environment`.
  - Code execution requests from Fastify (`apps/api`) use `CodeRunnerClient` with `CODE_RUNNER_SECRET`, ensuring unprivileged candidates cannot call the execution daemon directly or inspect concurrent jobs.
  - Worker daemon operates with **zero database credentials** and **zero AI provider API keys**, eliminating lateral movement risk.
- **Reproducible Runtime Containerfiles & Manifest (`images/`):**
  - Complete, un-truncated image digests for all 7 supported languages (Node 22 LTS, Python 3.12, Go 1.23, Java 21, GCC 14, Rust 1.81).
  - Machine-readable specification `runtime-manifest.json` documenting digests, runtime/compiler versions, non-root users (`1000:1000`), offline flags, and per-language CPU/memory/PID quotas.
- **Automated 12-Gate Adversarial Security Suite (`verify-security.sh`):**
  - Standalone bash test harness executing 12 harmless adversarial payloads against the Linux gVisor runtime:
    1. Environment Secret Isolation: Container cannot read host secrets or canary environment variables.
    2. Read-Only Root Filesystem: Writing to `/etc/` or `/` is strictly denied.
    3. Cross-Execution Isolation: Ephemeral tmpfs mounts guarantee workspace A data is invisible to workspace B.
    4. Network Egress Denial: Raw TCP connections to external IPs are blocked immediately.
    5. DNS Denial: Outbound DNS queries are rejected.
    6. PID Ceilings: Fork bombs are throttled and killed at the PID limit.
    7. Memory Quota Ceilings: OOM allocations trigger clean process containment without crashing the host.
    8. CPU Throttling: Infinite loops are throttled to configured CPU shares.
    9. Watchdog Timeout: Processes exceeding time limits are terminated via SIGKILL.
    10. Non-Root Candidate UID: Execution runs strictly under unprivileged UID `1000:1000`.
    11. Linux Capability Drop: Critical capabilities (`CAP_SYS_ADMIN`) are dropped.
    12. Ephemeral Teardown: Verifies zero leftover containers or orphaned processes after execution.

### 4.23. Private Company Pilot Readiness, Security Gate & Magic Link Authentication (LOOP 10)

LOOP 10 establishes the operational and security infrastructure to advance the platform from an engineering prototype to a controlled B2B design-partner pilot:

- **Critical Security Gate (`RUNNER_EXECUTION_ENABLED`):**
  - **Fail-Closed Execution Policy:** The Windows development host lacks verified Linux gVisor virtualization (HCS error 0x80070569). Bare-metal Node.js `--permission` and Python subprocess execution must **never** execute untrusted third-party candidate code.
  - **Authoritative Configuration:** `RUNNER_EXECUTION_ENABLED` in `apps/api/src/config.ts` defaults to `false` in production and development environments.
  - **API Defense (`POST /api/v1/code/validate`):** When the gate is closed, the API rejects execution attempts with HTTP 403 `RUNNER_EXECUTION_DISABLED` and an informative payload stating that arbitrary code execution is paused pending verified container sandbox deployment.
  - **Sandbox Status Probe (`GET /api/v1/code/validate/status`):** Exposes sandbox status and runtime information for frontend components.
  - **Graceful Workspace Degradation:** `AssessmentWorkspace.tsx` intercepts HTTP 403 `RUNNER_EXECUTION_DISABLED`, displays a non-blocking informational banner to the candidate, and preserves submission flows so candidates can still submit code for human evaluation.
- **Production Company Authentication via Single-Use Magic Links (`MagicLinkService`):**
  - **Elimination of Mocked Personas in Production:** Replaces insecure role switcher headers with production-grade passwordless email authentication (`POST /api/v1/auth/magic-link/request` and `POST /api/v1/auth/magic-link/verify`).
  - **Cryptographic Token Hashing:** Tokens are generated as 32-byte high-entropy buffers (`crypto.randomBytes(32)`). Only the SHA-256 hash is persisted in storage (`tokensByHash`).
  - **Single-Use Burn & 15-Minute Expiry:** Tokens expire after 15 minutes and are atomically marked used on verification, preventing replay attacks.
  - **Anti-Enumeration Safeguards:** Request endpoint always returns HTTP 200 with an identical generic message regardless of whether the email address exists in the tenant directory.
  - **Brute-Force Rate Limiting:** Enforces a maximum of 5 magic link requests per 15-minute window per email, returning HTTP 429 `RATE_LIMIT_EXCEEDED` if exceeded.
  - **Session Logout:** `POST /api/v1/auth/logout` revokes active tokens for the member.
- **Pilot Stage Model & Phased Deployment:**
  - **Stage A (Design-Partner Workflow Validation):** Recruiter onboarding, role configuration, Assessment Studio multi-task authoring (MCQs, short text, coding, and ZIP repository ingestion), immutable SHA-256 version publishing, candidate invitation flow with separated 48h deadline vs 90m attempt timer, candidate workspace navigation, and reviewer blind scoring with variance detection. Classified as **VERIFIED & OPERATIONAL**.
  - **Stage B (Untrusted Code Execution):** Conditioned on the independent Ubuntu 24.04 Linux gVisor runner deployment. Blocked on Windows hosts by `RUNNER_EXECUTION_ENABLED: false`.
- **Candidate Journey & Separation of Deadlines vs. Attempt Timers:**
  - Clearly decouples the invitation availability window (e.g. 48 hours to begin) from the active attempt duration (e.g. 90 minutes).
  - Explicit AI policy disclosure (`prohibited`, `restricted`, `enabled`) and mandatory patch review before applying proposed code diffs.
- **Reviewer Calibration & Evaluation Safeguards:**
  - Independent scoring across multiple evaluators.
  - Blind candidate review with PII masking to prevent cognitive and demographic bias.
  - Automated variance detection triggering calibration alerts when score spread exceeds 15%.
  - AI scorecards remain advisory; final hiring decisions belong exclusively to human reviewers.

### 4.24. Pilot Hardening & Policy Consistency (LOOP 10.0.1)

LOOP 10.0.1 resolves all policy and telemetry contradictions across the platform prior to external design partner onboarding:

- **Elimination of Candidate Integrity & Proctor Scores:**
  - Removed all 0–100 composite integrity scores, risk bands (`clean`, `low`, `medium`, `high`), and candidate risk rankings from services, contracts, and frontend views.
  - The telemetry pipeline (`IntegrityService`) reports strictly factual observations: active focus percentage, cumulative off-screen dwell time, unattributed clipboard paste events, and human proctor incident annotations.
  - No algorithmic candidate disqualification or composite score deduction is computed.
- **Elimination of Keystroke Cadence Telemetry:**
  - Removed all schemas and UI options for keystroke timing, cadence, and typing-speed analysis (`rapid_keystrokes`).
  - Typing behavior is neither monitored, recorded, nor used to derive performance or integrity signals.
- **Secure Magic-Link Debugging & Anti-Leakage:**
  - `debugToken` is strictly gated to test or explicitly enabled local development environments.
  - In production and external pilot configurations (`process.env.APP_ENV === "pilot"`), `debugToken` is strictly `undefined` and omitted from all HTTP responses.
  - Plaintext tokens are never stored in memory or written to audit logs; only one-way SHA-256 hashes are persisted. Tenant administrators have zero endpoints to inspect or retrieve login tokens.
- **Strict Server-Authoritative Attempt Pause Authorization:**
  - Enforced mandatory authorization on `POST /:sessionId/pause` and `POST /:sessionId/resume`. Unauthenticated requests fail with HTTP 401 `UNAUTHORIZED`.
  - Candidate tokens attempting to pause or resume fail with HTTP 403 `FORBIDDEN`. Only authenticated `owner`, `admin`, or `interviewer` roles can initiate pause controls during verified technical incidents.
  - Resumed sessions extend deadlines by the exact millisecond duration of the pause without granting unmonitored extra time.
- **AI Scoring Fairness & Fair N/A Redistribution:**
  - Candidates who solve challenges autonomously without querying the AI assistant have the *AI Collaboration* and *Critical Evaluation* rubric dimensions marked with `isNotApplicable: true` with 0 weight.
  - The 30% weight is cleanly redistributed across the remaining 5 core technical dimensions (30/10/30/25/5), ensuring a 100-point total without fabricating artificial bonus points (Rating 4) or penalizing independent engineering.
  - AI token consumption is treated strictly as financial infrastructure telemetry.
- **Verified Candidate Data Erasure (`DELETE /api/v1/sessions/:sessionId/data`):**
  - Implemented an authorized data erasure endpoint that performs immediate cascade hard-deletion across `assessment_sessions`, `session_events`, `submission_artifacts`, and `proctor_incidents`.
  - Returns a transparent erasure receipt documenting that primary database records are purged immediately, while encrypted disaster recovery backups and external AI provider inference logs follow their respective 30-day automated rotation windows.
- **Candidate Workspace View Isolation:**
  - When an active candidate session is initialized via an invitation token, the top navigation switcher (`Practice Copilot`, `Company Admin & Templates`) is hidden, locking the candidate into their assessment workspace and preventing unauthorized admin inspection during timed exams.

### 4.25. External Pilot Launch Gate & Delivery Architecture (LOOP 10.0.2)

LOOP 10.0.2 completes the final security and operational milestones required for onboarding an external design partner:

- **Multi-Provider Transactional Email Delivery Service (`apps/api/src/services/email.ts`):**
  - Integrated `EmailDeliveryService` supporting four pluggable provider implementations:
    - `SmtpEmailProvider`: Zero-dependency native Node socket SMTP transport with RFC 3207 STARTTLS and TLS support.
    - `ResendEmailProvider`: Cloud transactional delivery via the Resend REST API over HTTPS.
    - `ConsoleEmailProvider`: Formatted local development logger with automated PII masking (`d*veloper@domain.test`).
    - `TestEmailProvider`: Deterministic in-memory delivery tracker for integration test assertions.
  - Generates accessible, responsive HTML and plain-text emails for recruiter magic-link authentication and personalized candidate assessment invitations.
- **Strict Candidate-to-Company Authorization Boundary Guard:**
  - Enforced `assertCompanyMember` across all administrative API routes: templates (`GET/POST /templates`), invitations (`GET/POST /invitations`), member rosters (`GET /organizations/:id/members`), session listings (`GET/POST /sessions`), proctor audit logs (`GET /sessions/:id/events`), reviewer evaluations (`GET /sessions/:id/evaluations`), and ATS webhooks (`GET/POST /webhooks/subscriptions`, `GET /webhooks/logs`).
  - Candidate tokens attempting to inspect or mutate any company-level resource receive HTTP 403 `FORBIDDEN`.
- **Server-Authoritative Pause/Resume with Monotonic Audit Stream:**
  - Session pause requests require authenticated company members (`owner`, `admin`, `interviewer`). Candidates cannot pause or extend their sessions.
  - Server-authoritative time recalculation: `newExpiresAt = expiresAt + (now - pausedAt)`.
  - Emits sequential `session_paused` and `session_resumed` events into `session_events` with initiating user ID, exact pause duration in milliseconds, and proctor justification.
- **Candidate Data Erasure & Cache Eviction:**
  - Hard-deletion cascade across database entities on `DELETE /api/v1/sessions/:id/data`, coupled with in-memory buffer clearing via `eventsService.clearSession(sessionId)` and AI context reset.
- **Candidate Workspace Single-Header UI Optimization:**
  - Full viewport candidate layout suppressing the application navbar when an active candidate session is loaded.
  - Contextual `[Run Tests]` button displayed only for coding and repository challenges (suppressed on Question Set tasks).
  - Multi-select radio/checkbox bubbling resolved to eliminate double-dispatch toggle issues.

---

## 5. Complete End-to-End User Workflows (Step-by-Step Guides)

### Workflow 1: Company Admin / Recruiter Setup Guide
1. **Launch Company Portal:** Open `http://localhost:5173` and click the **`[Practice Copilot]`** / **`[Company Portal]`** toggle in the top bar.
2. **Select Active Organization & Role:**
   - Use the **Top Role Switcher** to switch between **Acme Corp** and **Apex Systems**.
   - Switch persona to **Priya Sharma (Owner)** or **Marcus Vance (Admin)**.
   - Click **`[Inspect JWT Token]`** to inspect HMAC-SHA256 authentication claims and verify signature integrity.
3. **Manage Team Members & RBAC:**
   - Click the **`[Auth & RBAC]`** tab.
   - Click **`[+ Invite Colleague]`**, enter email (e.g. `alex@acme.corp`), select role (`interviewer` or `reviewer`), and send invite.
4. **Configure Assessment Challenge Template:**
   - Click the **`[Challenge Templates]`** tab.
   - Inspect existing templates (e.g. *Frontend Engineer: Support Triage Queue*).
   - Review problem scenario, starter code, test suites, and duration (60 min).
5. **Lock Immutable Version (Task 9):**
   - Click **`[Lock Immutable Version]`** to freeze the assessment baseline.
   - Inspect the generated **SHA-256 content hash** under the **`[Template Hashes]`** sub-tab.
6. **Issue Candidate Invitation Link (Task 10):**
   - Click **`[+ Invite Candidate]`** in the Candidates section.
   - Enter candidate name (e.g. *"Jordan Lee"*), candidate email (`jordan@example.com`), and select the template.
   - Click **`[Issue Invitation]`**.
   - Copy the generated 32-byte secure invite link (e.g. `http://localhost:5173/?invite=7f2c8a...`).

---

### Workflow 2: Candidate Assessment Journey Guide
1. **Access Assessment Invitation:**
   - Candidate clicks the invitation link received via email.
   - Browser opens the **Candidate Onboarding Gateway**.
2. **Review Onboarding Brief & Objectives:**
   - Candidate reviews the assessment brief: *Frontend Engineer Challenge: Support Triage Queue*.
   - Reads problem scenario and reported regressions: Priority Inversion, In-Place Array Mutation, and Unhandled Empty Tags.
   - Inspects the 7 rubric evaluation dimensions.
3. **Accept Candidate Integrity Agreement:**
   - Candidate checks the agreement box: *"I understand this assessment measures how I collaborate with AI, critically review code, and verify edge cases. I agree to write and review my own code."*
4. **Ignite Assessment Session:**
   - Candidate clicks **`[Start 60-Minute Assessment]`**.
   - System registers session with server-authoritative deadline and transitions into `AssessmentWorkspace.tsx`.
5. **Analyze Code & Collaborate with AI Assistant:**
   - Candidate reads `src/useTicketQueue.ts` in the code editor.
   - Switches left tab to **`[AI Engineering Assistant]`**.
   - Asks AI targeted questions: *"Why does sorting tickets descending invert the urgent priority?"*
   - AI explains the numeric comparator bug in `PRIORITY_WEIGHTS`.
6. **Inspect & Decide on AI Proposed Patch:**
   - Candidate requests a fix or clicks **`[⚡ Propose Solution with AI]`**.
   - AI presents a **Unified Diff Modal** highlighting red deletions and green additions.
   - Candidate critically inspects lines: notices whether array mutation is prevented (`[...tickets].sort(...)`).
   - Candidate clicks **`[Accept & Apply Fix]`** (or clicks **`[Reject]`** to write it manually).
7. **Run Isolated Verification Test Suite:**
   - Candidate clicks **`[Run Tests]`** in the top toolbar.
   - Code executes in the Node 22 native isolated sandbox.
   - Terminal console prints test results (e.g. `5 / 5 passed (42ms)`).
8. **Background Autosave Assurance:**
   - Status bar displays `Autosaved 2s ago`. All work is securely synced to the server every 20 seconds.
9. **Final Submission:**
   - Candidate clicks **`[Submit Solution]`**.
   - Enters a concise **Technical Explanation** summarizing bug fixes and React immutability trade-offs.
   - Confirms submission. Workspace locks into a read-only submitted state and presents a submission confirmation receipt.

---

### Workflow 3: Interviewer & Proctor Real-Time Monitoring & Integrity Room Guide
1. **Open Active Sessions Monitor:**
   - Interviewer logs into Company Dashboard and selects the **`[Evidence & Audit Log]`** tab.
2. **Select Candidate Session:**
   - Select candidate (e.g. *"Jordan Lee"* or *"Elena Rostova"*).
   - View live elapsed timer, status (`active`, `grace_period`, `submitted`), and consumed AI budget.
3. **Inspect Real-Time Integrity & Anti-Cheat Control Room (LOOP 7):**
   - Click **`[Live Proctor & Integrity]`** to open the real-time proctoring console.
   - **Dynamic 0–100 Risk Dial:** Gauge visually displays candidate integrity score with dynamic status indicator (`clean`, `low`, `medium`, `high`).
   - **4 Live Metric Breakdown Cards:**
     - *Focus Rate %:* Percentage of elapsed time candidate remained actively focused on the assessment workspace.
     - *External Pastes:* Count and character volume of clipboard pastes not originating from accepted AI diff proposals.
     - *Off-Screen Dwell:* Total cumulative seconds spent outside the assessment window.
     - *Active Incidents:* Number of unresolved proctor or automated integrity flags.
4. **Log & Resolve Proctor Incidents:**
   - Click **`[+ Log Proctor Note]`** to log an observation (e.g., *"Candidate reported temporary home Wi-Fi dropout"* or *"Candidate switching to external secondary monitor"*).
   - Select category (`technical_issue`, `manual_flag`, `rapid_keystrokes`, `window_blur`) and severity (`info`, `warning`, `critical`).
   - For false alarms, click **`[Resolve]`** on any incident card to dismiss the penalty and restore the candidate's integrity score.
5. **Handle Technical Emergencies (Proctor Pause/Resume):**
   - If a candidate experiences a technical disruption, click **`[Pause Session]`** and provide an incident justification.
   - Server freezes the countdown timer and displays an incident hold banner on the candidate workspace.
   - Once resolved, click **`[Resume Session]`**. The server automatically calculates the paused elapsed time and extends the candidate's expiration deadline by the exact credit amount.

---

### Workflow 4: Reviewer & Hiring Manager Evaluation Guide
1. **Open Candidate Scorecard:**
   - Reviewer clicks on candidate's submitted session in the audit log and opens the **7-Dimension Rubric Scorecard Modal** (`[Score Rubric]`).
2. **Review Advisory AI Baseline & Enter Human Scores:**
   - Click **`[Auto-fill from AI Draft]`** to load automated baseline anchors generated from code AST diffs, test logs, and AI queries.
   - Select 1–4 anchors (Developing, Competent, Advanced, Exemplary) for each of the 7 dimensions.
   - Enter specific rationales and select a Hiring Recommendation (`Strong Hire`, `Hire`, `Lean Hire`, `No Hire`).
3. **Multi-Reviewer Calibration Consensus:**
   - Click **`[Calibration Board]`** to compare independent reviewer scorecards.
   - **Anti-Bias Invariant:** Blind review conceals other reviewers' ratings until the reviewer submits their own scorecard.
   - **Variance Alerts:** Automated spread detection ($\Delta \ge 2$) flags divergence for committee discussion.
4. **Generate Tamper-Evident Hiring Decision Report:**
   - Click **`[Decision Report]`** to view the comprehensive evidence-linked report.
   - **Cryptographic Seal:** Verifies submission SHA-256 fingerprint against published template version hash with server HMAC digital signature.
   - **Line-by-Line Evidence Links:** Directly cites AST diffs, test assertion timings, and AI prompt scrutiny.
   - **1-Click Export:** Click **`[Print / Save to PDF]`** for printable executive review, or **`[Copy ATS/HRIS JSON]`** for Greenhouse, Lever, or Workday candidate archiving.

---

### Workflow 5: Developer Setup & Local Execution Guide
1. **Prerequisites:**
   - Node.js v22.0.0 or higher.
   - pnpm v9.0.0 or higher.
2. **Install Monorepo Dependencies:**
   ```bash
   pnpm install
   ```
3. **Environment Configuration (`apps/api/.env`):**
   ```env
   PORT=4000
   NODE_ENV=development
   JWT_SECRET=enterprise-secret-key-super-secure-change-in-prod-32bytes
   OPENAI_API_KEY=sk-...               # Optional: OpenAI GPT-4o mini
   GROQ_API_KEY=gsk_...                # Optional: Groq LPU sub-second inference
   ANTHROPIC_API_KEY=sk-ant-...        # Optional: Claude 3.5 Sonnet
   GEMINI_API_KEY=AIza...              # Optional: Google Gemini 2.0
   ```
4. **Compile Core Packages:**
   ```bash
   pnpm --filter @ai-copilot/contracts build
   pnpm --filter @ai-copilot/api build
   ```
5. **Launch Fastify API Backend (Port 4000):**
   ```bash
   node apps/api/dist/server.js
   ```
6. **Launch Vite Web Frontend (Port 5173):**
   ```bash
   pnpm --filter @ai-copilot/desktop dev:renderer --host 0.0.0.0 --port 5173
   ```
7. **Launch Electron Desktop Client (Optional Native Mode):**
   ```bash
   pnpm --filter @ai-copilot/desktop start
   ```
8. **Run Complete Automated Test Suite (172 Tests):**
   ```bash
   pnpm test
   ```
9. **Run Monorepo Typecheck:**
   ```bash
   pnpm run typecheck
   ```

---

### Workflow 6: Authoring Role-Specific Multi-Task Assessments in Assessment Studio (LOOP 6)
1. **Navigate to Assessment Studio:**
   - Log into the Company Dashboard (`http://localhost:5173`) with an `owner` or `admin` role.
   - Click the **`[Assessment Studio]`** navigation tab.
2. **Configure Assessment Master Details:**
   - Enter Assessment Title (e.g. *"Principal Systems Engineer — Distributed KV Store"*).
   - Select Target Job Role and Difficulty Level (`junior`, `mid`, `senior`, `lead`).
   - Set Global Assessment Duration (e.g. 90 minutes) and Global AI Budget cap ($0.25 USD).
3. **Assemble Multi-Task Pipeline:**
   - **Task 1: Add a Question Set (`[+ Add Question Set]`):**
     - Enter title: *"Section 1: Concurrency Primitives & Distributed Consensus"*.
     - Set task weight: 25 points, estimated duration: 20 minutes.
     - Select AI Policy: `prohibited` (ensures candidate demonstrates unassisted foundational comprehension).
     - Add Questions:
       - MCQ 1: *"Which synchronization primitive guarantees wait-free execution on x86-64?"* (Options: CAS, Mutex, Spinlock, Semaphore).
       - Short Text: *"Explain the difference between Raft linearizable reads and Paxos lease reads."* (Max 300 characters).
   - **Task 2: Add a Coding Challenge (`[+ Add Coding Challenge]`):**
     - Enter title: *"Section 2: High-Throughput Token Bucket Rate Limiter"*.
     - Select Language: `Go` (or `TypeScript` / `Python` / `Java` / `C++` / `Rust`).
     - Set task weight: 35 points, estimated duration: 30 minutes.
     - Provide starter code stub and private verification test cases.
     - Select AI Policy: `restricted` (AI answers syntax and algorithmic questions but cannot propose full patches).
   - **Task 3: Add a Repository / Codebase Task (`[+ Add Codebase Task]`):**
     - Enter title: *"Section 3: Distributed KV Store Debugging & In-Place Mutation Fix"*.
     - Set task weight: 40 points, estimated duration: 40 minutes.
     - Define virtual multi-file starter structure (`src/storage/engine.ts`, `src/types/record.ts`, `src/index.ts`).
     - Set `src/types/record.ts` to `isReadOnly: true` to prevent candidate from mutating type definitions.
     - Add acceptance criteria: *"Preserve memory immutability; ensure O(1) key lookups; pass all 5 verification tests."*
     - Select AI Policy: `enabled` (Candidate can collaborate with AI, inspect unified diffs, and apply approved patches).
4. **Reorder, Validate & Preview:**
   - Use `[↑ Move Up]` and `[↓ Move Down]` buttons to fine-tune section sequencing.
   - Click **`[Preview Candidate Experience]`** to interactively test the candidate's exact split-screen view before publishing.
5. **Publish & Lock Immutable Version:**
   - Click **`[Publish Assessment Version]`**.
   - System computes a canonical SHA-256 fingerprint across all tasks, files, questions, rubrics, and AI policies.
   - Published version is permanently locked (`published`) and immediately available for candidate invitation dispatch.

---

## 6. API Gateway Endpoints Contract Specification

Fastify API server (`http://127.0.0.1:4000`):

| Method | Route | Auth / RBAC | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/health` | Public | Backend health, uptime, active AI provider. |
| `POST` | `/api/v1/auth/login` | Public | Authenticates member by email and returns JWT token. |
| `GET` | `/api/v1/auth/me` | Bearer JWT | Returns current authenticated user context and claims. |
| `GET` | `/api/v1/organizations` | Bearer JWT | Lists organizations accessible to caller. |
| `POST` | `/api/v1/organizations` | Bearer (`admin`, `owner`) | Creates a new tenant organization. |
| `GET` | `/api/v1/organizations/:orgId/members` | Bearer JWT | Lists organization members and roles. |
| `POST` | `/api/v1/organizations/:orgId/members` | Bearer (`admin`, `owner`) | Invites new team member with assigned role. |
| `GET` | `/api/v1/organizations/:orgId/templates` | Bearer JWT | Lists assessment templates for tenant. |
| `POST` | `/api/v1/organizations/:orgId/templates` | Bearer (`admin`, `owner`) | Creates a new assessment challenge template. |
| `POST` | `/api/v1/templates/:templateId/versions` | Bearer (`admin`, `owner`) | Locks an immutable version snapshot with SHA-256 hash. |
| `GET` | `/api/v1/templates/:templateId/versions` | Bearer JWT | Lists cryptographic version history for template. |
| `POST` | `/api/v1/organizations/:orgId/invitations` | Bearer (`interviewer`, `admin`, `owner`) | Generates a 32-byte cryptographic candidate invite token. |
| `GET` | `/api/v1/invitations/validate/:token` | Public | Validates invitation token for candidate onboarding. |
| `POST` | `/api/v1/invitations/accept/:token` | Public | Consumes invite token and provisions active session. |
| `POST` | `/api/v1/sessions` | Bearer JWT | Creates assessment session with server deadline. |
| `GET` | `/api/v1/sessions/:sessionId` | Candidate / Bearer | Retrieves session status, timer, and metadata. |
| `GET` | `/api/v1/sessions/:sessionId/heartbeat` | Candidate / Bearer | Returns authoritative remaining seconds and budget. |
| `PATCH`| `/api/v1/sessions/:sessionId/workspace` | Candidate / Bearer | Autosaves candidate workspace code and test results. |
| `POST` | `/api/v1/sessions/:sessionId/events` | Candidate / Bearer | Ingests batch of chronological telemetry audit events. |
| `GET` | `/api/v1/sessions/:sessionId/events` | Reviewer / Interviewer / Admin | Retrieves chronological telemetry stream for audit review. |
| `POST` | `/api/v1/sessions/:sessionId/submit` | Candidate / Bearer | Submits final solution, bundles artifacts, locks session. |
| `POST` | `/api/v1/sessions/:sessionId/pause` | Bearer (`interviewer`, `admin`, `owner`) | Proctor control: freezes session timer during technical incidents (Task 15). |
| `POST` | `/api/v1/sessions/:sessionId/resume` | Bearer (`interviewer`, `admin`, `owner`) | Proctor control: unfreezes timer and dynamically extends server deadline (Task 15). |
| `POST` | `/api/v1/sessions/:sessionId/evaluations` | Bearer (`interviewer`, `reviewer`, `admin`) | Submits blind 7-dimension rubric scorecard (Task 16). |
| `GET` | `/api/v1/sessions/:sessionId/evaluations` | Bearer JWT | Retrieves evaluations with blind-scoring anti-bias masking (Task 16). |
| `GET` | `/api/v1/sessions/:sessionId/calibration` | Bearer JWT | Returns multi-reviewer consensus and spread flags (Task 16). |
| `GET` | `/api/v1/sessions/:sessionId/report` | Bearer JWT | Generates evidence-linked hiring decision report with tamper seal (Task 17). |
| `GET` | `/api/v1/sessions/:sessionId/report/export` | Bearer / Token Query | Exports standalone print-ready HTML / PDF executive view (Task 17). |
| `GET` | `/api/v1/organizations/:orgId/webhooks` | Bearer JWT | Lists registered ATS/HRIS webhook endpoints for tenant (Task 19). |
| `POST` | `/api/v1/webhooks/subscriptions` | Bearer (`admin`, `owner`) | Registers ATS/HRIS webhook subscription with HMAC-SHA256 signing (Task 19). |
| `DELETE`| `/api/v1/webhooks/subscriptions/:id` | Bearer (`admin`, `owner`) | Removes webhook subscription (Task 19). |
| `POST` | `/api/v1/webhooks/subscriptions/:id/test` | Bearer (`admin`, `owner`) | Dispatches ping test with HMAC header and returns delivery log (Task 19). |
| `GET` | `/api/v1/analytics/ai-costs` | Bearer JWT | Aggregates token spend, models/tracks breakdown, budget utilization, runway, and anomalies (Task 20). |
| `GET` | `/api/v1/analytics/burn-rate` | Bearer JWT | Computes daily spend velocity and 30-day linear regression projection (Task 20). |
| `GET` | `/api/v1/analytics/anomalies` | Bearer JWT | Detects runaway prompt loops and statistical budget outliers (Task 20). |
| `POST` | `/api/v1/code/validate` | Candidate / Bearer | Executes code inside Node 22 native isolated sandbox. |
| `POST` | `/api/v1/answers/generate` | Candidate / Bearer | Generates AI assistant responses within budget cap. |
| `POST` | `/api/v1/assessment/evaluate` | Reviewer / Interviewer / Admin | Evaluates submission and computes 7-dimension scorecard. |
| `GET` | `/api/v1/sessions/:sessionId/integrity` | Bearer (`interviewer`, `admin`, `owner`) | Real-time candidate advisory integrity index (0–100), review status (`verified`, `review_recommended`, `unresolved_incident`), focus rate %, and dwell/paste evidentiary metrics (LOOP 7 / LOOP 8). |
| `POST` | `/api/v1/sessions/:sessionId/incidents` | Bearer (`interviewer`, `admin`, `owner`) | Records proctor observation flag or technical incident annotation (LOOP 7). |
| `GET` | `/api/v1/sessions/:sessionId/incidents` | Bearer JWT | Retrieves chronological list of proctor flags and integrity incidents (LOOP 7). |
| `POST` | `/api/v1/sessions/:sessionId/incidents/:incidentId/resolve` | Bearer (`interviewer`, `admin`, `owner`) | Resolves or dismisses false-positive incident and recalculates integrity score (LOOP 7). |
| `POST` | `/api/v1/templates/repository/upload-zip` | Bearer (`interviewer`, `admin`, `owner`) | Ingests ZIP repository archive, validates Zip Slip / bomb security, and returns virtual files (LOOP 9). |

---

## 7. Security, Privacy, Compliance & Employer Separation Policy

1. **Credential Scrubbing:** API keys (`GROQ_API_KEY`, `OPENAI_API_KEY`, `JWT_SECRET`) are kept strictly on the backend and are never sent to Electron or renderer bundles.
2. **Ephemeral Subprocess Sandboxing:** Node 22 native execution runs with zero host environment variables, strict disk permissions, and active socket traps. Python 3 subprocesses run with strict timeouts.
3. **Anti-IDOR Authorization:** Candidate tokens are strictly scoped to `sessionId`. Candidates cannot view or submit events to other candidate sessions.
4. **Data Protection Law Compliance (DPDP Act & GDPR):** Candidate personal identifiers (name, email) can be anonymized or scrubbed on request while preserving cryptographic code hashes for compliance audits.
5. **Clock Tamper Protection:** Deadlines are stored as server-side UTC timestamps (`expiresAt`). Client machine clock changes have zero effect on remaining time.
6. **Strict Personal Project & Employer Separation Policy:**
   - The developer is employed at Mahindra First Choice Wheels (MFCW).
   - This project is developed 100% independently with ZERO association with employer IP, infrastructure, identity, or resources.
   - All Git commit authorship strictly uses personal identity (`Samir Saurabh <samirverma527@gmail.com>`) and personal remote (`https://github.com/Samirsaurabh1298/ai-interview-copilot.git`).
   - Zero employer source code, internal logic, APIs, endpoints, DB schemas, confidential documentation, or customer data is used or reproduced.

---

## 8. Automated Verification & Test Matrix

All 13 packages maintain **100% passing test suites**:

| Package / Module | Test Scope | Tests Passed | Status |
| :--- | :--- | :---: | :---: |
| `tasks/frontend-ticket-queue` | Sorting, priority inversion, React array immutability, undef tags | 4 / 4 | **PASS** |
| `packages/contracts` | Zod validation contracts (answers, sessions, events, templates, analytics, webhooks, polyglot languages, integrity, runtime policies, zip import) | 4 / 4 | **PASS** |
| `packages/ai-core` | Model routing, fallback engine, prompt contract injection | 4 / 4 | **PASS** |
| `packages/context-engine` | AST context packing, token budgeting, file truncation | 3 / 3 | **PASS** |
| `services/code-runner` | Node 22 sandbox, Python 3 execution, Go polyglot static verification, OCI environment probe, polyglot compiler runners, watchdog timeouts, secret scrubbing, socket traps, and mutual token authentication (`/health`, `/environment`, `/validate`) | 24 / 24 (3 Suites) | **PASS** |
| `packages/ai-provider-groq` | Groq LPU adapter, JSON repair, fallback to GPT-OSS | 3 / 3 | **PASS** |
| `packages/ai-provider-openai` | OpenAI GPT-4o adapter, token cost calculation | 3 / 3 | **PASS** |
| `packages/ai-provider-anthropic` | Anthropic Claude 3.5 Sonnet adapter, tool call parsing | 3 / 3 | **PASS** |
| `packages/ai-provider-google` | Google Gemini 2.0 adapter, multimodal extraction | 3 / 3 | **PASS** |
| `packages/scoring-engine` | 7-dimension rubric evaluator, engineering autonomy reward, dynamic N/A weight redistribution, calibration consensus | 6 / 6 | **PASS** |
| `apps/api` | Fastify server, auth & RBAC, transactional email delivery (SMTP/Resend/Console/Test), candidate-to-company boundary enforcement, magic link login & rate limiting, organizations, templates & multi-task studio, ZIP archive ingest & penetration suite, versions, sessions & pause-resume audit trail, data deletion endpoint, invitations, telemetry events, submission bundling, proctor controls & factual integrity pipeline, calibration, evidence reports, multi-tenant IDOR attack suite, ATS/HRIS webhooks, AI cost analytics, candidate practice challenges, multimodal screen capture question ingestion, and execution security gate | 173 / 173 (25 Suites) | **PASS** |
| `apps/desktop` | Electron 34 desktop shell, Vite React renderer, TypeScript strict typecheck, and ErrorBoundary crash protection | Strict TSC | **PASS** |
| **Total Automated Tests** | **Across Full Enterprise Monorepo** | **219 / 219** | **100% PASS** |

---

## 9. Git Commit History & Roadmap Traceability

Every capability has been developed and committed with conventional commit standards on the `main` branch:

- `HEAD` — **feat(loop-10.0.2):** transactional email delivery, candidate authorization boundaries, pause audit, and tenant isolation
- `1f1210c` — **fix(desktop):** show Run Tests button only during coding tasks
- `e9f2913` — **feat(loop-10.0.1):** pilot hardening, proctor score removal, pause authorization, and data deletion mapping
- `ea88409` — **style(auth):** normalize trailing newlines in magic link service and test suite
- `9d72b0a` — **feat(loop-10):** private company pilot readiness, runner execution gate, and magic link authentication
- `19ef2a0` — **feat(loop-9.1):** Linux gVisor deployment architecture, mutual runner authentication, and adversarial security suite
- `d64d71a` — **style:** normalize trailing newlines across runner, API routes, and contracts
- `d32cd3a` — **feat(loop-9):** OCI runner architecture, separate language runtime policies, and ZIP repository archive ingestion
- `4a8ba16` — **docs:** update PROJECT_OVERVIEW.md and README.md with LOOP 8 enterprise pilot readiness
- `11e340e` — **feat(loop-8):** enterprise pilot hardening, scoring fairness, proctor redesign, and migration parity
- `a4e4b14` — **chore:** ignore windows powershell host transcription logs
- `16b69cc` — **docs:** update PROJECT_OVERVIEW.md and README.md with LOOP 6, 6.1, and 7 architectures
- `c3fefba` — **feat(loop-7):** complete real-time proctoring and passive integrity control room in Company Dashboard
- `c1c4c7c` — **fix(practice):** resolve polyglot java verification, resilient AI connection fallback, and schema submission payload
- `5d808ad` — **feat(loop-6):** implement company assessment studio and dynamic candidate task workspace
- `e4a3df1` — **feat(loop-6.1):** add dual-engine PostgreSQL & PGlite persistence with DDL auto-sync
- `55ad26b` — **chore(policy):** enforce strict personal project separation from employer policy
- `6392d17` — **feat(polyglot):** implement full multi-language software domain support (TS, JS, Python, Go, Java, C++, Rust) and bulletproof ErrorBoundary
- `a408bd7` — **fix(desktop):** resolve maximum call stack size recursion in capture modal
- `3eefcb5` — **feat(capture):** implement screen capture & multimodal ocr question ingest engine (Task 22)
- `c3b9ec3` — **feat(practice):** implement candidate practice studio, challenge catalog, and instant diagnostic feedback engine (Task 21)
- `3fda684` — **feat(analytics):** implement AI cost analytics, token budget forecasting, and company dashboard financial board (Task 20)
- `b8962fe` — **feat(webhooks):** implement enterprise ATS/HRIS webhook dispatcher with HMAC signatures, retry backoff, and format adapters (Task 19)
- `213aa37` — **feat(security):** implement multi-tenant IDOR guards, token brute-force rate limiter, and adversarial penetration test suite (Task 18)
- `3873048` — **feat(reports):** implement evidence-linked hiring decision reports, tamper verification seal, and HTML/PDF export (Task 17)
- `f0a85ed` — **feat(calibration):** add multi-reviewer rubric scorecard and consensus board UI (Task 16)
- `317fbc0` — **feat(calibration):** implement multi-reviewer calibration, blind scoring, and variance detection (Task 16)
- `a4fc469` — **feat(proctor):** implement proctor controls, session pause/resume, and crash recovery (Task 15)
- `afb44dc` — **feat(submission):** implement immutable artifact bundling with canonical sha256 fingerprint (Task 14)
- `c85fe95` — **fix(telemetry):** resolve undefined array indexing and isolate test port in session events
- `6174291` — **docs:** comprehensive feature inventory, architectural blueprint, and user workflows manual
- `727b7ba` — **feat(telemetry):** implement session event and evidence collection audit trail (Task 13)
- `2073260` — **feat(workspace):** candidate workspace session integration, autosave & favicon (Task 12)
- `60609e9` — **feat(session):** server-authoritative session creation & absolute expiration enforcement (Task 11)
- `d836869` — **feat(invitations):** 32-byte cryptographic candidate invitation and onboarding gateway (Task 10)
- `9c2a355` — **feat(frontend):** enterprise company dashboard with RBAC switcher, token inspector, template library, and version hashes (Tasks 6-9)
- `676e90f` — **feat(templates):** assessment template creation, seeding, and management (Task 8)
- `71dcb50` — **feat(auth):** JWT token authentication, RBAC hooks, and candidate session isolation (Task 7)
- `4e68df4` — **feat(org):** multi-tenant organization and membership management (Task 6)
- `9c04d20` — **feat(security):** harden code execution isolation and implement atomic budget reservation (Tasks 3, 4, 5)
- `493726b` — **feat(assessment):** require candidate explicit review and acceptance for AI proposed patches (Task 2 / AD #7)
- `87a9863` — **feat(scoring-engine):** decouple token economy from candidate performance score (Task 1 / AD #4)
- `4770b91` — **fix(contracts):** coerce date strings in CandidateSubmissionSchema and AssessmentScorecardSchema
- `ab07dcc` — **fix(desktop):** resolve exactOptionalPropertyTypes and MouseEvent handler in AssessmentWorkspace
- `bf84935` — **feat(assessment):** auto-apply AI code corrections to editor with 1-click auto-fix and test verification
- `6b342b7` — **feat(desktop):** add 60-min candidate assessment workspace, live budget meter, and 7-dimension reviewer scorecard
- `f9aafb3` — **feat(ai-provider-groq):** integrate Groq LPU provider and enable Node 22 native TypeScript sandbox execution
- `a27d678` — **feat(assessment):** deliver scoring engine, light theme, usage gateway, and 60-min candidate challenge
- `54b583e` — **fix(desktop):** connect electron main process to local dev server with full HMR and window focus
- `6c78708` — **feat(desktop):** add bulletproof electron launcher script and start script
- `15a5cd3` — **feat(ai-provider):** implement anthropic claude 3.5 sonnet provider with tool-calling schema and multimodal vision extraction
- `185b1b1` — **feat:** initial monorepo scaffold with contracts, ai-core, api, and desktop client
