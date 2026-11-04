import { describe, expect, it } from "vitest";
import { readSignatureCard } from "@/lib/email/signature-card";

describe("readSignatureCard", () => {
  it("reads a real PNG from disk", async () => {
    const buffer = await readSignatureCard();

    expect(buffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a"); // PNG magic bytes
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });

  it("caches the read — a second call returns the same buffer instance", async () => {
    const first = await readSignatureCard();
    const second = await readSignatureCard();

    expect(second).toBe(first);
  });
});
