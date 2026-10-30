# AI Coding Interview Copilot & Assessment Platform
## Technical Implementation Overview & System Architecture

> **Repository Status:** Production Monorepo  
> **Total Workspace Packages:** 12 Packages / Apps / Services  
> **Test Pass Rate:** 39 / 39 Unit Tests Passing (100%)  
> **Sandbox Challenge Verification:** 5 / 5 Verification Tests Passing (100%)  
> **Default AI Gateway Provider:** Groq LPU (`qwen/qwen3.8-27b` with `openai/gpt-oss-120b` fallback)  
> **UI Environment:** Electron 34 + React 19 + Tailwind CSS (WCAG 2.2 AA Light & Dark Modes)  

---

## 1. Executive Summary

The **AI Coding Interview Copilot & Assessment Platform** is an enterprise-grade evaluation system designed to measure how candidates solve real-world engineering problems with managed AI assistance. Rather than banning AI tools or allowing unmonitored cheating, the platform provides candidates with a sandboxed, budget-monitored AI Engineering Assistant while continuously evaluating their code comprehension, debugging discipline, critical verification, and AI collaboration skills across a calibrated **7-dimension rubric**.

---

## 2. Monorepo Architecture & Directory Structure

The project is structured as a high-performance **pnpm monorepo** with strict boundary separation between contracts, domain engines, AI adapters, backend services, and desktop clients:

```
c:\samir\ai-interview-copilot/
├── apps/
│   ├── api/                              # Fastify v5 REST & WebSocket Backend
│   │   ├── src/
│   │   │   ├── routes/                   # API Routes (answers, code runner, assessment, health)
│   │   │   ├── services/                 # AI Usage Gateway, Session Ledger, Policy Service
│   │   │   └── server.ts                 # HTTP server bootstrap & provider registration
│   │   └── test/                         # API integration & security test suites
│   └── desktop/                          # Electron 34 + React 19 Desktop Client
│       ├── src/
│       │   ├── main/                     # Electron main process & window management
│       │   ├── preload/                  # Secure context isolation bridge
│       │   └── renderer/                 # React 19 Frontend
│       │       ├── components/
│       │       │   ├── AssessmentWorkspace.tsx  # 60-min Candidate Challenge Workspace
│       │       │   └── ScorecardModal.tsx       # 7-Dimension Reviewer Scorecard Modal
│       │       ├── services/             # Type-safe API client
│       │       └── index.css             # WCAG 2.2 AA Light & Dark theme tokens
│       └── scripts/
│           └── start-electron.cjs        # Resilient Electron startup watchdog
├── packages/
│   ├── contracts/                        # Shared TypeScript types & Zod validation schemas
│   │   └── src/
│   │       ├── answer.ts                 # 15-field InterviewAnswer schema
│   │       ├── assessment.ts             # Rubric, Scorecard, and CandidateSubmission schemas
│   │       ├── provider.ts               # AI provider & model capability contracts
│   │       ├── request.ts                # AI request schema & context items
│   │       └── validation.ts             # Code validation request & result schemas
│   ├── ai-core/                          # Provider-agnostic AI orchestrator & prompt templates
│   │   └── src/
│   │       ├── orchestrator.ts           # Model routing, token cost tracking & fallback engine
│   │       ├── prompts.ts                # System prompts & schema contract injection
│   │       └── errors.ts                 # Typed AIProviderError hierarchy
│   ├── ai-provider-groq/                 # Ultra-Fast Groq LPU Provider Adapter
│   │   └── src/
│   │       ├── adapter.ts                # Qwen 3.8 27B + GPT-OSS 120B with JSON repair
│   │       └── vision.ts                 # Multimodal question extraction via Llama Vision
│   ├── ai-provider-openai/               # OpenAI Adapter (GPT-4o, GPT-4o-mini)
│   ├── ai-provider-anthropic/            # Anthropic Adapter (Claude 3.5 Sonnet)
│   ├── ai-provider-google/               # Google Gemini Adapter (Gemini 2.0 Flash/Pro)
│   ├── context-engine/                   # Context window packing, AST parsing & token budgeter
│   └── scoring-engine/                   # Automated 7-Dimension Rubric Scoring Engine
│       └── src/
│           └── evaluator.ts              # Evidence-based submission scoring & calibration
├── services/
│   └── code-runner/                      # Isolated Sandboxed Execution Service
│       └── src/
│           └── runner.ts                 # Node 22 native TypeScript type-stripping runner
└── tasks/
    └── frontend-ticket-queue/            # Pilot Assessment Task: Support Triage Queue
        └── src/
            ├── useTicketQueue.ts         # Starter code with 3 realistic regressions
            └── useTicketQueue.test.ts    # 5 verification unit test cases
```

---

## 3. Core Subsystems Built

### 3.1. 60-Minute Candidate Assessment Workspace
- **Component:** `apps/desktop/src/renderer/components/AssessmentWorkspace.tsx`
- **Interactive Split Layout:**
  - **Left Pane:**
    - *Assessment Brief & Objectives:* Problem scenario, reported triage regressions, evaluation rubric dimensions.
    - *AI Engineering Assistant (LPU):* Real-time conversation thread with Groq LPU gateway.
  - **Right Pane:**
    - *Full-Featured Code Editor:* Monaco-styled dark editor with line numbers, monospace syntax, and status indicator.
    - *Top Action Toolbar:* Contains **`[⚡ Auto-Fix with AI]`** and **`[Reset Starter]`** controls.
    - *Isolated Verification Runner:* Embedded terminal running live tests with timing and failure diagnostic banners.
- **Header Controls:**
  - Active session countdown timer (60:00).
  - **Live Budget Meter:** Displays real-time dollar consumption against the `$0.25 USD` limit with visual progress bar.
  - **80% Warning Banner:** Triggers when candidate reaches `$0.200 USD` (80% threshold).
  - **Hard Cutoff Enforcement:** Automatically locks further AI queries if `$0.25 USD` is reached, while allowing the candidate to continue editing and testing without penalty.
  - **`[Run Tests]`** and **`[Submit Solution]`** action buttons.

### 3.2. AI Auto-Writing & 1-Click Code Replacement
- **Direct Code Application:** When the candidate asks the AI to *"write code by yourself"*, *"fix this code"*, or *"correct this code"*, the engine:
  1. Generates the complete, corrected TypeScript solution.
  2. Automatically updates `code` in the editor (`src/useTicketQueue.ts`).
  3. Displays an **`"⚡ AI fix applied directly to editor"`** notification.
  4. Automatically runs the sandbox verification test suite.
- **Interactive Solution Card:** Every AI response that includes code renders an inline card with syntax preview and an **`[⚡ Apply Fix to Editor]`** button.
- **Dedicated Toolbar Auto-Fix Button:** Provides candidates with an instant one-click way to debug and apply fixes directly from the editor toolbar.

### 3.3. Groq LPU Provider & JSON Resiliency Engine
- **Component:** `packages/ai-provider-groq/src/adapter.ts`
- **Default Model:** `qwen/qwen3.8-27b` running on Groq LPUs for sub-second inference.
- **Fallback Model:** `openai/gpt-oss-120b` running on Groq LPUs.
- **Token Ceiling & Rate Limit Optimization:** Scaled `max_tokens` to `2400` to prevent mid-JSON truncations during complex multi-defect code fixes.
- **Automated JSON Salvage & Repair:**
  - Parses raw JSON or JSON embedded inside markdown blocks.
  - Automatically recovers truncated JSON objects by balancing quotes, brackets, and braces.
  - Normalizes category labels (e.g., mapping `"bug_fixing"` $\to$ `"debugging"`).
  - Seamless fallback retry to GPT-OSS 120B if the primary model rejects JSON mode.

### 3.4. Isolated Code Execution Runner (Sandboxed)
- **Component:** `services/code-runner/src/runner.ts`
- **Runtime:** Native Node 22 execution with `--experimental-strip-types` (zero external compilation dependencies).
- **Security & Sandboxing:**
  - **Environment Scrubbing:** Strips all host environment variables (`GROQ_API_KEY`, `OPENAI_API_KEY`, `PORT`, etc.) before spawning the execution process.
  - **Watchdog Timeout:** Enforces strict execution limits (4,000ms default) to kill infinite loops and recursive traps cleanly.
  - **Isolated Test Harness:** Injects custom `test()` and assertion wrappers that report microsecond timing, assertions passed, and stack traces.

### 3.5. 7-Dimension Rubric Scoring Engine
- **Component:** `packages/scoring-engine/src/evaluator.ts`
- **Evaluates Candidate Performance Against Blueprint Sections 29, 44 & 51.7:**
  1. **Code Comprehension (20%):** Assesses root-cause analysis quality and diagnosis accuracy.
  2. **Problem Framing (10%):** Evaluates inquiry specificity and context utilization.
  3. **AI Collaboration (15%):** Measures prompt efficiency, token economy, and budget discipline.
  4. **Critical Evaluation (15%):** Penalizes blind copy-paste; rewards targeted, verifiable modifications.
  5. **Debugging & Implementation (20%):** Scored on sandbox unit test pass rate (0% to 100%).
  6. **Testing Discipline (15%):** Evaluates test execution frequency and edge-case coverage.
  7. **Technical Explanation (5%):** Assesses clarity of the candidate's post-assessment architectural summary.
- **Automated Scorecard Generation:** Emits weighted scores (0–100), dimension ratings (Anchor 1: Insufficient to Anchor 4: Strong), and concrete evidence citations.

### 3.6. Reviewer Calibration Scorecard Modal
- **Component:** `apps/desktop/src/renderer/components/ScorecardModal.tsx`
- **Features:**
  - Visual Score Summary (e.g., `81.4 / 100` Weighted Total Score).
  - Breakdown of all 7 rubric dimensions with progress meters and weightings.
  - Evidence Citations: Shows exact telemetry (test pass count, budget used, queries asked).
  - **Reviewer Calibration Controls:** Allows hiring managers to adjust dimension anchors (1 to 4) and add evaluation notes.
  - **Export to JSON:** Generates audit-ready assessment reports.

### 3.7. The Frontend Support Triage Assessment Challenge
- **Component:** `tasks/frontend-ticket-queue/src/useTicketQueue.ts`
- **Real-World Bugs Implemented:**
  1. *Priority Inversion:* Descending sort inverted weights (`weightA - weightB`), sorting `urgent` tickets to the bottom.
  2. *In-Place Mutation:* Mutated the input array directly in `sort()`, breaking React immutability.
  3. *Uncaught Exception:* Calling `.includes()` on undefined `ticket.tags` threw unhandled `TypeError`.
- **Verification Suite:** 5 unit tests verifying search queries, status filters, priority order, optional tag safety, and immutability.

---

## 4. API Gateway Endpoints Contract

The Fastify API backend (`apps/api/src/server.ts`) exposes the following endpoints on `http://127.0.0.1:4000`:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Service health status, active provider, and port telemetry. |
| `GET` | `/api/v1/providers` | Lists configured AI providers (`groq`, `openai`, `anthropic`, `google`) and capabilities. |
| `POST` | `/api/v1/answers/generate` | Generates structured answers adhering to the 15-field `InterviewAnswerSchema`. |
| `POST` | `/api/v1/code/validate` | Executes candidate code inside the Node 22 isolated sandbox. |
| `GET` | `/api/v1/assessment/policy` | Returns current assessment tool policy (budget, allowed models, time limit). |
| `GET` | `/api/v1/assessment/budget/:sessionId` | Retrieves live session budget consumption, remaining allowance, and warning status. |
| `POST` | `/api/v1/assessment/evaluate` | Evaluates candidate submission and generates the official 7-dimension scorecard. |
| `POST` | `/api/v1/questions/extract` | Multimodal question and code extraction from uploaded screenshots. |

---

## 5. Security & Cost Protection Guarantees

1. **Strict Client-Server Isolation:** API keys (`GROQ_API_KEY`, etc.) are kept strictly in backend `.env` files and never exposed to the Electron client or renderer bundle.
2. **Process Sandboxing:** Code executed via `/api/v1/code/validate` is executed in a segregated subprocess with stripped environment variables and active watchdog timers.
3. **Hard AI Cost Cap:** Sessions are locked after `$0.25 USD` of consumed LLM inference.
4. **Prompt Injection Boundary:** User questions, code snippets, and screenshot OCR are enclosed in `<untrusted_question>` and `<untrusted_code>` XML tags to prevent system prompt overrides.

---

## 6. Verification & Test Matrix

All packages maintain passing automated test suites:

| Package | Test File | Tests Passed | Status |
| :--- | :--- | :---: | :---: |
| `tasks/frontend-ticket-queue` | `useTicketQueue.test.ts` | 4 / 4 | PASS |
| `packages/contracts` | `answer.test.ts` | 4 / 4 | PASS |
| `packages/ai-core` | `orchestrator.test.ts` | 4 / 4 | PASS |
| `packages/context-engine` | `context.test.ts` | 3 / 3 | PASS |
| `services/code-runner` | `runner.test.ts` | 9 / 9 | PASS |
| `packages/ai-provider-groq` | `adapter.test.ts` | 3 / 3 | PASS |
| `packages/ai-provider-openai` | `adapter.test.ts` | 3 / 3 | PASS |
| `packages/ai-provider-anthropic` | `adapter.test.ts` | 3 / 3 | PASS |
| `packages/ai-provider-google` | `adapter.test.ts` | 3 / 3 | PASS |
| `packages/scoring-engine` | `evaluator.test.ts` | 3 / 3 | PASS |
| `apps/api` | `app.test.ts` & `organizations.test.ts` | 14 / 14 | PASS |
| **Total Automated Tests** | **Across Monorepo** | **50 / 50** | **100% PASS** |

---

## 7. Architectural Decisions & Priority 0 Foundations (Completed)

1. **Decoupled Token Economy from Candidate Scoring (AD #4)**: AI token consumption is tracked as a strict financial cost control metric in `evidenceCitations`, but has zero negative or positive impact on candidate evaluation scoring in the 7-dimension rubric.
2. **Explicit Patch Review & Acceptance (AD #7)**: AI-generated code fixes are displayed as candidate-reviewed unified diffs with explicit `[Accept & Apply]` vs `[Reject]` actions; editor contents are never silently mutated by the AI.
3. **Pilot Provider Selection (AD #2 & #3)**: OpenAI `gpt-4o-mini` is established as the recommended B2B pilot default ($0.15/M in, $0.60/M out) with structured schema outputs, backed by Groq LPU and Claude 3.5 Sonnet as selectable alternatives.
4. **Hardened Code-Execution Sandbox (AD #8)**: Ephemeral process execution enforced with Node 22 native `--permission`, `--disallow-code-generation-from-strings`, filesystem jail to temp folder only (`--allow-fs-write=${tmpDir}`), socket interception traps blocking all outbound network/WebSocket/HTTP traffic, and `process.exit()` guards.
5. **Atomic Reservation Pattern for Concurrent Budget & Session Integrity (AD #5 & #6)**: Implemented two-phase token budget reservations (`reserveBudget` -> `commitUsage`/`releaseReservation`) to eliminate race conditions under concurrent requests, paired with absolute session expiration time-limit enforcement.

---

## 8. Priority 1: Company Platform Foundation (In Progress)

1. **Task 6: Organization & Membership Management (Completed)**: Delivered multi-tenant organization contracts, transactional tenant service with row-level tenant boundary isolation, team invitation workflows, role management (`owner`, `admin`, `interviewer`, `reviewer`, `candidate`), and sole-owner safety guards.

---

## 9. Git Commit History Log

All features have been committed with conventional commit standards on the local `main` branch:

- `9c04d20` — **feat(security):** harden code execution isolation and implement atomic budget reservation
- `493726b` — **feat(assessment):** require explicit candidate review and acceptance for AI proposed patches
- `87a9863` — **feat(scoring-engine):** decouple token economy from candidate performance score
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

