"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { formatFrenchDate } from "@/lib/format";
import {
  defaultClients,
  defaultInvoices,
  type ClientRecord,
  type InvoiceRecord,
  type InvoiceStatus,
} from "@/lib/invoice-storage";

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

async function ensureSeeded() {
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
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const dueSoonEnd = new Date(todayStart);
  dueSoonEnd.setDate(dueSoonEnd.getDate() + 8);

  const [totalAgg, paidAgg, sentAgg, draftAgg, monthAgg, overdueAgg, dueSoonCount, clientsCount, overdueInvoices, recentInvoices] =
    await Promise.all([
      prisma.invoice.aggregate({ _sum: { totalTtc: true }, _count: true }),
      prisma.invoice.aggregate({ _sum: { totalTtc: true }, _count: true, where: { status: "PAID" } }),
      prisma.invoice.aggregate({ _sum: { totalTtc: true }, where: { status: "SENT" } }),
      prisma.invoice.aggregate({ _sum: { totalTtc: true }, where: { status: "DRAFT" } }),
      prisma.invoice.aggregate({ _sum: { totalTtc: true }, _count: true, where: { createdAt: { gte: startOfMonth, lt: startOfNextMonth } } }),
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
    monthRevenue: Number(monthAgg._sum.totalTtc ?? 0),
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
        totalHt: amount(data.totalHt),
        totalTva: amount(data.totalTva),
        totalTtc: amount(data.totalTtc),
        status: statusToDb[data.status ?? "Brouillon"],
        createdByEmail: user.email,
        updatedByEmail: user.email,
        items: { create: { designation: data.designation, quantity: amount(data.quantity, 3), unit: "m³", unitPrice: amount(data.unitPrice), total: amount(data.totalHt) } },
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
  await prisma.invoice.update({
    where: { id: data.id },
    data: {
      clientId: client.id,
      periodStart: dateFromInput(data.periodStart),
      periodEnd: dateFromInput(data.periodEnd),
      dueDate: dateFromInput(data.dueDate ?? data.periodEnd),
      hasTva: data.hasTva,
      totalHt: amount(data.totalHt),
      totalTva: amount(data.totalTva),
      totalTtc: amount(data.totalTtc),
      status: statusToDb[data.status],
      updatedByEmail: user.email,
      items: existing.items[0]
        ? { update: { where: { id: existing.items[0].id }, data: { designation: data.designation, quantity: amount(data.quantity, 3), unitPrice: amount(data.unitPrice), total: amount(data.totalHt) } } }
        : { create: { designation: data.designation, quantity: amount(data.quantity, 3), unit: "m³", unitPrice: amount(data.unitPrice), total: amount(data.totalHt) } },
    },
  });
}

export async function updateInvoiceStatus(invoiceNumber: string, status: InvoiceStatus) {
  const user = await requireUser();
  const number = z.string().min(1).parse(invoiceNumber);
  const nextStatus = invoiceStatusSchema.parse(status);
  await prisma.invoice.update({ where: { invoiceNumber: number }, data: { status: statusToDb[nextStatus], updatedByEmail: user.email } });
}

export async function removeInvoice(invoiceNumber: string) {
  await requireUser();
  const number = z.string().min(1).parse(invoiceNumber);
  await prisma.invoice.delete({ where: { invoiceNumber: number } });
}