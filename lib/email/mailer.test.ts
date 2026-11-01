import { describe, expect, it } from "vitest";
import { formatSender, readMailerAccounts, readMailerConfig } from "@/lib/email/mailer";

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

// Multiple real mailboxes selectable in the compose dialog's "De" dropdown —
// the user's own account while testing, the director's Outlook once his app
// password is set up — without the sender ever becoming free text (see
// mailer.ts's module comment for why that matters: SPF/DKIM).
describe("readMailerAccounts", () => {
  it("returns just the default account when nothing extra is declared", () => {
    const result = readMailerAccounts({ ...base, SMTP_SERVICE: "gmail" });

    expect(result.accounts.map((a) => a.id)).toEqual(["default"]);
  });

  it("adds an account named in SMTP_ACCOUNTS, reading its own prefixed variables", () => {
    const result = readMailerAccounts({
      ...base,
      SMTP_SERVICE: "gmail",
      SMTP_ACCOUNTS: "boss",
      SMTP_BOSS_SERVICE: "outlook",
      SMTP_BOSS_USER: "patron@hotmail.com",
      SMTP_BOSS_PASSWORD: "secret2",
    });

    expect(result.accounts.map((a) => a.id)).toEqual(["default", "boss"]);
    expect(result.accounts[1].config.host).toBe("smtp-mail.outlook.com");
    expect(result.accounts[1].config.user).toBe("patron@hotmail.com");
  });

  it("skips an account named in SMTP_ACCOUNTS whose variables are incomplete", () => {
    const result = readMailerAccounts({
      ...base,
      SMTP_SERVICE: "gmail",
      SMTP_ACCOUNTS: "boss",
      SMTP_BOSS_USER: "patron@hotmail.com",
      // SMTP_BOSS_PASSWORD missing — the whole second account drops rather
      // than appearing as a dropdown entry that fails only at send time.
    });

    expect(result.accounts.map((a) => a.id)).toEqual(["default"]);
  });

  it("supports several extra accounts", () => {
    const result = readMailerAccounts({
      ...base,
      SMTP_SERVICE: "gmail",
      SMTP_ACCOUNTS: "boss, archive",
      SMTP_BOSS_SERVICE: "outlook",
      SMTP_BOSS_USER: "patron@hotmail.com",
      SMTP_BOSS_PASSWORD: "secret2",
      SMTP_ARCHIVE_SERVICE: "gmail",
      SMTP_ARCHIVE_USER: "archives@gmail.com",
      SMTP_ARCHIVE_PASSWORD: "secret3",
    });

    expect(result.accounts.map((a) => a.id)).toEqual(["default", "boss", "archive"]);
  });

  it("returns no accounts and the default's missing variables when nothing is configured", () => {
    const result = readMailerAccounts({});

    expect(result.accounts).toEqual([]);
    expect(result.missing).toEqual(["SMTP_HOST (ou SMTP_SERVICE)", "SMTP_USER", "SMTP_PASSWORD"]);
  });

  it("can offer only a secondary account when the default is not configured", () => {
    const result = readMailerAccounts({
      SMTP_ACCOUNTS: "boss",
      SMTP_BOSS_SERVICE: "outlook",
      SMTP_BOSS_USER: "patron@hotmail.com",
      SMTP_BOSS_PASSWORD: "secret2",
    });

    expect(result.accounts.map((a) => a.id)).toEqual(["boss"]);
  });
});
