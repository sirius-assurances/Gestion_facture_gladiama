"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { formatFrenchDate } from "@/lib/format";
import { createTransport, formatSender, readMailerConfig } from "@/lib/email/mailer";
import {
  buildAttachmentName,
  buildInvoiceHtml,
  buildInvoiceLetter,
  buildInvoiceSubject,
  buildInvoiceSummary,
  buildInvoiceText,
  type InvoiceMessageInput,
} from "@/lib/email/invoice-message";
import { computeInvoiceTotals, TVA_RATE_PERCENT } from "@/lib/invoice-totals";
import { defaultClients, defaultInvoices } from "@/lib/seed-data";
import { generateInvoicePdfBuffer } from "@/lib/pdf/server";
import { INVOICE_ISSUED_MESSAGE, isInvoiceIssued, type ClientRecord, type InvoiceRecord, type InvoiceStatus } from "@/lib/invoice";

const statusToDb: Record<InvoiceStatus, "DRAFT" | "SENT" | "PAID"> = {
  Brouillon: "DRAFT",
  Envoyée: "SENT",
  Payée: "PAID",
};
const statusFromDb = { DRAFT: "Brouillon", SENT: "Envoyée", PAID: "Payée" } as const;
let seedPromise: Promise<void> | null = null;

const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");
const money = z.number().finite().min(0).max(1_000_000_000_000);

const clientInputSchema = z.object({
  name: z.string().trim().min(1, "Nom requis.").max(200),
  location: z.string().trim().min(1, "Localisation requise.").max(200),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email("Email invalide.").max(200).optional().or(z.literal("")),
  projectName: z.string().trim().max(300).optional(),
  marketNumber: z.string().trim().max(120).optional(),
  contractNumber: z.string().trim().max(120).optional(),
  defaultUnitPrice: money,
  hasTva: z.boolean(),
});

const clientRecordSchema = clientInputSchema.extend({ id: z.string().min(1) });

const invoiceStatusSchema = z.enum(["Brouillon", "Envoyée", "Payée"]);

const invoiceInputSchema = z.object({
  client: z.string().trim().min(1, "Client requis."),
  clientId: z.string().min(1).optional(),
  periodStart: dateInput,
  periodEnd: dateInput,
  dueDate: dateInput.optional(),
  designation: z.string().trim().min(1, "Désignation requise.").max(300),
  quantity: z.number().finite().gt(0).max(1_000_000_000),
  unitPrice: money,
  hasTva: z.boolean(),
  // The client still sends its own computed totals for the optimistic UI,
  // but the server never trusts them — totals are always recomputed from
  // quantity/unitPrice/hasTva (see computeTotals) before being stored.
  totalHt: money,
  totalTva: money,
  totalTtc: money,
  status: invoiceStatusSchema.optional(),
});

const invoiceRecordSchema = invoiceInputSchema.extend({
  id: z.string().min(1),
  number: z.string().min(1),
  date: z.string().min(1),
  createdAt: z.string().min(1),
  status: invoiceStatusSchema,
});

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const paginationSchema = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
});

const clientsPageSchema = paginationSchema.extend({
  search: z.string().trim().max(200).optional(),
});

const invoicesPageSchema = paginationSchema.extend({
  status: invoiceStatusSchema.optional(),
});

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Authentification requise.");
  return user;
}

function dateFromInput(value: string) {
  return new Date(`${value}T12:00:00.000Z`);
}

function dateToInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function amount(value: number, decimals = 2) {
  return value.toFixed(decimals);
}

function mapClient(client: Awaited<ReturnType<typeof prisma.client.findMany>>[number]): ClientRecord {
  return {
    id: client.id,
    name: client.name,
    location: client.location,
    phone: client.phone ?? undefined,
    email: client.email ?? undefined,
    projectName: client.projectName ?? undefined,
    marketNumber: client.marketNumber ?? undefined,
    contractNumber: client.contractNumber ?? undefined,
    defaultUnitPrice: Number(client.defaultUnitPrice),
    hasTva: client.hasTva,
    createdByEmail: client.createdByEmail ?? undefined,
    updatedByEmail: client.updatedByEmail ?? undefined,
  };
}

function mapInvoice(invoice: Awaited<ReturnType<typeof prisma.invoice.findMany<{ include: { client: true; items: true } }>>>[number]): InvoiceRecord {
  const item = invoice.items[0];
  return {
    id: invoice.id,
    number: invoice.invoiceNumber,
    client: invoice.client.name,
    clientId: invoice.clientId,
    date: formatFrenchDate(invoice.invoiceDate),
    periodStart: dateToInput(invoice.periodStart),
    periodEnd: dateToInput(invoice.periodEnd),
    dueDate: dateToInput(invoice.dueDate),
    designation: item?.designation ?? "Fourniture latérite crue",
    quantity: item ? Number(item.quantity) : 0,
    unitPrice: item ? Number(item.unitPrice) : 0,
    hasTva: invoice.hasTva,
    totalHt: Number(invoice.totalHt),
    totalTva: Number(invoice.totalTva),
    totalTtc: Number(invoice.totalTtc),
    status: statusFromDb[invoice.status],
    createdAt: invoice.createdAt.toISOString(),
    createdByEmail: invoice.createdByEmail ?? undefined,
    updatedByEmail: invoice.updatedByEmail ?? undefined,
    hasStoredPdf: Boolean(invoice.pdfPath),
  };
}

async function seedDatabase() {
  const clients = await prisma.client.createMany({
    data: defaultClients.map((client) => ({
      id: client.id,
      name: client.name,
      location: client.location,
      phone: client.phone,
      email: client.email,
      projectName: client.projectName,
      defaultUnitPrice: amount(client.defaultUnitPrice),
      hasTva: client.hasTva,
    })),
    skipDuplicates: true,
  });

  if (clients.count === 0 && (await prisma.invoice.count()) > 0) return;

  for (const invoice of defaultInvoices) {
    const client = await prisma.client.findFirst({ where: { name: invoice.client } });
    if (!client || (await prisma.invoice.findUnique({ where: { invoiceNumber: invoice.number } }))) continue;
    await prisma.invoice.create({
      data: {
        id: invoice.id,
        clientId: client.id,
        invoiceNumber: invoice.number,
        invoiceDate: dateFromInput(invoice.periodEnd),
        periodStart: dateFromInput(invoice.periodStart),
        periodEnd: dateFromInput(invoice.periodEnd),
        dueDate: dateFromInput(invoice.dueDate ?? invoice.periodEnd),
        hasTva: invoice.hasTva,
        totalHt: amount(invoice.totalHt),
        totalTva: amount(invoice.totalTva),
        totalTtc: amount(invoice.totalTtc),
        status: statusToDb[invoice.status],
        items: {
          create: {
            designation: invoice.designation,
            quantity: amount(invoice.quantity, 3),
            unit: "m³",
            unitPrice: amount(invoice.unitPrice),
            total: amount(invoice.totalHt),
          },
        },
      },
    });
  }
}

// Seeding inserts the demo clients and invoices N°22–24. It used to run
// automatically whenever a table came back empty, which on a real ledger
// would silently resurrect fake invoices. It now only runs when explicitly
// enabled for a fresh or disposable database.
const demoSeedEnabled = process.env.ENABLE_DEMO_SEED === "1";

async function ensureSeeded() {
  if (!demoSeedEnabled) return;
  if (seedPromise) return seedPromise;
  seedPromise = seedDatabase().finally(() => {
    seedPromise = null;
  });
  return seedPromise;
}

export async function getClients() {
  await requireUser();
  if ((await prisma.client.count()) === 0) await ensureSeeded();
  return (await prisma.client.findMany({ orderBy: { name: "asc" } })).map(mapClient);
}

export type DashboardMetrics = {
  totalRevenue: number;
  paidRevenue: number;
  sentRevenue: number;
  draftRevenue: number;
  pendingRevenue: number;
  paidCount: number;
  pendingCount: number;
  totalCount: number;
  paymentRate: number;
  monthInvoiceCount: number;
  monthRevenue: number;
  /** Month-over-month revenue change, or null when last month had none. */
  revenueTrendPercent: number | null;
  clientsCount: number;
  overdueCount: number;
  overdueRevenue: number;
  overdueInvoices: InvoiceRecord[];
  dueSoonCount: number;
  recentInvoices: InvoiceRecord[];
};

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  await requireUser();
  if ((await prisma.invoice.count()) === 0) await ensureSeeded();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const dueSoonEnd = new Date(todayStart);
  dueSoonEnd.setDate(dueSoonEnd.getDate() + 8);

  const [totalAgg, paidAgg, sentAgg, draftAgg, monthAgg, previousMonthAgg, overdueAgg, dueSoonCount, clientsCount, overdueInvoices, recentInvoices] =
    await Promise.all([
      prisma.invoice.aggregate({ _sum: { totalTtc: true }, _count: true }),
      prisma.invoice.aggregate({ _sum: { totalTtc: true }, _count: true, where: { status: "PAID" } }),
      prisma.invoice.aggregate({ _sum: { totalTtc: true }, where: { status: "SENT" } }),
      prisma.invoice.aggregate({ _sum: { totalTtc: true }, where: { status: "DRAFT" } }),
      prisma.invoice.aggregate({ _sum: { totalTtc: true }, _count: true, where: { createdAt: { gte: startOfMonth, lt: startOfNextMonth } } }),
      prisma.invoice.aggregate({ _sum: { totalTtc: true }, where: { createdAt: { gte: startOfPreviousMonth, lt: startOfMonth } } }),
      prisma.invoice.aggregate({ _sum: { totalTtc: true }, _count: true, where: { status: { not: "PAID" }, dueDate: { lt: todayStart } } }),
      prisma.invoice.count({ where: { status: { not: "PAID" }, dueDate: { gte: todayStart, lt: dueSoonEnd } } }),
      prisma.client.count(),
      prisma.invoice.findMany({
        where: { status: { not: "PAID" }, dueDate: { lt: todayStart } },
        include: { client: true, items: true },
        orderBy: { createdAt: "desc" },
        take: 2,
      }),
      prisma.invoice.findMany({ include: { client: true, items: true }, orderBy: { createdAt: "desc" }, take: 3 }),
    ]);

  const totalCount = totalAgg._count;
  const paidCount = paidAgg._count;
  const sentRevenue = Number(sentAgg._sum.totalTtc ?? 0);
  const draftRevenue = Number(draftAgg._sum.totalTtc ?? 0);
  const monthRevenue = Number(monthAgg._sum.totalTtc ?? 0);
  const previousMonthRevenue = Number(previousMonthAgg._sum.totalTtc ?? 0);

  return {
    totalRevenue: Number(totalAgg._sum.totalTtc ?? 0),
    paidRevenue: Number(paidAgg._sum.totalTtc ?? 0),
    sentRevenue,
    draftRevenue,
    pendingRevenue: sentRevenue + draftRevenue,
    paidCount,
    pendingCount: totalCount - paidCount,
    totalCount,
    paymentRate: totalCount ? Math.round((paidCount / totalCount) * 100) : 0,
    monthInvoiceCount: monthAgg._count,
    monthRevenue,
    revenueTrendPercent: previousMonthRevenue > 0 ? Math.round(((monthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100) : null,
    clientsCount,
    overdueCount: overdueAgg._count,
    overdueRevenue: Number(overdueAgg._sum.totalTtc ?? 0),
    overdueInvoices: overdueInvoices.map(mapInvoice),
    dueSoonCount,
    recentInvoices: recentInvoices.map(mapInvoice),
  };
}

export async function getInvoices() {
  await requireUser();
  if ((await prisma.invoice.count()) === 0) await ensureSeeded();
  const invoices = await prisma.invoice.findMany({ include: { client: true, items: true }, orderBy: { createdAt: "desc" } });
  return invoices.map(mapInvoice);
}

export async function getInvoiceCount() {
  await requireUser();
  if ((await prisma.invoice.count()) === 0) await ensureSeeded();
  return prisma.invoice.count();
}

// The number an invoice will get is owned by a Postgres sequence, not by
// how many rows exist — deletions and the seeded invoices (which start at
// N°22) make those two diverge. The creation screen previously previewed
// `N°{count + 1}`, so a PDF downloaded or shared before saving carried a
// number that matched nothing in the ledger. Peek at the sequence instead
// (reading last_value does not consume a value).
export async function getNextInvoiceNumber() {
  await requireUser();
  const [sequence] = await prisma.$queryRaw<{ last_value: bigint; is_called: boolean }[]>`
    SELECT last_value, is_called FROM facturation.invoice_number_seq
  `;
  const next = sequence.is_called ? Number(sequence.last_value) + 1 : Number(sequence.last_value);
  return `N°${next}`;
}

export async function getInvoice(invoiceId: string) {
  await requireUser();
  const id = z.string().min(1).parse(invoiceId);
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: { client: true, items: true } });
  return invoice ? mapInvoice(invoice) : null;
}

export async function getClient(clientId: string) {
  await requireUser();
  const id = z.string().min(1).parse(clientId);
  const client = await prisma.client.findUnique({ where: { id } });
  return client ? mapClient(client) : null;
}

const PDF_BUCKET = "invoices";

// Named after the invoice rather than its uuid: this filename is what the
// browser offers when saving the PDF opened from the signed URL, and
// "3e651cf1-455a-….pdf" is not something anyone can file.
function pdfPathFor(invoiceNumber: string) {
  return `facture-${invoiceNumber.replace(/[^a-z0-9]/gi, "-")}.pdf`;
}

/**
 * Copies an issued invoice's PDF aside before it can be regenerated, under a
 * timestamped name so repeated corrections each keep their own trace.
 *
 * Best-effort on purpose: failing to archive must not block the user from
 * correcting an invoice, and the copy is a safety net rather than something
 * the app reads back.
 */
async function archiveInvoicePdf(pdfPath: string, invoiceNumber: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage
    .from(PDF_BUCKET)
    .copy(pdfPath, `archives/${pdfPathFor(invoiceNumber).replace(/\.pdf$/, "")}-${stamp}.pdf`);
  if (error) console.error(`Archivage du PDF ${pdfPath} impossible : ${error.message}`);
}

/**
 * Uploads the bytes to the private bucket and records the path on the
 * invoice. Shared by the browser-generated and server-generated routes so
 * the two can't file the same invoice under different names.
 *
 * Refuses to replace the document of an invoice that has already been
 * issued: that file is what the client holds, and overwriting it would
 * destroy the only evidence of what was actually sent.
 */
async function storeInvoicePdf(
  invoice: { id: string; invoiceNumber: string; status: "DRAFT" | "SENT" | "PAID"; pdfPath: string | null },
  bytes: Buffer,
) {
  if (invoice.pdfPath && isInvoiceIssued(statusFromDb[invoice.status])) return invoice.pdfPath;

  const supabase = await createSupabaseServerClient();
  const path = pdfPathFor(invoice.invoiceNumber);
  const { error } = await supabase.storage
    .from(PDF_BUCKET)
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`Échec de l'enregistrement du PDF : ${error.message}`);

  await prisma.invoice.update({ where: { id: invoice.id }, data: { pdfPath: path } });
  return path;
}

// Stores the already-generated PDF (built client-side with jsPDF, base64
// encoded) in Supabase Storage so it can be re-downloaded later without
// regenerating it. The bucket is private; access is via short-lived signed
// URLs only (see getInvoicePdfUrl).
export async function saveInvoicePdf(invoiceId: string, pdfBase64: string) {
  await requireUser();
  const id = z.string().min(1).parse(invoiceId);
  const base64 = z.string().min(1).max(15_000_000).parse(pdfBase64);
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw new Error("Facture introuvable.");

  await storeInvoicePdf(invoice, Buffer.from(base64, "base64"));
}

/**
 * Builds the invoice PDF on the server, from the database alone, and stores
 * it. Nothing here needs a browser — which is the point: an invoice can be
 * sent, or chased up by a scheduled reminder, without anyone having opened
 * it first.
 */
export async function generateAndStoreInvoicePdf(invoiceId: string) {
  await requireUser();
  const id = z.string().min(1).parse(invoiceId);
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: { client: true, items: true } });
  if (!invoice) throw new Error("Facture introuvable.");

  return storeInvoicePdf(invoice, await renderInvoicePdf(invoice));
}

type InvoiceWithRelations = Awaited<
  ReturnType<typeof prisma.invoice.findMany<{ include: { client: true; items: true } }>>
>[number];

/** Shared by the stored-PDF route and the email attachment. */
async function renderInvoicePdf(invoice: InvoiceWithRelations) {
  const item = invoice.items[0];
  return generateInvoicePdfBuffer({
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.client.name,
    clientLocation: invoice.client.location,
    projectName: invoice.client.projectName ?? undefined,
    marketNumber: invoice.client.marketNumber ?? undefined,
    contractNumber: invoice.client.contractNumber ?? undefined,
    periodStart: formatFrenchDate(invoice.periodStart),
    periodEnd: formatFrenchDate(invoice.periodEnd),
    designation: item?.designation ?? "Fourniture latérite crue",
    quantity: item ? Number(item.quantity) : 0,
    unitPrice: item ? Number(item.unitPrice) : 0,
    hasTva: invoice.hasTva,
    // The stored totals, not a fresh computation: they are what the server
    // already validated on save, and the PDF must match the ledger.
    totalHt: Number(invoice.totalHt),
    totalTva: Number(invoice.totalTva),
    totalTtc: Number(invoice.totalTtc),
  });
}

export async function getInvoicePdfUrl(invoiceId: string) {
  await requireUser();
  const id = z.string().min(1).parse(invoiceId);
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice?.pdfPath) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from(PDF_BUCKET).createSignedUrl(invoice.pdfPath, 60);
  return error ? null : data.signedUrl;
}

const emailDraftSchema = z.object({
  invoiceId: z.string().min(1),
  to: z.string().trim().email("Adresse du destinataire invalide.").max(200),
  cc: z.array(z.string().trim().email().max(200)).max(20).optional(),
  replyTo: z.string().trim().email().max(200).optional(),
  subject: z.string().trim().min(1, "Objet requis.").max(300),
  body: z.string().trim().min(1, "Message requis.").max(20_000),
  // Unticked while testing, so a trial run to one's own address does not
  // mark a real invoice as sent to the client.
  markAsSent: z.boolean(),
});

export type InvoiceEmailDraft = {
  from: string;
  to: string;
  subject: string;
  body: string;
  /** Appended automatically; shown read-only so the sender knows it is coming. */
  summary: Array<[string, string]>;
  attachmentName: string;
  configured: boolean;
  missing: string[];
};

/**
 * Every figure the message quotes comes from here, never from the browser:
 * an email that contradicts the invoice attached to it is worse than no
 * email at all.
 */
function invoiceMessageInput(invoice: InvoiceWithRelations): InvoiceMessageInput {
  const item = invoice.items[0];
  return {
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.client.name,
    designation: item?.designation ?? "Fourniture latérite crue",
    quantity: item ? Number(item.quantity) : 0,
    unit: item?.unit ?? "m³",
    unitPrice: item ? Number(item.unitPrice) : 0,
    hasTva: invoice.hasTva,
    tvaRate: Number(invoice.tvaRate),
    totalHt: Number(invoice.totalHt),
    totalTva: Number(invoice.totalTva),
    totalTtc: Number(invoice.totalTtc),
    periodStart: formatFrenchDate(invoice.periodStart),
    periodEnd: formatFrenchDate(invoice.periodEnd),
    dueDate: formatFrenchDate(invoice.dueDate),
    projectName: invoice.client.projectName ?? undefined,
    marketNumber: invoice.client.marketNumber ?? undefined,
    contractNumber: invoice.client.contractNumber ?? undefined,
  };
}

/**
 * Everything the compose dialog opens with. The sender comes from the
 * server because only it knows the configured mailbox, and the dialog has
 * to show what will actually appear in the client's inbox.
 */
export async function getInvoiceEmailDraft(invoiceId: string): Promise<InvoiceEmailDraft> {
  await requireUser();
  const id = z.string().min(1).parse(invoiceId);
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: { client: true, items: true } });
  if (!invoice) throw new Error("Facture introuvable.");

  const mailer = readMailerConfig();
  const message = invoiceMessageInput(invoice);

  return {
    from: mailer.ok ? formatSender(mailer.config) : "",
    to: invoice.client.email ?? "",
    subject: buildInvoiceSubject(message),
    body: buildInvoiceLetter(message),
    summary: buildInvoiceSummary(message),
    attachmentName: buildAttachmentName(invoice.invoiceNumber, invoice.client.name),
    configured: mailer.ok,
    missing: mailer.ok ? [] : mailer.missing,
  };
}

/**
 * Sends the invoice with its PDF attached. Unlike the mailto: link this
 * replaces, the attachment is real — mailto cannot carry a file at all, so
 * the message used to ask the client's supplier to attach it by hand.
 *
 * The invoice is only marked as sent once the mail server has accepted the
 * message, and the PDF is archived first: storeInvoicePdf refuses to write
 * for an issued invoice, so the order here is what guarantees the archived
 * document is exactly the one that went out.
 */
export async function sendInvoiceEmail(input: z.infer<typeof emailDraftSchema>) {
  const user = await requireUser();
  const data = emailDraftSchema.parse(input);

  const mailer = readMailerConfig();
  if (!mailer.ok) {
    throw new Error(`Envoi non configuré. Variables manquantes : ${mailer.missing.join(", ")}.`);
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: data.invoiceId },
    include: { client: true, items: true },
  });
  if (!invoice) throw new Error("Facture introuvable.");

  const pdf = await renderInvoicePdf(invoice);
  await storeInvoicePdf(invoice, pdf);

  const message = invoiceMessageInput(invoice);
  const transport = createTransport(mailer.config);
  try {
    await transport.sendMail({
      from: formatSender(mailer.config),
      to: data.to,
      cc: data.cc?.length ? data.cc : undefined,
      replyTo: data.replyTo || mailer.config.replyTo,
      // SMTP only sends; it files nothing in the sender's mailbox. Without
      // this the sender keeps no record of what left.
      bcc: mailer.config.fromEmail,
      subject: data.subject,
      // Both parts: the HTML is what most clients show, the text is the
      // fallback for those that refuse it — and for spam filters, which
      // treat an HTML-only message as a smell.
      text: buildInvoiceText(data.body, message),
      html: buildInvoiceHtml(data.body, message),
      attachments: [
        {
          filename: buildAttachmentName(invoice.invoiceNumber, invoice.client.name),
          content: pdf,
          contentType: "application/pdf",
        },
      ],
    });
  } catch (error) {
    // Surfaced verbatim: "535 authentication failed" tells the user to fix
    // the app password, where "envoi impossible" would not.
    throw new Error(`Envoi refusé par le serveur de messagerie : ${error instanceof Error ? error.message : "erreur inconnue"}`);
  }

  if (data.markAsSent && !isInvoiceIssued(statusFromDb[invoice.status])) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: "SENT", updatedByEmail: user.email },
    });
  }

  return { sentTo: data.to, cc: data.cc ?? [] };
}

export async function getClientsPage(params: { page?: number; pageSize?: number; search?: string } = {}) {
  await requireUser();
  const { page = 1, pageSize = DEFAULT_PAGE_SIZE, search } = clientsPageSchema.parse(params);
  if ((await prisma.client.count()) === 0) await ensureSeeded();

  const where = search ? { name: { contains: search, mode: "insensitive" as const } } : undefined;
  const [total, clients] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({ where, orderBy: { name: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);

  return { clients: clients.map(mapClient), total, page, pageSize };
}

export async function getInvoicesPage(params: { page?: number; pageSize?: number; status?: InvoiceStatus } = {}) {
  await requireUser();
  const { page = 1, pageSize = DEFAULT_PAGE_SIZE, status } = invoicesPageSchema.parse(params);
  if ((await prisma.invoice.count()) === 0) await ensureSeeded();

  const where = status ? { status: statusToDb[status] } : undefined;
  const [total, invoices, statusGroups] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      include: { client: true, items: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.invoice.groupBy({ by: ["status"], _count: true }),
  ]);

  const statusCounts: Record<InvoiceStatus, number> = { Brouillon: 0, Envoyée: 0, Payée: 0 };
  for (const group of statusGroups) statusCounts[statusFromDb[group.status]] = group._count;

  return { invoices: invoices.map(mapInvoice), total, page, pageSize, statusCounts };
}

export async function createClient(input: Omit<ClientRecord, "id">) {
  const user = await requireUser();
  const data = clientInputSchema.parse(input);
  const client = await prisma.client.create({
    data: {
      ...data,
      defaultUnitPrice: amount(data.defaultUnitPrice),
      phone: data.phone || null,
      email: data.email || null,
      projectName: data.projectName || null,
      marketNumber: data.marketNumber || null,
      contractNumber: data.contractNumber || null,
      createdByEmail: user.email,
      updatedByEmail: user.email,
    },
  });
  return mapClient(client);
}

export async function updateClient(client: ClientRecord) {
  const user = await requireUser();
  const data = clientRecordSchema.parse(client);
  const updated = await prisma.client.update({
    where: { id: data.id },
    data: {
      name: data.name,
      location: data.location,
      phone: data.phone || null,
      email: data.email || null,
      projectName: data.projectName || null,
      marketNumber: data.marketNumber || null,
      contractNumber: data.contractNumber || null,
      defaultUnitPrice: amount(data.defaultUnitPrice),
      hasTva: data.hasTva,
      updatedByEmail: user.email,
    },
  });
  return mapClient(updated);
}

export async function removeClient(clientId: string) {
  await requireUser();
  const id = z.string().min(1).parse(clientId);
  await prisma.client.delete({ where: { id } });
}

export async function createInvoice(input: Omit<InvoiceRecord, "id" | "number" | "date" | "createdAt">) {
  const user = await requireUser();
  const data = invoiceInputSchema.parse(input);
  const client = data.clientId
    ? await prisma.client.findUnique({ where: { id: data.clientId } })
    : await prisma.client.findFirst({ where: { name: data.client } });
  if (!client) throw new Error("Client introuvable.");

  const totals = computeInvoiceTotals(data.quantity, data.unitPrice, data.hasTva);

  await prisma.$transaction(async (transaction) => {
    const [{ nextval }] = await transaction.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('facturation.invoice_number_seq') AS nextval`;
    await transaction.invoice.create({
      data: {
        clientId: client.id,
        invoiceNumber: `N°${nextval}`,
        periodStart: dateFromInput(data.periodStart),
        periodEnd: dateFromInput(data.periodEnd),
        dueDate: dateFromInput(data.dueDate ?? data.periodEnd),
        hasTva: data.hasTva,
        tvaRate: amount(TVA_RATE_PERCENT),
        totalHt: amount(totals.totalHt),
        totalTva: amount(totals.totalTva),
        totalTtc: amount(totals.totalTtc),
        status: statusToDb[data.status ?? "Brouillon"],
        createdByEmail: user.email,
        updatedByEmail: user.email,
        items: { create: { designation: data.designation, quantity: amount(data.quantity, 3), unit: "m³", unitPrice: amount(data.unitPrice), total: amount(totals.totalHt) } },
      },
    });
  });
}

export async function updateInvoice(invoice: InvoiceRecord) {
  const user = await requireUser();
  const data = invoiceRecordSchema.parse(invoice);
  const client = data.clientId ? await prisma.client.findUnique({ where: { id: data.clientId } }) : await prisma.client.findFirst({ where: { name: data.client } });
  if (!client) throw new Error("Client introuvable.");
  const existing = await prisma.invoice.findUnique({ where: { id: data.id }, include: { items: true } });
  if (!existing) throw new Error("Facture introuvable.");
  // Checked against the stored status, not the one in the payload: otherwise
  // the caller could lift its own restriction simply by sending "Brouillon".
  if (isInvoiceIssued(statusFromDb[existing.status])) throw new Error(INVOICE_ISSUED_MESSAGE);
  const totals = computeInvoiceTotals(data.quantity, data.unitPrice, data.hasTva);
  await prisma.invoice.update({
    where: { id: data.id },
    data: {
      clientId: client.id,
      periodStart: dateFromInput(data.periodStart),
      periodEnd: dateFromInput(data.periodEnd),
      dueDate: dateFromInput(data.dueDate ?? data.periodEnd),
      hasTva: data.hasTva,
      tvaRate: amount(TVA_RATE_PERCENT),
      totalHt: amount(totals.totalHt),
      totalTva: amount(totals.totalTva),
      totalTtc: amount(totals.totalTtc),
      status: statusToDb[data.status],
      updatedByEmail: user.email,
      // The stored PDF was rendered from the previous values, so drop the
      // pointer rather than keep offering a stale document for download.
      pdfPath: null,
      items: existing.items[0]
        ? { update: { where: { id: existing.items[0].id }, data: { designation: data.designation, quantity: amount(data.quantity, 3), unitPrice: amount(data.unitPrice), total: amount(totals.totalHt) } } }
        : { create: { designation: data.designation, quantity: amount(data.quantity, 3), unit: "m³", unitPrice: amount(data.unitPrice), total: amount(totals.totalHt) } },
    },
  });
}

export async function updateInvoiceStatus(invoiceNumber: string, status: InvoiceStatus) {
  const user = await requireUser();
  const number = z.string().min(1).parse(invoiceNumber);
  const nextStatus = invoiceStatusSchema.parse(status);
  const existing = await prisma.invoice.findUnique({ where: { invoiceNumber: number } });
  if (!existing) throw new Error("Facture introuvable.");

  // Putting an issued invoice back to draft is the one sanctioned way to
  // correct it, and it reopens the document to being regenerated at the same
  // path. Copy the issued version aside first: it is what the client holds,
  // and after this it is the only record of it.
  if (nextStatus === "Brouillon" && isInvoiceIssued(statusFromDb[existing.status]) && existing.pdfPath) {
    await archiveInvoicePdf(existing.pdfPath, existing.invoiceNumber);
  }

  await prisma.invoice.update({ where: { invoiceNumber: number }, data: { status: statusToDb[nextStatus], updatedByEmail: user.email } });
}

export async function removeInvoice(invoiceNumber: string) {
  await requireUser();
  const number = z.string().min(1).parse(invoiceNumber);
  await prisma.invoice.delete({ where: { invoiceNumber: number } });
}