-- facturation_app (the role the app connects as) was granted USAGE on
-- invoice_number_seq, enough for nextval() when creating an invoice, but
-- never UPDATE — a separate Postgres privilege on a sequence, required by
-- setval(). Without it, moving the sequence's starting point to match
-- invoices already issued outside the app (paper, a previous tool) fails
-- with "permission denied for sequence invoice_number_seq".
GRANT UPDATE ON SEQUENCE "facturation"."invoice_number_seq" TO facturation_app;
