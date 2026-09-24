import { describe, expect, it } from "vitest";
import { formatCfa, formatFrenchDate, formatGroupedNumber } from "@/lib/format";

describe("formatGroupedNumber", () => {
  it("groups digits by thousands with a space", () => {
    expect(formatGroupedNumber(2430000)).toBe("2 430 000");
  });

  it("rounds decimal values", () => {
    expect(formatGroupedNumber(1483.6)).toBe("1 484");
  });

  it("leaves small numbers untouched", () => {
    expect(formatGroupedNumber(600)).toBe("600");
  });
});

describe("formatCfa", () => {
  it("appends the FCFA suffix to a grouped number", () => {
    expect(formatCfa(1879740)).toBe("1 879 740 FCFA");
  });

  it("formats zero", () => {
    expect(formatCfa(0)).toBe("0 FCFA");
  });
});

describe("formatFrenchDate", () => {
  it("formats a yyyy-mm-dd string with a capitalized month", () => {
    expect(formatFrenchDate("2026-09-17")).toBe("17 Septembre 2026");
  });

  it("formats a Date instance the same way as its equivalent string", () => {
    expect(formatFrenchDate(new Date("2026-01-05T12:00:00"))).toBe("05 Janvier 2026");
  });
});
