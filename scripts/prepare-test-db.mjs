// Prepares the disposable Postgres so the Prisma migrations can replay on
// it, then applies them.
//
// Migration 0005 creates a Supabase Storage bucket and its RLS policy, and
// those tables only exist inside a Supabase project. Rather than edit a
// migration that has already been applied in production (which would break
// its checksum), we stand up a minimal `storage` schema locally so the same
// migration history runs unmodified here.
import { execFileSync } from "node:child_process";
import pg from "pg";

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://gladiama:gladiama@localhost:55432/gladiama_test?schema=facturation";

const STORAGE_STUB = `
  CREATE SCHEMA IF NOT EXISTS storage;
  CREATE TABLE IF NOT EXISTS storage.buckets (
    id text PRIMARY KEY,
    name text NOT NULL,
    public boolean NOT NULL DEFAULT false
  );
  CREATE TABLE IF NOT EXISTS storage.objects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id text,
    name text
  );
  DO $$ BEGIN
    CREATE ROLE authenticated;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;
`;

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();
await client.query(STORAGE_STUB);
await client.end();
console.log("storage stub ready");

execFileSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, DATABASE_URL, DIRECT_DATABASE_URL: DATABASE_URL },
});
