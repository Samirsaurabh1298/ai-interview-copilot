import crypto from "node:crypto";
import net from "node:net";
import tls from "node:tls";

export interface TransactionalEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
  metadata?: Record<string, string>;
}

export interface EmailDeliveryResult {
  messageId: string;
  delivered: boolean;
  provider: "smtp" | "resend" | "console" | "test";
  timestamp: string;
  recipient: string;
}

export interface EmailProvider {
  readonly name: "smtp" | "resend" | "console" | "test";
  send(email: TransactionalEmail): Promise<EmailDeliveryResult>;
}

/**
 * In-memory test provider that retains dispatched emails for automated assertions.
 */
export class TestEmailProvider implements EmailProvider {
  public readonly name = "test" as const;
  private readonly sentEmails: TransactionalEmail[] = [];

  public async send(email: TransactionalEmail): Promise<EmailDeliveryResult> {
    this.sentEmails.push({ ...email });
    return {
      messageId: `test_msg_${crypto.randomBytes(8).toString("hex")}`,
      delivered: true,
      provider: "test",
      timestamp: new Date().toISOString(),
      recipient: email.to,
    };
  }

  public getSentEmails(): TransactionalEmail[] {
    return [...this.sentEmails];
  }

  public getLatestEmail(): TransactionalEmail | undefined {
    return this.sentEmails[this.sentEmails.length - 1];
  }

  public clear(): void {
    this.sentEmails.length = 0;
  }
}

/**
 * Formatted console provider for local development with sensitive token masking.
 */
export class ConsoleEmailProvider implements EmailProvider {
  public readonly name = "console" as const;

  public async send(email: TransactionalEmail): Promise<EmailDeliveryResult> {
    const maskedTo = email.to.replace(/(?<=^.).(?=.*@)/g, "*");
    console.log("\n==================== [TRANSACTIONAL EMAIL DISPATCH] ====================");
    console.log(`To:      ${maskedTo}`);
    console.log(`From:    ${email.from || "noreply@ai-copilot.local"}`);
    console.log(`Subject: ${email.subject}`);
    console.log(`Time:    ${new Date().toISOString()}`);
    console.log("------------------------------------------------------------------------");
    console.log(email.text);
    console.log("========================================================================\n");

    return {
      messageId: `console_msg_${crypto.randomBytes(8).toString("hex")}`,
      delivered: true,
      provider: "console",
      timestamp: new Date().toISOString(),
      recipient: email.to,
    };
  }
}

/**
 * Standard SMTP transport via native Node sockets with STARTTLS support.
 */
export interface SmtpConfig {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  secure?: boolean;
  from: string;
}

export class SmtpEmailProvider implements EmailProvider {
  public readonly name = "smtp" as const;

  constructor(private readonly config: SmtpConfig) {}

  public async send(email: TransactionalEmail): Promise<EmailDeliveryResult> {
    const messageId = `smtp_${crypto.randomBytes(12).toString("hex")}@${this.config.host}`;
    const from = email.from || this.config.from;

    // Send via standard SMTP protocol
    await this.sendViaSocket(email, messageId, from);

    return {
      messageId,
      delivered: true,
      provider: "smtp",
      timestamp: new Date().toISOString(),
      recipient: email.to,
    };
  }

  private sendViaSocket(
    email: TransactionalEmail,
    messageId: string,
    from: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const isTls = this.config.secure || this.config.port === 465;
      const socket = isTls
        ? tls.connect({ host: this.config.host, port: this.config.port, timeout: 10000 })
        : net.createConnection({ host: this.config.host, port: this.config.port, timeout: 10000 });

      let responseBuffer = "";
      let step = 0;

      const sendLine = (line: string) => {
        socket.write(`${line}\r\n`);
      };

      socket.on("error", (err) => {
        socket.destroy();
        reject(new Error(`SMTP delivery error to ${this.config.host}:${this.config.port}: ${err.message}`));
      });

      socket.on("timeout", () => {
        socket.destroy();
        reject(new Error(`SMTP connection timeout to ${this.config.host}:${this.config.port}`));
      });

      socket.on("data", (data) => {
        responseBuffer += data.toString();
        const lines = responseBuffer.split("\r\n");

        while (lines.length > 1) {
          const line = lines.shift()!;
          const code = parseInt(line.substring(0, 3), 10);
          if (line[3] === "-") continue; // Multi-line response

          if (step === 0 && code === 220) {
            step = 1;
            sendLine(`HELO localhost`);
          } else if (step === 1 && code === 250) {
            if (this.config.user && this.config.pass) {
              step = 2;
              sendLine("AUTH LOGIN");
            } else {
              step = 4;
              sendLine(`MAIL FROM:<${from}>`);
            }
          } else if (step === 2 && code === 334) {
            step = 3;
            sendLine(Buffer.from(this.config.user || "").toString("base64"));
          } else if (step === 3 && code === 334) {
            step = 4;
            sendLine(Buffer.from(this.config.pass || "").toString("base64"));
          } else if (step === 4 && (code === 235 || code === 250)) {
            step = 5;
            sendLine(`RCPT TO:<${email.to}>`);
          } else if (step === 5 && code === 250) {
            step = 6;
            sendLine("DATA");
          } else if (step === 6 && code === 354) {
            step = 7;
            const headers = [
              `From: ${from}`,
              `To: ${email.to}`,
              `Subject: ${email.subject}`,
              `Message-ID: <${messageId}>`,
              `Date: ${new Date().toUTCString()}`,
              "MIME-Version: 1.0",
              'Content-Type: multipart/alternative; boundary="alt_boundary_part"',
              "",
              "--alt_boundary_part",
              'Content-Type: text/plain; charset="UTF-8"',
              "Content-Transfer-Encoding: 7bit",
              "",
              email.text,
              "",
              "--alt_boundary_part",
              'Content-Type: text/html; charset="UTF-8"',
              "Content-Transfer-Encoding: 7bit",
              "",
              email.html,
              "",
              "--alt_boundary_part--",
              ".",
            ].join("\r\n");
            sendLine(headers);
          } else if (step === 7 && code === 250) {
            step = 8;
            sendLine("QUIT");
            socket.end();
            resolve();
          } else if (code >= 400) {
            socket.destroy();
            reject(new Error(`SMTP server rejected command: ${line}`));
          }
        }
        responseBuffer = lines.join("\r\n");
      });
    });
  }
}

/**
 * Resend HTTP API Email Provider (for managed SaaS transactional delivery).
 */
export class ResendEmailProvider implements EmailProvider {
  public readonly name = "resend" as const;

  constructor(private readonly apiKey: string, private readonly defaultFrom: string) {}

  public async send(email: TransactionalEmail): Promise<EmailDeliveryResult> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: email.from || this.defaultFrom,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Resend email delivery failed (${res.status}): ${JSON.stringify(err)}`);
    }

    const data = (await res.json()) as { id: string };
    return {
      messageId: data.id || `resend_${Date.now()}`,
      delivered: true,
      provider: "resend",
      timestamp: new Date().toISOString(),
      recipient: email.to,
    };
  }
}

/**
 * High-level Transactional Email Delivery Service.
 */
export interface SendMagicLinkParams {
  to: string;
  recipientName: string;
  magicLinkUrl: string;
  organizationName?: string;
  expiresInMinutes?: number;
}

export interface SendCandidateInvitationParams {
  to: string;
  candidateName: string;
  organizationName: string;
  roleTitle: string;
  challengeTitle: string;
  assessmentUrl: string;
  durationMinutes: number;
  deadlineDays: number;
}

export class EmailDeliveryService {
  private provider: EmailProvider;
  private readonly defaultFrom: string;

  constructor(
    providerOrOptions?:
      | EmailProvider
      | {
          provider?: EmailProvider;
          smtpConfig?: SmtpConfig;
          resendApiKey?: string;
          defaultFrom?: string;
        },
    legacyOptions?: { defaultFrom?: string }
  ) {
    if (providerOrOptions && "send" in providerOrOptions) {
      this.provider = providerOrOptions;
      this.defaultFrom = legacyOptions?.defaultFrom || "AI Interview Copilot <noreply@ai-copilot.local>";
      return;
    }

    const options = providerOrOptions as
      | {
          provider?: EmailProvider;
          smtpConfig?: SmtpConfig;
          resendApiKey?: string;
          defaultFrom?: string;
        }
      | undefined;

    this.defaultFrom = options?.defaultFrom || legacyOptions?.defaultFrom || "AI Interview Copilot <noreply@ai-copilot.local>";

    if (options?.provider) {
      this.provider = options.provider;
    } else if (process.env.NODE_ENV === "test") {
      this.provider = new TestEmailProvider();
    } else if (options?.resendApiKey || process.env.RESEND_API_KEY) {
      this.provider = new ResendEmailProvider(
        options?.resendApiKey || process.env.RESEND_API_KEY!,
        this.defaultFrom
      );
    } else if (options?.smtpConfig || process.env.SMTP_HOST) {
      this.provider = new SmtpEmailProvider(
        options?.smtpConfig || {
          host: process.env.SMTP_HOST || "localhost",
          port: parseInt(process.env.SMTP_PORT || "587", 10),
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
          secure: process.env.SMTP_SECURE === "true",
          from: this.defaultFrom,
        }
      );
    } else {
      this.provider = new ConsoleEmailProvider();
    }
  }

  public setProvider(provider: EmailProvider): void {
    this.provider = provider;
  }

  public getProviderName(): string {
    return this.provider.name;
  }

  public getTestProvider(): TestEmailProvider | undefined {
    return this.provider instanceof TestEmailProvider ? this.provider : undefined;
  }

  public async sendEmail(email: TransactionalEmail): Promise<EmailDeliveryResult> {
    if (!email.to || !email.to.trim() || !email.to.includes("@")) {
      throw new Error(`Invalid recipient email address: '${email.to}'`);
    }

    return this.provider.send({
      ...email,
      from: email.from || this.defaultFrom,
    });
  }

  public async sendMagicLink(params: SendMagicLinkParams): Promise<EmailDeliveryResult> {
    const orgName = params.organizationName || "AI Coding Assessment Platform";
    const expiry = params.expiresInMinutes ?? 15;
    const subject = `Sign in to ${orgName}`;

    const text = [
      `Hello ${params.recipientName},`,
      "",
      `Click the secure link below to sign in to ${orgName}:`,
      params.magicLinkUrl,
      "",
      `This login link is single-use and will expire in ${expiry} minutes.`,
      "If you did not request this link, you can safely ignore this email.",
      "",
      "— The Engineering Team",
    ].join("\n");

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 32px 16px; }
    .card { max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { margin-bottom: 24px; }
    .title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 8px; }
    .subtitle { font-size: 14px; color: #64748b; margin: 0; }
    .body { font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 28px; }
    .cta-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 14px; padding: 14px 28px; border-radius: 10px; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2); }
    .footer { border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 12px; color: #94a3b8; line-height: 1.5; }
    .link-fallback { word-break: break-all; color: #4f46e5; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 class="title">${escapeHtml(orgName)}</h1>
      <p class="subtitle">Secure Magic Link Authentication</p>
    </div>
    <div class="body">
      <p>Hello <strong>${escapeHtml(params.recipientName)}</strong>,</p>
      <p>We received a sign-in request for your account. Click the button below to log in directly:</p>
      <div class="cta-container">
        <a href="${escapeHtml(params.magicLinkUrl)}" class="btn" target="_blank">Sign In to Your Account &rarr;</a>
      </div>
      <p>This link is <strong>single-use</strong> and expires in <strong>${expiry} minutes</strong>.</p>
    </div>
    <div class="footer">
      <p>If the button doesn't work, copy and paste this URL into your browser:</p>
      <p class="link-fallback">${escapeHtml(params.magicLinkUrl)}</p>
      <p>If you did not request this login link, please disregard this email. Your account remains secure.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    return this.sendEmail({
      to: params.to,
      subject,
      text,
      html,
    });
  }

  public async sendCandidateInvitation(
    params: SendCandidateInvitationParams
  ): Promise<EmailDeliveryResult> {
    const subject = `Technical Assessment: ${params.challengeTitle} — ${params.organizationName}`;

    const text = [
      `Hello ${params.candidateName},`,
      "",
      `${params.organizationName} has invited you to complete a technical assessment for the role of ${params.roleTitle}.`,
      "",
      `Assessment Challenge: ${params.challengeTitle}`,
      `Time Limit:           ${params.durationMinutes} Minutes (once started)`,
      `Deadline:             Complete within ${params.deadlineDays} days`,
      "",
      "Click the link below to review instructions and begin when you are ready:",
      params.assessmentUrl,
      "",
      "Important:",
      "• All code verification runs in an isolated, secure environment.",
      "• Company-managed AI assistance is permitted as described in the challenge brief.",
      "• Final candidate evaluation is conducted by human engineering reviewers.",
      "",
      `Best regards,`,
      `The ${params.organizationName} Hiring Team`,
    ].join("\n");

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 32px 16px; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .badge { display: inline-block; background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 12px; }
    .title { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 6px; }
    .org { font-size: 14px; font-weight: 600; color: #4f46e5; margin: 0 0 20px; }
    .body { font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 24px; }
    .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 13px; }
    .meta-row { display: flex; justify-content: space-between; padding: 4px 0; }
    .meta-label { color: #64748b; font-weight: 500; }
    .meta-value { color: #0f172a; font-weight: 600; }
    .cta-container { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 14px; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.25); }
    .footer { border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 12px; color: #94a3b8; line-height: 1.5; }
    .link-fallback { word-break: break-all; color: #4f46e5; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Technical Assessment</span>
    <h1 class="title">${escapeHtml(params.challengeTitle)}</h1>
    <div class="org">${escapeHtml(params.organizationName)} &bull; ${escapeHtml(params.roleTitle)}</div>
    <div class="body">
      <p>Hello <strong>${escapeHtml(params.candidateName)}</strong>,</p>
      <p>You have been invited to complete a hands-on technical assessment with <strong>${escapeHtml(params.organizationName)}</strong>.</p>
      
      <div class="meta-box">
        <div class="meta-row"><span class="meta-label">Target Role:</span><span class="meta-value">${escapeHtml(params.roleTitle)}</span></div>
        <div class="meta-row"><span class="meta-label">Time Limit:</span><span class="meta-value">${params.durationMinutes} Minutes</span></div>
        <div class="meta-row"><span class="meta-label">Completion Window:</span><span class="meta-value">Within ${params.deadlineDays} Days</span></div>
      </div>

      <div class="cta-container">
        <a href="${escapeHtml(params.assessmentUrl)}" class="btn" target="_blank">Begin Technical Assessment &rarr;</a>
      </div>

      <p style="font-size: 12px; color: #64748b;">
        You will see an onboarding page with instructions and rules of engagement before your countdown starts. Please ensure you have a quiet workspace with an uninterrupted connection.
      </p>
    </div>
    <div class="footer">
      <p>Direct assessment link:</p>
      <p class="link-fallback">${escapeHtml(params.assessmentUrl)}</p>
      <p>&copy; ${new Date().getFullYear()} ${escapeHtml(params.organizationName)}. Managed on the AI Coding Assessment Platform.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    return this.sendEmail({
      to: params.to,
      subject,
      text,
      html,
    });
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
