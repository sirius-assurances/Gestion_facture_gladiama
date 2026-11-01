-- A mailbox connected through "Se connecter avec Microsoft" (OAuth2 device
-- login), not an app password. The owner authenticates directly with
-- Microsoft and never hands a password to this app; only a refresh token is
-- kept here, encrypted at rest (see lib/oauth/crypto.ts), to renew a short
-- lived access token whenever an invoice is actually sent from this account.
CREATE TABLE "facturation"."OAuthAccount" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'microsoft',
  "email" TEXT NOT NULL,
  "displayName" TEXT,
  "encryptedRefreshToken" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "connectedByEmail" TEXT,

  CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OAuthAccount_provider_email_key" ON "facturation"."OAuthAccount"("provider", "email");

-- Explicit, rather than assumed from default privileges: migration 0007
-- showed that facturation_app's base grants do not automatically cover
-- every new object (it had USAGE on a sequence but not UPDATE). Granted
-- directly here so this table works the moment the migration lands, not
-- after a second "permission denied" discovered in production.
GRANT SELECT, INSERT, UPDATE, DELETE ON "facturation"."OAuthAccount" TO facturation_app;
