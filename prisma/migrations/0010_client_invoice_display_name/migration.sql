-- Lets the printed billed-to name on an invoice differ from the client's
-- own name in the app (e.g. a subcontractor billed "CONSTRUCEN S/C
-- GRANUSEN" rather than just "GRANUSEN") without renaming the client
-- everywhere it's used for lookup (lists, the client picker, search).
ALTER TABLE "facturation"."Client"
  ADD COLUMN "invoiceDisplayName" TEXT;
