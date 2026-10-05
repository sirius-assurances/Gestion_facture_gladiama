"use client";

import { usePathname } from "next/navigation";
import MobileNav from "@/components/layout/mobile-nav";
import Sidebar from "@/components/layout/sidebar";

/**
 * Navigation is defined once here instead of being repeated by every page,
 * which is how the desktop sidebar ended up existing on the dashboard only
 * while the other pages still offset their content for it.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") return <>{children}</>;

  return (
    <>
      <Sidebar />
      <div className="lg:pl-[248px]">{children}</div>
      <MobileNav />
    </>
  );
}
