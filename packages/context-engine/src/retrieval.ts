import fs from "node:fs";
import type { ContextItem } from "@ai-copilot/contracts";
import type { RepoIndex, IndexedFile } from "./indexer.js";

export interface RetrievalOptions {
  maxFiles?: number;
  maxContentLength?: number;
}

export function retrieveRelevantContext(
  index: RepoIndex,
  query: string,
  options: RetrievalOptions = {}
): ContextItem[] {
  const maxFiles = options.maxFiles ?? 5;
  const maxContentLength = options.maxContentLength ?? 12000;

  // Extract query keywords (alphanumeric tokens > 2 chars)
  const tokens = query
    .toLowerCase()
    .split(/[^a-zA-Z0-9_$]+/)
    .filter((t) => t.length > 2);

  if (tokens.length === 0) {
    return [];
  }

  // Score files
  const scoredFiles: Array<{ file: IndexedFile; score: number }> = [];

  for (const file of index.files) {
    let score = 0;
    const lowerPath = file.relativePath.toLowerCase();

    // 1. Path match bonus
    for (const token of tokens) {
      if (lowerPath.includes(token)) {
        score += 5;
      }
    }

    // 2. Symbol match bonus (higher weight)
    for (const sym of file.symbols) {
      const lowerSym = sym.toLowerCase();
      for (const token of tokens) {
        if (lowerSym === token) {
          score += 15;
        } else if (lowerSym.includes(token)) {
          score += 3;
        }
      }
    }

    if (score > 0) {
      scoredFiles.push({ file, score });
    }
  }

  // Sort descending by score
  scoredFiles.sort((a, b) => b.score - a.score);

  const contextItems: ContextItem[] = [];
  let totalLength = 0;

  for (const { file } of scoredFiles.slice(0, maxFiles)) {
    try {
      const content = fs.readFileSync(file.absolutePath, "utf8");
      if (totalLength + content.length > maxContentLength) {
        // Truncate if nearing total budget
        const remaining = maxContentLength - totalLength;
        if (remaining > 500) {
          contextItems.push({
            path: file.relativePath,
            content: content.slice(0, remaining) + "\n// ... [truncated]",
            source: "repository",
          });
        }
        break;
      }

      contextItems.push({
        path: file.relativePath,
        content,
        source: "repository",
      });
      totalLength += content.length;
    } catch {
      // Ignore read errors
    }
  }

  return contextItems;
}
