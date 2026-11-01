import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "@/lib/oauth/crypto";

const ORIGINAL_KEY = process.env.TOKEN_ENCRYPTION_KEY;

beforeEach(() => {
  process.env.TOKEN_ENCRYPTION_KEY = "test-key-not-for-real-use";
});

afterEach(() => {
  process.env.TOKEN_ENCRYPTION_KEY = ORIGINAL_KEY;
});

describe("encryptToken / decryptToken", () => {
  it("round-trips a refresh token", () => {
    const token = "M.C123_SN.AbCdEf...refresh-token-value";

    expect(decryptToken(encryptToken(token))).toBe(token);
  });

  // The one secret this whole feature exists to protect; it must never be
  // readable as plain text in the stored column.
  it("never stores the token in the clear", () => {
    const token = "a-refresh-token-that-must-not-leak";

    expect(encryptToken(token)).not.toContain(token);
  });

  it("produces a different ciphertext each time, from a random IV", () => {
    const token = "same-token-twice";

    expect(encryptToken(token)).not.toBe(encryptToken(token));
  });

  // GCM's authentication tag: a flipped bit must fail loudly, not decrypt
  // into silently-wrong bytes that get used as a token against Microsoft.
  it("rejects a tampered ciphertext instead of returning garbage", () => {
    const encrypted = encryptToken("a-real-token");
    const [iv, authTag] = encrypted.split(":");
    const tampered = [iv, authTag, Buffer.from("tampered").toString("base64")].join(":");

    expect(() => decryptToken(tampered)).toThrow();
  });

  it("requires TOKEN_ENCRYPTION_KEY to be set", () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;

    expect(() => encryptToken("x")).toThrow("TOKEN_ENCRYPTION_KEY");
  });
});
