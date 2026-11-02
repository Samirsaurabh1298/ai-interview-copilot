import React, { useState, useEffect } from "react";
import { Header } from "./components/Header.js";
import { CaptureModal } from "./components/CaptureModal.js";
import { QuestionConfirmation } from "./components/QuestionConfirmation.js";
import { AnswerView } from "./components/AnswerView.js";
import { AssessmentWorkspace } from "./components/AssessmentWorkspace.js";
import { CompanyDashboard } from "./components/CompanyDashboard.js";
import { CandidateOnboarding } from "./components/CandidateOnboarding.js";
import { PracticeStudio } from "./components/PracticeStudio.js";
import { ApiClient } from "./services/apiClient.js";
import type { AIRequest, AIResponse, AcceptInvitationResponse } from "@ai-copilot/contracts";
import { Camera, Terminal, ShieldAlert, Sparkles, AlertCircle } from "lucide-react";

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<"copilot" | "assessment" | "company">("company");
  const [activeInviteToken, setActiveInviteToken] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("invite");
    } catch {
      return null;
    }
  });
  const [activeSessionData, setActiveSessionData] = useState<AcceptInvitationResponse | null>(null);
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
          onAssessmentStarted={(sessionData) => {
            setActiveInviteToken(null);
            setActiveSessionData(sessionData);
            window.history.replaceState({}, document.title, window.location.pathname);
            setActiveView("assessment");
          }}
          onCancel={() => {
            setActiveInviteToken(null);
            window.history.replaceState({}, document.title, window.location.pathname);
            setActiveView("company");
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 text-slate-900 transition-colors dark:bg-[#090d16] dark:text-gray-100 overflow-hidden select-none font-sans">
      <Header
        apiConnected={apiConnected}
        onOpenCapture={() => setTriggerPracticeCapture(true)}
        isGenerating={isGenerating}
        activeView={activeView}
        onSelectView={setActiveView}
      />

      {activeView === "company" ? (
        <CompanyDashboard
          onLaunchCandidateView={() => setActiveView("assessment")}
          onOpenInvitation={(token) => setActiveInviteToken(token)}
        />
      ) : activeView === "assessment" ? (
        <AssessmentWorkspace
          sessionData={activeSessionData}
          onExitSession={() => {
            setActiveSessionData(null);
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

