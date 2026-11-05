# AI Coding Assessment Platform: Enterprise B2B Technical Evaluation System

[![Tests](https://img.shields.io/badge/tests-168%20passing-brightgreen.svg)](https://github.com/Samirsaurabh1298/ai-interview-copilot)
[![Node.js](https://img.shields.io/badge/node-v22.0.0+-blue.svg)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-v9.0.0+-orange.svg)](https://pnpm.io)
[![Database](https://img.shields.io/badge/database-PostgreSQL%20%2B%20Drizzle%20ORM-336791.svg)](https://orm.drizzle.team)
[![Accessibility](https://img.shields.io/badge/WCAG-2.2%20AA%20Compliant-purple.svg)](https://www.w3.org/WAI/standards-guidelines/wcag/)

> **A production-grade, Google-bar engineering assessment platform designed to evaluate how software engineers solve real-world problems with managed AI assistance.**

---

## Complete Documentation & Operating Manual

For the **exhaustive technical specification, feature-by-feature inventory, security invariants, and step-by-step persona workflows**, please read:
👉 **[PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md)**

---

## Key Architectural Highlights

1. **Company Assessment Studio & Multi-Task Authoring (LOOP 6):** Enables recruiters and engineering managers to author role-tailored engineering evaluations spanning **Question Sets** (MCQ single/multi, short text), **Coding Challenges** (polyglot languages, unit tests), and **Repository / Codebase Tasks** (multi-file virtual filesystems, read-only file guards) with per-task time limits and granular AI policies (`prohibited`, `restricted`, `enabled`).
2. **Production-Grade Persistence (Drizzle ORM + PostgreSQL / PGlite) (LOOP 6.1):** 11 normalized database tables across 10 typed repositories. Features connection pooling (`pg.Pool`), embedded zero-daemon PGlite engine for offline/test environments, graceful shutdown, schema auto-migration, and complete survival across API process restarts.
3. **Real-Time Proctoring, Passive Integrity & Anti-Cheat Pipeline (LOOP 7):** Evidentiary passive observation pipeline featuring a deterministic 0–100 integrity scoring algorithm, off-screen dwell tracking, unattributed external clipboard paste detection ($>50$ chars), Company Dashboard live proctor control room with dynamic 0–100 risk dial, incident logging & resolution, and server-authoritative session pause with automatic technical credit extension.
4. **Company-Managed AI Access:** AI tokens are strictly a financial cost-control metric; LLM usage **never** deflates or inflates candidate scores (AD #4).
5. **Explicit Candidate Patch Review:** The AI assistant can propose solutions, but can **never** silently mutate candidate code. Candidates review unified diffs and explicitly accept or reject (AD #7).
6. **Hardened Ephemeral Code Sandbox & Polyglot Execution:** Node 22 native isolation, Python 3 runtime, and intelligent static verification for Go, Java, C++, and Rust (AD #8).
7. **Entire Software Engineering Domain Support:** Curated challenges, OCR screen capture ingest, dynamic Monaco syntax highlighting, and test harnesses across **TypeScript, JavaScript, Python, Go, Java, C++, and Rust**.
8. **Cryptographic Immutability:** Canonical SHA-256 fingerprinting for assessment templates, versions, sessions, and submissions (AD #9).
9. **Human Reviewer Accountability:** AI scorecards and integrity metrics are strictly advisory; final hiring decisions belong to human reviewers (AD #10).
10. **Anti-IDOR Tenant Boundary & UI Resilience:** Timing-safe JWT HMAC-SHA256 authentication with role-based access control, coupled with top-level React ErrorBoundaries for zero blank-screen crashes.

---

## Quick Start Guide

### 1. Prerequisites
- **Node.js**: `v22.0.0` or higher
- **pnpm**: `v9.0.0` or higher

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Database Setup (PostgreSQL / Drizzle ORM)

The platform supports two persistence modes:
- **Embedded Zero-Daemon Mode (Default for Dev & Tests):** Uses embedded WebAssembly PostgreSQL 16 (`PGlite`). No external database server required; works completely offline with zero configuration.
- **Production PostgreSQL:** Provide `DATABASE_URL` in your environment or `.env` file:
  ```env
  DATABASE_URL=postgresql://postgres:password@localhost:5432/ai_copilot
  ```

To generate or run database schema migrations via Drizzle Kit:
```bash
# Generate version-controlled SQL migration files
pnpm --filter @ai-copilot/api exec drizzle-kit generate

# Push schema directly to target database
pnpm --filter @ai-copilot/api exec drizzle-kit push
```

### 4. Build Core Packages
```bash
pnpm --filter @ai-copilot/contracts build
pnpm --filter @ai-copilot/api build
```

### 4. Run the Platform

In three separate terminal windows:

```bash
# Terminal 1: Fastify REST API Backend (Port 4000)
node apps/api/dist/server.js

# Terminal 2: Web Client Dev Server (Port 5173)
pnpm --filter @ai-copilot/desktop dev:renderer --host 0.0.0.0 --port 5173

# Terminal 3: Electron Desktop Client (Optional Native App)
pnpm --filter @ai-copilot/desktop start
```

Open your browser at **`http://localhost:5173`**.

---

## Monorepo Testing & Verification

Run the entire 156-test automated verification suite across all 13 workspace packages:

```bash
pnpm test
```

Typecheck the entire monorepo:

```bash
pnpm run typecheck
```

---

## Core Personas & Workflows Supported

- **Company Admin / Recruiter:** Set up organizations, manage RBAC, author custom multi-task assessments in **Assessment Studio** (Question Sets, Coding Challenges, Repository Tasks), configure task-level AI policies, lock immutable SHA-256 versions, and issue 32-byte cryptographic candidate invite links.
- **Candidate:** Open secure invite gateway, review objectives and agree to integrity terms, launch multi-task dynamic workspace, solve questions, navigate multi-file virtual repository projects, collaborate with AI, inspect diffs, run tests, and submit solution with 20-second autosave protection.
- **Interviewer / Proctor:** Live monitor sessions, inspect real-time 0–100 integrity risk dial, track window blurs, off-screen dwell time, and unattributed external clipboard pastes, record proctor notes, resolve false alarms, and pause/resume sessions with automatic technical credit time extension during incidents.
- **Reviewer / Hiring Manager:** Inspect candidate code AST diffs, evaluate 7-dimension rubric scores, calibrate anchors, verify cryptographic hashes, and export compliance reports.
- **Talent Operations / ATS Integration:** Dispatch cryptographically signed HMAC-SHA256 webhook payloads directly to Greenhouse, Lever, Workday, or custom HRIS webhooks with exponential retry backoff (Task 19).
- **Finance & Engineering Leadership:** Inspect real-time token spend ledgers, 30-day linear burn rate forecasting, unit economics ($/session), and automated runaway prompt anomaly alerts (Task 20).

All **168 automated tests across 13 packages** are passing (100% pass rate).

For in-depth operational instructions, refer to **[PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md)**.

