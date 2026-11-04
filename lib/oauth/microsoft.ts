/**
 * "Se connecter avec Microsoft" for sending invoices: the account owner
 * authenticates directly on Microsoft's own login page and only ever types
 * their password there — this app never sees it, never asks for an app
 * password, and stores nothing but a refresh token (encrypted, see
 * lib/oauth/crypto.ts) scoped to sending mail on their behalf.
 *
 * "common" authority rather than a specific tenant: it accepts both
 * organisational and personal Microsoft accounts (Hotmail, Outlook.com) —
 * required here, since neither the user nor the director has a work tenant.
 */
const AUTHORIZE_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// offline_access: issues a refresh token, so the connection survives past
// the ~1h access token. Mail.Send: the one permission this feature needs.
const SCOPES = "offline_access Mail.Send User.Read openid profile email";

export type MicrosoftOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type MicrosoftOAuthConfigResult =
  | { ok: true; config: MicrosoftOAuthConfig }
  | { ok: false; missing: string[] };

export function readMicrosoftOAuthConfig(env: Record<string, string | undefined> = process.env): MicrosoftOAuthConfigResult {
  const clientId = env.MICROSOFT_OAUTH_CLIENT_ID?.trim();
  const clientSecret = env.MICROSOFT_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri = env.MICROSOFT_OAUTH_REDIRECT_URI?.trim();

  const missing: string[] = [];
  if (!clientId) missing.push("MICROSOFT_OAUTH_CLIENT_ID");
  if (!clientSecret) missing.push("MICROSOFT_OAUTH_CLIENT_SECRET");
  if (!redirectUri) missing.push("MICROSOFT_OAUTH_REDIRECT_URI");
  if (missing.length) return { ok: false, missing };

  return { ok: true, config: { clientId: clientId!, clientSecret: clientSecret!, redirectUri: redirectUri! } };
}

/** Where "Connecter un compte Microsoft" sends the browser. `state` carries a CSRF check plus who initiated it. */
export function buildAuthorizeUrl(config: MicrosoftOAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    response_mode: "query",
    scope: SCOPES,
    state,
    // Always show the account picker: without it, a browser already signed
    // into one Microsoft account skips straight to it, which is wrong the
    // moment two different people share this computer to connect accounts.
    prompt: "select_account",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  error?: string;
  error_description?: string;
};

async function requestToken(config: MicrosoftOAuthConfig, body: Record<string, string>) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...body }),
  });
  const data = (await response.json()) as TokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Échec de l'échange de jeton avec Microsoft.");
  }
  return data;
}

export async function exchangeCodeForTokens(config: MicrosoftOAuthConfig, code: string) {
  const data = await requestToken(config, {
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    scope: SCOPES,
  });
  // Microsoft does not always reissue a refresh token on every exchange,
  // but it always does on this first one with offline_access requested.
  if (!data.refresh_token) throw new Error("Microsoft n'a pas renvoyé de jeton de renouvellement.");
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in };
}

/**
 * Microsoft rotates refresh tokens: the response may carry a new one, which
 * must replace the stored one, or the next refresh fails even though
 * nothing looks wrong yet.
 */
export async function refreshAccessToken(config: MicrosoftOAuthConfig, refreshToken: string) {
  const data = await requestToken(config, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: SCOPES,
  });
  return { accessToken: data.access_token, refreshToken: data.refresh_token ?? refreshToken, expiresIn: data.expires_in };
}

export async function fetchMicrosoftProfile(accessToken: string) {
  const response = await fetch(`${GRAPH_BASE}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error("Impossible de lire le profil Microsoft.");
  const data = (await response.json()) as { mail?: string; userPrincipalName?: string; displayName?: string };
  const email = data.mail || data.userPrincipalName;
  if (!email) throw new Error("Ce compte Microsoft n'a pas d'adresse email exploitable.");
  return { email, displayName: data.displayName };
}

export type GraphMailMessage = {
  to: string;
  cc?: string[];
  bcc?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  /** The PDF, plus any inline images referenced from html via `cid:` — see isInline/contentId. */
  attachments: Array<{
    filename: string;
    contentBase64: string;
    contentType: string;
    isInline?: boolean;
    contentId?: string;
  }>;
};

/**
 * Sends via Microsoft Graph's own sendMail endpoint rather than SMTP: more
 * reliable for personal (outlook.com/hotmail.com) accounts, which do not
 * always have "Authenticated SMTP" enabled the way a managed work mailbox
 * would — that is a separate, mailbox-level toggle OAuth alone does not
 * grant around.
 */
export async function sendMailViaGraph(accessToken: string, message: GraphMailMessage) {
  const payload = {
    message: {
      subject: message.subject,
      body: { contentType: "HTML", content: message.html },
      toRecipients: [{ emailAddress: { address: message.to } }],
      ccRecipients: message.cc?.map((address) => ({ emailAddress: { address } })),
      replyTo: message.replyTo ? [{ emailAddress: { address: message.replyTo } }] : undefined,
      bccRecipients: message.bcc ? [{ emailAddress: { address: message.bcc } }] : undefined,
      attachments: message.attachments.map((attachment) => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: attachment.filename,
        contentType: attachment.contentType,
        contentBytes: attachment.contentBase64,
        isInline: attachment.isInline,
        contentId: attachment.contentId,
      })),
    },
    saveToSentItems: true,
  };

  const response = await fetch(`${GRAPH_BASE}/me/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Microsoft Graph a refusé l'envoi : ${response.status} ${body.slice(0, 300)}`);
  }
}
