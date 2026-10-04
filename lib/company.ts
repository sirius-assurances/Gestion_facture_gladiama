/**
 * Single source of truth for the details printed on invoices and sent in
 * share messages. These were previously spread across lib/share.ts and the
 * PDF generator, including a personal email address written inline in the
 * email template.
 *
 * Anything here can be overridden per deployment without touching code.
 */
export const COMPANY = {
  name: "GLADIAMA SUARL",
  role: "Le Directeur Général",
  address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS ?? "Cité Soleil Dalifort Villa N°38",
  phone: process.env.NEXT_PUBLIC_COMPANY_PHONE ?? "+221 77 704 37 90",
  email: process.env.NEXT_PUBLIC_COMPANY_EMAIL ?? "contact@gladiama.sn",
  ninea: "009384629",
  rc: "SN.DKR.2022.B.14972",
} as const;

export const COMPANY_SIGNATURE = `${COMPANY.role}\n${COMPANY.name}`;
