import nodemailer from "nodemailer";
import { COMPANY } from "@/lib/company";

/**
 * Sending is configured entirely from the environment so accounts can
 * change without touching code: a personal Gmail while testing, the
 * director's Outlook mailbox, a provider on the company domain later. Only
 * the variables move.
 *
 * Mail is sent through the mailbox's own provider rather than a third party
 * because SPF and DKIM then pass naturally — a relay claiming to be
 * @gmail.com or @hotmail.com is rejected or filed as spam. That is also why
 * the sender in the compose dialog is a dropdown over these configured
 * accounts rather than free text: a message may only claim an address its
 * own mail server is authorised to send for.
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

/** One configured sender, selectable in the compose dialog. */
export type MailerAccount = {
  id: string;
  config: MailerConfig;
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

/**
 * Reads one account's settings, under the given variable prefix — "" for
 * the original, unprefixed SMTP_* set (kept so an already-configured single
 * account keeps working untouched), or e.g. "BOSS_" for SMTP_BOSS_*.
 */
function readAccountConfig(env: Record<string, string | undefined>, prefix: string): MailerConfigResult {
  const at = (name: string) => env[`SMTP_${prefix}${name}`];

  const service = at("SERVICE")?.trim().toLowerCase();
  const preset = service ? SERVICE_PRESETS[service] : undefined;
  const host = at("HOST")?.trim() || preset?.host;
  const user = at("USER")?.trim();
  const password = at("PASSWORD");

  const missing: string[] = [];
  if (!host) missing.push(`SMTP_${prefix}HOST (ou SMTP_${prefix}SERVICE)`);
  if (!user) missing.push(`SMTP_${prefix}USER`);
  if (!password) missing.push(`SMTP_${prefix}PASSWORD`);
  if (missing.length) return { ok: false, missing };

  const port = Number(at("PORT")?.trim() || preset?.port || 587);
  return {
    ok: true,
    config: {
      service,
      host,
      port,
      // Port 465 is implicit TLS; 587 upgrades through STARTTLS instead.
      secure: at("SECURE") ? at("SECURE") === "true" : port === 465,
      user: user!,
      password: password!,
      // Defaulting the sender to the authenticated mailbox keeps the common
      // case to two variables, and a mismatch here is what gets a message
      // rejected for impersonation.
      fromEmail: at("FROM_EMAIL")?.trim() || user!,
      fromName: at("FROM_NAME")?.trim() || COMPANY.name,
      replyTo: at("REPLY_TO")?.trim() || undefined,
    },
  };
}

/** Takes the environment as an argument so the rules are testable without touching process.env. */
export function readMailerConfig(env: Record<string, string | undefined> = process.env): MailerConfigResult {
  return readAccountConfig(env, "");
}

export type MailerAccountsResult = {
  accounts: MailerAccount[];
  /** Missing variables for the default account only — what check:smtp reports with no account named. */
  missing: string[];
};

/**
 * Every configured sender: the unprefixed account (id "default") plus one
 * per entry in SMTP_ACCOUNTS (comma-separated ids, e.g. "boss" reading
 * SMTP_BOSS_*). An id declared in SMTP_ACCOUNTS but missing its variables is
 * silently skipped rather than surfaced — only the default account's
 * completeness is reported, since that is the one deployment that must work
 * for sending to function at all; a second account is additive.
 */
export function readMailerAccounts(env: Record<string, string | undefined> = process.env): MailerAccountsResult {
  const accounts: MailerAccount[] = [];
  const primary = readAccountConfig(env, "");
  if (primary.ok) accounts.push({ id: "default", config: primary.config });

  const extraIds = (env.SMTP_ACCOUNTS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  for (const id of extraIds) {
    const result = readAccountConfig(env, `${id.toUpperCase()}_`);
    if (result.ok) accounts.push({ id: id.toLowerCase(), config: result.config });
  }

  return { accounts, missing: primary.ok ? [] : primary.missing };
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
