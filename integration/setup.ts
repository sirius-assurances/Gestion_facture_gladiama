import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

/**
 * Integration tests run against the disposable Postgres in
 * docker-compose.test.yml — never Supabase, since they create and delete
 * invoices and would consume numbers from the real ledger's sequence.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://gladiama:gladiama@localhost:55432/gladiama_test?schema=facturation";

export function createTestPrisma() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: TEST_DATABASE_URL }) });
}

export async function resetDatabase(prisma: PrismaClient) {
  // InvoiceItem and Invoice cascade from Client, but delete explicitly so a
  // failure points at the right table.
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.client.deleteMany();
  await prisma.$executeRawUnsafe("ALTER SEQUENCE facturation.invoice_number_seq RESTART WITH 1");
}

/** Mirrors the server's numbering: a value taken from the sequence. */
export async function nextInvoiceNumber(prisma: PrismaClient) {
  const [row] = await prisma.$queryRawUnsafe<{ nextval: bigint }[]>(
    "SELECT nextval('facturation.invoice_number_seq') AS nextval",
  );
  return `N°${row.nextval}`;
}
