"use server";

import { prisma } from "@/lib/prisma";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
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

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
    .format(value)
    .replace(/(^|\s)([a-z])/g, (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
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
  };
}

function mapInvoice(invoice: Awaited<ReturnType<typeof prisma.invoice.findMany<{ include: { client: true; items: true } }>>>[number]): InvoiceRecord {
  const item = invoice.items[0];
  return {
    id: invoice.id,
    number: invoice.invoiceNumber,
    client: invoice.client.name,
    clientId: invoice.clientId,
    date: formatDate(invoice.invoiceDate),
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

export async function getInvoices() {
  await requireUser();
  if ((await prisma.invoice.count()) === 0) await ensureSeeded();
  const invoices = await prisma.invoice.findMany({ include: { client: true, items: true }, orderBy: { createdAt: "desc" } });
  return invoices.map(mapInvoice);
}

export async function createClient(input: Omit<ClientRecord, "id">) {
  await requireUser();
  const client = await prisma.client.create({ data: input });
  return mapClient(client);
}

export async function updateClient(client: ClientRecord) {
  await requireUser();
  const updated = await prisma.client.update({
    where: { id: client.id },
    data: {
      name: client.name,
      location: client.location,
      phone: client.phone || null,
      email: client.email || null,
      projectName: client.projectName || null,
      defaultUnitPrice: amount(client.defaultUnitPrice),
      hasTva: client.hasTva,
    },
  });
  return mapClient(updated);
}

export async function removeClient(clientId: string) {
  await requireUser();
  await prisma.client.delete({ where: { id: clientId } });
  return getClients();
}

export async function createInvoice(input: Omit<InvoiceRecord, "id" | "number" | "date" | "createdAt">) {
  await requireUser();
  const client = input.clientId
    ? await prisma.client.findUnique({ where: { id: input.clientId } })
    : await prisma.client.findFirst({ where: { name: input.client } });
  if (!client) throw new Error("Client introuvable.");

  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(742913);`;
    const invoices = await transaction.invoice.findMany({ select: { invoiceNumber: true } });
    const highest = invoices.reduce((max, invoice) => Math.max(max, Number.parseInt(invoice.invoiceNumber.replace(/\D+/g, ""), 10) || 0), 0);
    await transaction.invoice.create({
      data: {
        clientId: client.id,
        invoiceNumber: `N°${highest + 1}`,
        periodStart: dateFromInput(input.periodStart),
        periodEnd: dateFromInput(input.periodEnd),
        dueDate: dateFromInput(input.dueDate ?? input.periodEnd),
        hasTva: input.hasTva,
        totalHt: amount(input.totalHt),
        totalTva: amount(input.totalTva),
        totalTtc: amount(input.totalTtc),
        status: statusToDb[input.status ?? "Brouillon"],
        items: { create: { designation: input.designation, quantity: amount(input.quantity, 3), unit: "m³", unitPrice: amount(input.unitPrice), total: amount(input.totalHt) } },
      },
    });
  });
  return getInvoices();
}

export async function updateInvoice(invoice: InvoiceRecord) {
  await requireUser();
  const client = invoice.clientId ? await prisma.client.findUnique({ where: { id: invoice.clientId } }) : await prisma.client.findFirst({ where: { name: invoice.client } });
  if (!client) throw new Error("Client introuvable.");
  const existing = await prisma.invoice.findUnique({ where: { id: invoice.id }, include: { items: true } });
  if (!existing) throw new Error("Facture introuvable.");
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      clientId: client.id,
      periodStart: dateFromInput(invoice.periodStart),
      periodEnd: dateFromInput(invoice.periodEnd),
      dueDate: dateFromInput(invoice.dueDate ?? invoice.periodEnd),
      hasTva: invoice.hasTva,
      totalHt: amount(invoice.totalHt),
      totalTva: amount(invoice.totalTva),
      totalTtc: amount(invoice.totalTtc),
      status: statusToDb[invoice.status],
      items: existing.items[0]
        ? { update: { where: { id: existing.items[0].id }, data: { designation: invoice.designation, quantity: amount(invoice.quantity, 3), unitPrice: amount(invoice.unitPrice), total: amount(invoice.totalHt) } } }
        : { create: { designation: invoice.designation, quantity: amount(invoice.quantity, 3), unit: "m³", unitPrice: amount(invoice.unitPrice), total: amount(invoice.totalHt) } },
    },
  });
  return getInvoices();
}

export async function updateInvoiceStatus(invoiceNumber: string, status: InvoiceStatus) {
  await requireUser();
  await prisma.invoice.update({ where: { invoiceNumber }, data: { status: statusToDb[status] } });
  return getInvoices();
}

export async function removeInvoice(invoiceNumber: string) {
  await requireUser();
  await prisma.invoice.delete({ where: { invoiceNumber } });
  return getInvoices();
}