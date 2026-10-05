"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Shared by the desktop button and the mobile navigation bar. */
export function useSignOut() {
  const router = useRouter();

  return async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  };
}
