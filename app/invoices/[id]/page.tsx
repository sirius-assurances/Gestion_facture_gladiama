"use client";

import Link from "next/link";
import { ArrowLeft, FileText, Save } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import MobileNav from "@/components/layout/mobile-nav";
import { getClients, getInvoices, updateInvoice } from "@/app/actions/billing";
import {
  getNextInvoiceStatus,
  getInvoiceDueDate,
  invoiceStatusMeta,
  invoiceStatusOrder,
  type InvoiceRecord,
} from "@/lib/invoice-storage";
import { formatCfa } from "@/lib/format";

export default function InvoiceDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    async function loadInvoice() {
      const [storedInvoices, storedClients] = await Promise.all([getInvoices(), getClients()]);
      const found = storedInvoices.find((item) => item.id === params.id);
      setInvoice(found ?? null);
      setClients(storedClients.map(({ id, name }) => ({ id, name })));
    }
    void loadInvoice();
  }, [params.id]);

  const totals = useMemo(() => {
    if (!invoice) return { totalHt: 0, totalTva: 0, totalTtc: 0 };
    const totalHt = invoice.quantity * invoice.unitPrice;
    const totalTva = invoice.hasTva ? totalHt * 0.18 : 0;
    return { totalHt, totalTva, totalTtc: totalHt + totalTva };
  }, [invoice]);

  if (!invoice) {
    return (
      <main className="min-h-screen bg-[#f5f4f0] px-5 py-6 sm:px-8 lg:ml-[248px] lg:px-12 lg:py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#e4e3dd] bg-[#fbfaf7] p-10 text-center text-sm text-[#6f7885]">
          Facture introuvable.
        </div>
      </main>
    );
  }

  const updateField = <K extends keyof InvoiceRecord>(key: K, value: InvoiceRecord[K]) => {
    setInvoice((current) => (current ? { ...current, [key]: value } : current));
  };

  const handleSave = async () => {
    await updateInvoice({ ...invoice, totalHt: totals.totalHt, totalTva: totals.totalTva, totalTtc: totals.totalTtc });
    router.push("/invoices");
  };

  const moveToNextStatus = () => {
    const nextStatus = getNextInvoiceStatus(invoice.status);
    updateField("status", nextStatus);
  };

  return (
    <main className="min-h-screen bg-[#f5f4f0] px-4 py-5 pb-24 sm:px-8 lg:ml-[248px] lg:px-12 lg:py-10 lg:pb-10">
      <div className="mx-auto max-w-5xl">
        <Link className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-[#6f7885] hover:text-[#172238]" href="/invoices">
          <ArrowLeft size={17} /> Retour aux factures
        </Link>

        <div className="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#e8712b]">Détail facture</p>
            <h1 className="font-[var(--font-space-grotesk)] text-2xl font-bold tracking-tight sm:text-3xl">{invoice.number}</h1>
          </div>
          <div className="rounded-full border border-[#e4e3dd] bg-[#fbfaf7] px-3 py-2 text-sm font-semibold text-[#172238]">
            {invoice.status}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="rounded-2xl border border-[#e4e3dd] bg-[#fbfaf7] p-5 sm:p-7">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-semibold">Client</span>
                <select
                  className="w-full rounded-xl border border-[#d9d8d1] bg-white px-4 py-3 text-sm outline-none focus:border-[#e8712b]"
                  value={invoice.client}
                  onChange={(event) => updateField("client", event.target.value)}
                >
                  {clients.map((client) => (
                    <option key={client.id} value={client.name}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Début</span>
                <input
                  className="w-full rounded-xl border border-[#d9d8d1] bg-white px-4 py-3 text-sm outline-none focus:border-[#e8712b]"
                  type="date"
                  value={invoice.periodStart}
                  onChange={(event) => updateField("periodStart", event.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Fin</span>
                <input
                  className="w-full rounded-xl border border-[#d9d8d1] bg-white px-4 py-3 text-sm outline-none focus:border-[#e8712b]"
                  type="date"
                  value={invoice.periodEnd}
                  onChange={(event) => updateField("periodEnd", event.target.value)}
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-semibold">Échéance de paiement</span>
                <input
                  className="w-full rounded-xl border border-[#d9d8d1] bg-white px-4 py-3 text-sm outline-none focus:border-[#e8712b]"
                  type="date"
                  value={getInvoiceDueDate(invoice)}
                  onChange={(event) => updateField("dueDate", event.target.value)}
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-semibold">Désignation</span>
                <input
                  className="w-full rounded-xl border border-[#d9d8d1] bg-white px-4 py-3 text-sm outline-none focus:border-[#e8712b]"
                  value={invoice.designation}
                  onChange={(event) => updateField("designation", event.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Quantité</span>
                <input
                  className="w-full rounded-xl border border-[#d9d8d1] bg-white px-4 py-3 text-sm outline-none focus:border-[#e8712b]"
                  type="number"
                  value={invoice.quantity}
                  onChange={(event) => updateField("quantity", Number(event.target.value))}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Prix unitaire</span>
                <input
                  className="w-full rounded-xl border border-[#d9d8d1] bg-white px-4 py-3 text-sm outline-none focus:border-[#e8712b]"
                  type="number"
                  value={invoice.unitPrice}
                  onChange={(event) => updateField("unitPrice", Number(event.target.value))}
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-[#e4e3dd] bg-white p-4 sm:col-span-2">
                <span>
                  <span className="block text-sm font-semibold">TVA</span>
                  <span className="mt-1 block text-xs text-[#6f7885]">Appliquer 18% au prix unitaire</span>
                </span>
                <input
                  checked={invoice.hasTva}
                  className="h-5 w-5 accent-[#e8712b]"
                  type="checkbox"
                  onChange={(event) => updateField("hasTva", event.target.checked)}
                />
              </label>

              <div className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-semibold">Statut</span>
                <div className="grid gap-2 sm:grid-cols-3">
                  {invoiceStatusOrder.map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                        invoice.status === status
                          ? invoiceStatusMeta[status].accent
                          : "border-[#e4e3dd] bg-white text-[#172238] hover:border-[#d9d8d1]"
                      }`}
                      onClick={() => updateField("status", status)}
                    >
                      <div className="font-semibold">{invoiceStatusMeta[status].label}</div>
                      <div className="mt-1 text-[11px] opacity-80">{invoiceStatusMeta[status].description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <aside className="h-fit rounded-2xl bg-[#172238] p-5 text-white sm:p-7 lg:sticky lg:top-8">
            <div className="mb-8 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e8712b]/15 text-[#e8712b]">
                <FileText size={20} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-white/50">Aperçu total</p>
                <p className="font-[var(--font-space-grotesk)] text-lg font-bold">{invoice.number}</p>
              </div>
            </div>

            <div className="space-y-4 border-b border-white/10 pb-6 text-sm">
              <div className="flex justify-between text-white/65">
                <span>Client</span>
                <span className="font-semibold text-white">{invoice.client}</span>
              </div>
              <div className="flex justify-between text-white/65">
                <span>Quantité</span>
                <span className="font-semibold text-white">{invoice.quantity.toLocaleString("fr-FR")}</span>
              </div>
              <div className="flex justify-between text-white/65">
                <span>Prix unitaire</span>
                <span className="font-semibold text-white">{formatCfa(invoice.unitPrice)}</span>
              </div>
            </div>

            <div className="space-y-3 py-6 text-sm">
              <div className="flex justify-between text-white/65">
                <span>Total HT</span>
                <span className="font-semibold text-white">{formatCfa(totals.totalHt)}</span>
              </div>
              {invoice.hasTva && (
                <div className="flex justify-between text-white/65">
                  <span>TVA (18%)</span>
                  <span className="font-semibold text-white">{formatCfa(totals.totalTva)}</span>
                </div>
              )}
            </div>

            <div className="rounded-xl bg-[#e8712b] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">Total TTC</p>
              <p className="mt-2 font-[var(--font-space-grotesk)] text-2xl font-bold">{formatCfa(totals.totalTtc)}</p>
            </div>

            <button
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
              type="button"
              onClick={moveToNextStatus}
            >
              Passer au statut {invoiceStatusMeta[getNextInvoiceStatus(invoice.status)].label}
            </button>

            <button
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#e8712b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#d86322]"
              type="button"
              onClick={handleSave}
            >
              <Save size={17} /> Enregistrer les modifications
            </button>
          </aside>
        </div>
      </div>
      <MobileNav />
    </main>
  );
}
