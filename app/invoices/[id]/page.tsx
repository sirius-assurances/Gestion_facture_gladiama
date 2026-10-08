"use client";

import Link from "next/link";
import { ArrowLeft, Download, Eye, FileText, Mail, MessageCircle, Save } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  generateAndStoreInvoicePdf,
  getClients,
  getInvoice,
  getInvoicePdfUrl,
  updateInvoice,
  updateInvoiceStatus as updateInvoiceStatusInDatabase,
} from "@/app/actions/billing";
import {
  getNextInvoiceStatus,
  getInvoiceDueDate,
  invoiceStatusMeta,
  invoiceStatusOrder,
  INVOICE_ISSUED_MESSAGE,
  isInvoiceIssued,
  type ClientRecord,
  type InvoiceRecord,
  type InvoiceStatus,
} from "@/lib/invoice";
import { computeInvoiceTotals, TVA_RATE_PERCENT } from "@/lib/invoice-totals";
import { formatCfa, formatFrenchDate } from "@/lib/format";
import { openWhatsAppFallback, sharePDF } from "@/lib/share";
import EmailDialog from "@/components/invoices/email-dialog";

export default function InvoiceDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [pdfPending, setPdfPending] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);

  useEffect(() => {
    async function loadInvoice() {
      const [found, storedClients] = await Promise.all([getInvoice(params.id as string), getClients()]);
      setInvoice(found);
      setClients(storedClients);
    }
    void loadInvoice();
  }, [params.id]);

  const totals = useMemo(
    () =>
      invoice
        ? computeInvoiceTotals(invoice.quantity, invoice.unitPrice, invoice.hasTva)
        : { totalHt: 0, totalTva: 0, totalTtc: 0 },
    [invoice],
  );

  if (!invoice) {
    return (
      <main className="min-h-dvh bg-[#f5f4f0] px-5 py-6 sm:px-8 lg:px-12 lg:py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#e4e3dd] bg-[#fbfaf7] p-10 text-center text-sm text-[#6f7885]">
          Facture introuvable.
        </div>
      </main>
    );
  }

  const updateField = <K extends keyof InvoiceRecord>(key: K, value: InvoiceRecord[K]) => {
    setInvoice((current) => (current ? { ...current, [key]: value } : current));
  };

  // An invoice past "Brouillon" has gone to the client; its content is frozen
  // (see isInvoiceIssued).
  const issued = isInvoiceIssued(invoice.status);

  const handleSave = async () => {
    setActionError("");
    try {
      await updateInvoice({ ...invoice, totalHt: totals.totalHt, totalTva: totals.totalTva, totalTtc: totals.totalTtc });
    } catch (error) {
      // Carries the server's own wording, which explains how to unlock the
      // invoice — a generic "échec" would leave the user stuck.
      setActionError(error instanceof Error ? error.message : "Enregistrement impossible.");
      return;
    }
    router.push("/invoices");
  };

  const changeStatus = async (status: InvoiceStatus) => {
    setActionError("");
    try {
      await updateInvoiceStatusInDatabase(invoice.number, status);
      updateField("status", status);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Changement de statut impossible.");
    }
  };

  /**
   * The PDF comes from the server, built from the database.
   *
   * The browser used to generate it here and post it back base64-encoded
   * through a Server Action. That capped the payload at roughly 1MB, and —
   * worse — stored whatever was currently in the form, so an unsaved edit
   * could become the invoice's archived document while the database still
   * held the old figures. Asking the server removes both problems: what is
   * stored is always what the ledger says.
   *
   * For an invoice already issued, storeInvoicePdf declines to overwrite, so
   * this returns the archived document rather than a new rendering of it.
   */
  const getPdfUrl = async () => {
    await generateAndStoreInvoicePdf(invoice.id);
    const url = await getInvoicePdfUrl(invoice.id);
    if (!url) throw new Error("Le PDF de cette facture est introuvable.");
    setInvoice((current) => (current ? { ...current, hasStoredPdf: true } : current));
    return url;
  };

  // Saved through a same-origin blob: the download attribute is ignored on a
  // cross-origin URL, which would open the PDF in a viewer instead of saving
  // it under the invoice's own name.
  const saveBlob = (blob: Blob, fileName: string) => {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(objectUrl);
  };

  const handleDownloadPdf = async () => {
    setActionError("");
    setPdfPending(true);
    try {
      const blob = await (await fetch(await getPdfUrl())).blob();
      saveBlob(blob, `facture-${invoice.number.replace(/[^a-z0-9]/gi, "-")}.pdf`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Impossible de générer le PDF de cette facture.");
    } finally {
      setPdfPending(false);
    }
  };

  // Safari (desktop and iOS) only treats window.open() as user-initiated —
  // and skips its popup blocker — when it's called synchronously inside the
  // click handler. Any `await` beforehand loses that association and the tab
  // gets silently blocked. Opening a blank tab immediately, then pointing it
  // at the real URL once it's ready, keeps it inside the user-gesture window.
  //
  // The tab is never pointed at a local blob: URL either — Safari can't
  // resolve a blob created in the opener's context from another browsing
  // context, which renders as a blank white page. Chrome tolerates this;
  // Safari doesn't. A real https:// signed URL sidesteps it entirely.
  const handleViewPdf = async () => {
    setActionError("");
    const tab = window.open("", "_blank");
    try {
      const url = await getPdfUrl();
      if (!tab) return;
      tab.location.href = url;
    } catch {
      tab?.close();
      setActionError("Impossible d'ouvrir le PDF de cette facture.");
    }
  };

  // WhatsApp has no equivalent of an email attachment: the native share sheet
  // can carry the file, and where it can't, the PDF is downloaded and the
  // message prefilled so it can be attached by hand.
  const handleShare = async () => {
    setActionError("");
    const client = clients.find((item) => item.name === invoice.client);
    const fileName = `Facture_${invoice.number.replace(/[^a-z0-9]/gi, "_")}_${invoice.client.replace(/\s+/g, "_")}.pdf`;
    const totalFormatted = formatCfa(totals.totalTtc);

    let blob;
    try {
      blob = await (await fetch(await getPdfUrl())).blob();
    } catch {
      setActionError("Impossible de préparer le PDF à partager.");
      return;
    }

    const result = await sharePDF(
      blob,
      fileName,
      invoice.client,
      invoice.number,
      totalFormatted,
      formatFrenchDate(invoice.periodStart),
      formatFrenchDate(invoice.periodEnd),
    );
    if (result.success || result.method === "cancelled") return;

    saveBlob(blob, fileName);
    openWhatsAppFallback(fileName, invoice.client, invoice.number, totalFormatted, client?.phone);
    setShareNotice("PDF téléchargé. Attachez-le dans votre conversation.");
    window.setTimeout(() => setShareNotice(""), 5000);
  };

  const moveToNextStatus = () => changeStatus(getNextInvoiceStatus(invoice.status));

  return (
    <main className="min-h-dvh bg-[#f5f4f0] px-4 py-5 pb-24 sm:px-8 lg:px-12 lg:py-10 lg:pb-10">
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

        {(invoice.createdByEmail || invoice.updatedByEmail) && (
          <p className="mb-6 text-xs text-[#9ba1a7]">
            {invoice.createdByEmail && <>Créée par {invoice.createdByEmail}</>}
            {invoice.createdByEmail && invoice.updatedByEmail && invoice.updatedByEmail !== invoice.createdByEmail && (
              <> · Modifiée par {invoice.updatedByEmail}</>
            )}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="rounded-2xl border border-[#e4e3dd] bg-[#fbfaf7] p-5 sm:p-7">
            {issued && (
              <p className="mb-5 rounded-xl border border-[#e8712b]/30 bg-[#e8712b]/5 p-4 text-sm text-[#172238]">
                <span className="font-semibold">Facture émise, non modifiable.</span> Le client détient un document
                portant ce numéro et ces montants. Pour la corriger, repassez-la en brouillon : le document envoyé sera
                archivé avant toute nouvelle version.
              </p>
            )}

            {/* One disabled fieldset rather than a flag on each control: the
                browser disables every descendant, so a field added later is
                locked too instead of quietly staying editable. */}
            <fieldset className="disabled:opacity-60" disabled={issued}>
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
                  <span className="mt-1 block text-xs text-[#6f7885]">Appliquer {TVA_RATE_PERCENT}% au prix unitaire</span>
                </span>
                <input
                  checked={invoice.hasTva}
                  className="h-5 w-5 accent-[#e8712b]"
                  type="checkbox"
                  onChange={(event) => updateField("hasTva", event.target.checked)}
                />
              </label>

              </div>
            </fieldset>

            {/* Deliberately outside the disabled fieldset: changing the status
                is how an issued invoice is unlocked for correction, so locking
                it away with the rest would be a dead end. It also saves on the
                spot through its own action rather than the full update, which
                refuses issued invoices. */}
            <div className="mt-5 block sm:col-span-2">
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
                    onClick={() => changeStatus(status)}
                  >
                    <div className="font-semibold">{invoiceStatusMeta[status].label}</div>
                    <div className="mt-1 text-[11px] opacity-80">{invoiceStatusMeta[status].description}</div>
                  </button>
                ))}
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
                  <span>TVA ({TVA_RATE_PERCENT}%)</span>
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
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#e8712b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#d86322] disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={issued}
              title={issued ? INVOICE_ISSUED_MESSAGE : undefined}
              onClick={handleSave}
            >
              <Save size={17} /> Enregistrer les modifications
            </button>

            <button
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
              type="button"
              disabled={pdfPending}
              onClick={handleDownloadPdf}
            >
              <Download size={17} /> {pdfPending ? "Préparation…" : "Télécharger le PDF"}
            </button>


            <button
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
              type="button"
              onClick={handleViewPdf}
            >
              <Eye size={17} /> Visualiser la facture
            </button>

            <button
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1db954]"
              type="button"
              onClick={handleShare}
            >
              <MessageCircle size={17} /> WhatsApp
            </button>

            <button
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
              type="button"
              onClick={() => setEmailOpen(true)}
            >
              <Mail size={17} /> Email
            </button>

            {shareNotice && <p className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-center text-xs text-white/80">{shareNotice}</p>}
            {actionError && (
              <p className="mt-3 rounded-lg bg-[#c13a3a]/20 px-3 py-2 text-center text-xs font-semibold text-[#ffd9d9]">{actionError}</p>
            )}
          </aside>
        </div>
      </div>

      {emailOpen && (
        <EmailDialog
          invoiceId={invoice.id}
          invoiceNumber={invoice.number}
          isDraft={!issued}
          onClose={() => setEmailOpen(false)}
          onSent={(markedAsSent) => {
            setEmailOpen(false);
            setActionError("");
            setShareNotice(markedAsSent ? "Facture envoyée et marquée comme envoyée." : "Message envoyé.");
            if (markedAsSent) updateField("status", "Envoyée");
          }}
        />
      )}
    </main>
  );
}
