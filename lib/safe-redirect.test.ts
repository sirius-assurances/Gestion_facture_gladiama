import { describe, expect, it } from "vitest";
import { safeRelativePath } from "@/lib/safe-redirect";

describe("safeRelativePath", () => {
  it("accepts a plain relative path", () => {
    expect(safeRelativePath("/invoices/42", "/")).toBe("/invoices/42");
  });

  it("falls back for a missing value", () => {
    expect(safeRelativePath(null, "/invoices")).toBe("/invoices");
    expect(safeRelativePath(undefined, "/invoices")).toBe("/invoices");
    expect(safeRelativePath("", "/invoices")).toBe("/invoices");
  });

  it("rejects a protocol-relative URL (//evil.example)", () => {
    expect(safeRelativePath("//evil.example", "/invoices")).toBe("/invoices");
  });

  it("rejects an absolute URL to another host", () => {
    expect(safeRelativePath("https://evil.example/phish", "/invoices")).toBe("/invoices");
  });

  it("rejects a backslash variant some browsers normalise to //", () => {
    expect(safeRelativePath("/\\evil.example", "/invoices")).toBe("/invoices");
  });

  it("rejects a path that doesn't start with a slash", () => {
    expect(safeRelativePath("evil.example", "/invoices")).toBe("/invoices");
  });
});
