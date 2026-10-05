export type InvoiceStatus = "Brouillon" | "Envoyée" | "Payée";

export type ClientRecord = {
  id: string;
  name: string;
  location: string;
  phone?: string;
  email?: string;
  projectName?: string;
  marketNumber?: string;
  contractNumber?: string;
  defaultUnitPrice: number;
  hasTva: boolean;
  createdByEmail?: string;
  updatedByEmail?: string;
};

export type InvoiceRecord = {
  id: string;
  number: string;
  client: string;
  clientId?: string;
  date: string;
  periodStart: string;
  periodEnd: string;
  dueDate?: string;
  designation: string;
  quantity: number;
  unitPrice: number;
  hasTva: boolean;
  totalHt: number;
  totalTva: number;
  totalTtc: number;
  status: InvoiceStatus;
  createdAt: string;
  createdByEmail?: string;
  updatedByEmail?: string;
  hasStoredPdf?: boolean;
};

export const invoiceStatusOrder: InvoiceStatus[] = ["Brouillon", "Envoyée", "Payée"];

// Single source of truth for the VAT rate applied to invoices. Previously
// hardcoded as 0.18 in three separate places (the invoice form, the invoice
// detail page, and the PDF generator's "TVA (18%)" label), which risked
// drifting out of sync if the rate ever changed.
export const TVA_RATE_PERCENT = 18;

const PAYMENT_TERM_DAYS = 30;

export function getInvoiceDueDate(invoice: Pick<InvoiceRecord, "periodEnd" | "dueDate">): string {
  if (invoice.dueDate) return invoice.dueDate;
  const dueDate = new Date(`${invoice.periodEnd}T12:00:00`);
  dueDate.setDate(dueDate.getDate() + PAYMENT_TERM_DAYS);
  return dueDate.toISOString().slice(0, 10);
}

export function getInvoiceDaysUntilDue(invoice: Pick<InvoiceRecord, "periodEnd" | "dueDate">, today = new Date()): number {
  const dueDate = new Date(`${getInvoiceDueDate(invoice)}T12:00:00`);
  const referenceDate = new Date(today);
  referenceDate.setHours(12, 0, 0, 0);
  return Math.ceil((dueDate.getTime() - referenceDate.getTime()) / 86_400_000);
}

export function isInvoiceOverdue(invoice: Pick<InvoiceRecord, "periodEnd" | "dueDate" | "status">, today = new Date()): boolean {
  return invoice.status !== "Payée" && getInvoiceDaysUntilDue(invoice, today) < 0;
}

export const invoiceStatusMeta: Record<
  InvoiceStatus,
  {
    label: string;
    description: string;
    tone: string;
    accent: string;
    next: InvoiceStatus;
  }
> = {
  Brouillon: {
    label: "Brouillon",
    description: "Préparation en cours, pas encore transmise au client.",
    tone: "bg-[#eceef1] text-[#67717c]",
    accent: "border-[#d9d8d1] bg-[#fbfaf7] text-[#172238]",
    next: "Envoyée",
  },
  Envoyée: {
    label: "Envoyée",
    description: "Facture transmise, en attente du paiement du client.",
    tone: "bg-[#fff1df] text-[#a95b16]",
    accent: "border-[#f5d59d] bg-[#fffaf1] text-[#a95b16]",
    next: "Payée",
  },
  Payée: {
    label: "Payée",
    description: "Paiement reçu et facture clôturée.",
    tone: "bg-[#e5f4ed] text-[#21744d]",
    accent: "border-[#bfe7d2] bg-[#f1fbf5] text-[#21744d]",
    next: "Payée",
  },
};

export const invoiceStatusStyles: Record<InvoiceStatus, string> = Object.fromEntries(
  Object.entries(invoiceStatusMeta).map(([status, meta]) => [status, meta.tone]),
) as Record<InvoiceStatus, string>;

export function getNextInvoiceStatus(status: InvoiceStatus): InvoiceStatus {
  return invoiceStatusMeta[status].next;
}

/**
 * A draft is still ours to change. Anything beyond it has been issued: the
 * client holds a document bearing this number and these amounts, so editing
 * it in place would leave two different invoices under one number, with no
 * record of what was actually sent — the exact thing you need if a client
 * ever disputes a line.
 *
 * Correcting an issued invoice is therefore a deliberate act: put it back to
 * "Brouillon" first, which archives the document the client received.
 */
export function isInvoiceIssued(status: InvoiceStatus): boolean {
  return status !== "Brouillon";
}

export const INVOICE_ISSUED_MESSAGE =
  "Cette facture a déjà été émise. Repassez-la en brouillon pour la corriger — le document envoyé au client sera archivé.";
