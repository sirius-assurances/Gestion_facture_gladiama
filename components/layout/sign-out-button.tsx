"use client";

import { LogOut } from "lucide-react";
import { usePathname } from "next/navigation";
import { useSignOut } from "@/components/layout/use-sign-out";

export default function SignOutButton() {
  const pathname = usePathname();
  const signOut = useSignOut();
  if (pathname === "/login") return null;

  // Desktop only: on phones this floated over the list rows as an unlabelled
  // icon, so signing out now lives in the bottom navigation bar instead.
  return (
    <button
      aria-label="Se déconnecter"
      className="fixed bottom-8 left-7 z-30 hidden items-center gap-2 rounded-xl border border-[#e4e3dd] bg-[#fbfaf7] px-3 py-2 text-xs font-semibold text-[#6f7885] shadow-sm hover:text-[#172238] lg:inline-flex"
      onClick={signOut}
      type="button"
    >
      <LogOut size={15} /> Déconnexion
    </button>
  );
}
