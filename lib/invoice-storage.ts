export type InvoiceStatus = "Brouillon" | "Envoyée" | "Payée";

export type ClientRecord = {
  id: string;
  name: string;
  location: string;
  phone?: string;
  email?: string;
  projectName?: string;
  defaultUnitPrice: number;
  hasTva: boolean;
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
};

export const invoiceStatusOrder: InvoiceStatus[] = ["Brouillon", "Envoyée", "Payée"];

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

export const defaultClients: ClientRecord[] = [
  {
    id: "pfo",
    name: "PFO AFRICA",
    location: "Dakar, Sénégal",
    phone: "+221777043790",
    email: "contact@pfoafrica.sn",
    projectName: "Projet Autoroute Dakar Tivaouane",
    defaultUnitPrice: 600,
    hasTva: false,
  },
  {
    id: "granusen",
    name: "GRANUSEN",
    location: "Dakar, Sénégal",
    phone: "+221770000000",
    email: "facturation@granusen.sn",
    projectName: "Projet en cours",
    defaultUnitPrice: 675,
    hasTva: true,
  },
  {
    id: "sogea",
    name: "SOGEA SATOM",
    location: "Diamniadio, Sénégal",
    phone: "+221776000000",
    email: "finance@sogeasatom.sn",
    projectName: "Travaux de terrassement",
    defaultUnitPrice: 600,
    hasTva: false,
  },
];

export const defaultInvoices: InvoiceRecord[] = [
  {
    id: "inv-24",
    number: "N°24",
    client: "PFO AFRICA",
    date: "17 Septembre 2026",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-17",
    dueDate: "2026-10-17",
    designation: "Fourniture latérite crue",
    quantity: 4050,
    unitPrice: 600,
    hasTva: false,
    totalHt: 2430000,
    totalTva: 0,
    totalTtc: 2430000,
    status: "Payée",
    createdAt: "2026-09-17T00:00:00.000Z",
  },
  {
    id: "inv-23",
    number: "N°23",
    client: "GRANUSEN",
    date: "12 Septembre 2026",
    periodStart: "2026-08-20",
    periodEnd: "2026-09-12",
    dueDate: "2026-10-12",
    designation: "Terrassement et remblai",
    quantity: 2360,
    unitPrice: 675,
    hasTva: true,
    totalHt: 1593000,
    totalTva: 286740,
    totalTtc: 1879740,
    status: "Envoyée",
    createdAt: "2026-09-12T00:00:00.000Z",
  },
  {
    id: "inv-22",
    number: "N°22",
    client: "SOGEA SATOM",
    date: "04 Septembre 2026",
    periodStart: "2026-08-01",
    periodEnd: "2026-09-04",
    dueDate: "2026-10-04",
    designation: "Transport et gravats",
    quantity: 1483,
    unitPrice: 600,
    hasTva: false,
    totalHt: 889800,
    totalTva: 0,
    totalTtc: 889800,
    status: "Brouillon",
    createdAt: "2026-09-04T00:00:00.000Z",
  },
];

