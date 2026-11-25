import fs from "node:fs";
import path from "node:path";

export const MAX_WORKSPACE_FILES = 50;
export const MAX_WORKSPACE_BYTES = 512 * 1024; // 512 KB

const RESERVED_SANDBOX_FILES = new Set([
  "runner.ts",
  "runner.py",
  "__sandbox_harness__.ts",
  "__sandbox_harness__.py",
  "__sandbox_tests__.ts",
  "__sandbox_tests__.py",
  "solution_code.txt",
  "test_code.txt",
]);

export class WorkspaceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceValidationError";
    Object.setPrototypeOf(this, WorkspaceValidationError.prototype);
  }
}

/**
 * Strictly validates and normalizes a virtual workspace relative path.
 * Rejects absolute paths, drive letters, backslashes, null bytes, traversal (".."),
 * and reserved sandbox harness files.
 */
export function validateAndNormalizeRelativePath(
  rawPath: string,
  options?: { allowReservedTestFile?: boolean }
): string {
  if (!rawPath || typeof rawPath !== "string" || rawPath.trim().length === 0) {
    throw new WorkspaceValidationError("Workspace file path cannot be empty.");
  }

  if (rawPath.includes("\0")) {
    throw new WorkspaceValidationError(`Illegal null byte in file path: '${rawPath}'.`);
  }

  if (rawPath.includes("\\")) {
    throw new WorkspaceValidationError(
      `Invalid path separator '\\' in file path '${rawPath}'. Use POSIX forward slashes '/'.`
    );
  }

  if (/^[A-Za-z]:/.test(rawPath) || rawPath.startsWith("/")) {
    throw new WorkspaceValidationError(
      `Absolute paths are prohibited in sandbox workspace: '${rawPath}'.`
    );
  }

  const segments = rawPath.split("/");
  if (segments.some((seg) => seg === ".." || seg === "" || seg === ".")) {
    throw new WorkspaceValidationError(
      `Invalid or traversal path segment in '${rawPath}'.`
    );
  }

  const normalized = path.posix.normalize(rawPath);
  if (
    normalized === "." ||
    normalized.startsWith("..") ||
    normalized.startsWith("/")
  ) {
    throw new WorkspaceValidationError(`Path traversal detected in '${rawPath}'.`);
  }

  if (!options?.allowReservedTestFile && RESERVED_SANDBOX_FILES.has(normalized)) {
    throw new WorkspaceValidationError(
      `File path '${normalized}' collides with a reserved sandbox runtime file.`
    );
  }

  return normalized;
}

/**
 * Safely materializes a multi-file virtual workspace inside an ephemeral sandbox directory.
 * Enforces file count limits, total byte size limits, and path containment.
 */
export function materializeWorkspaceFiles(
  rootDir: string,
  files: Record<string, string>
): string[] {
  const entries = Object.entries(files);
  if (entries.length > MAX_WORKSPACE_FILES) {
    throw new WorkspaceValidationError(
      `Workspace exceeds maximum allowed file count (${entries.length} > ${MAX_WORKSPACE_FILES}).`
    );
  }

  const resolvedRoot = path.resolve(rootDir);
  let totalBytes = 0;
  const normalizedPairs: Array<{ relPath: string; absPath: string; content: string }> = [];

  for (const [rawPath, content] of entries) {
    if (typeof content !== "string") {
      throw new WorkspaceValidationError(`File content for '${rawPath}' must be a string.`);
    }

    const relPath = validateAndNormalizeRelativePath(rawPath);
    const byteLen = Buffer.byteLength(content, "utf8");
    totalBytes += byteLen;
    if (totalBytes > MAX_WORKSPACE_BYTES) {
      throw new WorkspaceValidationError(
        `Workspace total payload size exceeds limit (${MAX_WORKSPACE_BYTES} bytes).`
      );
    }

    const absPath = path.resolve(resolvedRoot, ...relPath.split("/"));
    if (!absPath.startsWith(resolvedRoot + path.sep)) {
      throw new WorkspaceValidationError(
        `SecurityException: Target file '${rawPath}' escaped sandbox directory.`
      );
    }

    normalizedPairs.push({ relPath, absPath, content });
  }

  for (const item of normalizedPairs) {
    const parentDir = path.dirname(item.absPath);
    fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(item.absPath, item.content, "utf8");
  }

  return normalizedPairs.map((p) => p.relPath);
}

/**
 * Resolves a safe target path for an entry test file inside rootDir.
 */
export function resolveSafeTestFilePath(rootDir: string, entryTestFile: string): string {
  const relPath = validateAndNormalizeRelativePath(entryTestFile, {
    allowReservedTestFile: true,
  });
  const resolvedRoot = path.resolve(rootDir);
  const absPath = path.resolve(resolvedRoot, ...relPath.split("/"));
  if (!absPath.startsWith(resolvedRoot + path.sep)) {
    throw new WorkspaceValidationError(
      `SecurityException: Test entry path '${entryTestFile}' escaped sandbox directory.`
    );
  }
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  return absPath;
}
