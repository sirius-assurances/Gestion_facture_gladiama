CREATE SCHEMA IF NOT EXISTS "facturation";

CREATE TYPE "facturation"."InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID');

CREATE TABLE "facturation"."Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT 'Dakar, Sénégal',
    "phone" TEXT,
    "email" TEXT,
    "projectName" TEXT,
    "marketNumber" TEXT,
    "contractNumber" TEXT,
    "defaultProduct" TEXT NOT NULL DEFAULT 'Latérite crue',
    "defaultUnitPrice" INTEGER NOT NULL DEFAULT 600,
    "hasTva" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "facturation"."Invoice" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "hasTva" BOOLEAN NOT NULL DEFAULT false,
    "tvaRate" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "totalHt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTtc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "facturation"."InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "facturation"."InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "designation" TEXT NOT NULL DEFAULT 'Fourniture latérite crue',
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'm³',
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "facturation"."Invoice"("invoiceNumber");

ALTER TABLE "facturation"."Invoice"
  ADD CONSTRAINT "Invoice_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "facturation"."Client"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "facturation"."InvoiceItem"
  ADD CONSTRAINT "InvoiceItem_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "facturation"."Invoice"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;