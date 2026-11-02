import { randomUUID } from "node:crypto";
import type {
  PracticeChallenge,
  PracticeDifficulty,
  PracticeFeedbackCard,
  PracticeFeedbackDimension,
  PracticeSubmissionRequest,
  PracticeTrack,
  RubricDimensionId,
} from "@ai-copilot/contracts";

export class PracticeStudioService {
  private challenges: Map<string, PracticeChallenge> = new Map();

  constructor() {
    this.seedDefaultChallenges();
  }

  private seedDefaultChallenges(): void {
    const catalog: PracticeChallenge[] = [
      {
        id: "chal_frontend_ticket_queue",
        slug: "react-immutable-ticket-queue",
        title: "React Concurrent Ticket Queue & Priority Inversion",
        track: "frontend",
        difficulty: "mid",
        estimatedMinutes: 45,
        description: `### Challenge Context
You are working on a high-traffic support triage dashboard. Support agents have reported two critical defects:
1. **Stale Ticket Loss:** When multiple tickets are resolved in rapid succession, earlier tickets reappear because of stale state closures in async handlers.
2. **Priority Inversion:** High-priority tickets (P0/Critical) are intermittently placed behind P2/Low tickets when sorting with identical timestamps.
3. **Array Mutation Crash:** A \`.sort()\` invocation directly mutates state, triggering React re-render loops and breaking shallow equality memoization.

### Objectives
- Refactor the queue reducer / hook to enforce 100% state immutability.
- Ensure stable multi-key sorting (Priority descending: P0 > P1 > P2, then Timestamp ascending).
- All 5 verification unit tests must pass in the isolated sandbox.`,
        starterCode: `export interface Ticket {
  id: string;
  title: string;
  priority: "P0" | "P1" | "P2";
  createdAt: number;
  tags?: string[];
}

export function sortTickets(tickets: Ticket[]): Ticket[] {
  // BUG: Mutates original array in place and lacks secondary timestamp sort
  return tickets.sort((a, b) => {
    const pOrder = { P0: 3, P1: 2, P2: 1 };
    return pOrder[b.priority] - pOrder[a.priority];
  });
}

export function resolveTicket(queue: Ticket[], ticketId: string): Ticket[] {
  // BUG: Direct mutation with splice
  const idx = queue.findIndex(t => t.id === ticketId);
  if (idx !== -1) {
    queue.splice(idx, 1);
  }
  return queue;
}`,
        verificationTestCode: `import { test } from "node:test";
import assert from "node:assert/strict";
import { sortTickets, resolveTicket, Ticket } from "./candidateSolution.js";

test("sortTickets preserves array immutability", () => {
  const original: Ticket[] = [
    { id: "1", title: "Bug A", priority: "P2", createdAt: 100 },
    { id: "2", title: "Bug B", priority: "P0", createdAt: 200 }
  ];
  const originalSnapshot = JSON.stringify(original);
  const sorted = sortTickets(original);
  assert.equal(JSON.stringify(original), originalSnapshot, "Original array must not be mutated");
  assert.notEqual(sorted, original, "Should return a fresh array reference");
});

test("sortTickets orders by priority P0 > P1 > P2", () => {
  const tickets: Ticket[] = [
    { id: "1", title: "Low", priority: "P2", createdAt: 100 },
    { id: "2", title: "High", priority: "P0", createdAt: 200 },
    { id: "3", title: "Med", priority: "P1", createdAt: 150 }
  ];
  const sorted = sortTickets(tickets);
  assert.deepEqual(sorted.map(t => t.id), ["2", "3", "1"]);
});

test("sortTickets applies secondary FIFO sort on equal priority", () => {
  const tickets: Ticket[] = [
    { id: "late", title: "Late P0", priority: "P0", createdAt: 500 },
    { id: "early", title: "Early P0", priority: "P0", createdAt: 100 }
  ];
  const sorted = sortTickets(tickets);
  assert.deepEqual(sorted.map(t => t.id), ["early", "late"]);
});

test("resolveTicket immutably removes target ticket", () => {
  const queue: Ticket[] = [
    { id: "1", title: "A", priority: "P0", createdAt: 1 },
    { id: "2", title: "B", priority: "P1", createdAt: 2 }
  ];
  const next = resolveTicket(queue, "1");
  assert.equal(queue.length, 2, "Original queue must remain untouched");
  assert.equal(next.length, 1);
  assert.equal(next[0].id, "2");
});

test("resolveTicket handles non-existent ticket gracefully", () => {
  const queue: Ticket[] = [{ id: "1", title: "A", priority: "P0", createdAt: 1 }];
  const next = resolveTicket(queue, "999");
  assert.equal(next.length, 1);
});`,
        solutionTemplate: `export function sortTickets(tickets: Ticket[]): Ticket[] {
  const pWeight = { P0: 3, P1: 2, P2: 1 };
  return [...tickets].sort((a, b) => {
    const diff = pWeight[b.priority] - pWeight[a.priority];
    if (diff !== 0) return diff;
    return a.createdAt - b.createdAt;
  });
}

export function resolveTicket(queue: Ticket[], ticketId: string): Ticket[] {
  return queue.filter(t => t.id !== ticketId);
}`,
        hints: [
          "Use the spread operator [...tickets] before calling .sort() to prevent mutating caller state.",
          "Check both priority difference and creation timestamp difference for deterministic ordering.",
          "Use queue.filter() for an immutable removal pattern.",
        ],
        simulatedAiBudgetUsd: 0.25,
        tags: ["react", "typescript", "immutability", "sorting", "frontend"],
      },
      {
        id: "chal_backend_lru_cache",
        slug: "algorithmic-lru-cache-ttl",
        title: "High-Throughput LRU Cache with TTL Eviction",
        track: "backend",
        difficulty: "senior",
        estimatedMinutes: 50,
        description: `### Challenge Context
Design and implement an in-memory Least Recently Used (LRU) Cache in TypeScript with time-to-live (TTL) support for high-throughput API endpoints.

### Objectives
- \`get(key: string): V | undefined\`: O(1) average time complexity. Accessing a key refreshes its recency. If expired by TTL, return \`undefined\` and purge it.
- \`put(key: string, value: V, ttlMs?: number): void\`: O(1) average time complexity. If capacity is exceeded, evict the least recently used key.
- Provide accurate \`size\` reporting.
- Prohibit memory leaks and pass all concurrency and expiration tests.`,
        starterCode: `export class LruCache<K, V> {
  private capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  get(key: K): V | undefined {
    // TODO: Implement O(1) get with recency update & TTL check
    return undefined;
  }

  put(key: K, value: V, ttlMs?: number): void {
    // TODO: Implement O(1) put with LRU eviction
  }

  get size(): number {
    return 0;
  }
}`,
        verificationTestCode: `import { test } from "node:test";
import assert from "node:assert/strict";
import { LruCache } from "./candidateSolution.js";

test("LruCache stores and retrieves values", () => {
  const cache = new LruCache<string, number>(2);
  cache.put("a", 1);
  cache.put("b", 2);
  assert.equal(cache.get("a"), 1);
  assert.equal(cache.get("b"), 2);
});

test("LruCache evicts least recently used on capacity overflow", () => {
  const cache = new LruCache<string, number>(2);
  cache.put("a", 1);
  cache.put("b", 2);
  cache.get("a"); // a becomes most recently used
  cache.put("c", 3); // b should be evicted
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("a"), 1);
  assert.equal(cache.get("c"), 3);
});

test("LruCache respects TTL expiration", async () => {
  const cache = new LruCache<string, string>(5);
  cache.put("quick", "expires", 20); // 20ms TTL
  assert.equal(cache.get("quick"), "expires");
  await new Promise(r => setTimeout(r, 40));
  assert.equal(cache.get("quick"), undefined, "Expired key must return undefined");
});

test("LruCache reports accurate size count", () => {
  const cache = new LruCache<string, number>(3);
  cache.put("x", 10);
  cache.put("y", 20);
  assert.equal(cache.size, 2);
  cache.put("z", 30);
  assert.equal(cache.size, 3);
  cache.put("overflow", 40);
  assert.equal(cache.size, 3, "Size must cap at capacity");
});`,
        hints: [
          "JavaScript's Map preserves insertion order. Deleting and re-setting a key moves it to the most recent position in O(1).",
          "Store { value, expiresAt?: number } inside the map to support optional TTL expiration cleanly.",
          "To evict the oldest key in O(1): this.map.keys().next().value gives the least recently used key.",
        ],
        simulatedAiBudgetUsd: 0.25,
        tags: ["data-structures", "lru-cache", "ttl", "concurrency", "backend"],
      },
      {
        id: "chal_systems_concurrency_limiter",
        slug: "async-concurrency-limiter",
        title: "Fair Asynchronous Semaphore & Rate Limiter",
        track: "systems",
        difficulty: "staff",
        estimatedMinutes: 60,
        description: `### Challenge Context
Build an enterprise-grade async concurrency limiter (\`ConcurrencyLimiter\`) in TypeScript to throttle outgoing third-party LLM API requests.

### Objectives
- \`run<T>(task: () => Promise<T>, options?: { timeoutMs?: number }): Promise<T>\`
- Limits concurrent executions to \`maxConcurrency\`.
- Queued tasks must execute strictly in FIFO arrival order (zero starvation).
- Supports per-task execution timeout; on timeout, cancel waiting or reject promise with a \`TimeoutError\`.
- Never unhandled rejections; properly propagate errors while freeing concurrency slots immediately for waiting tasks.`,
        starterCode: `export class ConcurrencyLimiter {
  private maxConcurrency: number;

  constructor(maxConcurrency: number) {
    this.maxConcurrency = maxConcurrency;
  }

  async run<T>(task: () => Promise<T>, options?: { timeoutMs?: number }): Promise<T> {
    // TODO: Implement FIFO queue, active counter, slot release in finally block, and optional timeout
    return task();
  }

  get activeCount(): number {
    return 0;
  }

  get pendingCount(): number {
    return 0;
  }
}`,
        verificationTestCode: `import { test } from "node:test";
import assert from "node:assert/strict";
import { ConcurrencyLimiter } from "./candidateSolution.js";

test("ConcurrencyLimiter caps active concurrency to threshold", async () => {
  const limiter = new ConcurrencyLimiter(2);
  let activeMax = 0;
  let active = 0;

  const makeTask = (ms: number) => async () => {
    active++;
    activeMax = Math.max(activeMax, active);
    await new Promise(r => setTimeout(r, ms));
    active--;
    return ms;
  };

  await Promise.all([
    limiter.run(makeTask(50)),
    limiter.run(makeTask(50)),
    limiter.run(makeTask(50)),
    limiter.run(makeTask(50))
  ]);

  assert.equal(activeMax, 2, "Max concurrent tasks must never exceed 2");
});

test("ConcurrencyLimiter executes queued tasks in FIFO order", async () => {
  const limiter = new ConcurrencyLimiter(1);
  const order: number[] = [];

  const t1 = limiter.run(async () => {
    await new Promise(r => setTimeout(r, 30));
    order.push(1);
  });
  const t2 = limiter.run(async () => {
    order.push(2);
  });
  const t3 = limiter.run(async () => {
    order.push(3);
  });

  await Promise.all([t1, t2, t3]);
  assert.deepEqual(order, [1, 2, 3], "Must execute tasks in strict FIFO order");
});

test("ConcurrencyLimiter frees slot when task throws error", async () => {
  const limiter = new ConcurrencyLimiter(1);
  await assert.rejects(
    limiter.run(async () => {
      throw new Error("Task failed");
    }),
    /Task failed/
  );

  // Slot should be free for next task
  const res = await limiter.run(async () => "recovered");
  assert.equal(res, "recovered");
  assert.equal(limiter.activeCount, 0);
});`,
        hints: [
          "Maintain an internal Array of resolver callbacks: Array<{ execute: () => void, reject: (err: any) => void }>",
          "Always wrap the task execution in a try / finally block so the next queued task is dispatched immediately upon completion or failure.",
          "For timeout support, use Promise.race between the task and a timer promise.",
        ],
        simulatedAiBudgetUsd: 0.35,
        tags: ["concurrency", "async", "semaphore", "rate-limiting", "systems"],
      },
    ];

    for (const challenge of catalog) {
      this.challenges.set(challenge.id, challenge);
    }
  }

  public listChallenges(track?: PracticeTrack, difficulty?: PracticeDifficulty): PracticeChallenge[] {
    let list = Array.from(this.challenges.values());
    if (track) list = list.filter((c) => c.track === track);
    if (difficulty) list = list.filter((c) => c.difficulty === difficulty);
    return list;
  }

  public getChallengeById(id: string): PracticeChallenge | undefined {
    return this.challenges.get(id);
  }

  /**
   * Evaluates candidate practice submission against the 7-dimension rubric
   * and computes instant diagnostic feedback card.
   */
  public evaluatePracticeSubmission(req: PracticeSubmissionRequest): PracticeFeedbackCard {
    const challenge = this.challenges.get(req.challengeId);
    const challengeTitle = challenge?.title || "Practice Challenge";
    const track = challenge?.track || "frontend";
    const difficulty = challenge?.difficulty || "mid";
    const allocatedMinutes = challenge?.estimatedMinutes || 45;

    const testRate = req.testResults.total > 0
      ? (req.testResults.passed / req.testResults.total) * 100
      : 0;

    // Dimension 1: Code Comprehension & Localization (Weight: 20%)
    const compRating: 1 | 2 | 3 | 4 = testRate === 100 ? 4 : testRate >= 75 ? 3 : testRate >= 40 ? 2 : 1;
    const compScore = compRating * 25; // 0-100 base

    // Dimension 2: Problem Framing & Architecture (Weight: 10%)
    const explLen = req.technicalExplanation.trim().length;
    const frameRating: 1 | 2 | 3 | 4 = explLen > 150 ? 4 : explLen > 60 ? 3 : explLen > 20 ? 2 : 1;

    // Dimension 3: AI Collaboration Efficiency (Weight: 15%)
    // Good collaboration: asks focused questions, doesn't spam runaway prompt loops
    let aiCollabRating: 1 | 2 | 3 | 4 = 3;
    if (req.aiQueriesCount <= 6 && req.aiQueriesCount >= 1 && req.aiBudgetConsumedUsd <= 0.15) {
      aiCollabRating = 4; // High signal-to-token ratio
    } else if (req.aiQueriesCount > 15 || req.aiBudgetConsumedUsd > 0.22) {
      aiCollabRating = 2; // Over-querying
    } else if (req.aiQueriesCount === 0) {
      aiCollabRating = 3; // Fully autonomous
    }

    // Dimension 4: Critical Evaluation & Patch Scrutiny (Weight: 15%)
    // Did candidate reject suboptimal or hallucinated suggestions?
    let critRating: 1 | 2 | 3 | 4 = 3;
    if (req.patchesRejected >= 1 && req.patchesAccepted >= 1) {
      critRating = 4; // Demonstrated discernment
    } else if (req.patchesAccepted > 3 && req.patchesRejected === 0) {
      critRating = 2; // Potential blind acceptance
    }

    // Dimension 5: Debugging & Code Quality (Weight: 15%)
    const debugRating: 1 | 2 | 3 | 4 = testRate === 100 ? 4 : testRate >= 60 ? 3 : 2;

    // Dimension 6: Testing & Verification Discipline (Weight: 15%)
    const testRuns = req.testRunsCount;
    let testDiscRating: 1 | 2 | 3 | 4 = 3;
    if (testRuns >= 3 && testRate === 100) {
      testDiscRating = 4; // Iterative test-driven approach
    } else if (testRuns === 0) {
      testDiscRating = 1; // Never ran tests
    } else if (testRuns === 1 && testRate < 100) {
      testDiscRating = 2;
    }

    // Dimension 7: Technical Explanation & Justification (Weight: 10%)
    let explRating: 1 | 2 | 3 | 4 = 2;
    if (explLen > 120 && testRate === 100) {
      explRating = 4;
    } else if (explLen > 40) {
      explRating = 3;
    }

    const ratingToLabel = (r: 1 | 2 | 3 | 4): "Developing" | "Competent" | "Advanced" | "Exemplary" => {
      switch (r) {
        case 4: return "Exemplary";
        case 3: return "Advanced";
        case 2: return "Competent";
        default: return "Developing";
      }
    };

    const dimensions: PracticeFeedbackDimension[] = [
      {
        dimensionId: "code-comprehension",
        name: "Code Comprehension & Localization",
        rating: compRating,
        weight: 20,
        weightedScore: (compRating / 4) * 20,
        levelLabel: ratingToLabel(compRating),
        rationale: testRate === 100
          ? "Targeted edits addressed root-cause defects without collateral regressions."
          : `Localized partially; passed ${req.testResults.passed} of ${req.testResults.total} assertions.`,
        keyStrengths: testRate >= 80 ? ["Accurately identified mutation side-effects", "Preserved API contracts"] : ["Understood general architecture"],
        growthAreas: testRate < 100 ? ["Watch out for edge-case invariants", "Check immutable copy semantics"] : [],
      },
      {
        dimensionId: "problem-framing",
        name: "Problem Framing & Architecture",
        rating: frameRating,
        weight: 10,
        weightedScore: (frameRating / 4) * 10,
        levelLabel: ratingToLabel(frameRating),
        rationale: explLen > 60
          ? "Articulated problem constraints and structured resolution before coding."
          : "Minimal framing observed in architectural explanation.",
        keyStrengths: ["Clear recognition of data-flow bottlenecks"],
        growthAreas: explLen < 60 ? ["Document design trade-offs more explicitly"] : [],
      },
      {
        dimensionId: "ai-collaboration",
        name: "AI Collaboration Efficiency",
        rating: aiCollabRating,
        weight: 15,
        weightedScore: (aiCollabRating / 4) * 15,
        levelLabel: ratingToLabel(aiCollabRating),
        rationale: `Asked ${req.aiQueriesCount} AI queries with $${req.aiBudgetConsumedUsd.toFixed(3)} budget consumed. Signal-to-token ratio was optimal.`,
        keyStrengths: ["Kept AI prompts bounded and targeted", "Maintained budget control"],
        growthAreas: req.aiQueriesCount > 10 ? ["Formulate more concise queries to preserve budget"] : [],
      },
      {
        dimensionId: "critical-evaluation",
        name: "Critical Evaluation of AI Suggestions",
        rating: critRating,
        weight: 15,
        weightedScore: (critRating / 4) * 15,
        levelLabel: ratingToLabel(critRating),
        rationale: req.patchesRejected > 0
          ? `Scrutinized AI outputs: accepted ${req.patchesAccepted} patches, rejected ${req.patchesRejected} hallucinated/suboptimal diffs.`
          : "Accepted all AI patches without documented rejection; ensure AI output is always verified against security & performance criteria.",
        keyStrengths: req.patchesRejected > 0 ? ["Active skepticism of AI hallucination"] : ["Efficient code integration"],
        growthAreas: req.patchesRejected === 0 ? ["Practice rejecting suboptimal AI suggestions"] : [],
      },
      {
        dimensionId: "debugging-implementation",
        name: "Debugging & Implementation Quality",
        rating: debugRating,
        weight: 15,
        weightedScore: (debugRating / 4) * 15,
        levelLabel: ratingToLabel(debugRating),
        rationale: testRate === 100
          ? "Clean, idiomatic TypeScript implementation satisfying all contract constraints."
          : `Implementation has unresolved edge cases (${req.testResults.passed}/${req.testResults.total} passed).`,
        keyStrengths: ["Clean code structure", "Preserved interface definitions"],
        growthAreas: testRate < 100 ? ["Double check return types and null checks"] : [],
      },
      {
        dimensionId: "testing-verification",
        name: "Testing & Verification Discipline",
        rating: testDiscRating,
        weight: 15,
        weightedScore: (testDiscRating / 4) * 15,
        levelLabel: ratingToLabel(testDiscRating),
        rationale: `Executed sandbox test suite ${testRuns} times, verifying fixes iteratively.`,
        keyStrengths: ["Frequent sandbox verification runs"],
        growthAreas: testRuns < 2 ? ["Run tests incrementally after each code patch"] : [],
      },
      {
        dimensionId: "explanation-judgment",
        name: "Technical Explanation & Judgment",
        rating: explRating,
        weight: 10,
        weightedScore: (explRating / 4) * 10,
        levelLabel: ratingToLabel(explRating),
        rationale: explLen > 40
          ? "Concise explanation clearly stated root cause, fix rationale, and complexity trade-offs."
          : "Explanation was brief; expand on algorithmic trade-offs for stronger engineering signal.",
        keyStrengths: ["Clear communication of fix intent"],
        growthAreas: explLen < 80 ? ["Include asymptotic Big-O complexity in technical summary"] : [],
      },
    ];

    const compositeScore = Math.round(
      dimensions.reduce((acc, d) => acc + d.weightedScore, 0)
    );

    let recommendation: "strong_hire" | "hire" | "lean_hire" | "no_hire" = "no_hire";
    if (compositeScore >= 85) recommendation = "strong_hire";
    else if (compositeScore >= 70) recommendation = "hire";
    else if (compositeScore >= 55) recommendation = "lean_hire";

    // AI Reliance Index
    const totalPatches = req.patchesAccepted + req.patchesRejected;
    const scrutinyRatio = totalPatches > 0 ? req.patchesRejected / totalPatches : 0;
    let relianceLabel: "Autonomous Coder" | "Balanced AI Collaborator" | "Over-Reliant on Suggestions" | "Critical & Methodical Reviewer" = "Balanced AI Collaborator";
    if (req.aiQueriesCount <= 1) {
      relianceLabel = "Autonomous Coder";
    } else if (req.patchesRejected >= 1) {
      relianceLabel = "Critical & Methodical Reviewer";
    } else if (req.aiQueriesCount > 10 && req.patchesRejected === 0) {
      relianceLabel = "Over-Reliant on Suggestions";
    }

    const elapsedMinutes = Math.round((req.elapsedSeconds / 60) * 10) / 10;

    return {
      id: `pcard_${randomUUID().slice(0, 12)}`,
      challengeId: req.challengeId,
      challengeTitle,
      track,
      difficulty,
      compositeScore,
      recommendation,
      submittedAt: new Date(),
      dimensions,
      aiRelianceIndex: {
        score: Math.min(100, Math.round(req.aiQueriesCount * 6 + req.patchesAccepted * 8)),
        label: relianceLabel,
        patchesAccepted: req.patchesAccepted,
        patchesRejected: req.patchesRejected,
        scrutinyRatio: Math.round(scrutinyRatio * 100) / 100,
        queriesCount: req.aiQueriesCount,
      },
      speedAndPrecision: {
        elapsedMinutes,
        timeAllocatedMinutes: allocatedMinutes,
        testPassRatePercent: Math.round(testRate),
        testsPassed: req.testResults.passed,
        testsTotal: req.testResults.total,
      },
      executiveSummary: `Completed in ${elapsedMinutes}m with ${Math.round(testRate)}% test pass rate. Composite assessment signal: ${compositeScore}/100 pts (${recommendation.replace("_", " ").toUpperCase()}).`,
      actionableTakeaways: [
        testRate < 100
          ? "Prioritize edge cases: review the failing assertions to uncover hidden boundary bugs."
          : "Superb implementation correctness: all isolated sandbox tests passed cleanly.",
        req.patchesRejected === 0 && req.patchesAccepted > 1
          ? "Hiring managers look for critical evaluation: reject or modify AI patches when you identify suboptimal patterns."
          : "Excellent AI collaboration discipline: you balanced AI speed with critical verification.",
        "Practice communicating runtime complexity (Big-O) in your technical explanation.",
      ],
      recommendedNextChallenges: [
        "algorithmic-lru-cache-ttl",
        "async-concurrency-limiter",
      ],
    };
  }
}

