import React, { useState, useEffect } from "react";
import { Camera, ShieldCheck, Terminal, Sun, Moon, Briefcase, Sparkles, Building2, Layers } from "lucide-react";

interface HeaderProps {
  apiConnected: boolean;
  onOpenCapture: () => void;
  isGenerating: boolean;
  activeView: "copilot" | "assessment" | "company" | "showcase";
  onSelectView: (view: "copilot" | "assessment" | "company" | "showcase") => void;
  isCandidateSession?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  apiConnected,
  onOpenCapture,
  isGenerating,
  activeView,
  onSelectView,
  isCandidateSession = false,
}) => {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("ai_copilot_theme") as "light" | "dark") || "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
    localStorage.setItem("ai_copilot_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <header className="h-16 border-b border-slate-200 bg-white/95 px-6 flex items-center justify-between shadow-xs backdrop-blur-sm transition-colors dark:border-gray-800 dark:bg-[#0d131f]">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2 dark:text-white">
              AI Coding Assessment Platform
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20">
                v1.0
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              Evidence-based engineering evaluation with managed AI access
            </p>
          </div>
        </div>

        {isCandidateSession ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Candidate Assessment Session Active</span>
          </div>
        ) : (
          /* Mode Switcher Segmented Control */
          <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold dark:bg-gray-800/80 dark:border-gray-700">
            <button
              onClick={() => onSelectView("copilot")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeView === "copilot"
                  ? "bg-white text-indigo-600 shadow-xs dark:bg-gray-900 dark:text-indigo-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Practice Copilot</span>
            </button>

            <button
              onClick={() => onSelectView("assessment")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeView === "assessment"
                  ? "bg-white text-indigo-600 shadow-xs dark:bg-gray-900 dark:text-indigo-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
              <span>60-Min Assessment Task</span>
            </button>

            <button
              onClick={() => onSelectView("company")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeView === "company"
                  ? "bg-white text-indigo-600 shadow-xs dark:bg-gray-900 dark:text-indigo-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-500" />
              <span>Company Admin & Templates</span>
            </button>

            <button
              onClick={() => onSelectView("showcase")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeView === "showcase"
                  ? "bg-white text-indigo-600 shadow-xs dark:bg-gray-900 dark:text-indigo-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              <span>Pilot Showcase</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Status badges */}
        <div className="flex items-center gap-2 text-xs">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors ${
              apiConnected
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                apiConnected ? "bg-emerald-500 animate-pulse dark:bg-emerald-400" : "bg-amber-500 dark:bg-amber-400"
              }`}
            />
            {apiConnected ? "Backend Connected" : "Connecting..."}
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 dark:bg-gray-800/60 dark:text-gray-400 dark:border-gray-700/50">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
            <span>Server AI Gateway</span>
          </div>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
          title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Theme`}
          aria-label={`Switch to ${theme === "dark" ? "Light" : "Dark"} Theme`}
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600" />
          )}
        </button>

        {/* Capture Action button (for Practice Copilot mode) */}
        {activeView === "copilot" && (
          <button
            onClick={onOpenCapture}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-400"
            aria-label="Capture Screen or Window"
          >
            <Camera className="w-4 h-4" />
            <span>Capture Question</span>
          </button>
        )}
      </div>
    </header>
  );
};
