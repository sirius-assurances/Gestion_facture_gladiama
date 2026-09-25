"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Bell, ChevronRight, CircleDollarSign, Clock3, FileText, Home as HomeIcon, Menu, Plus, TrendingUp, Users, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import MobileNav from "@/components/layout/mobile-nav";
import { getDashboardMetrics, type DashboardMetrics } from "@/app/actions/billing";
import { invoiceStatusStyles } from "@/lib/invoice-storage";
import { formatCfa } from "@/lib/format";

const emptyMetrics: DashboardMetrics = {
  totalRevenue: 0,
  paidRevenue: 0,
  sentRevenue: 0,
  draftRevenue: 0,
  pendingRevenue: 0,
  paidCount: 0,
  pendingCount: 0,
  totalCount: 0,
  paymentRate: 0,
  monthInvoiceCount: 0,
  monthRevenue: 0,
  clientsCount: 0,
  overdueCount: 0,
  overdueRevenue: 0,
  overdueInvoices: [],
  dueSoonCount: 0,
  recentInvoices: [],
};

export default function Home() {
  const [metrics, setMetrics] = useState<DashboardMetrics>(emptyMetrics);

  useEffect(() => {
    void getDashboardMetrics().then(setMetrics);
  }, []);

  const summaryCards = [
    {
      label: "Chiffre d’affaires",
      value: formatCfa(metrics.totalRevenue),
      helper: `${metrics.paidCount} facture(s) payées`,
      accent: "bg-[#172238] text-white",
      icon: Wallet,
      trend: "+12,5%",
      trendTone: "text-[#78c89b]",
    },
    {
      label: "Factures du mois",
      value: String(metrics.monthInvoiceCount),
      helper: metrics.monthRevenue > 0 ? formatCfa(metrics.monthRevenue) : "Aucune facture",
      accent: "border border-[#e4e3dd] bg-[#fbfaf7] text-[#172238]",
      icon: FileText,
      trend: `${metrics.paymentRate}% payées`,
      trendTone: "text-[#6f7885]",
    },
    {
      label: "À recevoir",
      value: formatCfa(metrics.pendingRevenue),
      helper: `${metrics.pendingCount} en attente`,
      accent: "border border-[#e4e3dd] bg-[#fbfaf7] text-[#172238]",
      icon: ArrowUpRight,
      trend: `${metrics.sentRevenue > 0 ? "encours" : "à l’étude"}`,
      trendTone: "text-[#a95b16]",
    },
    {
      label: "Taux de paiement",
      value: `${metrics.paymentRate}%`,
      helper: `${metrics.clientsCount} clients actifs`,
      accent: "border border-[#e4e3dd] bg-[#fbfaf7] text-[#172238]",
      icon: TrendingUp,
      trend: `${metrics.paidRevenue > 0 ? formatCfa(metrics.paidRevenue) : "0 FCFA"}`,
      trendTone: "text-[#21744d]",
    },
  ];

  const recentInvoices = metrics.recentInvoices;

  return (
    <div className="min-h-screen bg-[#f5f4f0] pb-24 lg:pb-0">
      <aside className="fixed inset-y-0 left-0 hidden w-[248px] flex-col bg-[#172238] px-7 py-8 text-white lg:flex">
        <div className="mb-16 flex items-center gap-3">
          <img alt="GLADIAMA SUARL" className="h-auto w-40 object-contain" src="/images/logo-gladiama.png" />
        </div>
        <nav className="space-y-2 text-sm">
          <Link className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 font-medium" href="/"><HomeIcon size={18} /> Accueil</Link>
          <Link className="flex items-center gap-3 rounded-xl px-4 py-3 text-white/60 hover:bg-white/10 hover:text-white" href="/invoices"><FileText size={18} /> Factures</Link>
          <Link className="flex items-center gap-3 rounded-xl px-4 py-3 text-white/60 hover:bg-white/10 hover:text-white" href="/clients"><Users size={18} /> Clients</Link>
        </nav>
      </aside>

      <main className="mx-auto max-w-[1440px] px-5 py-5 sm:px-8 lg:ml-[248px] lg:px-12 lg:py-10">
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3 lg:hidden"><Link aria-label="Ouvrir les clients" className="rounded-lg p-2 hover:bg-white" href="/clients"><Menu size={22} /></Link><img alt="GLADIAMA SUARL" className="h-auto w-32 object-contain" src="/images/logo-gladiama.png" /></div>
          <div className="hidden lg:block"><p className="text-sm font-medium text-[#6f7885]">{new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}</p><h1 className="mt-1 font-[var(--font-space-grotesk)] text-3xl font-bold tracking-tight">Bonjour, Abdoulaye</h1></div>
          <div className="flex items-center gap-3"><Link aria-label="Voir les factures" className="rounded-full border border-[#e4e3dd] bg-white p-2.5" href="/invoices"><Bell size={18} /></Link><div className="grid h-10 w-10 place-items-center rounded-full bg-[#e8712b] font-bold text-white">AD</div></div>
        </header>
        <div className="mb-8 lg:hidden"><p className="text-sm text-[#6f7885]">{new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}</p><h1 className="mt-1 font-[var(--font-space-grotesk)] text-2xl font-bold">Bonjour, Abdoulaye</h1></div>

        <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map(({ label, value, helper, accent, icon: Icon, trend, trendTone }) => (
            <div className={`relative overflow-hidden rounded-2xl p-5 shadow-[0_8px_28px_rgba(23,34,56,0.04)] sm:p-6 ${accent}`} key={label}>
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/5" />
              <div className="relative mb-6 flex items-center justify-between">
                <span className={`text-sm ${accent.includes("bg-[#172238]") ? "text-white/65" : "text-[#6f7885]"}`}>{label}</span>
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e8712b]/10"><Icon size={18} className="text-[#e8712b]" /></span>
              </div>
              <p className="relative font-[var(--font-space-grotesk)] text-2xl font-bold">{value}</p>
              <p className={`relative mt-2 text-xs ${trendTone}`}>{trend} <span className={accent.includes("bg-[#172238]") ? "text-white/45" : "text-[#6f7885]"}>· {helper}</span></p>
            </div>
          ))}
        </section>

        <section className="mb-10 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className={`rounded-2xl border p-5 sm:p-6 ${metrics.overdueCount ? "border-[#f1caca] bg-[#fff8f7]" : "border-[#bfe7d2] bg-[#f5fcf8]"}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${metrics.overdueCount ? "bg-[#c13a3a]/10 text-[#c13a3a]" : "bg-[#21744d]/10 text-[#21744d]"}`}>
                  {metrics.overdueCount ? <AlertTriangle size={19} /> : <CircleDollarSign size={19} />}
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9ba1a7]">Surveillance des encaissements</p>
                  <h2 className="mt-1 font-[var(--font-space-grotesk)] text-xl font-bold">{metrics.overdueCount ? `${metrics.overdueCount} paiement(s) en retard` : "Aucun paiement en retard"}</h2>
                  <p className="mt-2 text-sm text-[#6f7885]">{metrics.overdueCount ? `${formatCfa(metrics.overdueRevenue)} nécessitent votre attention.` : "Votre portefeuille client est à jour pour le moment."}</p>
                </div>
              </div>
              <span className={`hidden rounded-full px-3 py-1 text-xs font-bold sm:inline-flex ${metrics.overdueCount ? "bg-[#c13a3a]/10 text-[#c13a3a]" : "bg-[#21744d]/10 text-[#21744d]"}`}>{metrics.overdueCount ? "Action requise" : "À jour"}</span>
            </div>
            {metrics.overdueCount > 0 && (
              <div className="mt-5 space-y-2 border-t border-[#f1caca] pt-4">
                {metrics.overdueInvoices.map((invoice) => (
                  <Link className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-3 text-sm transition hover:bg-white" href={`/invoices/${invoice.id}`} key={invoice.id}>
                    <span><span className="font-semibold">{invoice.number}</span><span className="ml-2 text-[#6f7885]">{invoice.client}</span></span>
                    <span className="shrink-0 font-semibold text-[#c13a3a]">{formatCfa(invoice.totalTtc)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-[#172238] p-5 text-white shadow-[0_12px_30px_rgba(23,34,56,0.12)] sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Prochaines échéances</p><h2 className="mt-1 font-[var(--font-space-grotesk)] text-xl font-bold">À surveiller</h2></div>
              <Clock3 className="text-[#e8712b]" size={21} />
            </div>
            <div className="mt-5 flex items-end justify-between"><p className="font-[var(--font-space-grotesk)] text-3xl font-bold">{metrics.dueSoonCount}</p><p className="text-right text-xs text-white/50">dans les<br />7 prochains jours</p></div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#e8712b]" style={{ width: `${Math.min(100, metrics.dueSoonCount * 25)}%` }} /></div>
            <p className="mt-3 text-xs text-white/50">{metrics.pendingRevenue ? `${formatCfa(metrics.pendingRevenue)} encore à recouvrer` : "Aucun encours à recouvrer"}</p>
          </div>
        </section>

        <section className="flex items-end justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#e8712b]">Votre activité</p>
            <h2 className="font-[var(--font-space-grotesk)] text-2xl font-bold">Factures récentes</h2>
          </div>
          <Link className="hidden items-center gap-1 text-sm font-semibold text-[#e8712b] sm:flex" href="/invoices">Voir toutes <ChevronRight size={16} /></Link>
        </section>

        <section className="mt-5 overflow-hidden rounded-2xl border border-[#e4e3dd] bg-[#fbfaf7]">
          <div className="hidden grid-cols-[1fr_1.2fr_1fr_1fr_auto] gap-4 border-b border-[#e4e3dd] px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9ba1a7] md:grid">
            <span>Facture</span>
            <span>Client</span>
            <span>Date</span>
            <span>Montant</span>
            <span>Statut</span>
          </div>
          {recentInvoices.map((invoice) => (
            <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-[#e4e3dd] px-4 py-4 last:border-0 sm:px-6 md:grid-cols-[1fr_1.2fr_1fr_1fr_auto] md:gap-4" key={invoice.id}>
              <div>
                <p className="font-semibold">{invoice.number}</p>
                <p className="text-xs text-[#6f7885] md:hidden">{invoice.date}</p>
              </div>
              <p className="text-sm font-medium">{invoice.client}</p>
              <p className="hidden text-sm text-[#6f7885] md:block">{invoice.date}</p>
              <p className="hidden text-sm font-semibold md:block">{formatCfa(invoice.totalTtc)}</p>
              <div className="text-right md:text-left">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${invoiceStatusStyles[invoice.status]}`}>{invoice.status}</span>
                <p className="mt-1 text-xs font-semibold md:hidden">{formatCfa(invoice.totalTtc)}</p>
              </div>
            </div>
          ))}
        </section>

        {recentInvoices.length === 0 && (
          <div className="mt-5 rounded-2xl border border-dashed border-[#d9d8d1] bg-[#fbfaf7] p-10 text-center text-sm text-[#6f7885]">
            Aucune facture enregistrée pour le moment.
          </div>
        )}

        <Link className="mt-4 flex items-center justify-center gap-1 text-sm font-semibold text-[#e8712b] sm:hidden" href="/invoices">Voir toutes les factures <ChevronRight size={16} /></Link>
      </main>
      <Link aria-label="Créer une nouvelle facture" className="fixed bottom-20 right-5 grid h-14 w-14 place-items-center rounded-full bg-[#e8712b] text-white shadow-[0_12px_30px_rgba(232,113,43,0.35)] transition-transform hover:scale-105 lg:bottom-10 lg:right-10" href="/invoices/new"><Plus size={25} /></Link>
      <MobileNav />
    </div>
  );
}
