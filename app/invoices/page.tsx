"use client";

import Link from "next/link";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Eye, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import MobileNav from "@/components/layout/mobile-nav";
import { getInvoicesPage, removeInvoice, updateInvoiceStatus as updateInvoiceStatusInDatabase } from "@/app/actions/billing";
import {
  getInvoiceDueDate,
  isInvoiceOverdue,
  getNextInvoiceStatus,
  invoiceStatusMeta,
  invoiceStatusOrder,
  invoiceStatusStyles,
  type InvoiceRecord,
  type InvoiceStatus,
} from "@/lib/invoice-storage";

const filterOptions: Array<"Toutes" | InvoiceStatus> = ["Toutes", "Brouillon", "Envoyée", "Payée"];
const PAGE_SIZE = 15;

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [filter, setFilter] = useState<"Toutes" | InvoiceStatus>("Toutes");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<InvoiceStatus, number>>({ Brouillon: 0, Envoyée: 0, Payée: 0 });
  // Bumped after a mutation to re-run the fetch effect below without
  // calling it imperatively.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    async function loadPage() {
      const result = await getInvoicesPage({ page, pageSize: PAGE_SIZE, status: filter === "Toutes" ? undefined : filter });
      setInvoices(result.invoices);
      setTotal(result.total);
      setStatusCounts(result.statusCounts);
    }
    void loadPage();
  }, [page, filter, reloadToken]);

  const changeFilter = (next: "Toutes" | InvoiceStatus) => {
    setFilter(next);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const updateStatus = async (invoiceNumber: string) => {
    const currentInvoice = invoices.find((invoice) => invoice.number === invoiceNumber);
    if (!currentInvoice) return;

    const nextStatus = getNextInvoiceStatus(currentInvoice.status);
    await updateInvoiceStatusInDatabase(invoiceNumber, nextStatus);
    setReloadToken((token) => token + 1);
  };

  const statusSummary = invoiceStatusOrder.map((status) => ({ status, count: statusCounts[status] }));

  const removeInvoiceFromDatabase = async (invoiceNumber: string) => {
    await removeInvoice(invoiceNumber);
    // If we just removed the last invoice on this page, step back a page
    // instead of showing an empty page that still claims more exist.
    if (invoices.length === 1 && page > 1) setPage(page - 1);
    else setReloadToken((token) => token + 1);
  };

  return (
    <main className="min-h-screen bg-[#f5f4f0] px-4 py-5 pb-24 sm:px-8 lg:ml-[248px] lg:px-12 lg:py-10 lg:pb-10">
      <div className="mx-auto max-w-5xl">
        <Link className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-[#6f7885] hover:text-[#172238]" href="/">
          <ArrowLeft size={17} /> Retour au tableau de bord
        </Link>

        <div className="mb-8 flex flex-col items-start gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#e8712b]">Registre des factures</p>
            <h1 className="font-[var(--font-space-grotesk)] text-3xl font-bold tracking-tight">Toutes les factures</h1>
            <p className="mt-2 text-sm text-[#6f7885]">Suivez vos brouillons, envois et paiements.</p>
          </div>
          <Link className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#e8712b] px-4 py-3 text-sm font-bold text-white hover:bg-[#d86322]" href="/invoices/new">
            <Plus size={18} /> <span className="hidden sm:inline">Nouvelle facture</span>
          </Link>
        </div>

        <div className="mb-5 grid gap-2 sm:grid-cols-3">
          {statusSummary.map(({ status, count }) => (
            <div className={`rounded-2xl border px-4 py-3 ${invoiceStatusMeta[status].accent}`} key={status}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em]">{status}</span>
                <span className="text-lg font-bold">{count}</span>
              </div>
              <p className="mt-2 text-xs opacity-80">{invoiceStatusMeta[status].description}</p>
            </div>
          ))}
        </div>

        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {filterOptions.map((item) => (
            <button
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${filter === item ? "bg-[#172238] text-white" : "border border-[#e4e3dd] bg-[#fbfaf7] text-[#6f7885]"}`}
              key={item}
              type="button"
              onClick={() => changeFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <section className="overflow-hidden rounded-2xl border border-[#e4e3dd] bg-[#fbfaf7]">
          <div className="hidden grid-cols-[1fr_1.2fr_1fr_1fr_auto] gap-4 border-b border-[#e4e3dd] px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9ba1a7] md:grid">
            <span>Facture</span>
            <span>Client</span>
            <span>Date</span>
            <span>Montant</span>
            <span>Action</span>
          </div>

          {invoices.map((invoice) => (
            <div
              className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-[#e4e3dd] px-4 py-4 last:border-0 sm:px-6 md:grid-cols-[1fr_1.2fr_1fr_1fr_auto] md:gap-4"
              key={invoice.id}
            >
              <div>
                <p className="font-semibold">{invoice.number}</p>
                <p className="text-xs text-[#6f7885] md:hidden">{invoice.date}</p>
              </div>

              <p className="text-sm font-medium">{invoice.client}</p>
              <p className="hidden text-sm text-[#6f7885] md:block">{invoice.date}</p>
              <p className="hidden text-sm font-semibold md:block">{invoice.totalTtc.toLocaleString("fr-FR")} FCFA</p>

              <div className="col-span-2 flex flex-wrap items-center justify-start gap-2 md:col-span-1 md:justify-start">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${invoiceStatusStyles[invoice.status]}`}>
                  {invoice.status}
                </span>
                {isInvoiceOverdue(invoice) && (
                  <span className="hidden rounded-full bg-[#c13a3a]/10 px-2.5 py-1 text-[11px] font-semibold text-[#c13a3a] sm:inline-flex">En retard</span>
                )}
                <span className="hidden text-[10px] text-[#6f7885] sm:block">{invoiceStatusMeta[invoice.status].description}</span>
                <span className="hidden text-[10px] text-[#6f7885] xl:block">Échéance {getInvoiceDueDate(invoice)}</span>
                <Link
                  className="inline-flex items-center gap-1 rounded-full border border-[#e4e3dd] bg-white p-2 text-[#172238] hover:border-[#d9d8d1]"
                  href={`/invoices/${invoice.id}`}
                  aria-label={`Voir la facture ${invoice.number}`}
                  title="Voir la facture"
                >
                  <Eye size={14} />
                </Link>
                <button
                  className="inline-flex items-center gap-1 rounded-full border border-[#e4e3dd] bg-white p-2 text-[#172238] hover:border-[#d9d8d1]"
                  type="button"
                  onClick={() => updateStatus(invoice.number)}
                  aria-label={`Mettre à jour le statut de ${invoice.number}`}
                  title="Changer le statut"
                >
                  <Check size={14} />
                </button>
                <button
                  className="inline-flex items-center gap-1 rounded-full border border-[#e4e3dd] bg-white p-2 text-[#c13a3a] hover:border-[#f0d2d2]"
                  type="button"
                  onClick={() => removeInvoiceFromDatabase(invoice.number)}
                  aria-label={`Supprimer ${invoice.number}`}
                  title="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </section>

        {invoices.length === 0 && (
          <div className="mt-5 rounded-2xl border border-dashed border-[#d9d8d1] bg-[#fbfaf7] p-10 text-center text-sm text-[#6f7885]">
            Aucune facture ne correspond à ce filtre.
          </div>
        )}

        {total > 0 && (
          <div className="mt-5 flex items-center justify-between gap-3 text-sm text-[#6f7885]">
            <p>
              Page {page} sur {totalPages} · {total} facture{total > 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex items-center gap-1 rounded-full border border-[#e4e3dd] bg-white px-3 py-2 font-semibold text-[#172238] hover:border-[#d9d8d1] disabled:cursor-not-allowed disabled:opacity-40"
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft size={14} /> Précédent
              </button>
              <button
                className="inline-flex items-center gap-1 rounded-full border border-[#e4e3dd] bg-white px-3 py-2 font-semibold text-[#172238] hover:border-[#d9d8d1] disabled:cursor-not-allowed disabled:opacity-40"
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                Suivant <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
      <MobileNav />
    </main>
  );
}
