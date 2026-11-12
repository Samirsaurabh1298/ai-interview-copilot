import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Clock,
  Sparkles,
  Terminal,
  CheckCircle2,
  AlertCircle,
  FileCode,
  ArrowRight,
  Lock,
  Building2,
} from "lucide-react";
import { ApiClient } from "../services/apiClient.js";
import type { VerifyInvitationResponse, AcceptInvitationResponse } from "@ai-copilot/contracts";

interface CandidateOnboardingProps {
  invitationToken: string;
  onAssessmentStarted: (sessionData: AcceptInvitationResponse) => void;
  onCancel: () => void;
  isInternalPreview?: boolean;
}

export const CandidateOnboarding: React.FC<CandidateOnboardingProps> = ({
  invitationToken,
  onAssessmentStarted,
  onCancel,
  isInternalPreview = false,
}) => {
  const [details, setDetails] = useState<VerifyInvitationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    verifyToken();
  }, [invitationToken]);

  const verifyToken = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await ApiClient.verifyInvitation(invitationToken);
      setDetails(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid or expired assessment invitation.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartAssessment = async () => {
    if (!agreed) {
      setError("Please review and agree to the academic integrity and AI collaboration policies.");
      return;
    }

    try {
      setIsStarting(true);
      setError(null);
      const sessionBootstrap = await ApiClient.acceptInvitation(invitationToken);
      onAssessmentStarted(sessionBootstrap);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to provision assessment session.");
      setIsStarting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-gray-100">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 animate-pulse mb-4">
          <Terminal className="w-6 h-6" />
        </div>
        <div className="text-sm font-semibold">Verifying Candidate Invitation...</div>
        <div className="text-xs text-slate-500 dark:text-gray-400 mt-1">Connecting to company gateway</div>
      </div>
    );
  }

  if (error && !details) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-gray-100">
        <div className="max-w-md w-full p-6 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-white dark:bg-[#0d131f] text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Invitation Unavailable</h3>
            <p className="text-xs text-slate-600 dark:text-gray-400 mt-1.5 leading-relaxed">{error}</p>
          </div>
          {isInternalPreview ? (
            <button
              onClick={onCancel}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-800 dark:text-gray-200 font-semibold text-xs transition-all"
            >
              Return to Dashboard
            </button>
          ) : (
            <p className="text-xs text-slate-500 dark:text-gray-400 pt-2 border-t border-slate-100 dark:border-gray-800">
              Please contact your recruiting coordinator or hiring organization to request a valid assessment link.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-gray-100 p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Company Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-gray-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                {details?.organizationName}
              </div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                Technical Engineering Assessment
              </h1>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-slate-500 dark:text-gray-400">Candidate:</div>
            <div className="text-xs font-bold text-slate-800 dark:text-gray-200">
              {details?.invitation.candidateName}
            </div>
          </div>
        </div>

        {/* Challenge Overview Card */}
        <div className="rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {details?.targetRole}
            </span>
            <span className="text-xs text-slate-500 dark:text-gray-400 capitalize">
              Difficulty: <strong>{details?.difficulty}</strong>
            </span>
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {details?.templateTitle}
            </h2>
            <p className="text-xs text-slate-600 dark:text-gray-300 mt-2 leading-relaxed whitespace-pre-wrap">
              {details?.templateDescription}
            </p>
          </div>

          {/* Three Key Tenets */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded-xl border border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/40 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-gray-200">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                <span>{details?.durationMinutes} Minutes</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-gray-400">
                Timer runs continuously once started.
              </p>
            </div>

            <div className="p-3 rounded-xl border border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/40 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-gray-200">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                <span>AI Assisted</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-gray-400">
                Managed OpenAI assistant with patch review.
              </p>
            </div>

            <div className="p-3 rounded-xl border border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/40 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-gray-200">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
                <span>Isolated Sandbox</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-gray-400">
                Verification tests run in secure Node jails.
              </p>
            </div>
          </div>
        </div>

        {/* Rules of Engagement */}
        <div className="rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] p-6 space-y-3 shadow-xs text-xs">
          <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
            Rules of Engagement & Expectations
          </h3>
          <ul className="space-y-2 text-slate-600 dark:text-gray-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>
                <strong>Company-Managed AI is Encouraged:</strong> You have access to an AI copilot. Feel free to use it to understand code, formulate hypotheses, or propose patches.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>
                <strong>Explicit Patch Review:</strong> The AI cannot overwrite your workspace without your explicit inspection. Always review proposed diffs before accepting.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>
                <strong>Human Accountable Evaluation:</strong> Automated AI scoring is strictly advisory. Senior company engineers review your code diffs, test passes, and technical explanations.
              </span>
            </li>
          </ul>
        </div>

        {/* Integrity Checkbox & Start Button OR Completed Notice */}
        {details?.invitation.status === "completed" ? (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-6 space-y-3 text-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Assessment Completed & Submitted
            </h3>
            <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed max-w-md mx-auto">
              Your assessment attempt has been successfully submitted and sealed. Further workspace modifications are locked to preserve evaluation integrity.
            </p>
            {isInternalPreview && (
              <button
                onClick={onCancel}
                className="mt-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-800 dark:text-gray-200 cursor-pointer"
              >
                Return to Dashboard
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20 p-6 space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="text-xs text-slate-700 dark:text-gray-300 font-medium leading-relaxed">
                I agree to complete this assessment independently. I understand that my code runs inside an isolated sandbox, all AI assistance is logged for auditability, and my final evaluation is conducted by human engineering reviewers.
              </span>
            </label>

            {error && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              {isInternalPreview ? (
                <button
                  onClick={onCancel}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white"
                >
                  Cancel
                </button>
              ) : null}
              <button
                onClick={handleStartAssessment}
                disabled={!agreed || isStarting}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs text-white shadow-lg transition-all ${
                  !isInternalPreview ? "w-full justify-center" : ""
                } ${
                  agreed && !isStarting
                    ? "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20"
                    : "bg-slate-300 dark:bg-gray-800 text-slate-500 cursor-not-allowed"
                }`}
              >
                <span>{isStarting ? "Provisioning Session..." : "Begin Assessment"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

