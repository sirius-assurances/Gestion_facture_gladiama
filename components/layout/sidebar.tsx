"use client";

import Link from "next/link";
import { FileText, Home, LogOut, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { useSignOut } from "@/components/layout/use-sign-out";

const items = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/invoices", label: "Factures", icon: FileText },
  { href: "/clients", label: "Clients", icon: Users },
];

// Previously this lived inside the dashboard page alone, so leaving the
// dashboard on a desktop removed the navigation entirely while the other
// pages still reserved its 248px of empty space.
export default function Sidebar() {
  const pathname = usePathname();
  const signOut = useSignOut();

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-[248px] flex-col bg-[#172238] px-7 py-8 text-white lg:flex">
      <Link className="mb-12 flex items-center gap-3" href="/">
        <img alt="GLADIAMA SUARL" className="h-auto w-40 object-contain" src="/images/logo-gladiama.png" />
      </Link>

      <nav className="space-y-2 text-sm">
        {items.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
                isActive ? "bg-white/10 font-semibold text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
              href={href}
              key={href}
            >
              <Icon size={18} /> {label}
            </Link>
          );
        })}
      </nav>

      <button
        className="mt-auto inline-flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-white/60 hover:bg-white/10 hover:text-white"
        onClick={signOut}
        type="button"
      >
        <LogOut size={18} /> Déconnexion
      </button>
    </aside>
  );
}
