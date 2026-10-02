import { describe, expect, it } from "vitest";
import { getInvoiceTableLayout, TABLE_LEFT, TABLE_RIGHT } from "@/lib/pdf/layout";

describe.each([
  ["with VAT", true],
  ["without VAT", false],
])("invoice table layout %s", (_label, hasTva) => {
  const layout = getInvoiceTableLayout(hasTva);

  // The regression that broke every VAT invoice: the VAT layout declared
  // four headers but only four boundaries, so the last header's centre
  // resolved to NaN and jsPDF threw "Invalid arguments passed to jsPDF.text".
  it("has exactly one more boundary than it has headers", () => {
    expect(layout.columns).toHaveLength(layout.headers.length + 1);
  });

  it("produces a finite centre for every header", () => {
    layout.headers.forEach((_header, index) => {
      const centre = (layout.columns[index] + layout.columns[index + 1]) / 2;
      expect(Number.isFinite(centre)).toBe(true);
    });
  });

  it("spans the full table width", () => {
    expect(layout.columns.at(0)).toBe(TABLE_LEFT);
    expect(layout.columns.at(-1)).toBe(TABLE_RIGHT);
  });

  it("has strictly increasing boundaries", () => {
    const increasing = layout.columns.every((value, index) => index === 0 || value > layout.columns[index - 1]);
    expect(increasing).toBe(true);
  });

  it("leaves the amount column clear of the right-aligned total at x=187", () => {
    expect(layout.columns.at(-2)!).toBeLessThan(187);
  });
});

describe("invoice table layout variants", () => {
  it("adds a row for the VAT and TTC lines", () => {
    expect(getInvoiceTableLayout(true).rowCount).toBeGreaterThan(getInvoiceTableLayout(false).rowCount);
  });

  it("labels the VAT layout with a unit-price column", () => {
    expect(getInvoiceTableLayout(true).headers).toContain("PRIX UNITAIRE");
    expect(getInvoiceTableLayout(false).headers).toContain("PRIX M3");
  });
});
