import { beforeEach, describe, expect, it, vi } from "vitest";

// Every exported Server Action must refuse to touch the database when there
// is no authenticated Supabase session. This is the app's only access
// control layer (see app/actions/billing.ts:requireUser), so a regression
// here means any unauthenticated caller gets full read/write access.

const getUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

// Prisma must never be reached when requireUser() rejects. Any property
// access throws, so a call that "leaks" past the auth guard fails loudly.
vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy(
    {},
    {
      get() {
        throw new Error("prisma should not be called without an authenticated user");
      },
    },
  ),
}));

beforeEach(() => {
  getUser.mockReset();
  getUser.mockResolvedValue({ data: { user: null }, error: null });
});

describe("billing Server Actions without an authenticated session", () => {
  it("getClients rejects", async () => {
    const { getClients } = await import("@/app/actions/billing");
    await expect(getClients()).rejects.toThrow("Authentification requise.");
  });

  it("getInvoices rejects", async () => {
    const { getInvoices } = await import("@/app/actions/billing");
    await expect(getInvoices()).rejects.toThrow("Authentification requise.");
  });

  it("createClient rejects", async () => {
    const { createClient } = await import("@/app/actions/billing");
    await expect(
      createClient({ name: "Test", location: "Dakar", defaultUnitPrice: 600, hasTva: false }),
    ).rejects.toThrow("Authentification requise.");
  });

  it("updateClient rejects", async () => {
    const { updateClient } = await import("@/app/actions/billing");
    await expect(
      updateClient({ id: "abc", name: "Test", location: "Dakar", defaultUnitPrice: 600, hasTva: false }),
    ).rejects.toThrow("Authentification requise.");
  });

  it("removeClient rejects", async () => {
    const { removeClient } = await import("@/app/actions/billing");
    await expect(removeClient("abc")).rejects.toThrow("Authentification requise.");
  });

  it("createInvoice rejects", async () => {
    const { createInvoice } = await import("@/app/actions/billing");
    await expect(
      createInvoice({
        client: "Test",
        periodStart: "2026-09-01",
        periodEnd: "2026-09-17",
        designation: "Fourniture",
        quantity: 100,
        unitPrice: 600,
        hasTva: false,
        totalHt: 60000,
        totalTva: 0,
        totalTtc: 60000,
        status: "Brouillon",
      }),
    ).rejects.toThrow("Authentification requise.");
  });

  it("updateInvoice rejects", async () => {
    const { updateInvoice } = await import("@/app/actions/billing");
    await expect(
      updateInvoice({
        id: "inv-1",
        number: "N°1",
        client: "Test",
        date: "17 Septembre 2026",
        periodStart: "2026-09-01",
        periodEnd: "2026-09-17",
        designation: "Fourniture",
        quantity: 100,
        unitPrice: 600,
        hasTva: false,
        totalHt: 60000,
        totalTva: 0,
        totalTtc: 60000,
        status: "Brouillon",
        createdAt: "2026-09-17T00:00:00.000Z",
      }),
    ).rejects.toThrow("Authentification requise.");
  });

  it("updateInvoiceStatus rejects", async () => {
    const { updateInvoiceStatus } = await import("@/app/actions/billing");
    await expect(updateInvoiceStatus("N°1", "Envoyée")).rejects.toThrow("Authentification requise.");
  });

  it("removeInvoice rejects", async () => {
    const { removeInvoice } = await import("@/app/actions/billing");
    await expect(removeInvoice("N°1")).rejects.toThrow("Authentification requise.");
  });

  it("saveInvoicePdf rejects", async () => {
    const { saveInvoicePdf } = await import("@/app/actions/billing");
    await expect(saveInvoicePdf("inv-1", "AAAA")).rejects.toThrow("Authentification requise.");
  });

  it("getInvoicePdfUrl rejects", async () => {
    const { getInvoicePdfUrl } = await import("@/app/actions/billing");
    await expect(getInvoicePdfUrl("inv-1")).rejects.toThrow("Authentification requise.");
  });
});
