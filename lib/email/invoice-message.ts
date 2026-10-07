import { COMPANY, COMPANY_SIGNATURE } from "@/lib/company";

export type InvoiceMessageInput = {
  invoiceNumber: string;
  clientName: string;
  totalFormatted: string;
  periodStart: string;
  periodEnd: string;
};

/**
 * The subject and body the compose dialog opens with. Both stay editable —
 * these are a starting point, not a template the user is locked into.
 *
 * Kept pure and separate from sending so the wording can be checked without
 * an SMTP server.
 */
export function buildInvoiceSubject(input: InvoiceMessageInput) {
  return `Facture ${input.invoiceNumber} — ${COMPANY.name}`;
}

export function buildInvoiceBody(input: InvoiceMessageInput) {
  return [
    "Bonjour,",
    "",
    `Veuillez trouver ci-joint la facture ${input.invoiceNumber}.`,
    "",
    `Client : ${input.clientName}`,
    `Montant : ${input.totalFormatted}`,
    `Période : du ${input.periodStart} au ${input.periodEnd}`,
    "",
    "Cordialement,",
    COMPANY_SIGNATURE,
    `Tél : ${COMPANY.phone}`,
  ].join("\n");
}

/** Filename the recipient sees on the attachment. */
export function buildAttachmentName(invoiceNumber: string, clientName: string) {
  const safe = (value: string) => value.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
  return `Facture_${safe(invoiceNumber)}_${safe(clientName)}.pdf`;
}

/**
 * Accepts the comma- or semicolon-separated list people actually type into a
 * Cc field, and drops anything that is not an address rather than letting the
 * send fail on one stray character.
 */
export function parseRecipients(value: string): string[] {
  return value
    .split(/[,;\s]+/)
    .map((entry) => entry.trim())
    .filter((entry) => /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(entry));
}
