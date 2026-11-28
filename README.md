# AI Coding Assessment Platform: Enterprise B2B Technical Evaluation System

[![Tests](https://img.shields.io/badge/tests-311%20passing-brightgreen.svg)](https://github.com/Samirsaurabh1298/ai-interview-copilot)
[![Typecheck](https://img.shields.io/badge/typecheck-12%2F12%20green-brightgreen.svg)](https://github.com/Samirsaurabh1298/ai-interview-copilot)
[![Node.js](https://img.shields.io/badge/node-v22.0.0+-blue.svg)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-v12.16.1-orange.svg)](https://pnpm.io)
[![Database](https://img.shields.io/badge/database-PostgreSQL%20%2B%20Drizzle%20ORM-336791.svg)](https://orm.drizzle.team)
[![Accessibility](https://img.shields.io/badge/WCAG-2.2%20AA%20Compliant-purple.svg)](https://www.w3.org/WAI/standards-guidelines/wcag/)

> **A production-grade engineering assessment platform built to evaluate how software engineers debug real multi-file codebases, critically scrutinize AI assistance, and defend engineering decisions.**

---

## Documentation Map

- **System Architecture & Subsystem Specs (Single Source of Truth, `HEAD = Loop 11.0.3`):** [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md)
- **Chronological Release & Loop History:** [CHANGELOG.md](./CHANGELOG.md)

---

## Core Architectural Highlights

1. **Auth, Multi-Tenant RBAC & Passwordless Magic Links:** Timing-safe HMAC-SHA256 JWTs, 32-byte single-use SHA-256 Magic Links (15-min TTL, anti-enumeration, 5/15m rate limits), sole-owner guards, and `assertCompanyMember` boundaries blocking candidate tokens (`403 FORBIDDEN`) across all company routes.
2. **Company Assessment Studio & ZIP Codebase Authoring:** Visual multi-task builder supporting `question_set`, `coding_challenge`, and multi-file `repository_task` sections, streaming PKZip repository imports (Zip Slip, symlink, and compression-bomb hardened), hidden test scrubbing, immutable SHA-256 versioning, and decoupled invite/attempt deadlines.
3. **7-State Lifecycle FSM & Durable Autosave Idempotency:** Explicit server-authoritative FSM (`CREATED`, `ACTIVE`, `PAUSED`, `GRACE_PERIOD`, `FINALIZING`, `SUBMITTED`, `TERMINATED`), PostgreSQL `clock_timestamp()` deadlines, lease-fenced crash recovery (`SessionExpiryProcessor`), and `session_autosave_mutations` idempotency (`baseRevision`, `clientMutationId`, SHA-256 request hashing).
4. **Per-Task AI Policies, Weak-AI Simulation & Diff-Anchored Defense:** Enforces 4 canonical AI modes (`prohibited`, `restricted_explainer`, `full_copilot`, `flawed_junior`) server-side with `allowedModel` locking, mandatory explicit candidate diff review (**AD #7**), XML prompt-injection boundaries, and post-fix comprehension defense prompts sealed into `submission_artifacts`.
5. **Fail-Closed Sandbox Gate & Linux gVisor Isolation:** `RUNNER_EXECUTION_ENABLED` defaults to `false` outside test mode (returning HTTP `403 RUNNER_EXECUTION_DISABLED` and `NOT_RUN` rather than running untrusted code on bare-metal Windows hosts). Production deploys decoupled worker containers under Ubuntu 24.04 + rootless Podman + gVisor (`runsc`) with mutual `CODE_RUNNER_SECRET` auth, multi-file `workspace-materializer.ts` guards, and polyglot compiler profiles across 7 languages.
6. **Factual Telemetry & Non-Punitive Proctoring:** Append-only monotonic event streams paired with transparent evidentiary metrics (`focusRatePercent`, off-screen dwell, unattributed external pastes, `reviewStatus`: `verified` | `review_recommended` | `unresolved_incident`) and server-authoritative pause/resume credit extension — **zero** 0–100 proctor scores, risk bands, or keystroke cadence tracking.
7. **Fair 7-Dimension Scoring & Blind Calibration:** AI token usage stays strictly decoupled from competence scores (**AD #4**); autonomous non-AI candidates and `prohibited` sections receive `isNotApplicable: true` with normalized technical weight redistribution; blind multi-reviewer calibration flags `>15%` variance while human reviewers own hiring decisions (**AD #10**).
8. **PostgreSQL / PGlite Persistence, Email, Webhooks & Desktop UI Tests:** 13 Drizzle tables across pooled PostgreSQL and embedded PGlite; pluggable transactional email (SMTP STARTTLS, Resend, Console, Test); HMAC-SHA256 ATS/HRIS webhooks; AI cost analytics; multimodal OCR capture; `PracticeStudio` (with Weak-AI & Strict Exam modes); and Vitest + Testing Library smoke integration coverage in `apps/desktop`.

---

## Quick Start Guide

### 1. Prerequisites
- **Node.js**: `v22.0.0` or higher
- **pnpm**: `v9.0.0` or higher (configured at `12.16.1`)

### 2. Install & Build Contracts
```bash
pnpm install
pnpm --filter @ai-copilot/contracts build
pnpm --filter @ai-copilot/code-runner build
pnpm --filter @ai-copilot/api build
```

### 3. Database Modes
- **Embedded Zero-Daemon Mode (Default):** Runs locally on WebAssembly PostgreSQL 16 (`PGlite`) with automatic DDL init.
- **Production PostgreSQL:** Set `DATABASE_URL` (e.g. `postgresql://postgres:password@localhost:5432/ai_copilot`) and apply Drizzle migrations (`apps/api/drizzle/`).

### 4. Run Locally
```bash
# Terminal 1: Fastify API Backend (Port 4000)
pnpm --filter @ai-copilot/api dev

# Terminal 2: Web Renderer (Port 5173)
pnpm --filter @ai-copilot/desktop dev:renderer --host 0.0.0.0 --port 5173

# Terminal 3: Electron Desktop Client (Optional)
pnpm --filter @ai-copilot/desktop start
```

Open **`http://localhost:5173`**. *(Note: `RUNNER_EXECUTION_ENABLED` defaults to `false` in `development`; set `RUNNER_EXECUTION_ENABLED=true` locally only when testing trusted challenges.)*

---

## Monorepo Verification

```bash
pnpm test            # 311 / 311 tests passing across 48 test files (12 packages)
pnpm run typecheck   # 12 / 12 TypeScript projects passing strict tsc --noEmit
```

---

## Supported Personas

- **Company Admin / Recruiter:** Configure tenant RBAC, sign in via Magic Links, author multi-task evaluations + ZIP repositories in Assessment Studio, lock SHA-256 versions, and send tracked email invitations.
- **Candidate:** Verify onboarding terms, solve question sets and multi-file repositories under server-authoritative deadlines, inspect/review AI diffs critically (including `flawed_junior` sessions), submit post-fix comprehension defenses, or train in Practice Studio.
- **Interviewer / Proctor:** Inspect factual focus/paste/dwell observations and telemetry timelines, annotate or resolve `proctor_incidents`, and pause/resume sessions with exact millisecond credit extension.
- **Reviewer / Hiring Manager:** Grade submissions blindly on 7 rubric dimensions, resolve >15% calibration spreads, inspect SHA-256 seals, and export evidence-linked HTML/PDF hiring reports.
- **Talent Ops & Leadership:** Integrate HMAC-SHA256 ATS webhooks (Greenhouse, Lever, Workday) and monitor token spend, 30-day burn forecasts, and anomaly alerts.
