import { afterEach, describe, expect, it } from "vitest";
import { isUserEmailAllowed } from "@/lib/auth/allowed-users";

const ORIGINAL = process.env.ALLOWED_USER_EMAILS;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ALLOWED_USER_EMAILS;
  else process.env.ALLOWED_USER_EMAILS = ORIGINAL;
});

describe("isUserEmailAllowed", () => {
  it("allows everyone when the variable is unset — no regression before it's configured", () => {
    delete process.env.ALLOWED_USER_EMAILS;
    expect(isUserEmailAllowed("anyone@example.com")).toBe(true);
    expect(isUserEmailAllowed(null)).toBe(true);
  });

  it("allows only listed emails once set", () => {
    process.env.ALLOWED_USER_EMAILS = "boss@example.com, assistant@example.com";
    expect(isUserEmailAllowed("boss@example.com")).toBe(true);
    expect(isUserEmailAllowed("assistant@example.com")).toBe(true);
    expect(isUserEmailAllowed("stranger@example.com")).toBe(false);
  });

  it("is case-insensitive", () => {
    process.env.ALLOWED_USER_EMAILS = "Boss@Example.com";
    expect(isUserEmailAllowed("boss@example.com")).toBe(true);
  });

  it("rejects a missing email once the list is configured", () => {
    process.env.ALLOWED_USER_EMAILS = "boss@example.com";
    expect(isUserEmailAllowed(null)).toBe(false);
    expect(isUserEmailAllowed(undefined)).toBe(false);
  });
});
