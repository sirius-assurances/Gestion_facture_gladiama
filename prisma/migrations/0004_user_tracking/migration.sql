-- Traceability: record which authenticated user (by email) created or
-- last modified a client/invoice. There is no role-based access
-- restriction between the two accounts using this app; this is purely
-- an audit trail.
ALTER TABLE "facturation"."Client"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "createdByEmail" TEXT,
  ADD COLUMN "updatedByEmail" TEXT;

ALTER TABLE "facturation"."Invoice"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "createdByEmail" TEXT,
  ADD COLUMN "updatedByEmail" TEXT;
