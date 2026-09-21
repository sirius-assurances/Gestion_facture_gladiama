import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";
import InvoiceForm from "@/components/invoices/invoice-form";
import MobileNav from "@/components/layout/mobile-nav";

export default function NewInvoicePage() {
  return (
    <main className="min-h-screen bg-[#f5f4f0] px-4 py-5 pb-24 sm:px-8 lg:ml-[248px] lg:px-12 lg:py-10 lg:pb-10">
      <div className="mx-auto max-w-5xl">
        <Link className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-[#6f7885] hover:text-[#172238]" href="/">
          <ArrowLeft size={17} /> Retour au tableau de bord
        </Link>
        <div className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#e8712b]">Nouvelle facture</p>
          <h1 className="font-[var(--font-space-grotesk)] text-2xl font-bold tracking-tight sm:text-3xl">Créer une facture</h1>
          <p className="mt-2 max-w-xl text-sm text-[#6f7885]">Renseignez les informations essentielles. Les montants se calculent automatiquement en FCFA.</p>
        </div>
        <Suspense fallback={<div className="rounded-2xl border border-[#e4e3dd] bg-[#fbfaf7] p-8 text-sm text-[#6f7885]">Chargement du formulaire...</div>}>
          <InvoiceForm />
        </Suspense>
      </div>
      <MobileNav />
    </main>
  );
}
