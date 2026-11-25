-- The original "FOR ALL" policy (migration 0005) let any authenticated
-- Supabase session SELECT/INSERT/UPDATE/DELETE objects in the invoices
-- bucket directly through Supabase's Storage API — bypassing the
-- application's own rule that an issued invoice's PDF is never overwritten
-- or removed (storeInvoicePdf in app/actions/billing.ts). The app never
-- calls storage.remove() itself, so DELETE was never something the app
-- needed from this policy; UPDATE stays, since re-generating a draft's PDF
-- legitimately upserts the same path before the invoice is issued.
DROP POLICY IF EXISTS "Authenticated users manage invoice PDFs" ON storage.objects;

CREATE POLICY "Authenticated users read/write invoice PDFs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'invoices');

CREATE POLICY "Authenticated users upload invoice PDFs"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "Authenticated users update invoice PDFs"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'invoices')
  WITH CHECK (bucket_id = 'invoices');

-- No DELETE policy: direct deletion of a stored PDF through the Storage API
-- is refused outright, matching the fact that nothing in the app ever does
-- it on purpose.
