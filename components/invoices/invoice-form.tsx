"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, FileText, Mail, MessageCircle, Save } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { createInvoice, getClients, getInvoices } from "@/app/actions/billing";
import type { ClientRecord } from "@/lib/invoice-storage";
import { downloadInvoicePdf, generateInvoiceDocument, type InvoicePdfData } from "@/lib/pdf/generator";
import { openEmailFallback, openWhatsAppFallback, sharePDF } from "@/lib/share";

const formatCfa = (value: number) => `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} FCFA`;
const formatDate = (value: string) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00`)).replace(/(^|\s)([a-z])/g, (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);

export default function InvoiceForm() {
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [clientName, setClientName] = useState("");
  const [quantity, setQuantity] = useState(4050);
  const [unitPrice, setUnitPrice] = useState(600);
  const [hasTva, setHasTva] = useState(false);
  const [designation, setDesignation] = useState("Fourniture latérite crue");
  const [periodStart, setPeriodStart] = useState("2026-09-01");
  const [periodEnd, setPeriodEnd] = useState("2026-09-17");
  const [dueDate, setDueDate] = useState("2026-10-17");
  const [saved, setSaved] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const [invoiceCount, setInvoiceCount] = useState(0);

  useEffect(() => {
    async function loadForm() {
      const [storedClients, storedInvoices] = await Promise.all([getClients(), getInvoices()]);
      setClients(storedClients);
      setInvoiceCount(storedInvoices.length);
      const preferredClientId = searchParams.get("client");
      const initialClient = storedClients.find((client) => client.id === preferredClientId) ?? storedClients[0];

      if (initialClient) {
        setClientName(initialClient.name);
        setUnitPrice(initialClient.defaultUnitPrice);
        setHasTva(initialClient.hasTva);
      }
    }
    void loadForm();
  }, [searchParams]);

  const totals = useMemo(() => {
    const totalHt = Math.max(0, quantity) * Math.max(0, unitPrice);
    const totalTva = hasTva ? totalHt * 0.18 : 0;
    return { totalHt, totalTva, totalTtc: totalHt + totalTva };
  }, [hasTva, quantity, unitPrice]);

  function handleClientChange(name: string) {
    const client = clients.find((item) => item.name === name);
    setClientName(name);
    if (client) {
      setUnitPrice(client.defaultUnitPrice);
      setHasTva(client.hasTva);
    }
  }

  function getPdfData(): InvoicePdfData {
    const client = clients.find((item) => item.name === clientName);
    return {
      invoiceNumber: `N°${invoiceCount + 1}`,
      clientName,
      clientLocation: client?.location ?? "Dakar, Sénégal",
      projectName: client?.projectName,
      marketNumber: "Marché N°TA3/1087/AGR",
      contractNumber: "Contrat T0032/24",
      periodStart: formatDate(periodStart),
      periodEnd: formatDate(periodEnd),
      designation,
      quantity,
      unitPrice,
      hasTva,
      totalHt: totals.totalHt,
      totalTva: totals.totalTva,
      totalTtc: totals.totalTtc,
    };
  }

  async function handleSave() {
    const invoice = {
      client: clientName,
      clientId: clients.find((client) => client.name === clientName)?.id,
      periodStart,
      periodEnd,
      dueDate,
      designation,
      quantity,
      unitPrice,
      hasTva,
      totalHt: totals.totalHt,
      totalTva: totals.totalTva,
      totalTtc: totals.totalTtc,
      status: "Brouillon" as const,
    };
    const next = await createInvoice(invoice);
    setInvoiceCount(next.length);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  async function handleShare(channel: "whatsapp" | "email") {
    const data = getPdfData();
    const client = clients.find((item) => item.name === clientName);
    const invoiceNumber = data.invoiceNumber;
    const fileName = `Facture_${invoiceNumber.replace(/[^a-z0-9]/gi, "_")}_${clientName.replace(/\s+/g, "_")}.pdf`;
    const totalFormatted = formatCfa(totals.totalTtc);
    const doc = await generateInvoiceDocument(data);
    const result = await sharePDF(doc.output("blob"), fileName, clientName, invoiceNumber, totalFormatted, data.periodStart, data.periodEnd);
    if (result.success || result.method === "cancelled") return;
    doc.save(fileName);
    if (channel === "whatsapp") openWhatsAppFallback(fileName, clientName, invoiceNumber, totalFormatted, client?.phone);
    else openEmailFallback(fileName, clientName, invoiceNumber, totalFormatted, data.periodStart, data.periodEnd, client?.email);
    setShareNotice("PDF téléchargé. Attachez-le dans votre conversation.");
    window.setTimeout(() => setShareNotice(""), 5000);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
      <section className="rounded-2xl border border-[#e4e3dd] bg-[#fbfaf7] p-5 sm:p-7">
        <div className="mb-7 flex items-center justify-between border-b border-[#e4e3dd] pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9ba1a7]">Étape 1</p>
            <h2 className="mt-1 font-[var(--font-space-grotesk)] text-xl font-bold">Client et période</h2>
          </div>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#fff1df] text-sm font-bold text-[#e8712b]">1</span>
        </div>

        <div className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Client</span>
            <span className="relative block">
              <select className="w-full appearance-none rounded-xl border border-[#d9d8d1] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#e8712b]" value={clientName} onChange={(event) => handleClientChange(event.target.value)}>
                {clients.map((client) => (
                  <option key={client.id}>{client.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-3.5 text-[#6f7885]" size={18} />
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Début de période</span>
              <input className="w-full rounded-xl border border-[#d9d8d1] bg-white px-4 py-3 text-sm outline-none focus:border-[#e8712b]" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Fin de période</span>
              <input className="w-full rounded-xl border border-[#d9d8d1] bg-white px-4 py-3 text-sm outline-none focus:border-[#e8712b]" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-semibold">Échéance de paiement</span>
              <input className="w-full rounded-xl border border-[#d9d8d1] bg-white px-4 py-3 text-sm outline-none focus:border-[#e8712b]" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              <span className="mt-2 block text-xs text-[#6f7885]">Cette date alimente les alertes de paiement en retard.</span>
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Désignation</span>
            <input className="w-full rounded-xl border border-[#d9d8d1] bg-white px-4 py-3 text-sm outline-none focus:border-[#e8712b]" value={designation} onChange={(event) => setDesignation(event.target.value)} />
          </label>
        </div>

        <div className="mb-7 mt-10 flex items-center justify-between border-b border-[#e4e3dd] pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9ba1a7]">Étape 2</p>
            <h2 className="mt-1 font-[var(--font-space-grotesk)] text-xl font-bold">Détails de la fourniture</h2>
          </div>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#fff1df] text-sm font-bold text-[#e8712b]">2</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Quantité <span className="font-normal text-[#6f7885]">(m³)</span></span>
            <input className="w-full rounded-xl border border-[#d9d8d1] bg-white px-4 py-3 text-sm outline-none focus:border-[#e8712b]" min="0" type="number" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Prix unitaire <span className="font-normal text-[#6f7885]">(FCFA)</span></span>
            <input className="w-full rounded-xl border border-[#d9d8d1] bg-white px-4 py-3 text-sm outline-none focus:border-[#e8712b]" min="0" type="number" value={unitPrice} onChange={(event) => setUnitPrice(Number(event.target.value))} />
          </label>

          <div>
            <span className="mb-2 block text-sm font-semibold">Unité</span>
            <div className="rounded-xl border border-[#d9d8d1] bg-[#f5f4f0] px-4 py-3 text-sm text-[#6f7885]">m³</div>
          </div>
        </div>

        <label className="mt-7 flex cursor-pointer items-center justify-between rounded-xl border border-[#e4e3dd] bg-white p-4">
          <span>
            <span className="block text-sm font-semibold">Appliquer la TVA</span>
            <span className="mt-1 block text-xs text-[#6f7885]">TVA applicable au taux de 18%</span>
          </span>
          <input checked={hasTva} className="h-5 w-5 accent-[#e8712b]" type="checkbox" onChange={(event) => setHasTva(event.target.checked)} />
        </label>

        <button
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#172238] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#263957]"
          type="button"
          onClick={handleSave}
        >
          {saved ? (
            <>
              <Check size={18} /> Brouillon enregistré
            </>
          ) : (
            <>
              <Save size={18} /> Enregistrer le brouillon
            </>
          )}
        </button>
      </section>

      <aside className="h-fit rounded-2xl bg-[#172238] p-5 text-white sm:p-7 lg:sticky lg:top-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e8712b]/15 text-[#e8712b]">
            <FileText size={20} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-white/50">Aperçu total</p>
            <p className="font-[var(--font-space-grotesk)] text-lg font-bold">Facture N°{invoiceCount + 1}</p>
          </div>
        </div>

        <div className="space-y-4 border-b border-white/10 pb-6 text-sm">
          <div className="flex justify-between text-white/65">
            <span>Client</span>
            <span className="font-semibold text-white">{clientName}</span>
          </div>
          <div className="flex justify-between text-white/65">
            <span>Fourniture</span>
            <span className="font-semibold text-white">{quantity.toLocaleString("fr-FR")} m³</span>
          </div>
          <div className="flex justify-between text-white/65">
            <span>Prix unitaire</span>
            <span className="font-semibold text-white">{formatCfa(unitPrice)}</span>
          </div>
        </div>

        <div className="space-y-3 py-6 text-sm">
          <div className="flex justify-between text-white/65">
            <span>Total HT</span>
            <span className="font-semibold text-white">{formatCfa(totals.totalHt)}</span>
          </div>
          {hasTva && (
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

        <div className="mt-5 grid gap-2">
          <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#e8712b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#d86322]" type="button" onClick={() => downloadInvoicePdf(getPdfData())}>
            <FileText size={17} /> Télécharger PDF
          </button>
          <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1db954]" type="button" onClick={() => handleShare("whatsapp")}>
            <MessageCircle size={17} /> WhatsApp
          </button>
          <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10" type="button" onClick={() => handleShare("email")}>
            <Mail size={17} /> Email
          </button>
        </div>

        {shareNotice && <p className="mt-4 rounded-lg bg-white/10 px-3 py-2 text-center text-xs text-white/80">{shareNotice}</p>}
        <p className="mt-6 text-center text-xs leading-5 text-white/45">Le numéro de facture sera attribué automatiquement à l&apos;enregistrement.</p>
      </aside>
    </div>
  );
}
