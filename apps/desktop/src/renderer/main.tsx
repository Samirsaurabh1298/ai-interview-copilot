import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import "./index.css";

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

