/**
 * Single source of truth for the details printed on invoices and sent in
 * share messages. These were previously spread across lib/share.ts and the
 * PDF generator.
 *
 * The values must match what the invoice footer image (public/images/
 * Picture2.png) prints, because that image is what the client actually
 * reads — the text here is only drawn when the image is missing, and it also
 * signs the share emails. They drifted apart once already: the code claimed
 * a contact@gladiama.sn address that has never existed (the domain does not
 * resolve), while every invoice carried the real one below.
 *
 * Anything here can be overridden per deployment without touching code.
 */
export const COMPANY = {
  name: "GLADIAMA SUARL",
  role: "Le Directeur Général",
  address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS ?? "Cité Soleil Dalifort Villa N°38",
  phone: process.env.NEXT_PUBLIC_COMPANY_PHONE ?? "+221 77 704 37 90",
  email: process.env.NEXT_PUBLIC_COMPANY_EMAIL ?? "abdoulayedrame1@hotmail.com",
  ninea: "009384629",
  rc: "SN.DKR.2022.B.14972",
} as const;

export const COMPANY_SIGNATURE = `${COMPANY.role}\n${COMPANY.name}`;
