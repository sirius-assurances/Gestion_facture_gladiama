import { describe, expect, it } from "vitest";
import { formatSender, readMailerConfig } from "@/lib/email/mailer";

// Sending is meant to move between mailboxes — a personal Gmail while
// testing, the director's Outlook later, a provider on the company domain
// after that — by changing variables only. These pin that contract.
const base = { SMTP_USER: "moi@gmail.com", SMTP_PASSWORD: "secret" };

describe("readMailerConfig", () => {
  it("reports exactly what is missing rather than failing blankly", () => {
    const result = readMailerConfig({});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toEqual(["SMTP_HOST (ou SMTP_SERVICE)", "SMTP_USER", "SMTP_PASSWORD"]);
  });

  it("fills in host and port from a known service", () => {
    const result = readMailerConfig({ ...base, SMTP_SERVICE: "gmail" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.host).toBe("smtp.gmail.com");
    expect(result.config.port).toBe(465);
  });

  it("switches mailbox provider on the service alone", () => {
    const result = readMailerConfig({ ...base, SMTP_SERVICE: "hotmail" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.host).toBe("smtp-mail.outlook.com");
    expect(result.config.port).toBe(587);
  });

  // 465 is implicit TLS and 587 upgrades through STARTTLS. Getting this
  // backwards makes the connection hang rather than fail with a clear error.
  it("derives TLS from the port", () => {
    const implicit = readMailerConfig({ ...base, SMTP_HOST: "smtp.example.com", SMTP_PORT: "465" });
    const starttls = readMailerConfig({ ...base, SMTP_HOST: "smtp.example.com", SMTP_PORT: "587" });

    expect(implicit.ok && implicit.config.secure).toBe(true);
    expect(starttls.ok && starttls.config.secure).toBe(false);
  });

  it("defaults the sender to the authenticated mailbox", () => {
    const result = readMailerConfig({ ...base, SMTP_SERVICE: "gmail" });

    expect(result.ok && result.config.fromEmail).toBe("moi@gmail.com");
  });

  it("lets the sender address be overridden", () => {
    const result = readMailerConfig({ ...base, SMTP_SERVICE: "gmail", SMTP_FROM_EMAIL: "facturation@societe.com" });

    expect(result.ok && result.config.fromEmail).toBe("facturation@societe.com");
  });

  it("explicit SMTP_HOST wins over the service preset", () => {
    const result = readMailerConfig({ ...base, SMTP_SERVICE: "gmail", SMTP_HOST: "smtp.maison.sn", SMTP_PORT: "2525" });

    expect(result.ok && result.config.host).toBe("smtp.maison.sn");
    expect(result.ok && result.config.port).toBe(2525);
  });
});

describe("formatSender", () => {
  it("shows the company name, which is what a mail client displays", () => {
    const result = readMailerConfig({ ...base, SMTP_SERVICE: "gmail", SMTP_FROM_NAME: "GLADIAMA SUARL" });

    expect(result.ok && formatSender(result.config)).toBe("GLADIAMA SUARL <moi@gmail.com>");
  });
});
