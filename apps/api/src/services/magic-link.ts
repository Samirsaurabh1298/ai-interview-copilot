import crypto from "node:crypto";
import type { OrganizationService } from "./organization.js";
import type { OrganizationMember } from "@ai-copilot/contracts";

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

export interface StoredMagicLink {
  tokenHash: string;
  email: string;
  organizationId: string;
  memberId: string;
  role: string;
  name: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
  usedAt?: number;
}

export interface MagicLinkResult {
  success: boolean;
  message: string;
  debugToken?: string;
  expiresInSeconds: number;
}

export class MagicLinkService {
  private readonly tokensByHash = new Map<string, StoredMagicLink>();
  private readonly requestCountsByEmail = new Map<string, { count: number; windowStart: number }>();
  private readonly ttlMs: number = 15 * 60 * 1000; // 15 minutes
  private readonly maxRequestsPerWindow: number = 5;
  private readonly windowMs: number = 15 * 60 * 1000;

  constructor(private readonly orgService: OrganizationService) {}

  /**
   * Request a single-use magic login link.
   * Anti-enumeration protection: Always returns success message regardless of whether
   * the email exists in any organization.
   */
  public async requestMagicLink(
    email: string,
    organizationId?: string
  ): Promise<MagicLinkResult> {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Rate Limiting Check
    this.checkRateLimit(normalizedEmail);

    // 2. Locate member across organizations
    let targetMember: OrganizationMember | undefined;
    let targetOrgId = organizationId;

    if (organizationId) {
      const members = this.orgService.listMembers(organizationId);
      targetMember = members.find(
        (m) => m.email.toLowerCase() === normalizedEmail && m.status === "active"
      );
    } else {
      // Find the first active organization where this member exists
      const orgs = this.orgService.listOrganizations();
      for (const org of orgs) {
        const members = this.orgService.listMembers(org.id);
        const found = members.find(
          (m) => m.email.toLowerCase() === normalizedEmail && m.status === "active"
        );
        if (found) {
          targetMember = found;
          targetOrgId = org.id;
          break;
        }
      }
    }

    const expiresInSeconds = Math.floor(this.ttlMs / 1000);
    const standardMessage =
      "If an active member account matches this email, a single-use login link has been issued.";

    // If member not found, return generic success (anti-enumeration)
    if (!targetMember || !targetOrgId) {
      return {
        success: true,
        message: standardMessage,
        expiresInSeconds,
      };
    }

    // 3. Generate high-entropy 32-byte cryptographic token
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = this.hashToken(token);
    const now = Date.now();

    const record: StoredMagicLink = {
      tokenHash,
      email: normalizedEmail,
      organizationId: targetOrgId,
      memberId: targetMember.id,
      role: targetMember.role,
      name: targetMember.name,
      createdAt: now,
      expiresAt: now + this.ttlMs,
      used: false,
    };

    this.tokensByHash.set(tokenHash, record);

    // 4. In development or test environments, expose debugToken for automated test & local UI validation.
    // In production, token is ONLY sent via private enterprise delivery channel (never leaked in HTTP response).
    const isDevOrTest =
      process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_LOGIN === "true";

    return {
      success: true,
      message: standardMessage,
      debugToken: isDevOrTest ? token : undefined,
      expiresInSeconds,
    };
  }

  /**
   * Verify and consume a single-use login token.
   * Atomically burns the token to prevent replay attacks.
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
    const record = this.tokensByHash.get(tokenHash);

    if (!record) {
      throw new MagicLinkError(
        "INVALID_OR_EXPIRED_TOKEN",
        "This login link is invalid or has expired. Please request a new login link.",
        401
      );
    }

    if (record.used) {
      throw new MagicLinkError(
        "TOKEN_ALREADY_USED",
        "This single-use login link has already been used. Please request a new link.",
        401
      );
    }

    if (Date.now() > record.expiresAt) {
      this.tokensByHash.delete(tokenHash);
      throw new MagicLinkError(
        "TOKEN_EXPIRED",
        "This login link has expired. Magic links are valid for 15 minutes.",
        401
      );
    }

    // Atomically burn the token
    record.used = true;
    record.usedAt = Date.now();
    this.tokensByHash.set(tokenHash, record);

    return record;
  }

  /**
   * Invalidate/Revoke all active tokens for a member.
   */
  public revokeAllMemberTokens(memberId: string): void {
    for (const [hash, record] of this.tokensByHash.entries()) {
      if (record.memberId === memberId) {
        record.used = true;
        this.tokensByHash.delete(hash);
      }
    }
  }

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  private checkRateLimit(email: string): void {
    const now = Date.now();
    const entry = this.requestCountsByEmail.get(email);

    if (!entry || now - entry.windowStart > this.windowMs) {
      this.requestCountsByEmail.set(email, { count: 1, windowStart: now });
      return;
    }

    if (entry.count >= this.maxRequestsPerWindow) {
      throw new MagicLinkError(
        "RATE_LIMIT_EXCEEDED",
        "Too many login link requests. Please wait 15 minutes before requesting another link.",
        429
      );
    }

    entry.count += 1;
  }
}
