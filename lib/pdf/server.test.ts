import { describe, expect, it } from "vitest";
import { generateInvoicePdfBuffer } from "@/lib/pdf/server";

// Deliberately uses the real jsPDF and the real PNGs on disk, unlike
// generator.test.ts which mocks jsPDF to inspect draw coordinates. The point
// here is the opposite: prove the whole thing actually produces a file
// outside a browser, which is what automatic sending depends on.
const invoice = {
  invoiceNumber: "N°27",
  clientName: "SOGEA SATOM",
  clientLocation: "Diamniadio, Sénégal",
  projectName: "Travaux de terrassement",
  marketNumber: "Marché N°TA3/1087/AGR",
  contractNumber: "Contrat T0032/24",
  periodStart: "01 Septembre 2026",
  periodEnd: "17 Septembre 2026",
  designation: "Fourniture latérite crue",
  quantity: 5000,
  unitPrice: 650,
  hasTva: true,
  totalHt: 3_250_000,
  totalTva: 585_000,
  totalTtc: 3_835_000,
};

describe("server-side invoice PDF", () => {
  it("produces a real PDF with no browser", async () => {
    const pdf = await generateInvoicePdfBuffer(invoice);

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  // The header logo, stamp and footer are read from public/images by path.
  // Next traces imports, not files opened at runtime, so they are easy to
  // lose on deploy — and a PDF without them still renders, just with plain
  // text where the branding should be. Size is the cheapest honest signal:
  // the three PNGs are hundreds of kilobytes, the text fallback is a few.
  it("embeds the branding images rather than falling back to text", async () => {
    const pdf = await generateInvoicePdfBuffer(invoice);

    expect(pdf.byteLength).toBeGreaterThan(100_000);
  });

  it("renders invoices without VAT too", async () => {
    const pdf = await generateInvoicePdfBuffer({ ...invoice, hasTva: false, totalTva: 0, totalTtc: 3_250_000 });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
