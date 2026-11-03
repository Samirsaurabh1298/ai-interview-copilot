import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import "./index.css";

// Fail-safe initialization error handler to prevent blank white screens
window.addEventListener("error", (event) => {
  const rootEl = document.getElementById("root");
  if (rootEl && rootEl.children.length === 0) {
    rootEl.innerHTML = `
      <div style="min-height: 100vh; background-color: #090d16; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px;">
        <div style="max-width: 600px; width: 100%; background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
          <h2 style="color: #f43f5e; font-size: 18px; margin-top: 0; margin-bottom: 8px;">Initialization Error</h2>
          <p style="color: #94a3b8; font-size: 13px; margin-bottom: 16px;">The assessment platform failed to initialize:</p>
          <pre style="background: #020617; border: 1px solid #1e293b; border-radius: 8px; padding: 12px; font-size: 12px; color: #cbd5e1; overflow-x: auto; white-space: pre-wrap;">${event.message || "Unknown script initialization error"}</pre>
          <button onclick="window.location.reload()" style="margin-top: 16px; background: #6366f1; color: white; border: none; border-radius: 6px; padding: 8px 16px; font-weight: 600; cursor: pointer;">Reload Application</button>
        </div>
      </div>
    `;
  }
});

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary fallbackTitle="AI Interview Copilot Desktop Error">
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}

