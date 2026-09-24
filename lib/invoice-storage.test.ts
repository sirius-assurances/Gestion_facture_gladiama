import { describe, expect, it } from "vitest";
import {
  getInvoiceDaysUntilDue,
  getInvoiceDueDate,
  getNextInvoiceStatus,
  isInvoiceOverdue,
} from "@/lib/invoice-storage";

describe("getInvoiceDueDate", () => {
  it("returns the explicit dueDate when set", () => {
    expect(getInvoiceDueDate({ periodEnd: "2026-09-17", dueDate: "2026-10-17" })).toBe("2026-10-17");
  });

  it("falls back to periodEnd + 30 days when dueDate is missing", () => {
    expect(getInvoiceDueDate({ periodEnd: "2026-09-17" })).toBe("2026-10-17");
  });

  it("rolls over to the next month correctly", () => {
    expect(getInvoiceDueDate({ periodEnd: "2026-01-15" })).toBe("2026-02-14");
  });
});

describe("getInvoiceDaysUntilDue", () => {
  it("is 0 the day the invoice is due", () => {
    const invoice = { periodEnd: "2026-09-17", dueDate: "2026-09-20" };
    expect(getInvoiceDaysUntilDue(invoice, new Date("2026-09-20T09:00:00"))).toBe(0);
  });

  it("is positive before the due date", () => {
    const invoice = { periodEnd: "2026-09-17", dueDate: "2026-09-20" };
    expect(getInvoiceDaysUntilDue(invoice, new Date("2026-09-17T09:00:00"))).toBe(3);
  });

  it("is negative after the due date", () => {
    const invoice = { periodEnd: "2026-09-17", dueDate: "2026-09-20" };
    expect(getInvoiceDaysUntilDue(invoice, new Date("2026-09-25T09:00:00"))).toBe(-5);
  });
});

describe("isInvoiceOverdue", () => {
  it("is false once the invoice is marked as paid, even past the due date", () => {
    const invoice = { periodEnd: "2026-09-17", dueDate: "2026-09-20", status: "Payée" as const };
    expect(isInvoiceOverdue(invoice, new Date("2026-10-01"))).toBe(false);
  });

  it("is true for an unpaid invoice past its due date", () => {
    const invoice = { periodEnd: "2026-09-17", dueDate: "2026-09-20", status: "Envoyée" as const };
    expect(isInvoiceOverdue(invoice, new Date("2026-10-01"))).toBe(true);
  });

  it("is false for an unpaid invoice still within its due date", () => {
    const invoice = { periodEnd: "2026-09-17", dueDate: "2026-09-20", status: "Brouillon" as const };
    expect(isInvoiceOverdue(invoice, new Date("2026-09-18"))).toBe(false);
  });
});

describe("getNextInvoiceStatus", () => {
  it("moves Brouillon to Envoyée", () => {
    expect(getNextInvoiceStatus("Brouillon")).toBe("Envoyée");
  });

  it("moves Envoyée to Payée", () => {
    expect(getNextInvoiceStatus("Envoyée")).toBe("Payée");
  });

  it("keeps Payée as a terminal state", () => {
    expect(getNextInvoiceStatus("Payée")).toBe("Payée");
  });
});
