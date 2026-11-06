import zlib from "node:zlib";
import path from "node:path";
import type {
  ZipImportResult,
  VirtualFileEntry,
  SkippedFileEntry,
} from "@ai-copilot/contracts";

export class ZipIngestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ZipIngestError";
  }
}

export interface ZipIngestOptions {
  maxFiles?: number;
  maxTotalBytes?: number;
  maxSingleFileBytes?: number;
  maxCompressionRatio?: number;
  allowedExtensions?: Set<string>;
}

const DEFAULT_OPTIONS: Required<ZipIngestOptions> = {
  maxFiles: 100,
  maxTotalBytes: 10 * 1024 * 1024, // 10MB
  maxSingleFileBytes: 1024 * 1024, // 1MB
  maxCompressionRatio: 50, // 50:1 ratio limit
  allowedExtensions: new Set([
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".json",
    ".py",
    ".go",
    ".java",
    ".cpp",
    ".c",
    ".h",
    ".hpp",
    ".rs",
    ".md",
    ".txt",
    ".html",
    ".css",
    ".yml",
    ".yaml",
    ".sql",
    ".toml",
    ".xml",
    ".env.example",
  ]),
};

const DISALLOWED_EXTENSIONS = new Set([
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
  ".sh",
  ".bat",
  ".cmd",
  ".ps1",
  ".zip",
  ".tar",
  ".gz",
  ".tgz",
  ".bz2",
  ".xz",
  ".7z",
]);

interface CentralDirectoryEntry {
  fileName: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
  relativeOffsetOfLocalHeader: number;
  externalFileAttributes: number;
}

export class ZipIngestService {
  private readonly options: Required<ZipIngestOptions>;

  constructor(options?: ZipIngestOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  public parseAndValidateZip(buffer: Buffer): ZipImportResult {
    // 1. Magic byte verification
    if (buffer.length < 22) {
      throw new ZipIngestError(
        "ZIP_MALFORMED",
        "Archive is too small to be a valid ZIP archive"
      );
    }

    // Check for standard ZIP local header signature (PK\x03\x04)
    if (buffer.readUInt32LE(0) !== 0x04034b50) {
      throw new ZipIngestError(
        "ZIP_INVALID_HEADER",
        "Archive does not begin with valid ZIP magic bytes (PK\\x03\\x04)"
      );
    }

    // 2. Locate End of Central Directory (EOCD) record
    const eocdOffset = this.findEOCDOffset(buffer);
    if (eocdOffset === -1) {
      throw new ZipIngestError(
        "ZIP_MALFORMED",
        "Unable to find End of Central Directory (EOCD) record"
      );
    }

    const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
    const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
    const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);

    if (
      centralDirectoryOffset + centralDirectorySize > buffer.length ||
      centralDirectoryOffset < 0
    ) {
      throw new ZipIngestError(
        "ZIP_CORRUPT",
        "Central directory offset exceeds archive bounds"
      );
    }

    if (totalEntries > this.options.maxFiles * 2) {
      throw new ZipIngestError(
        "ZIP_EXCESSIVE_FILE_COUNT",
        `Archive contains ${totalEntries} entries, exceeding maximum allowed (${this.options.maxFiles})`
      );
    }

    // 3. Parse Central Directory headers
    const entries: CentralDirectoryEntry[] = [];
    let cdPtr = centralDirectoryOffset;

    while (cdPtr < centralDirectoryOffset + centralDirectorySize) {
      if (cdPtr + 46 > buffer.length) break;
      const cdSig = buffer.readUInt32LE(cdPtr);
      if (cdSig !== 0x02014b50) break; // Central directory file header signature

      const compressionMethod = buffer.readUInt16LE(cdPtr + 10);
      const compressedSize = buffer.readUInt32LE(cdPtr + 20);
      const uncompressedSize = buffer.readUInt32LE(cdPtr + 24);
      const fileNameLength = buffer.readUInt16LE(cdPtr + 28);
      const extraFieldLength = buffer.readUInt16LE(cdPtr + 30);
      const fileCommentLength = buffer.readUInt16LE(cdPtr + 32);
      const externalFileAttributes = buffer.readUInt32LE(cdPtr + 38);
      const relativeOffsetOfLocalHeader = buffer.readUInt32LE(cdPtr + 42);

      const fileNameRaw = buffer.subarray(cdPtr + 46, cdPtr + 46 + fileNameLength).toString("utf8");

      entries.push({
        fileName: fileNameRaw,
        compressedSize,
        uncompressedSize,
        compressionMethod,
        relativeOffsetOfLocalHeader,
        externalFileAttributes,
      });

      cdPtr += 46 + fileNameLength + extraFieldLength + fileCommentLength;
    }

    // 4. Validate & Decompress Entries
    const files: VirtualFileEntry[] = [];
    const skippedFiles: SkippedFileEntry[] = [];
    const warnings: string[] = [];
    const seenPaths = new Set<string>();
    let cumulativeDecompressedBytes = 0;

    for (const entry of entries) {
      const rawName = entry.fileName.replace(/\\/g, "/");

      // Skip directory entries
      if (rawName.endsWith("/")) {
        continue;
      }

      // Check for Symlinks in Unix file attributes (top 16 bits)
      const unixMode = (entry.externalFileAttributes >> 16) & 0xffff;
      if ((unixMode & 0o170000) === 0o120000) {
        throw new ZipIngestError(
          "ZIP_SECURITY_SYMLINK_REJECTED",
          `Symbolic link detected for path '${rawName}'. Symlinks are strictly prohibited for sandbox integrity.`
        );
      }

      // Path Security Validation: Zip Slip, Absolute Paths, Drive Letters
      const normalizedPath = this.sanitizeAndValidatePath(rawName);

      // Check for duplicate paths
      if (seenPaths.has(normalizedPath.toLowerCase())) {
        throw new ZipIngestError(
          "ZIP_DUPLICATE_PATH",
          `Duplicate normalized path detected in archive: '${normalizedPath}'`
        );
      }
      seenPaths.add(normalizedPath.toLowerCase());

      // Filter hidden/sensitive files
      if (
        normalizedPath.startsWith(".git/") ||
        normalizedPath.includes("/node_modules/") ||
        normalizedPath.startsWith("node_modules/") ||
        path.posix.basename(normalizedPath) === ".env"
      ) {
        skippedFiles.push({
          path: normalizedPath,
          reason: "Ignored internal VCS, dependency, or secret environment file",
        });
        continue;
      }

      // Check file extensions
      const ext = path.posix.extname(normalizedPath).toLowerCase();
      if (DISALLOWED_EXTENSIONS.has(ext)) {
        throw new ZipIngestError(
          "ZIP_UNSUPPORTED_EXTENSION",
          `Executable, binary, or nested archive extension '${ext}' is prohibited in '${normalizedPath}'`
        );
      }

      if (!this.options.allowedExtensions.has(ext) && ext !== "") {
        skippedFiles.push({
          path: normalizedPath,
          reason: `Extension '${ext}' is not in allowed source extensions list`,
        });
        continue;
      }

      // Compression ratio & Bomb Protection
      if (entry.uncompressedSize > this.options.maxSingleFileBytes) {
        throw new ZipIngestError(
          "ZIP_EXCESSIVE_FILE_SIZE",
          `File '${normalizedPath}' uncompressed size (${entry.uncompressedSize} bytes) exceeds limit (${this.options.maxSingleFileBytes} bytes)`
        );
      }

      if (entry.compressedSize > 0) {
        const ratio = entry.uncompressedSize / entry.compressedSize;
        if (ratio > this.options.maxCompressionRatio) {
          throw new ZipIngestError(
            "ZIP_BOMB_DETECTED",
            `File '${normalizedPath}' has a suspicious compression ratio (${ratio.toFixed(1)}:1), exceeding safety threshold (${this.options.maxCompressionRatio}:1)`
          );
        }
      }

      if (cumulativeDecompressedBytes + entry.uncompressedSize > this.options.maxTotalBytes) {
        throw new ZipIngestError(
          "ZIP_EXCESSIVE_TOTAL_SIZE",
          `Total uncompressed payload exceeds maximum limit of ${this.options.maxTotalBytes} bytes`
        );
      }

      // Read file content from local header
      const content = this.extractEntryContent(buffer, entry);
      cumulativeDecompressedBytes += content.length;

      // Classify read-only status (e.g. test files, configuration files)
      const isReadOnly =
        normalizedPath.includes("test") ||
        normalizedPath.includes("spec") ||
        normalizedPath.endsWith(".config.ts") ||
        normalizedPath.endsWith(".config.js") ||
        normalizedPath === "package.json" ||
        normalizedPath === "tsconfig.json";

      files.push({
        path: normalizedPath,
        content: content.toString("utf8"),
        isReadOnly,
        sizeBytes: content.length,
      });

      if (files.length > this.options.maxFiles) {
        throw new ZipIngestError(
          "ZIP_EXCESSIVE_FILE_COUNT",
          `Valid file count exceeds limit of ${this.options.maxFiles}`
        );
      }
    }

    if (files.length === 0) {
      throw new ZipIngestError(
        "ZIP_EMPTY_OR_UNSUPPORTED",
        "Archive contains no valid source code files"
      );
    }

    return {
      success: true,
      files,
      totalFiles: files.length,
      totalBytes: cumulativeDecompressedBytes,
      skippedFiles,
      warnings,
    };
  }

  private sanitizeAndValidatePath(rawName: string): string {
    // 1. Reject absolute Unix paths or root slashes
    if (rawName.startsWith("/")) {
      throw new ZipIngestError(
        "ZIP_ABSOLUTE_PATH_REJECTED",
        `Absolute paths are prohibited: '${rawName}'`
      );
    }

    // 2. Reject Windows drive letters (e.g. C:, D:)
    if (/^[a-zA-Z]:/.test(rawName)) {
      throw new ZipIngestError(
        "ZIP_WINDOWS_DRIVE_REJECTED",
        `Windows drive letter paths are prohibited: '${rawName}'`
      );
    }

    // 3. Normalize path using posix standard
    const normalized = path.posix.normalize(rawName);

    // 4. Zip Slip traversal checks: cannot escape root or begin with ../
    if (
      normalized === ".." ||
      normalized.startsWith("../") ||
      normalized.includes("/../")
    ) {
      throw new ZipIngestError(
        "ZIP_TRAVERSAL_ATTACK_REJECTED",
        `Zip Slip directory traversal detected for path: '${rawName}'`
      );
    }

    // 5. Reject null bytes or control characters in path
    if (/[\x00-\x1f]/.test(normalized)) {
      throw new ZipIngestError(
        "ZIP_INVALID_PATH_CHARACTERS",
        `Path contains invalid control characters: '${rawName}'`
      );
    }

    return normalized;
  }

  private extractEntryContent(buffer: Buffer, entry: CentralDirectoryEntry): Buffer {
    const localHeaderOffset = entry.relativeOffsetOfLocalHeader;
    if (localHeaderOffset + 30 > buffer.length) {
      throw new ZipIngestError("ZIP_CORRUPT", "Local file header offset out of bounds");
    }

    const localSig = buffer.readUInt32LE(localHeaderOffset);
    if (localSig !== 0x04034b50) {
      throw new ZipIngestError("ZIP_CORRUPT", "Invalid local file header signature");
    }

    const localNameLen = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localNameLen + localExtraLen;

    if (dataOffset + entry.compressedSize > buffer.length) {
      throw new ZipIngestError("ZIP_CORRUPT", "Compressed data offset out of bounds");
    }

    const compressedData = buffer.subarray(dataOffset, dataOffset + entry.compressedSize);

    if (entry.compressionMethod === 0) {
      // Stored (no compression)
      return compressedData;
    } else if (entry.compressionMethod === 8) {
      // Deflate
      try {
        return zlib.inflateRawSync(compressedData);
      } catch (err) {
        throw new ZipIngestError(
          "ZIP_DECOMPRESSION_FAILED",
          `Failed to decompress entry '${entry.fileName}': ${err instanceof Error ? err.message : String(err)}`
        );
      }
    } else {
      throw new ZipIngestError(
        "ZIP_UNSUPPORTED_COMPRESSION",
        `Unsupported compression method: ${entry.compressionMethod}`
      );
    }
  }

  private findEOCDOffset(buffer: Buffer): number {
    // EOCD signature is 0x06054b50 (PK\x05\x06)
    // The EOCD record is minimum 22 bytes and can have up to 65535 bytes of comment
    const minOffset = Math.max(0, buffer.length - 65557);
    for (let i = buffer.length - 22; i >= minOffset; i--) {
      if (buffer.readUInt32LE(i) === 0x06054b50) {
        return i;
      }
    }
    return -1;
  }
}
