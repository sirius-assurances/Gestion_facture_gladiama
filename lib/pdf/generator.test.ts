import { beforeEach, describe, expect, it, vi } from "vitest";

// jsPDF is replaced with a recorder so the layout can be asserted in
// millimetres without rendering anything.
const calls: { text: { value: string; x: number; y: number }[] } = { text: [] };

vi.mock("jspdf", () => {
  class FakeDoc {
    text(value: string | string[], x: number, y: number) {
      calls.text.push({ value: Array.isArray(value) ? value.join(" ") : value, x, y });
    }
    getTextWidth(value: string) {
      return value.length * 2;
    }
    splitTextToSize(value: string) {
      return [value];
    }
    setTextColor() {}
    setFont() {}
    setFontSize() {}
    setDrawColor() {}
    setFillColor() {}
    setLineWidth() {}
    line() {}
    rect() {}
    addImage() {}
    save() {}
    output() {
      return "";
    }
  }
  return { default: FakeDoc };
});

const { generateInvoiceDocument } = await import("@/lib/pdf/generator");

const baseInvoice = {
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
  totalHt: 3_250_000,
};

const withTva = { ...baseInvoice, hasTva: true, totalTva: 585_000, totalTtc: 3_835_000 };
const withoutTva = { ...baseInvoice, hasTva: false, totalTva: 0, totalTtc: 3_250_000 };

function findY(fragment: string) {
  const match = calls.text.find((call) => call.value.includes(fragment));
  if (!match) throw new Error(`No text drawn containing "${fragment}"`);
  return match.y;
}

beforeEach(() => {
  calls.text = [];
});

describe.each([
  ["with VAT", withTva],
  ["without VAT", withoutTva],
])("invoice layout %s", (_label, data) => {
  // The signature block used to sit at a fixed y=252 while the amount line
  // floats with the table height, so the gap between them changed from one
  // invoice to the next and left a large hole on short invoices.
  it("keeps the signature a consistent, modest distance below the amount", async () => {
    await generateInvoiceDocument(data);
    const gap = findY("LE DIRECTEUR GENERAL") - findY("Soit Un Total De");

    expect(gap).toBe(20);
  });

  it("never pushes the signature into the page footer", async () => {
    await generateInvoiceDocument(data);
    expect(findY("LE DIRECTEUR GENERAL")).toBeLessThanOrEqual(252);
  });
});
