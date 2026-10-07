import nodemailer from "nodemailer";
import { COMPANY } from "@/lib/company";

/**
 * Sending is configured entirely from the environment so the account can
 * change without touching code: a personal Gmail while testing, the
 * director's Outlook mailbox, or a provider on the company domain later.
 * Only the variables move.
 *
 * Mail is sent through the mailbox's own provider rather than a third party
 * because SPF and DKIM then pass naturally — a relay claiming to be
 * @gmail.com or @hotmail.com is rejected or filed as spam.
 */
export type MailerConfig = {
  service?: string;
  host?: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
};

/** Well-known hosts, so a working setup needs only a user and a password. */
const SERVICE_PRESETS: Record<string, { host: string; port: number }> = {
  gmail: { host: "smtp.gmail.com", port: 465 },
  outlook: { host: "smtp-mail.outlook.com", port: 587 },
  hotmail: { host: "smtp-mail.outlook.com", port: 587 },
  resend: { host: "smtp.resend.com", port: 465 },
};

export type MailerConfigResult =
  | { ok: true; config: MailerConfig }
  | { ok: false; missing: string[] };

/** Takes the environment as an argument so the rules are testable without touching process.env. */
export function readMailerConfig(env: Record<string, string | undefined> = process.env): MailerConfigResult {
  const service = env.SMTP_SERVICE?.trim().toLowerCase();
  const preset = service ? SERVICE_PRESETS[service] : undefined;
  const host = env.SMTP_HOST?.trim() || preset?.host;
  const user = env.SMTP_USER?.trim();
  const password = env.SMTP_PASSWORD;

  const missing: string[] = [];
  if (!host) missing.push("SMTP_HOST (ou SMTP_SERVICE)");
  if (!user) missing.push("SMTP_USER");
  if (!password) missing.push("SMTP_PASSWORD");
  if (missing.length) return { ok: false, missing };

  const port = Number(env.SMTP_PORT?.trim() || preset?.port || 587);
  return {
    ok: true,
    config: {
      service,
      host,
      port,
      // Port 465 is implicit TLS; 587 upgrades through STARTTLS instead.
      secure: env.SMTP_SECURE ? env.SMTP_SECURE === "true" : port === 465,
      user: user!,
      password: password!,
      // Defaulting the sender to the authenticated mailbox keeps the common
      // case to two variables, and a mismatch here is what gets a message
      // rejected for impersonation.
      fromEmail: env.SMTP_FROM_EMAIL?.trim() || user!,
      fromName: env.SMTP_FROM_NAME?.trim() || COMPANY.name,
      replyTo: env.SMTP_REPLY_TO?.trim() || undefined,
    },
  };
}

export function createTransport(config: MailerConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
  });
}

/** "GLADIAMA SUARL <facturation@example.com>" — the name is what a mail client shows. */
export function formatSender(config: MailerConfig) {
  return `${config.fromName} <${config.fromEmail}>`;
}
