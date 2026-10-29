import React from "react";
import { Camera, ShieldCheck, Terminal, Cpu } from "lucide-react";

interface HeaderProps {
  apiConnected: boolean;
  onOpenCapture: () => void;
  isGenerating: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  apiConnected,
  onOpenCapture,
  isGenerating,
}) => {
  return (
    <header className="h-16 border-b border-gray-800 bg-[#0d131f] px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
          <Terminal className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
            AI Coding Interview Copilot
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Desktop MVP
            </span>
          </h1>
          <p className="text-xs text-gray-400">
            Real-world code comprehension, debugging & verification
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Status badges */}
        <div className="flex items-center gap-2 text-xs">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
              apiConnected
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                apiConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
              }`}
            />
            {apiConnected ? "Backend Connected" : "Connecting..."}
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-800/60 text-gray-400 border border-gray-700/50">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Zero-Retention Screen Mode</span>
          </div>
        </div>

        {/* Capture Action button */}
        <button
          onClick={onOpenCapture}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-gray-900"
          aria-label="Capture Screen or Window"
        >
          <Camera className="w-4 h-4" />
          <span>Capture Question</span>
        </button>
      </div>
    </header>
  );
};

