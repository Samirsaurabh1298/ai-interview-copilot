import React, { useState, useEffect } from "react";
import {
  Terminal,
  Clock,
  ShieldCheck,
  Cpu,
  CheckCircle2,
  Lock,
  ArrowRight,
  Copy,
  Check,
  Eye,
  Play,
  RotateCcw,
  Sparkles,
  ChevronRight,
  Layers,
  Fingerprint,
  Zap,
} from "lucide-react";

interface ProductBentoShowcaseProps {
  onExit?: () => void;
  onLaunchAssessment?: () => void;
}

export const ProductBentoShowcase: React.FC<ProductBentoShowcaseProps> = ({
  onExit,
  onLaunchAssessment,
}) => {
  // Interactive State for Panel 1: Code & Tests
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState([
    { name: "filters tickets by query string", passed: true, duration: "14ms" },
    { name: "sorts descending by priority", passed: true, duration: "8ms" },
    { name: "handles undefined tags safely", passed: true, duration: "5ms" },
  ]);

  // Interactive State for Panel 2: Live Server Watchdog Clock
  const [watchdogSeconds, setWatchdogSeconds] = useState(3524);
  const [isGraceActive, setIsGraceActive] = useState(false);

  // Interactive State for Panel 3: Hiring Team Telemetry View
  const [activeTelemetryTab, setActiveTelemetryTab] = useState<"factual" | "policy">("factual");

  // Interactive State for Panel 4: Cryptographic Fingerprint
  const [copiedFingerprint, setCopiedFingerprint] = useState(false);
  const fingerprintHash = "e7f9a2b841029c3de776b910e5d0a1b89412f86429c017e84a22b0f47c32d91e";

  useEffect(() => {
    const timer = setInterval(() => {
      setWatchdogSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleRunTestsSim = () => {
    setIsRunningTests(true);
    setTimeout(() => {
      setIsRunningTests(false);
    }, 900);
  };

  const handleCopyFingerprint = () => {
    navigator.clipboard?.writeText(fingerprintHash);
    setCopiedFingerprint(true);
    setTimeout(() => setCopiedFingerprint(false), 2000);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#080c14] text-slate-100 overflow-y-auto font-sans p-6 sm:p-10 select-none">
      {/* Top Navigation Banner */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between pb-8 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">
                AI Coding Assessment Platform
              </h2>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/50">
                Design Partner Showcase
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Production Architecture Bento: Server Authority, Ethical Telemetry & Cryptographic Verification
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onLaunchAssessment && (
            <button
              onClick={onLaunchAssessment}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <span>Try Live Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          {onExit && (
            <button
              onClick={onExit}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs border border-slate-700/60 transition-all cursor-pointer"
            >
              Back to Dashboard
            </button>
          )}
        </div>
      </div>

      {/* Main 4-Panel Bento Grid */}
      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 mt-8">
        {/* PANEL 1: Candidate Cockpit (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-800/90 bg-[#0d131f]/90 backdrop-blur-md p-6 shadow-xl flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 font-mono text-xs text-slate-400">src/useTicketQueue.ts</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-md">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>3/3 Tests Passed</span>
                </span>
                <button
                  onClick={handleRunTestsSim}
                  disabled={isRunningTests}
                  className="flex items-center gap-1 text-[11px] font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1 rounded-md transition-all cursor-pointer"
                >
                  {isRunningTests ? (
                    <RotateCcw className="w-3 h-3 animate-spin text-indigo-400" />
                  ) : (
                    <Play className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                  )}
                  <span>{isRunningTests ? "Running..." : "Run Tests"}</span>
                </button>
              </div>
            </div>

            {/* Code Snippet Window */}
            <div className="mt-4 p-4 rounded-xl bg-[#06090e] border border-slate-800/60 font-mono text-xs text-slate-300 space-y-1.5 leading-relaxed overflow-x-auto">
              <div className="text-slate-500">// Pure immutability: Avoids in-place array mutation</div>
              <div>
                <span className="text-purple-400">export function</span>{" "}
                <span className="text-blue-400">filterAndSortTickets</span>
                (tickets: <span className="text-amber-300">Ticket[]</span>):{" "}
                <span className="text-amber-300">Ticket[]</span> &#123;
              </div>
              <div className="pl-4 text-slate-400">
                <span className="text-purple-400">const</span> filtered = tickets.
                <span className="text-blue-300">filter</span>((t) =&gt; t.tags?.
                <span className="text-blue-300">length</span> &gt; <span className="text-amber-300">0</span>);
              </div>
              <div className="pl-4">
                <span className="text-purple-400">return</span> [...filtered].
                <span className="text-blue-300">sort</span>((a, b) =&gt; &#123;
              </div>
              <div className="pl-8 text-emerald-300">
                <span className="text-purple-400">const</span> weightA = PRIORITY_WEIGHTS[a.priority] || 0;
              </div>
              <div className="pl-8 text-emerald-300">
                <span className="text-purple-400">const</span> weightB = PRIORITY_WEIGHTS[b.priority] || 0;
              </div>
              <div className="pl-8 text-emerald-400 font-semibold">
                <span className="text-purple-400">return</span> weightB - weightA;{" "}
                <span className="text-slate-500 text-[10px] font-normal">// Deterministic priority order</span>
              </div>
              <div className="pl-4">&#125;);</div>
              <div>&#125;</div>
            </div>

            {/* Test Runner Feedback Area */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {testResults.map((test, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-lg border border-slate-800 bg-[#090d16] flex items-center justify-between text-[11px]"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-slate-300 truncate">{test.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-1">{test.duration}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              Isolated Node 22 Sandbox Runner
            </span>
            <span className="text-[11px] text-slate-500 font-mono">Zero host filesystem escape</span>
          </div>
        </div>

        {/* PANEL 2: Server-Authoritative Watchdog (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-800/90 bg-[#0d131f]/90 backdrop-blur-md p-6 shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                Server-Authoritative Clock
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
                ±0ms drift
              </span>
            </div>

            {/* Large Countdown Display */}
            <div className="mt-6 text-center space-y-2">
              <div className="font-mono text-4xl sm:text-5xl font-extrabold tracking-tight text-white bg-clip-text">
                {formatTimer(watchdogSeconds)}
              </div>
              <p className="text-xs text-slate-400">
                Server wall-clock expiration with continuous client reconciliation
              </p>
            </div>

            {/* Policy Badges */}
            <div className="mt-6 space-y-2.5">
              <div className="p-3 rounded-xl border border-slate-800 bg-[#090d16] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-slate-300 font-medium">Network Grace Window</span>
                </div>
                <span className="text-xs font-mono font-semibold text-emerald-400">60s In-Flight Buffer</span>
              </div>

              <div className="p-3 rounded-xl border border-slate-800 bg-[#090d16] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-xs text-slate-300 font-medium">Post-Deadline Mutation Guard</span>
                </div>
                <span className="text-xs font-mono font-semibold text-rose-400">HTTP 410 LOCKED</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Automatic Snapshot Recovery</span>
              <span className="text-emerald-400 font-semibold text-[11px]">Guaranteed Terminal State</span>
            </div>
          </div>
        </div>

        {/* PANEL 3: Ethical Factual Telemetry (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-800/90 bg-[#0d131f]/90 backdrop-blur-md p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                Ethical Evidence Telemetry
              </span>
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded-full">
                No AI Proctor Scores
              </span>
            </div>

            <div className="mt-4 flex rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-xs">
              <button
                onClick={() => setActiveTelemetryTab("factual")}
                className={`flex-1 py-1 rounded-md transition-all font-medium ${
                  activeTelemetryTab === "factual"
                    ? "bg-slate-800 text-white shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Disclosed Technical Events
              </button>
              <button
                onClick={() => setActiveTelemetryTab("policy")}
                className={`flex-1 py-1 rounded-md transition-all font-medium ${
                  activeTelemetryTab === "policy"
                    ? "bg-slate-800 text-white shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Zero-Creepiness Invariant
              </button>
            </div>

            {/* Event Timeline */}
            {activeTelemetryTab === "factual" ? (
              <div className="mt-4 space-y-2 font-mono text-[11px]">
                <div className="p-2.5 rounded-lg border border-slate-800/80 bg-[#090d16] flex items-center justify-between">
                  <span className="text-slate-300">10:14:02 · Window blur / focus return</span>
                  <span className="text-slate-500">1.4s gap</span>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-800/80 bg-[#090d16] flex items-center justify-between">
                  <span className="text-slate-300">10:22:45 · Clipboard paste (18 chars)</span>
                  <span className="text-indigo-400">STARTER_DIFF</span>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-800/80 bg-[#090d16] flex items-center justify-between">
                  <span className="text-slate-300">10:35:10 · Technical reconnection</span>
                  <span className="text-emerald-400">ACK 200</span>
                </div>
              </div>
            ) : (
              <div className="mt-4 p-4 rounded-xl border border-indigo-900/40 bg-indigo-950/20 text-xs text-indigo-200 space-y-2 leading-relaxed">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Candidate Trust Guarantee
                </div>
                <p className="text-[11px] text-slate-300">
                  No keystroke cadence monitoring. No webcam eye tracking. No automated 0–100 cheat scores. Evaluators see purely factual technical event timelines.
                </p>
              </div>
            )}
          </div>

          <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>AI Token Budget:</span>
            <span className="font-mono text-slate-200 font-semibold">$0.048 / $0.250 consumed</span>
          </div>
        </div>

        {/* PANEL 4: Cryptographic SHA-256 Tamper-Proof Seal (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-800/90 bg-[#0d131f]/90 backdrop-blur-md p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Fingerprint className="w-3.5 h-3.5 text-indigo-400" />
                Cryptographic Artifact & Seal
              </span>
              <span className="text-[10px] font-mono text-slate-400">SHA-256 Canonical JSON</span>
            </div>

            <p className="text-xs text-slate-400 mt-4 leading-relaxed">
              Every candidate submission, line diff, test execution output, and audit event stream is bundled into an immutable, cryptographically fingerprinted artifact.
            </p>

            {/* Fingerprint Display Pill */}
            <div className="mt-4 p-3.5 rounded-xl border border-slate-800 bg-[#06090e] flex items-center justify-between gap-3">
              <div className="font-mono text-xs text-indigo-300 truncate">{fingerprintHash}</div>
              <button
                onClick={handleCopyFingerprint}
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg border border-slate-700 transition-all shrink-0 cursor-pointer"
              >
                {copiedFingerprint ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedFingerprint ? "Copied" : "Copy Hash"}</span>
              </button>
            </div>

            {/* Audit Properties */}
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-slate-800/80 bg-[#090d16]">
                <div className="text-slate-400 text-[11px]">Magic-Link Auth</div>
                <div className="font-semibold text-slate-200 mt-0.5">Single-Use HMAC-SHA256</div>
              </div>
              <div className="p-3 rounded-lg border border-slate-800/80 bg-[#090d16]">
                <div className="text-slate-400 text-[11px]">Audit Event Log</div>
                <div className="font-semibold text-slate-200 mt-0.5">Append-Only Monotonic Seq</div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Evaluation Integrity:</span>
            <span className="text-emerald-400 font-semibold text-[11px]">Sealed & Irreversible</span>
          </div>
        </div>
      </div>
    </div>
  );
};

