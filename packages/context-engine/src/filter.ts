import fs from "node:fs";
import path from "node:path";
import ignore, { type Ignore } from "ignore";

// Hardcoded security boundaries: never index secrets or huge artifacts
export const DEFAULT_EXCLUDED_PATTERNS = [
  ".git/**",
  "node_modules/**",
  ".pnpm-store/**",
  "dist/**",
  "dist-electron/**",
  "build/**",
  ".next/**",
  "out/**",
  "coverage/**",
  ".cache/**",
  ".turbo/**",
  "**/.env",
  "**/.env.*",
  "**/*.pem",
  "**/*.key",
  "**/*.cert",
  "**/*.pfx",
  "**/*.p12",
  "**/*.log",
  "**/*.tmp",
  "**/*.lock",
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
];

export const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".svg",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".exe",
  ".dll",
  ".dylib",
  ".so",
  ".node",
  ".wasm",
  ".map",
  ".mp3",
  ".mp4",
  ".wav",
]);

export const MAX_FILE_SIZE_BYTES = 256 * 1024; // 256 KB max per file

export function createRepoFilter(repoRoot: string): (relativeFilePath: string) => boolean {
  const ig: Ignore = ignore();
  ig.add(DEFAULT_EXCLUDED_PATTERNS);

  const gitignorePath = path.join(repoRoot, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    try {
      const gitignoreContent = fs.readFileSync(gitignorePath, "utf8");
      ig.add(gitignoreContent);
    } catch {
      // Ignore read errors
    }
  }

  return (relativeFilePath: string): boolean => {
    // Normalize path separators to forward slash for ignore matching
    const normalized = relativeFilePath.replace(/\\/g, "/");
    const ext = path.extname(normalized).toLowerCase();

    if (BINARY_EXTENSIONS.has(ext)) {
      return false;
    }

    if (ig.ignores(normalized)) {
      return false;
    }

    return true;
  };
}
