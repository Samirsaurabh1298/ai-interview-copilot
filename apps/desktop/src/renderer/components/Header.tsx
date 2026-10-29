import React, { useState, useEffect } from "react";
import { Camera, ShieldCheck, Terminal, Sun, Moon } from "lucide-react";

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
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
          <Terminal className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2 dark:text-white">
            AI Coding Interview Copilot
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20">
              Desktop Assessment
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-gray-400">
            Real-world code comprehension, debugging & verification
          </p>
        </div>
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
            <span>Zero-Retention Screen Mode</span>
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

        {/* Capture Action button */}
        <button
          onClick={onOpenCapture}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-400"
          aria-label="Capture Screen or Window"
        >
          <Camera className="w-4 h-4" />
          <span>Capture Question</span>
        </button>
      </div>
    </header>
  );
};
