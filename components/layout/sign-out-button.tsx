"use client";

import { LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === "/login") return null;

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return <button aria-label="Se déconnecter" className="fixed bottom-20 left-5 z-30 inline-flex items-center gap-2 rounded-xl border border-[#e4e3dd] bg-[#fbfaf7] px-3 py-2 text-xs font-semibold text-[#6f7885] shadow-sm hover:text-[#172238] lg:bottom-8 lg:left-7" onClick={signOut} title="Se déconnecter" type="button"><LogOut size={15} /> <span className="hidden sm:inline">Déconnexion</span></button>;
}