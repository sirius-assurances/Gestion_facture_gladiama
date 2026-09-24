import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import SignOutButton from "@/components/layout/sign-out-button";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gladiama Factures",
  description: "Générez vos factures GLADIAMA en quelques secondes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${dmSans.variable} ${spaceGrotesk.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}<SignOutButton /></body>
    </html>
  );
}
