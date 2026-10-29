import type { ElectronAPI } from "./index.js";

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};

