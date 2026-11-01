import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  readMicrosoftOAuthConfig,
  refreshAccessToken,
  sendMailViaGraph,
  type MicrosoftOAuthConfig,
} from "@/lib/oauth/microsoft";

const config: MicrosoftOAuthConfig = {
  clientId: "client-123",
  clientSecret: "secret-xyz",
  redirectUri: "https://example.com/api/auth/microsoft/callback",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readMicrosoftOAuthConfig", () => {
  it("reports exactly what is missing", () => {
    const result = readMicrosoftOAuthConfig({});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toEqual([
      "MICROSOFT_OAUTH_CLIENT_ID",
      "MICROSOFT_OAUTH_CLIENT_SECRET",
      "MICROSOFT_OAUTH_REDIRECT_URI",
    ]);
  });

  it("reads all three when present", () => {
    const result = readMicrosoftOAuthConfig({
      MICROSOFT_OAUTH_CLIENT_ID: "a",
      MICROSOFT_OAUTH_CLIENT_SECRET: "b",
      MICROSOFT_OAUTH_REDIRECT_URI: "c",
    });

    expect(result.ok).toBe(true);
  });
});

describe("buildAuthorizeUrl", () => {
  it("points at the common authority, so both work and personal accounts can sign in", () => {
    const url = buildAuthorizeUrl(config, "state-abc");

    expect(url).toMatch(/^https:\/\/login\.microsoftonline\.com\/common\/oauth2\/v2\.0\/authorize\?/);
  });

  it("requests offline_access and Mail.Send, and carries the redirect URI and state through", () => {
    const url = buildAuthorizeUrl(config, "state-abc");
    const params = new URL(url).searchParams;

    expect(params.get("scope")).toContain("offline_access");
    expect(params.get("scope")).toContain("Mail.Send");
    expect(params.get("redirect_uri")).toBe(config.redirectUri);
    expect(params.get("state")).toBe("state-abc");
  });

  // Without this, a browser already signed into one Microsoft account skips
  // straight to it — wrong the moment two people share a computer to connect
  // their own accounts.
  it("forces the account picker", () => {
    const url = buildAuthorizeUrl(config, "state-abc");

    expect(new URL(url).searchParams.get("prompt")).toBe("select_account");
  });
});

describe("exchangeCodeForTokens", () => {
  it("sends an authorization_code grant and returns the tokens", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "at", refresh_token: "rt", expires_in: 3600 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await exchangeCodeForTokens(config, "the-code");

    expect(result).toEqual({ accessToken: "at", refreshToken: "rt", expiresIn: 3600 });
    const [, init] = fetchMock.mock.calls[0];
    const body = new URLSearchParams(init.body);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("the-code");
    expect(body.get("client_secret")).toBe("secret-xyz");
  });

  // offline_access was requested, so a response with no refresh token at all
  // means something is misconfigured upstream — surfacing that beats
  // silently storing `undefined` and failing only on the next send attempt.
  it("fails loudly when Microsoft returns no refresh token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: "at", expires_in: 3600 }) }),
    );

    await expect(exchangeCodeForTokens(config, "the-code")).rejects.toThrow(/renouvellement/);
  });

  it("surfaces Microsoft's own error description", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "invalid_grant", error_description: "AADSTS70000: expired code" }),
      }),
    );

    await expect(exchangeCodeForTokens(config, "stale-code")).rejects.toThrow("AADSTS70000");
  });
});

describe("refreshAccessToken", () => {
  // Microsoft rotates refresh tokens on some responses; the caller must get
  // the new one back or the next refresh silently fails later.
  it("returns the rotated refresh token when Microsoft issues one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: "at2", refresh_token: "rt-rotated", expires_in: 3600 }),
      }),
    );

    const result = await refreshAccessToken(config, "rt-old");

    expect(result.refreshToken).toBe("rt-rotated");
  });

  it("keeps the existing refresh token when Microsoft does not reissue one", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: "at2", expires_in: 3600 }) }));

    const result = await refreshAccessToken(config, "rt-old");

    expect(result.refreshToken).toBe("rt-old");
  });
});

describe("sendMailViaGraph", () => {
  it("shapes the request the way Graph's sendMail endpoint expects", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await sendMailViaGraph("access-token", {
      to: "client@exemple.com",
      cc: ["copie@exemple.com"],
      subject: "Facture N°30",
      html: "<p>Bonjour</p>",
      text: "Bonjour",
      attachment: { filename: "Facture_30.pdf", contentBase64: "JVBERi0=" },
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.microsoft.com/v1.0/me/sendMail");
    expect(init.headers.Authorization).toBe("Bearer access-token");
    const payload = JSON.parse(init.body);
    expect(payload.message.toRecipients[0].emailAddress.address).toBe("client@exemple.com");
    expect(payload.message.ccRecipients[0].emailAddress.address).toBe("copie@exemple.com");
    expect(payload.message.attachments[0].name).toBe("Facture_30.pdf");
    expect(payload.message.attachments[0]["@odata.type"]).toBe("#microsoft.graph.fileAttachment");
    // Graph's own "save a copy" rather than the SMTP bcc-to-self trick used
    // for the other accounts, which exists only because plain SMTP has no
    // equivalent of this flag.
    expect(payload.saveToSentItems).toBe(true);
  });

  it("surfaces Graph's status and body on refusal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => "ErrorAccessDenied" }),
    );

    await expect(
      sendMailViaGraph("access-token", {
        to: "client@exemple.com",
        subject: "x",
        html: "x",
        text: "x",
        attachment: { filename: "x.pdf", contentBase64: "AA==" },
      }),
    ).rejects.toThrow(/403/);
  });
});
