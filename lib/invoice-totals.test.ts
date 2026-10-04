import { describe, expect, it } from "vitest";
import { computeInvoiceTotals, TVA_RATE_PERCENT } from "@/lib/invoice-totals";

describe("computeInvoiceTotals", () => {
  it("multiplies quantity by unit price without VAT", () => {
    expect(computeInvoiceTotals(1483, 600, false)).toEqual({
      totalHt: 889_800,
      totalTva: 0,
      totalTtc: 889_800,
    });
  });

  it("adds VAT at the configured rate", () => {
    const { totalHt, totalTva, totalTtc } = computeInvoiceTotals(2360, 675, true);
    expect(totalHt).toBe(1_593_000);
    expect(totalTva).toBeCloseTo(1_593_000 * (TVA_RATE_PERCENT / 100), 6);
    expect(totalTtc).toBeCloseTo(totalHt + totalTva, 6);
  });

  it("never produces a negative total from negative input", () => {
    expect(computeInvoiceTotals(-10, 600, true)).toEqual({ totalHt: 0, totalTva: 0, totalTtc: 0 });
    expect(computeInvoiceTotals(10, -600, false).totalHt).toBe(0);
  });

  it("keeps TTC equal to HT when VAT is off", () => {
    const totals = computeInvoiceTotals(4050, 600, false);
    expect(totals.totalTtc).toBe(totals.totalHt);
  });
});
