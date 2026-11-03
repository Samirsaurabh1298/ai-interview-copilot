import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, RotateCcw, Copy, Check } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error("ErrorBoundary caught an unhandled render error:", error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  handleCopyDetails = async (): Promise<void> => {
    const details = [
      `Error: ${this.state.error?.name}: ${this.state.error?.message}`,
      `Stack:\n${this.state.error?.stack || "No stack trace available"}`,
      `Component Stack:\n${this.state.errorInfo?.componentStack || "No component stack"}`,
    ].join("\n\n");

    try {
      await navigator.clipboard.writeText(details);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      // Ignore clipboard write failures
    }
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="min-h-screen w-screen flex items-center justify-center bg-slate-900 text-slate-100 p-6 font-sans select-text"
        >
          <div className="max-w-2xl w-full rounded-2xl border border-rose-500/30 bg-[#0d131f] p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-white tracking-tight">
                  {this.props.fallbackTitle || "Render Diagnostic Recovery Engine"}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  An unhandled exception occurred in the UI renderer. The application was saved from a white-screen crash.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-black/50 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-rose-400 font-bold uppercase tracking-wider">
                <span>{this.state.error?.name || "Runtime Error"}</span>
                <button
                  type="button"
                  onClick={this.handleCopyDetails}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors cursor-pointer"
                >
                  {this.state.copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{this.state.copied ? "Copied" : "Copy Stack"}</span>
                </button>
              </div>
              <p className="font-mono text-xs text-rose-200 break-words leading-relaxed">
                {this.state.error?.message || "Unknown rendering exception"}
              </p>
              {this.state.error?.stack && (
                <pre className="font-mono text-[10px] text-slate-500 max-h-36 overflow-y-auto leading-snug pt-2 border-t border-slate-800">
                  {this.state.error.stack}
                </pre>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Recover Component</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Application</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
