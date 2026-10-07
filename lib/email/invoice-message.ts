import { COMPANY } from "@/lib/company";
import { formatCfa } from "@/lib/format";

export type InvoiceMessageInput = {
  invoiceNumber: string;
  clientName: string;
  designation: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  hasTva: boolean;
  tvaRate: number;
  totalHt: number;
  totalTva: number;
  totalTtc: number;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  projectName?: string;
  marketNumber?: string;
  contractNumber?: string;
};

export function buildInvoiceSubject(input: InvoiceMessageInput) {
  // The market reference goes in the subject because that is what a large
  // contractor's accounts department files and searches by — without it an
  // invoice sits unmatched in an inbox.
  const reference = input.marketNumber ? ` — ${input.marketNumber}` : "";
  return `Facture ${input.invoiceNumber}${reference} — ${COMPANY.name}`;
}

/**
 * The covering letter, and the only part the sender edits. Everything
 * factual — amounts, references, legal identifiers — is generated separately
 * so a hand-edited message can never contradict the invoice attached to it.
 *
 * "Madame, Monsieur" rather than "Bonjour": these go to the accounts
 * department of a construction firm, not to a known contact.
 */
export function buildInvoiceLetter(input: InvoiceMessageInput) {
  const object = input.projectName
    ? `relative au projet « ${input.projectName} »`
    : `relative à la période du ${input.periodStart} au ${input.periodEnd}`;

  return [
    "Madame, Monsieur,",
    "",
    `Nous vous prions de bien vouloir trouver ci-joint la facture ${input.invoiceNumber} ${object}.`,
    "",
    `Son règlement est attendu au plus tard le ${input.dueDate}.`,
    "",
    "Nous restons à votre entière disposition pour tout complément d’information.",
    "",
    "Nous vous prions d’agréer, Madame, Monsieur, l’expression de nos salutations distinguées.",
  ].join("\n");
}

/** The invoice facts, as label/value pairs. Empty references are left out. */
export function buildInvoiceSummary(input: InvoiceMessageInput): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ["Client", input.clientName],
    ["Désignation", input.designation],
    ["Période", `du ${input.periodStart} au ${input.periodEnd}`],
    ["Quantité", `${new Intl.NumberFormat("fr-FR").format(input.quantity)} ${input.unit}`],
    ["Prix unitaire", formatCfa(input.unitPrice)],
  ];

  if (input.hasTva) {
    rows.push(["Montant HT", formatCfa(input.totalHt)]);
    rows.push([`TVA (${input.tvaRate} %)`, formatCfa(input.totalTva)]);
  }
  rows.push(["Montant total", formatCfa(input.totalTtc)]);
  rows.push(["Échéance de règlement", input.dueDate]);

  if (input.marketNumber) rows.push(["Marché", input.marketNumber]);
  if (input.contractNumber) rows.push(["Contrat", input.contractNumber]);

  return rows;
}

const LEGAL_FOOTER = [
  `${COMPANY.name} — ${COMPANY.address}`,
  `Tél : ${COMPANY.phone} — Email : ${COMPANY.email}`,
  `N.I.N.E.A : ${COMPANY.ninea} — RC N° ${COMPANY.rc}`,
];

/** Plain-text part, for clients that do not render HTML. */
export function buildInvoiceText(letter: string, input: InvoiceMessageInput) {
  const width = Math.max(...buildInvoiceSummary(input).map(([label]) => label.length));
  const summary = buildInvoiceSummary(input).map(([label, value]) => `  ${label.padEnd(width)}  ${value}`);

  return [
    letter.trimEnd(),
    "",
    `RÉCAPITULATIF — FACTURE ${input.invoiceNumber}`,
    ...summary,
    "",
    "La facture détaillée est jointe au format PDF.",
    "",
    "—",
    ...LEGAL_FOOTER,
  ].join("\n");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * HTML part. Deliberately tables and inline styles only — mail clients strip
 * <style> blocks and support neither flexbox nor grid, so anything more
 * modern collapses into an unreadable column in Outlook.
 */
export function buildInvoiceHtml(letter: string, input: InvoiceMessageInput) {
  const navy = "#172238";
  const orange = "#e8712b";
  const line = "#e4e3dd";

  const paragraphs = letter
    .trim()
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 14px;line-height:1.6;">${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");

  const rows = buildInvoiceSummary(input)
    .map(([label, value], index, all) => {
      const last = index === all.length - 1;
      const isTotal = label === "Montant total";
      return `<tr>
        <td style="padding:9px 0;border-bottom:${last ? "none" : `1px solid ${line}`};color:#6f7885;font-size:13px;">${escapeHtml(label)}</td>
        <td style="padding:9px 0;border-bottom:${last ? "none" : `1px solid ${line}`};text-align:right;font-size:13px;color:${navy};font-weight:${isTotal ? "700" : "500"};">${escapeHtml(value)}</td>
      </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px 12px;background:#f5f4f0;font-family:Helvetica,Arial,sans-serif;color:${navy};">
<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;width:100%;background:#ffffff;border:1px solid ${line};border-radius:12px;">
  <tr><td style="padding:26px 28px 0;">
    <div style="font-size:19px;font-weight:700;letter-spacing:0.5px;color:${orange};">${escapeHtml(COMPANY.name)}</div>
    <div style="height:3px;width:52px;background:${orange};margin:10px 0 22px;"></div>
  </td></tr>
  <tr><td style="padding:0 28px;font-size:14px;color:${navy};">${paragraphs}</td></tr>
  <tr><td style="padding:10px 28px 0;">
    <div style="font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${orange};margin-bottom:6px;">Récapitulatif — facture ${escapeHtml(input.invoiceNumber)}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${rows}</table>
  </td></tr>
  <tr><td style="padding:18px 28px 26px;font-size:13px;color:#6f7885;">La facture détaillée est jointe au format PDF.</td></tr>
  <tr><td style="padding:16px 28px 22px;border-top:1px solid ${line};font-size:11px;line-height:1.6;color:#9ba1a7;">
    ${LEGAL_FOOTER.map((entry) => escapeHtml(entry)).join("<br>")}
  </td></tr>
</table>
</body></html>`;
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
