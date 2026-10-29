import React, { useState, useEffect } from "react";
import { Header } from "./components/Header.js";
import { CaptureModal } from "./components/CaptureModal.js";
import { QuestionConfirmation } from "./components/QuestionConfirmation.js";
import { AnswerView } from "./components/AnswerView.js";
import { ApiClient } from "./services/apiClient.js";
import type { AIRequest, AIResponse } from "@ai-copilot/contracts";
import { Camera, Terminal, ShieldAlert, Sparkles, AlertCircle } from "lucide-react";

export const App: React.FC = () => {
  const [apiConnected, setApiConnected] = useState(false);
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

  const handleConfirmAndSubmit = async (request: AIRequest) => {
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const answer = await ApiClient.generateAnswer(request);
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

  return (
    <div className="flex flex-col h-screen w-screen bg-[#090d16] text-gray-100 overflow-hidden select-none font-sans">
      <Header
        apiConnected={apiConnected}
        onOpenCapture={() => setIsCaptureModalOpen(true)}
        isGenerating={isGenerating}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {errorMessage && (
          <div className="max-w-4xl mx-auto mt-4 px-4">
            <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-4 text-xs text-rose-300 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-gray-400 hover:text-white"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {stage === "idle" && (
          <div className="h-full flex flex-col items-center justify-center p-8 max-w-2xl mx-auto text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-xl shadow-indigo-600/10">
              <Terminal className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white tracking-tight">
                AI Coding Interview & Code Comprehension Copilot
              </h2>
              <p className="text-sm text-gray-400 leading-relaxed">
                Diagnose bugs in unfamiliar codebases, evaluate AI patches, trace edge cases,
                and practice technical communication with full human oversight.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setIsCaptureModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-6 py-3 font-semibold text-sm text-white shadow-lg shadow-indigo-600/20 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <Camera className="w-4 h-4" />
                <span>Capture Question / Problem</span>
              </button>
            </div>

            {/* Guiding Principles Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full text-left pt-6">
              <div className="rounded-lg border border-gray-800 bg-[#111827]/70 p-4 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-200">
                  <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Ethical by Design</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Visible capture only. Designed for AI-permitted assessments and real-world practice.
                </p>
              </div>

              <div className="rounded-lg border border-gray-800 bg-[#111827]/70 p-4 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-200">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Structured Analysis</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Minimal diffs, explicit assumptions, test cases, and honest limitations.
                </p>
              </div>

              <div className="rounded-lg border border-gray-800 bg-[#111827]/70 p-4 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-200">
                  <Terminal className="w-3.5 h-3.5 text-purple-400" />
                  <span>Isolated Sandbox</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Code changes run inside ephemeral sandboxes to distinguish verified code from hallucinations.
                </p>
              </div>
            </div>
          </div>
        )}

        {stage === "confirming" && (
          <QuestionConfirmation
            initialQuestion={extractedQuestion}
            initialCode={extractedCode}
            onCancel={() => setStage("idle")}
            onSubmit={handleConfirmAndSubmit}
            isSubmitting={isGenerating}
          />
        )}

        {stage === "answered" && currentAnswer && (
          <AnswerView answer={currentAnswer} onReset={handleReset} />
        )}
      </main>

      <CaptureModal
        isOpen={isCaptureModalOpen}
        onClose={() => setIsCaptureModalOpen(false)}
        onCaptureCompleted={handleCaptureCompleted}
      />
    </div>
  );
};

