-- Persist generated invoice PDFs in Supabase Storage instead of only
-- generating them ephemerally in the browser, so there is a durable copy
-- to re-download later without regenerating (and re-typing) the invoice.
ALTER TABLE "facturation"."Invoice"
  ADD COLUMN "pdfPath" TEXT;

-- Private bucket: PDFs are only reachable through short-lived signed URLs
-- issued server-side, never a public path.
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Both accounts using this app already have full CRUD on every client and
-- invoice (see app/actions/billing.ts requireUser — no per-user scoping),
-- so storage access mirrors that: any authenticated user can manage
-- objects in the invoices bucket.
CREATE POLICY "Authenticated users manage invoice PDFs"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'invoices')
  WITH CHECK (bucket_id = 'invoices');
