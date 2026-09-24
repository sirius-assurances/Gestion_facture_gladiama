-- Dedicated sequence for invoice numbers, replacing the full-table-scan
-- approach guarded by an advisory lock. Avoids reading every invoice row
-- on each creation and removes the global serialization point.
CREATE SEQUENCE IF NOT EXISTS "facturation"."invoice_number_seq";

-- Align the sequence with the highest invoice number already in the table,
-- so numbering continues seamlessly instead of restarting at 1.
SELECT setval(
  '"facturation"."invoice_number_seq"',
  GREATEST(
    1,
    COALESCE(
      (
        SELECT MAX(NULLIF(regexp_replace("invoiceNumber", '\D', '', 'g'), '')::int)
        FROM "facturation"."Invoice"
      ),
      0
    )
  )
);
