import { describe, it, expect, beforeEach } from "vitest";
import {
  EmailDeliveryService,
  TestEmailProvider,
  ConsoleEmailProvider,
} from "./email.js";

describe("EmailDeliveryService Unit & Integration Test Suite", () => {
  let testProvider: TestEmailProvider;
  let emailService: EmailDeliveryService;

  beforeEach(() => {
    testProvider = new TestEmailProvider();
    emailService = new EmailDeliveryService(testProvider, {
      defaultFrom: '"Engineering Assessments" <noreply@eval-platform.com>',
    });
  });

  describe("Magic Link Email Delivery", () => {
    it("delivers formatted transactional magic link email with valid metadata and token URL", async () => {
      const result = await emailService.sendMagicLink({
        to: "recruiter@acme-corp.com",
        recipientName: "Alice Recruiter",
        magicLinkUrl: "https://platform.acme.com/auth/verify?token=abc1234567890abcdef",
        expiresInMinutes: 15,
        organizationName: "Acme Corporation",
      });

      expect(result.delivered).toBe(true);
      expect(result.recipient).toBe("recruiter@acme-corp.com");
      expect(result.provider).toBe("test");
      expect(result.messageId).toMatch(/^test_msg_/);

      const sent = testProvider.getLatestEmail();
      expect(sent).toBeDefined();
      expect(sent?.to).toBe("recruiter@acme-corp.com");
      expect(sent?.subject).toBe("Sign in to Acme Corporation");
      expect(sent?.from).toBe('"Engineering Assessments" <noreply@eval-platform.com>');

      // Verify HTML and text versions contain link and expiry
      expect(sent?.text).toContain("Hello Alice Recruiter,");
      expect(sent?.text).toContain("https://platform.acme.com/auth/verify?token=abc1234567890abcdef");
      expect(sent?.text).toContain("15 minutes");

      expect(sent?.html).toContain("Alice Recruiter");
      expect(sent?.html).toContain("href=\"https://platform.acme.com/auth/verify?token=abc1234567890abcdef\"");
      expect(sent?.html).toContain("Acme Corporation");
    });

    it("escapes malicious HTML characters in recipient names and org names", async () => {
      await emailService.sendMagicLink({
        to: "victim@corp.com",
        recipientName: "<script>alert('xss')</script>",
        magicLinkUrl: "https://platform.acme.com/auth/verify?token=12345",
        organizationName: '<b>Hackers & "Co"</b>',
      });

      const sent = testProvider.getLatestEmail();
      expect(sent?.html).not.toContain("<script>");
      expect(sent?.html).toContain("&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;");
      expect(sent?.html).toContain("&lt;b&gt;Hackers &amp; &quot;Co&quot;&lt;/b&gt;");
    });

    it("rejects blank or invalid email addresses", async () => {
      await expect(
        emailService.sendMagicLink({
          to: "invalid-email",
          recipientName: "Test",
          magicLinkUrl: "https://example.com",
        })
      ).rejects.toThrow(/Invalid recipient email/i);

      await expect(
        emailService.sendMagicLink({
          to: "   ",
          recipientName: "Test",
          magicLinkUrl: "https://example.com",
        })
      ).rejects.toThrow(/Invalid recipient email/i);
    });
  });

  describe("Candidate Assessment Invitation Email Delivery", () => {
    it("delivers personalized invitation with role, duration, deadline and direct URL", async () => {
      const result = await emailService.sendCandidateInvitation({
        to: "candidate.jordan@gmail.com",
        candidateName: "Jordan Lee",
        assessmentUrl: "https://platform.acme.com/?invite=inv_token_9999",
        challengeTitle: "Full-Stack Distributed Queue Triage",
        roleTitle: "Senior Backend Engineer",
        organizationName: "Pinnacle Cloud Ltd",
        durationMinutes: 90,
        deadlineDays: 7,
      });

      expect(result.delivered).toBe(true);
      expect(result.recipient).toBe("candidate.jordan@gmail.com");

      const sent = testProvider.getLatestEmail();
      expect(sent?.subject).toBe(
        "Technical Assessment: Full-Stack Distributed Queue Triage — Pinnacle Cloud Ltd"
      );
      expect(sent?.text).toContain("Hello Jordan Lee,");
      expect(sent?.text).toContain("Senior Backend Engineer");
      expect(sent?.text).toContain("90 Minutes");
      expect(sent?.text).toContain("7 days");
      expect(sent?.text).toContain("https://platform.acme.com/?invite=inv_token_9999");

      expect(sent?.html).toContain("Jordan Lee");
      expect(sent?.html).toContain("Senior Backend Engineer");
      expect(sent?.html).toContain("90 Minutes");
      expect(sent?.html).toContain("Within 7 Days");
      expect(sent?.html).toContain("https://platform.acme.com/?invite=inv_token_9999");
    });
  });

  describe("Provider Swapping & Console Logging", () => {
    it("allows dynamic provider swapping at runtime", async () => {
      expect(emailService.getProviderName()).toBe("test");

      const consoleProvider = new ConsoleEmailProvider();
      emailService.setProvider(consoleProvider);
      expect(emailService.getProviderName()).toBe("console");

      const result = await emailService.sendMagicLink({
        to: "developer@domain.test",
        recipientName: "Dev User",
        magicLinkUrl: "http://localhost:5173/auth/verify?token=123",
      });

      expect(result.provider).toBe("console");
      expect(result.delivered).toBe(true);
    });
  });
});
