import crypto from "node:crypto";
import type { OrganizationService } from "./organization.js";
import type { OrganizationMember } from "@ai-copilot/contracts";
import type { EmailDeliveryService } from "./email.js";
import { MagicLinkRepository, type MagicLinkRecord } from "../repositories/magic-link.repo.js";
import { OrganizationRepository } from "../repositories/organization.repo.js";

export class MagicLinkError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = "MagicLinkError";
  }
}

export type StoredMagicLink = MagicLinkRecord;

export interface MagicLinkResult {
  success: boolean;
  message: string;
  debugToken?: string;
  expiresInSeconds: number;
}

export class MagicLinkService {
  private readonly repo: MagicLinkRepository;
  private readonly orgRepo: OrganizationRepository;
  private readonly ttlSeconds: number = 15 * 60; // 15 minutes
  private readonly maxRequestsPerWindow: number = 5;
  private readonly windowSeconds: number = 15 * 60; // 15 minutes

  constructor(
    private readonly orgService: OrganizationService,
    private readonly emailService?: EmailDeliveryService,
    private readonly baseUrl?: string,
    repo?: MagicLinkRepository,
    orgRepo?: OrganizationRepository
  ) {
    this.repo = repo ?? new MagicLinkRepository();
    this.orgRepo = orgRepo ?? orgService.getRepo();
  }

  /**
   * Request a single-use magic login link.
   * Persists both rate limits and SHA-256 hashed tokens in PostgreSQL/PGlite.
   * Anti-enumeration protection: always returns success message regardless of whether
   * the email exists in any organization (unless rate limit is exceeded).
   */
  public async requestMagicLink(
    email: string,
    organizationId?: string
  ): Promise<MagicLinkResult> {
    const normalizedEmail = email.toLowerCase().trim();

    // Ensure pending async member/org writes are committed before DB queries
    await this.orgService.flush();

    // 1. Database-Backed Rate Limiting Check (5 requests / 15-minute window)
    const rateKey = `magic_link:${normalizedEmail}`;
    const rateStatus = await this.repo.incrementAndCheckRateLimit(
      rateKey,
      this.maxRequestsPerWindow,
      this.windowSeconds
    );
    if (!rateStatus.allowed) {
      throw new MagicLinkError(
        "RATE_LIMIT_EXCEEDED",
        "Too many login link requests. Please wait 15 minutes before requesting another link.",
        429
      );
    }

    // 2. Locate active member directly from PostgreSQL/PGlite (horizontal replica safe)
    let targetMember: OrganizationMember | null = null;
    if (organizationId) {
      const found = await this.orgRepo.findMemberByEmail(organizationId, normalizedEmail);
      if (found && found.status === "active") {
        targetMember = found;
      }
    } else {
      targetMember = await this.orgRepo.findActiveMemberByEmailAcrossOrgs(normalizedEmail);
    }

    const expiresInSeconds = this.ttlSeconds;
    const standardMessage =
      "If an active member account matches this email, a single-use login link has been issued.";

    // If member not found, return generic success (anti-enumeration)
    if (!targetMember) {
      return {
        success: true,
        message: standardMessage,
        expiresInSeconds,
      };
    }

    const targetOrgId = targetMember.organizationId;

    // 3. Generate high-entropy 32-byte cryptographic token and store SHA-256 hash in DB
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = this.hashToken(token);

    await this.repo.createToken({
      tokenHash,
      memberId: targetMember.id,
      organizationId: targetOrgId,
      email: normalizedEmail,
      ttlSeconds: this.ttlSeconds,
    });

    // Dispatch transactional magic link email
    const baseUrl = this.baseUrl || process.env.APP_BASE_URL || "http://localhost:5173";
    const magicLinkUrl = `${baseUrl}/login?token=${token}`;
    const org =
      this.orgService.getOrganizationById(targetOrgId) ||
      (await this.orgRepo.findById(targetOrgId));

    if (this.emailService) {
      await this.emailService
        .sendMagicLink({
          to: normalizedEmail,
          recipientName: targetMember.name || normalizedEmail,
          magicLinkUrl,
          ...(org?.name ? { organizationName: org.name } : {}),
          expiresInMinutes: Math.floor(this.ttlSeconds / 60),
        })
        .catch((err) => {
          console.error("[MagicLinkService] Transactional email dispatch error:", err);
        });
    }

    // 4. Secure Magic-Link Debugging (LOOP 10.0.1 Invariant 3)
    const isProductionOrPilot =
      process.env.NODE_ENV === "production" ||
      process.env.APP_ENV === "pilot" ||
      process.env.APP_ENV === "production";

    const allowDebugToken =
      !isProductionOrPilot &&
      (process.env.NODE_ENV === "test" || process.env.ALLOW_LOCAL_DEBUG_MAGIC_LINK === "true");

    return {
      success: true,
      message: standardMessage,
      ...(allowDebugToken ? { debugToken: token } : {}),
      expiresInSeconds,
    };
  }

  /**
   * Verify and atomically consume a single-use login token in PostgreSQL.
   * Only one concurrent caller can claim a tokenHash.
   */
  public async verifyAndConsumeToken(token: string): Promise<StoredMagicLink> {
    if (!token || token.length < 16) {
      throw new MagicLinkError(
        "INVALID_LOGIN_TOKEN",
        "The login link token is invalid or malformed.",
        400
      );
    }

    const tokenHash = this.hashToken(token);
    const result = await this.repo.consumeTokenAtomically(tokenHash);

    if (result.status === "consumed") {
      return result.record;
    }

    if (result.status === "already_used") {
      throw new MagicLinkError(
        "TOKEN_ALREADY_USED",
        "This single-use login link has already been used. Please request a new link.",
        401
      );
    }

    if (result.status === "expired") {
      throw new MagicLinkError(
        "TOKEN_EXPIRED",
        "This login link has expired. Magic links are valid for 15 minutes.",
        401
      );
    }

    throw new MagicLinkError(
      "INVALID_OR_EXPIRED_TOKEN",
      "This login link is invalid or has expired. Please request a new login link.",
      401
    );
  }

  /**
   * Invalidate all unused magic-link tokens for a member in SQL.
   */
  public async revokeAllMemberTokens(memberId: string): Promise<void> {
    await this.repo.revokeAllForMember(memberId);
  }

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }
}
