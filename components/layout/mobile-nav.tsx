"use client";

import Link from "next/link";
import { FileText, Home, Users } from "lucide-react";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/invoices", label: "Factures", icon: FileText },
  { href: "/clients", label: "Clients", icon: Users },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t border-[#e4e3dd] bg-[#fbfaf7]/95 px-4 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur lg:hidden">
      {items.map(({ href, label, icon: Icon }) => {
        const isActive = href === "/" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            className={`flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] font-semibold ${isActive ? "text-[#e8712b]" : "text-[#6f7885]"}`}
            href={href}
            key={href}
          >
            <Icon size={19} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
