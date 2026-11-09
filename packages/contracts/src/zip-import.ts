import { z } from "zod";

export const VirtualFileEntrySchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  isReadOnly: z.boolean().default(false),
  sizeBytes: z.number().int().nonnegative(),
});

export type VirtualFileEntry = z.infer<typeof VirtualFileEntrySchema>;

export const ZipImportRequestSchema = z.object({
  zipBase64: z.string().min(1, "Base64 archive payload is required"),
  filename: z.string().optional(),
  maxFiles: z.number().int().min(1).max(200).default(100),
  maxTotalBytes: z.number().int().min(1024).max(20 * 1024 * 1024).default(10 * 1024 * 1024),
});

export type ZipImportRequest = z.infer<typeof ZipImportRequestSchema>;

export const SkippedFileEntrySchema = z.object({
  path: z.string(),
  reason: z.string(),
});

export type SkippedFileEntry = z.infer<typeof SkippedFileEntrySchema>;

export const ZipImportResultSchema = z.object({
  success: z.boolean(),
  files: z.array(VirtualFileEntrySchema),
  totalFiles: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
  skippedFiles: z.array(SkippedFileEntrySchema),
  warnings: z.array(z.string()),
});

export type ZipImportResult = z.infer<typeof ZipImportResultSchema>;

