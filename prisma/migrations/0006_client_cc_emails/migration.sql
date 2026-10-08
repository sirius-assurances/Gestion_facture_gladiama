-- Addresses to copy on every invoice email for this client, typically the
-- accounts department alongside the named contact.
--
-- Stored as an array rather than a delimited string so the database never
-- has to guess a separator, and so an address containing a comma-like
-- character cannot split a recipient in two. The compose dialog still
-- prefills from it and lets the sender change it per message.
ALTER TABLE "facturation"."Client"
  ADD COLUMN "ccEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
