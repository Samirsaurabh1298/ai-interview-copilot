import fs from "node:fs";
import path from "node:path";
import { createRepoFilter, MAX_FILE_SIZE_BYTES } from "./filter.js";

export interface IndexedFile {
  relativePath: string;
  absolutePath: string;
  language: string;
  symbols: string[];
  sizeBytes: number;
}

export interface RepoIndex {
  repoRoot: string;
  indexedAt: string;
  files: IndexedFile[];
  totalFiles: number;
}

export function indexRepository(repoRoot: string): RepoIndex {
  if (!fs.existsSync(repoRoot)) {
    throw new Error(`Repository path '${repoRoot}' does not exist.`);
  }

  const isAllowed = createRepoFilter(repoRoot);
  const indexedFiles: IndexedFile[] = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(repoRoot, fullPath);

      if (entry.isDirectory()) {
        if (isAllowed(relativePath + "/")) {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        if (!isAllowed(relativePath)) {
          continue;
        }

        try {
          const stats = fs.statSync(fullPath);
          if (stats.size > MAX_FILE_SIZE_BYTES || stats.size === 0) {
            continue;
          }

          const content = fs.readFileSync(fullPath, "utf8");
          const language = detectLanguage(fullPath);
          const symbols = extractSymbols(content, language);

          indexedFiles.push({
            relativePath: relativePath.replace(/\\/g, "/"),
            absolutePath: fullPath,
            language,
            symbols,
            sizeBytes: stats.size,
          });
        } catch {
          // Skip unreadable files safely
        }
      }
    }
  }

  walk(repoRoot);

  return {
    repoRoot,
    indexedAt: new Date().toISOString(),
    files: indexedFiles,
    totalFiles: indexedFiles.length,
  };
}

function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".ts":
    case ".tsx":
      return "typescript";
    case ".js":
    case ".jsx":
    case ".mjs":
    case ".cjs":
      return "javascript";
    case ".py":
      return "python";
    case ".go":
      return "go";
    case ".rs":
      return "rust";
    case ".java":
      return "java";
    case ".json":
      return "json";
    case ".md":
      return "markdown";
    default:
      return "plaintext";
  }
}

function extractSymbols(content: string, language: string): string[] {
  const symbols = new Set<string>();

  if (language === "typescript" || language === "javascript") {
    // Functions: function myFunc, const myFunc = (...) =>
    const funcMatches = content.matchAll(/(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)/g);
    for (const m of funcMatches) {
      if (m[1]) symbols.add(m[1]);
    }

    const constMatches = content.matchAll(/(?:export\s+)?const\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\(/g);
    for (const m of constMatches) {
      if (m[1]) symbols.add(m[1]);
    }

    // Classes & Interfaces
    const classMatches = content.matchAll(/(?:export\s+)?(?:abstract\s+)?class\s+([a-zA-Z0-9_$]+)/g);
    for (const m of classMatches) {
      if (m[1]) symbols.add(m[1]);
    }

    const interfaceMatches = content.matchAll(/(?:export\s+)?interface\s+([a-zA-Z0-9_$]+)/g);
    for (const m of interfaceMatches) {
      if (m[1]) symbols.add(m[1]);
    }

    const typeMatches = content.matchAll(/(?:export\s+)?type\s+([a-zA-Z0-9_$]+)\s*=/g);
    for (const m of typeMatches) {
      if (m[1]) symbols.add(m[1]);
    }
  } else if (language === "python") {
    const pyDefs = content.matchAll(/def\s+([a-zA-Z0-9_]+)\s*\(/g);
    for (const m of pyDefs) {
      if (m[1]) symbols.add(m[1]);
    }

    const pyClasses = content.matchAll(/class\s+([a-zA-Z0-9_]+)[\s:(]/g);
    for (const m of pyClasses) {
      if (m[1]) symbols.add(m[1]);
    }
  }

  return Array.from(symbols);
}
