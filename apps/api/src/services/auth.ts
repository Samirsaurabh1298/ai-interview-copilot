import crypto from "node:crypto";
import type { FastifyRequest, FastifyReply } from "fastify";
import type {
  OrganizationMember,
  MembershipRole,
  AuthUserContext,
  TokenPayload,
  AuthTokenResponse,
  CandidateTokenRequest,
} from "@ai-copilot/contracts";

export class AuthenticationError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthenticationError";
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class AuthorizationError extends Error {
  constructor(message = "Forbidden: Insufficient role permissions") {
    super(message);
    this.name = "AuthorizationError";
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

export class TenantAccessDeniedError extends Error {
  constructor(message = "Forbidden: Cannot access resources outside your organization") {
    super(message);
    this.name = "TenantAccessDeniedError";
    Object.setPrototypeOf(this, TenantAccessDeniedError.prototype);
  }
}

export function isTenantOrAuthForbiddenError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof TenantAccessDeniedError || err instanceof AuthorizationError) return true;
  if (
    err instanceof Error &&
    (err.name === "TenantAccessDeniedError" ||
      err.name === "AuthorizationError" ||
      err.message.includes("Cross-tenant access forbidden") ||
      err.message.includes("lacks permission"))
  ) {
    return true;
  }
  return false;
}

export class AuthService {
  private secret: Buffer;

  constructor(secretString: string) {
    this.secret = Buffer.from(secretString, "utf8");
  }

  public createMemberToken(
    member: OrganizationMember,
    expiresInSeconds = 86400
  ): AuthTokenResponse {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + expiresInSeconds;

    const payload: TokenPayload = {
      sub: member.userId,
      orgId: member.organizationId,
      memberId: member.id,
      role: member.role,
      email: member.email,
      iat: now,
      exp,
    };

    const token = this.signJwt(payload);
    return {
      token,
      tokenType: "Bearer",
      expiresInSeconds,
      user: {
        userId: member.userId,
        organizationId: member.organizationId,
        memberId: member.id,
        role: member.role,
        email: member.email,
      },
    };
  }

  public createCandidateToken(req: CandidateTokenRequest): AuthTokenResponse {
    const now = Math.floor(Date.now() / 1000);
    const validity = req.validitySeconds ?? 3600;
    const exp = now + validity;

    const payload: TokenPayload = {
      sub: req.candidateId,
      orgId: req.organizationId,
      sessionId: req.sessionId,
      role: "candidate",
      email: req.candidateEmail,
      iat: now,
      exp,
    };

    const token = this.signJwt(payload);
    return {
      token,
      tokenType: "Bearer",
      expiresInSeconds: validity,
      user: {
        userId: req.candidateId,
        organizationId: req.organizationId,
        sessionId: req.sessionId,
        role: "candidate",
        email: req.candidateEmail,
      },
    };
  }

  public verifyToken(token: string): AuthUserContext {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new AuthenticationError("Malformed JWT token format");
    }

    const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];
    const dataToVerify = `${headerB64}.${payloadB64}`;

    const expectedSignature = crypto
      .createHmac("sha256", this.secret)
      .update(dataToVerify)
      .digest("base64url");

    // Timing-safe signature comparison to protect against side-channel timing attacks
    const sigBuf = Buffer.from(signatureB64, "utf8");
    const expBuf = Buffer.from(expectedSignature, "utf8");
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      throw new AuthenticationError("Invalid token signature");
    }

    let payload: TokenPayload;
    try {
      const json = Buffer.from(payloadB64, "base64url").toString("utf8");
      payload = JSON.parse(json);
    } catch {
      throw new AuthenticationError("Failed to decode token payload");
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new AuthenticationError("Token has expired");
    }

    return {
      userId: payload.sub,
      organizationId: payload.orgId,
      memberId: payload.memberId,
      sessionId: payload.sessionId,
      role: payload.role,
      email: payload.email,
    };
  }

  public parseAuthHeader(header?: string): AuthUserContext {
    if (!header) {
      throw new AuthenticationError("Missing Authorization header");
    }

    const [scheme, token] = header.trim().split(/\s+/);
    if (scheme?.toLowerCase() !== "bearer" || !token) {
      throw new AuthenticationError("Authorization header must use Bearer scheme");
    }

    return this.verifyToken(token);
  }

  public requireAuth() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const authHeader = request.headers.authorization;
        const authContext = this.parseAuthHeader(authHeader);
        (request as any).auth = authContext;
      } catch (err) {
        return reply.status(401).send({
          error: "UNAUTHORIZED",
          message: err instanceof Error ? err.message : "Authentication required",
        });
      }
    };
  }

  public requireRole(allowedRoles: MembershipRole[]) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const authHeader = request.headers.authorization;
        const authContext = this.parseAuthHeader(authHeader);
        (request as any).auth = authContext;

        if (!allowedRoles.includes(authContext.role)) {
          return reply.status(403).send({
            error: "FORBIDDEN",
            message: `User role '${authContext.role}' lacks permission for this action. Required: ${allowedRoles.join(", ")}`,
          });
        }
      } catch (err) {
        return reply.status(401).send({
          error: "UNAUTHORIZED",
          message: err instanceof Error ? err.message : "Authentication required",
        });
      }
    };
  }

  public assertTenantAccess(context: AuthUserContext, resourceOrgId: string): void {
    if (context.organizationId !== resourceOrgId) {
      throw new TenantAccessDeniedError(
        `Cross-tenant access forbidden: Auth tenant '${context.organizationId}' cannot access '${resourceOrgId}'`
      );
    }
  }

  public assertCompanyMember(context: AuthUserContext): void {
    if (context.role === "candidate") {
      throw new AuthorizationError(
        "Forbidden: Candidate tokens cannot access company administrative resources"
      );
    }
  }

  public assertSessionAccess(context: AuthUserContext, targetSessionId: string): void {
    // If the caller is a candidate, they can ONLY access their explicitly assigned session
    if (context.role === "candidate" && context.sessionId !== targetSessionId) {
      throw new AuthorizationError(
        `Candidate token is strictly restricted to session '${context.sessionId}'. Cannot access '${targetSessionId}'`
      );
    }
  }

  private signJwt(payload: TokenPayload): string {
    const header = { alg: "HS256", typ: "JWT" };
    const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto
      .createHmac("sha256", this.secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest("base64url");

    return `${headerB64}.${payloadB64}.${signature}`;
  }
}

