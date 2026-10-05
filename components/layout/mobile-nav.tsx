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

const itemClass = "flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] font-semibold";

export default function MobileNav() {
  const pathname = usePathname();
  const signOut = useSignOut();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-[#e4e3dd] bg-[#fbfaf7]/95 px-4 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur lg:hidden">
      {items.map(({ href, label, icon: Icon }) => {
        const isActive = href === "/" ? pathname === href : pathname.startsWith(href);
        return (
          <Link className={`${itemClass} ${isActive ? "text-[#e8712b]" : "text-[#6f7885]"}`} href={href} key={href}>
            <Icon size={19} />
            <span>{label}</span>
          </Link>
        );
      })}

      {/* Signing out used to be an unlabelled floating icon covering the
          content; here it is named and out of the way. */}
      <button className={`${itemClass} text-[#6f7885]`} onClick={signOut} type="button">
        <LogOut size={19} />
        <span>Quitter</span>
      </button>
    </nav>
  );
}
