ALTER TABLE "facturation"."Client"
  ALTER COLUMN "defaultUnitPrice" TYPE DECIMAL(15, 2)
  USING ROUND("defaultUnitPrice"::numeric, 2);

ALTER TABLE "facturation"."Invoice"
  ALTER COLUMN "tvaRate" TYPE DECIMAL(5, 2)
    USING ROUND("tvaRate"::numeric, 2),
  ALTER COLUMN "totalHt" TYPE DECIMAL(15, 2)
    USING ROUND("totalHt"::numeric, 2),
  ALTER COLUMN "totalTva" TYPE DECIMAL(15, 2)
    USING ROUND("totalTva"::numeric, 2),
  ALTER COLUMN "totalTtc" TYPE DECIMAL(15, 2)
    USING ROUND("totalTtc"::numeric, 2);

ALTER TABLE "facturation"."InvoiceItem"
  ALTER COLUMN "quantity" TYPE DECIMAL(15, 3)
    USING ROUND("quantity"::numeric, 3),
  ALTER COLUMN "unitPrice" TYPE DECIMAL(15, 2)
    USING ROUND("unitPrice"::numeric, 2),
  ALTER COLUMN "total" TYPE DECIMAL(15, 2)
    USING ROUND("total"::numeric, 2);

CREATE INDEX "Client_name_idx" ON "facturation"."Client"("name");
CREATE INDEX "Invoice_clientId_idx" ON "facturation"."Invoice"("clientId");
CREATE INDEX "Invoice_status_idx" ON "facturation"."Invoice"("status");
CREATE INDEX "Invoice_createdAt_idx" ON "facturation"."Invoice"("createdAt");
CREATE INDEX "Invoice_dueDate_idx" ON "facturation"."Invoice"("dueDate");
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "facturation"."InvoiceItem"("invoiceId");