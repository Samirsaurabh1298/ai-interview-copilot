import React, { useState } from "react";
import {
  X,
  Award,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ShieldCheck,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Download,
  Info,
} from "lucide-react";
import type { AssessmentScorecard, RubricRatingAnchor } from "@ai-copilot/contracts";

interface ScorecardModalProps {
  scorecard: AssessmentScorecard | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ScorecardModal: React.FC<ScorecardModalProps> = ({
  scorecard,
  isOpen,
  onClose,
}) => {
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null);
  const [reviewerNotes, setReviewerNotes] = useState<Record<string, string>>({});
  const [reviewerRatings, setReviewerRatings] = useState<Record<string, RubricRatingAnchor>>({});
  const [isCalibrated, setIsCalibrated] = useState(false);

  if (!isOpen || !scorecard) return null;

  const toggleExpand = (dimId: string) => {
    setExpandedDimension((prev) => (prev === dimId ? null : dimId));
  };

  const handleRatingChange = (dimId: string, rating: RubricRatingAnchor) => {
    setReviewerRatings((prev) => ({ ...prev, [dimId]: rating }));
  };

  const handleNoteChange = (dimId: string, note: string) => {
    setReviewerNotes((prev) => ({ ...prev, [dimId]: note }));
  };

  // Compute total points with reviewer overrides
  const effectiveTotalScore = Math.round(
    scorecard.dimensions.reduce((acc, dim) => {
      const activeRating = reviewerRatings[dim.dimensionId] ?? dim.rating;
      const points = Math.round(dim.weight * (activeRating / 4) * 10) / 10;
      return acc + points;
    }, 0) * 10
  ) / 10;

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-emerald-700 bg-emerald-50 border-emerald-300 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-600";
    if (score >= 70) return "text-indigo-700 bg-indigo-50 border-indigo-300 dark:text-indigo-400 dark:bg-indigo-950/30 dark:border-indigo-600";
    if (score >= 50) return "text-amber-700 bg-amber-50 border-amber-300 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-600";
    return "text-rose-700 bg-rose-50 border-rose-300 dark:text-rose-400 dark:bg-rose-950/30 dark:border-rose-600";
  };

  const getRatingBadge = (rating: number) => {
    switch (rating) {
      case 4:
        return { label: "4 - Strong", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300" };
      case 3:
        return { label: "3 - Effective", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300" };
      case 2:
        return { label: "2 - Developing", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300" };
      default:
        return { label: "1 - Insufficient", color: "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300" };
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scorecard-title"
    >
      <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-colors dark:border-gray-800 dark:bg-[#111827]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50 dark:border-gray-800 dark:bg-[#0d131f]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="scorecard-title" className="text-base font-bold text-slate-900 dark:text-white">
                  Engineering Assessment Scorecard
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                  Rubric v{scorecard.rubricVersion}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Candidate: <strong className="text-slate-800 dark:text-gray-200">{scorecard.candidateId}</strong> | Session: <span className="font-mono">{scorecard.sessionId}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800 transition-colors dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            aria-label="Close Scorecard"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Governance Notice Banner */}
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between text-xs text-amber-800 dark:bg-amber-950/20 dark:border-amber-800/40 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              <strong>Company Governance Notice:</strong> Automated AI-generated evaluation draft. All scores cite concrete diff and test evidence. Human reviewer calibration required prior to hiring decision.
            </span>
          </div>
          <div className="flex items-center gap-1 font-semibold text-amber-900 dark:text-amber-200">
            <ShieldCheck className="w-4 h-4" />
            <span>No Auto-Rejection</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Score Summary Banner */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className={`md:col-span-1 rounded-xl border p-4 flex flex-col items-center justify-center text-center shadow-xs ${getScoreColor(effectiveTotalScore)}`}>
              <span className="text-xs uppercase tracking-wider font-semibold">Weighted Total</span>
              <span className="text-4xl font-extrabold my-1">{effectiveTotalScore}%</span>
              <span className="text-[11px] font-medium">
                {isCalibrated ? "Verified by Interviewer" : "AI Suggested Draft"}
              </span>
            </div>

            <div className="md:col-span-3 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs text-slate-700 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-300 flex flex-col justify-center">
              <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-gray-200">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Evaluation Summary
                </span>
                <span className="text-[11px] text-slate-500 dark:text-gray-400">
                  Method: {isCalibrated ? "human_verified" : scorecard.scoringMethod}
                </span>
              </div>
              <p className="leading-relaxed">{scorecard.summaryNotes}</p>
            </div>
          </div>

          {/* 7-Dimension Rubric Breakdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <span>7-Dimension Evidence Rubric</span>
                <span className="text-xs font-normal text-slate-500 dark:text-gray-400">(Weights total 100%)</span>
              </h3>
              <span className="text-xs text-slate-500 dark:text-gray-400">
                Click dimension to expand evidence & reviewer notes
              </span>
            </div>

            <div className="space-y-2.5">
              {scorecard.dimensions.map((dim) => {
                const currentRating = reviewerRatings[dim.dimensionId] ?? dim.rating;
                const badge = getRatingBadge(currentRating);
                const isExpanded = expandedDimension === dim.dimensionId;

                return (
                  <div
                    key={dim.dimensionId}
                    className="rounded-xl border border-slate-200 bg-white transition-all shadow-xs overflow-hidden dark:border-gray-800 dark:bg-gray-900/40"
                  >
                    <div
                      onClick={() => toggleExpand(dim.dimensionId)}
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors dark:hover:bg-gray-800/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-xs dark:bg-indigo-950/60 dark:text-indigo-400">
                          {dim.weight}%
                        </span>
                        <div>
                          <h4 className="text-sm font-semibold text-slate-800 dark:text-gray-200">
                            {dim.name}
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-gray-400">
                            Points: <strong>{Math.round(dim.weight * (currentRating / 4) * 10) / 10} / {dim.weight}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${badge.color}`}>
                          {badge.label}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-5 pb-4 pt-1 border-t border-slate-100 bg-slate-50/70 space-y-3 dark:border-gray-800/80 dark:bg-gray-900/80">
                        {/* Evidence Citations */}
                        <div className="space-y-1.5 pt-2">
                          <span className="text-xs font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            Cited Objective Evidence:
                          </span>
                          <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 dark:text-gray-400">
                            {dim.evidenceCitations.length > 0 ? (
                              dim.evidenceCitations.map((cit, cIdx) => (
                                <li key={cIdx} className="leading-relaxed">
                                  {cit}
                                </li>
                              ))
                            ) : (
                              <li>No automated citations recorded.</li>
                            )}
                          </ul>
                        </div>

                        {/* Reviewer Calibration Controls */}
                        <div className="pt-2 border-t border-slate-200/80 dark:border-gray-800 flex flex-col md:flex-row gap-3">
                          <div className="flex-1 space-y-1">
                            <label className="text-[11px] font-semibold text-slate-700 dark:text-gray-300">
                              Interviewer Calibration Note:
                            </label>
                            <input
                              type="text"
                              value={reviewerNotes[dim.dimensionId] ?? ""}
                              onChange={(e) => handleNoteChange(dim.dimensionId, e.target.value)}
                              placeholder="Add human observation or rationale..."
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-700 dark:text-gray-300">
                              Adjust Rating:
                            </label>
                            <div className="flex gap-1">
                              {([1, 2, 3, 4] as RubricRatingAnchor[]).map((r) => (
                                <button
                                  key={r}
                                  type="button"
                                  onClick={() => handleRatingChange(dim.dimensionId, r)}
                                  className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-colors ${
                                    currentRating === r
                                      ? "bg-indigo-600 text-white shadow-xs"
                                      : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                                  }`}
                                >
                                  {r}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 bg-slate-50 dark:border-gray-800 dark:bg-[#0d131f]">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-gray-400">
            <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Reviewer: <strong>Senior Interviewer / Hiring Lead</strong></span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const reportJson = JSON.stringify(
                  {
                    ...scorecard,
                    weightedTotalScore: effectiveTotalScore,
                    scoringMethod: isCalibrated ? "human_verified" : "ai_draft",
                    reviewerNotes,
                    reviewerRatings,
                    calibratedAt: new Date(),
                  },
                  null,
                  2
                );
                const blob = new Blob([reportJson], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `scorecard_${scorecard.sessionId}.json`;
                a.click();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Report</span>
            </button>

            <button
              onClick={() => {
                setIsCalibrated(true);
                alert("Scorecard has been calibrated and human verified.");
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Sign Off & Calibrate</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

