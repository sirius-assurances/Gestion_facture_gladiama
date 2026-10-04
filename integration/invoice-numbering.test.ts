import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestPrisma, nextInvoiceNumber, resetDatabase } from "./setup";

const prisma = createTestPrisma();

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase(prisma);
});

async function createClient(name: string) {
  return prisma.client.create({
    data: { name, location: "Dakar, Sénégal", defaultUnitPrice: "600.00", hasTva: false },
  });
}

function invoiceData(clientId: string, invoiceNumber: string) {
  const day = new Date("2026-09-17T12:00:00.000Z");
  return {
    clientId,
    invoiceNumber,
    periodStart: day,
    periodEnd: day,
    dueDate: day,
    hasTva: false,
    totalHt: "600.00",
    totalTva: "0.00",
    totalTtc: "600.00",
  };
}

describe("invoice numbering", () => {
  it("never hands the same number to concurrent creations", async () => {
    const client = await createClient("PFO AFRICA");

    // The sequence exists precisely so that simultaneous creations can't
    // collide; the previous implementation scanned the table for the
    // highest number, which two requests could read at the same time.
    const numbers = await Promise.all(Array.from({ length: 25 }, () => nextInvoiceNumber(prisma)));
    await Promise.all(numbers.map((number) => prisma.invoice.create({ data: invoiceData(client.id, number) })));

    expect(new Set(numbers).size).toBe(numbers.length);
    expect(await prisma.invoice.count()).toBe(numbers.length);
  });

  it("keeps numbering forward after invoices are deleted", async () => {
    const client = await createClient("GRANUSEN");
    const first = await nextInvoiceNumber(prisma);
    await prisma.invoice.create({ data: invoiceData(client.id, first) });
    await prisma.invoice.deleteMany();

    // Row count is not the source of truth — deleting must not cause the
    // next invoice to reuse a number that was already issued.
    expect(await prisma.invoice.count()).toBe(0);
    expect(await nextInvoiceNumber(prisma)).not.toBe(first);
  });

  it("rejects a duplicate invoice number", async () => {
    const client = await createClient("SOGEA SATOM");
    await prisma.invoice.create({ data: invoiceData(client.id, "N°100") });
    await expect(prisma.invoice.create({ data: invoiceData(client.id, "N°100") })).rejects.toThrow();
  });
});

describe("invoice relations", () => {
  it("deletes an invoice's items with it", async () => {
    const client = await createClient("PFO AFRICA");
    const invoice = await prisma.invoice.create({
      data: {
        ...invoiceData(client.id, "N°200"),
        items: { create: { designation: "Fourniture", quantity: "1.000", unit: "m³", unitPrice: "600.00", total: "600.00" } },
      },
    });

    expect(await prisma.invoiceItem.count({ where: { invoiceId: invoice.id } })).toBe(1);
    await prisma.invoice.delete({ where: { id: invoice.id } });
    expect(await prisma.invoiceItem.count({ where: { invoiceId: invoice.id } })).toBe(0);
  });

  it("deletes a client's invoices with it", async () => {
    const client = await createClient("GRANUSEN");
    await prisma.invoice.create({ data: invoiceData(client.id, "N°300") });

    await prisma.client.delete({ where: { id: client.id } });
    expect(await prisma.invoice.count({ where: { clientId: client.id } })).toBe(0);
  });

  it("stores amounts at two decimals and quantities at three", async () => {
    const client = await createClient("SOGEA SATOM");
    const invoice = await prisma.invoice.create({
      data: {
        ...invoiceData(client.id, "N°400"),
        totalTtc: "1879740.00",
        items: { create: { designation: "Fourniture", quantity: "2360.125", unit: "m³", unitPrice: "675.00", total: "1593000.00" } },
      },
      include: { items: true },
    });

    expect(Number(invoice.totalTtc)).toBe(1_879_740);
    expect(Number(invoice.items[0].quantity)).toBe(2360.125);
  });
});
