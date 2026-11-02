# AI Coding Assessment Platform: Enterprise B2B Technical Evaluation System

[![Tests](https://img.shields.io/badge/tests-156%20passing-brightgreen.svg)](https://github.com/Samirsaurabh1298/ai-interview-copilot)
[![Node.js](https://img.shields.io/badge/node-v22.0.0+-blue.svg)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-v9.0.0+-orange.svg)](https://pnpm.io)
[![Accessibility](https://img.shields.io/badge/WCAG-2.2%20AA%20Compliant-purple.svg)](https://www.w3.org/WAI/standards-guidelines/wcag/)

> **A production-grade, Google-bar engineering assessment platform designed to evaluate how software engineers solve real-world problems with managed AI assistance.**

---

## Complete Documentation & Operating Manual

For the **exhaustive technical specification, feature-by-feature inventory, security invariants, and step-by-step persona workflows**, please read:
👉 **[PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md)**

---

## Key Architectural Highlights

1. **Company-Managed AI Access:** AI tokens are strictly a financial cost-control metric; LLM usage **never** deflates or inflates candidate scores (AD #4).
2. **Explicit Candidate Patch Review:** The AI assistant can propose solutions, but can **never** silently mutate candidate code. Candidates review unified diffs and explicitly accept or reject (AD #7).
3. **Hardened Ephemeral Code Sandbox:** Node 22 native execution with `--permission`, `--disallow-code-generation-from-strings`, stripped environment variables, temp directory jail, and socket interception traps (AD #8).
4. **Cryptographic Immutability:** Canonical SHA-256 fingerprinting for assessment templates, versions, sessions, and submissions (AD #9).
5. **Human Reviewer Accountability:** AI scorecards are strictly advisory; final hiring decisions belong to human reviewers (AD #10).
6. **Anti-IDOR Tenant Boundary:** Timing-safe JWT HMAC-SHA256 authentication with role-based access control (`owner`, `admin`, `interviewer`, `reviewer`, `candidate`).

---

## Quick Start Guide

### 1. Prerequisites
- **Node.js**: `v22.0.0` or higher
- **pnpm**: `v9.0.0` or higher

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Build Core Packages
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

- **Company Admin / Recruiter:** Set up organizations, manage RBAC, create assessment templates, lock immutable SHA-256 versions, and issue 32-byte cryptographic candidate invite links.
- **Candidate:** Open secure invite gateway, review objectives and agree to integrity terms, launch 60-minute workspace, ask AI questions, inspect diffs, run tests, and submit solution with 20-second autosave protection.
- **Interviewer / Proctor:** Live monitor sessions, track consumed AI budget, review chronological telemetry checkpoints, detect window blurs/pastes, and pause/resume sessions during technical incidents.
- **Reviewer / Hiring Manager:** Inspect candidate code AST diffs, evaluate 7-dimension rubric scores, calibrate anchors, verify cryptographic hashes, and export compliance reports.
- **Talent Operations / ATS Integration:** Dispatch cryptographically signed HMAC-SHA256 webhook payloads directly to Greenhouse, Lever, Workday, or custom HRIS webhooks with exponential retry backoff (Task 19).
- **Finance & Engineering Leadership:** Inspect real-time token spend ledgers, 30-day linear burn rate forecasting, unit economics ($/session), and automated runaway prompt anomaly alerts (Task 20).

All **142 automated tests across 13 packages** are passing (100% pass rate).

For in-depth operational instructions, refer to **[PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md)**.

