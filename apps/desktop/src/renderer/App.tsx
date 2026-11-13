import React, { useState, useEffect, useRef } from "react";
import { Header } from "./components/Header.js";
import { CaptureModal } from "./components/CaptureModal.js";
import { QuestionConfirmation } from "./components/QuestionConfirmation.js";
import { AnswerView } from "./components/AnswerView.js";
import { AssessmentWorkspace } from "./components/AssessmentWorkspace.js";
import { CompanyDashboard } from "./components/CompanyDashboard.js";
import { CandidateOnboarding } from "./components/CandidateOnboarding.js";
import { PracticeStudio } from "./components/PracticeStudio.js";
import { ProductBentoShowcase } from "./components/showcase/ProductBentoShowcase.js";
import { ApiClient } from "./services/apiClient.js";
import type { AIRequest, AIResponse, AcceptInvitationResponse } from "@ai-copilot/contracts";
import { Camera, Terminal, ShieldAlert, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";

const CANDIDATE_SESSION_STORAGE_KEY = "ai_copilot_candidate_session";

export const App: React.FC = () => {
  const isDirectCandidateVisit = useRef<boolean>(
    typeof window !== "undefined" && Boolean(new URLSearchParams(window.location.search).get("invite"))
  );

  const [activeInviteToken, setActiveInviteToken] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("invite");
    } catch {
      return null;
    }
  });

  const [activeSessionData, setActiveSessionData] = useState<AcceptInvitationResponse | null>(() => {
    try {
      const stored = sessionStorage.getItem(CANDIDATE_SESSION_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return null;
  });

  const [isCandidateExited, setIsCandidateExited] = useState(false);
  const [activeView, setActiveView] = useState<"copilot" | "assessment" | "company" | "showcase">(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("view") === "showcase") return "showcase";
    } catch {
      // ignore
    }
    return "company";
  });
  const [apiConnected, setApiConnected] = useState(false);
  const [triggerPracticeCapture, setTriggerPracticeCapture] = useState(false);
  const [isCaptureModalOpen, setIsCaptureModalOpen] = useState(false);
  const [stage, setStage] = useState<"idle" | "confirming" | "answered">("idle");

  const [extractedQuestion, setExtractedQuestion] = useState("");
  const [extractedCode, setExtractedCode] = useState<string | undefined>(undefined);
  const [currentAnswer, setCurrentAnswer] = useState<AIResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const checkBackend = async () => {
      const ok = await ApiClient.checkHealth();
      setApiConnected(ok);
    };

    checkBackend();
    const interval = setInterval(checkBackend, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCaptureCompleted = async (data: {
    imageBase64?: string;
    pastedText?: string;
  }) => {
    setIsCaptureModalOpen(false);
    setErrorMessage(null);

    if (data.pastedText) {
      setExtractedQuestion(data.pastedText);
      setExtractedCode(undefined);
      setStage("confirming");
      return;
    }

    if (data.imageBase64) {
      try {
        setIsGenerating(true);
        const extraction = await ApiClient.extractQuestion(data.imageBase64);
        setExtractedQuestion(extraction.cleanedQuestion);
        setExtractedCode(extraction.codeSnippet);
        setStage("confirming");
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Failed to extract text from captured screenshot."
        );
      } finally {
        setIsGenerating(false);
      }
    }
  };

  const handleConfirmAndSubmit = async (request: AIRequest, providerId?: string) => {
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const answer = await ApiClient.generateAnswer(request, providerId);
      setCurrentAnswer(answer);
      setStage("answered");
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to generate structured answer."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setStage("idle");
    setCurrentAnswer(null);
    setExtractedQuestion("");
    setExtractedCode(undefined);
    setErrorMessage(null);
  };

  if (activeInviteToken) {
    return (
      <div className="flex flex-col h-screen w-screen bg-slate-50 text-slate-900 transition-colors dark:bg-[#090d16] dark:text-gray-100 overflow-hidden font-sans">
        <CandidateOnboarding
          invitationToken={activeInviteToken}
          isInternalPreview={!isDirectCandidateVisit.current}
          onAssessmentStarted={(sessionData) => {
            setActiveInviteToken(null);
            setActiveSessionData(sessionData);
            try {
              sessionStorage.setItem(CANDIDATE_SESSION_STORAGE_KEY, JSON.stringify(sessionData));
            } catch {
              // ignore
            }
            window.history.replaceState({}, document.title, window.location.pathname);
            setActiveView("assessment");
          }}
          onCancel={() => {
            setActiveInviteToken(null);
            window.history.replaceState({}, document.title, window.location.pathname);
            if (isDirectCandidateVisit.current) {
              setIsCandidateExited(true);
            } else {
              setActiveView("company");
            }
          }}
        />
      </div>
    );
  }

  // Pure isolated candidate view with no host admin tabs
  if (activeSessionData) {
    if (isCandidateExited && !activeSessionData.isSubmitted) {
      return (
        <div className="flex flex-col h-screen w-screen bg-slate-50 text-slate-900 transition-colors dark:bg-[#090d16] dark:text-gray-100 overflow-hidden font-sans items-center justify-center p-6">
          <div className="max-w-md w-full p-8 rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] text-center space-y-5 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Assessment Session Paused</h3>
              <p className="text-xs text-slate-600 dark:text-gray-400 mt-2 leading-relaxed">
                Your progress, code, and answers are safely saved. You may resume your assessment attempt as long as time remains on your clock.
              </p>
            </div>
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => setIsCandidateExited(false)}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
              >
                Resume Assessment
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-screen w-screen bg-slate-50 text-slate-900 transition-colors dark:bg-[#090d16] dark:text-gray-100 overflow-hidden select-none font-sans">
        <AssessmentWorkspace
          sessionData={activeSessionData}
          onExitSession={() => {
            try {
              const raw = sessionStorage.getItem(CANDIDATE_SESSION_STORAGE_KEY);
              const parsed = raw ? JSON.parse(raw) : null;
              if (parsed?.isSubmitted || activeSessionData.isSubmitted) {
                sessionStorage.removeItem(CANDIDATE_SESSION_STORAGE_KEY);
                setActiveSessionData(null);
                setIsCandidateExited(false);
                return;
              }
            } catch {
              // ignore
            }
            setIsCandidateExited(true);
          }}
        />
      </div>
    );
  }

  // Admin / Company Management View
  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 text-slate-900 transition-colors dark:bg-[#090d16] dark:text-gray-100 overflow-hidden select-none font-sans">
      <Header
        apiConnected={apiConnected}
        onOpenCapture={() => setTriggerPracticeCapture(true)}
        isGenerating={isGenerating}
        activeView={activeView}
        onSelectView={setActiveView}
        isCandidateSession={false}
      />

      {activeView === "showcase" ? (
        <ProductBentoShowcase
          onExit={() => setActiveView("company")}
          onLaunchAssessment={() => setActiveView("assessment")}
        />
      ) : activeView === "company" ? (
        <CompanyDashboard
          onLaunchCandidateView={() => setActiveView("assessment")}
          onOpenInvitation={(token) => setActiveInviteToken(token)}
        />
      ) : activeView === "assessment" ? (
        <AssessmentWorkspace
          sessionData={null}
          onExitSession={() => {
            setActiveView("company");
          }}
        />
      ) : (
        <PracticeStudio
          triggerCapture={triggerPracticeCapture}
          onResetTriggerCapture={() => setTriggerPracticeCapture(false)}
          onExit={() => setActiveView("company")}
        />
      )}

      <CaptureModal
        isOpen={isCaptureModalOpen}
        onClose={() => setIsCaptureModalOpen(false)}
        onCaptureCompleted={handleCaptureCompleted}
      />
    </div>
  );
};

