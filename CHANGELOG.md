# Changelog & Milestone Traceability

Chronological delivery history for the **AI Coding Assessment Platform** on `main` (`https://github.com/Samirsaurabh1298/ai-interview-copilot.git`).

---

## Release Milestones

### Loop 11.0.1 – 11.0.3: Multi-File Sandbox, Weak-AI Simulation & Post-Fix Defense
- `2454bde` — **feat(loop-11.0.3):** unify `PracticeStudio` onto multi-file workspaces, weak-AI simulation (`flawed_junior`), strict timed exam mode, and post-fix comprehension defense.
- `e730e73` — **feat(loop-11.0.2):** add `flawed_junior` AI policy mode with server-side model locking and diff-anchored post-fix defense responses sealed into `submission_artifacts`.
- `44313da` — **feat(loop-11.0.1):** extend `CodeValidationRequestSchema` for multi-file virtual repos, build hardened `workspace-materializer.ts`, and wire `repository_task` test verification into `AssessmentWorkspace` and `SubmissionService`.

### Loop 10.0.4 – 10.0.4.2.4: Explicit Lifecycle FSM, Clock Authority & Durable Autosave Idempotency
- `1cef74c` / `c1761e8` / `20f2714` — **fix(test):** resolve TypeScript type mismatches across session expiry, concurrency, and FSM reliability test suites.
- `c651482` — **feat(loop-10.0.4.2.4):** durable autosave idempotency (`session_autosave_mutations`), database-enforced `UNIQUE(session_id, client_mutation_id)`, and SHA-256 canonical request hashing.
- `c0f9f2c` — **feat(loop-10.0.4.2.3):** server revision authority, mandatory `baseRevision` and `clientMutationId`, and idempotent retry recovery.
- `add10c0` — **feat(loop-10.0.4.2.2):** strict autosave revision CAS transitions and stale revision HTTP 409 rejections.
- `ef87a33` — **feat(loop-10.0.4.2.1):** PostgreSQL `clock_timestamp()` deadline enforcement and concurrency guards.
- `7fc552d` — **feat(loop-10.0.4.2):** SQL deadline locking, strict `FINALIZING -> SUBMITTED` transition contracts, and 4-state `TestExecutionStatus` (`SUCCESS`, `FAILURE`, `NOT_RUN`, `UNAVAILABLE`).
- `80fb6a5` — **feat(loop-10.0.4.1):** FSM reliability acceptance suite, worker lease fencing, and transactional artifact sealing.
- `fa05767` — **feat(loop-10.0.4):** formal 7-state lifecycle FSM (`CREATED`, `ACTIVE`, `PAUSED`, `GRACE_PERIOD`, `FINALIZING`, `SUBMITTED`, `TERMINATED`), atomic DB CAS transitions, and frontend `useAssessmentLifecycle` reducer.

### Loop 10.0.3 & Showcase: Server Expiry Sweep & Design Partner Bento UI
- `d31374e` / `dc06f34` — **feat(showcase):** add interactive `ProductBentoShowcase` component for stakeholder and pilot walkthroughs.
- `26f3e25` — **feat(loop-10.0.3):** `SessionExpiryProcessor` background sweep, crash lease recovery, and finalization reliability.
- `e7e4dc4` — **fix(assessment):** auto-close candidate workspace on timeout and fix timer restart edge case.

### Loop 10 – 10.0.2: Pilot Readiness, Runner Gate, Magic Link Auth & Email Delivery
- `123e280` — **feat(loop-10.0.2):** pluggable transactional email service (SMTP STARTTLS, Resend, Console, Test), candidate-to-company authorization boundaries, and server pause/resume audit trail.
- `1f1210c` — **fix(desktop):** display `Run Tests` button contextually only for coding/repository tasks.
- `760cee6` — **feat(loop-10.0.1):** remove composite 0–100 proctor scores/risk bands and keystroke cadence telemetry, gate magic-link debug tokens, and add candidate data erasure (`DELETE /api/v1/sessions/:sessionId/data`).
- `9d72b0a` — **feat(loop-10):** fail-closed `RUNNER_EXECUTION_ENABLED` gate, passwordless single-use Magic Link auth, and decoupled invite window vs attempt duration.

### Loop 8 – 9.1: Scoring Fairness, OCI/gVisor Runner, ZIP Import & Adversarial Verification
- `b44964b` — **feat(loop-9.1):** Ubuntu 24.04 + rootless Podman/gVisor (`runsc`) deployment bundle, mutual `CODE_RUNNER_SECRET` auth, and 12-gate adversarial security verification script.
- `d32cd3a` — **feat(loop-9):** decoupled standalone runner service, per-language runtime envelopes, polyglot compiler drivers, and streaming PKZip parser (`ZipIngestService`) with Zip Slip / bomb protection.
- `11e340e` — **feat(loop-8):** scoring fairness with N/A weight redistribution, non-punitive evidentiary proctoring redesign, Drizzle migration `0001_careless_killraven.sql`, and production auth hardening.

### Loop 6 – 7: Multi-Task Studio, PostgreSQL/PGlite Persistence & Proctor Control Room
- `c3fefba` — **feat(loop-7):** real-time proctoring control room, passive telemetry metrics, and incident workflow.
- `c1c4c7c` / `317fbe0` — **fix(practice/persistence):** polyglot verification fixes and `taskSubmissions` mapping in `SubmissionRepository`.
- `cd95146` / `abe1329` — **feat(loop-6):** Company Assessment Studio (`question_set`, `coding_challenge`, `repository_task`) and multi-task workspace integration.
- `2c9cf36` — **feat(api):** dual-engine PostgreSQL (`pg.Pool`) + embedded `PGlite` persistence with Drizzle ORM (`LOOP 6.1`).

### Foundation & Core Platform (Tasks 1–22)
- `6392d17` — **feat(polyglot):** multi-language domain support (TypeScript, JavaScript, Python, Go, Java, C++, Rust) and top-level React `ErrorBoundary`.
- `3eefcb5` — **feat(capture):** multimodal screen capture & OCR question ingest (Task 22).
- `c3b9ec3` — **feat(practice):** interactive Practice Studio catalog and instant 7-dimension diagnostic feedback (Task 21).
- `3fda684` — **feat(analytics):** AI cost analytics ledger, burn rate projection, and anomaly detection (Task 20).
- `b8962fe` — **feat(webhooks):** signed HMAC-SHA256 ATS/HRIS webhooks with retry backoff (Task 19).
- `213aa37` — **feat(security):** multi-tenant IDOR protection and brute-force rate-limiting penetration suite (Task 18).
- `3873048` — **feat(reports):** evidence-linked hiring decision reports, tamper seals, and HTML/PDF export (Task 17).
- `f0a85ed` / `317fbc0` — **feat(calibration):** blind multi-reviewer scorecard calibration and spread alerts (Task 16).
- `a4fc469` — **feat(proctor):** session pause/resume with deadline credit extension and crash recovery (Task 15).
- `afb44dc` — **feat(submission):** immutable SHA-256 artifact bundling (Task 14).
- `727b7ba` / `2073260` / `60609e9` — **feat(telemetry/workspace/session):** monotonic telemetry events, 20s autosave, and server deadlines (Tasks 11–13).
- `d836869` / `9c2a355` / `676e90f` / `71dcb50` / `4e68df4` — **feat(org/auth/templates/invitations):** multi-tenancy, RBAC, immutable SHA-256 template versions, and 32-byte candidate invitations (Tasks 6–10).
- `9c04d20` / `493726b` / `87a9863` / `185b1b1` — **feat:** monorepo scaffold, token-score decoupling (AD #4), explicit patch review (AD #7), isolated sandbox (AD #8), and two-phase budget reservation (AD #5).
