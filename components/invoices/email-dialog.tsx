"use client";

import { useEffect, useState } from "react";
import { Loader2, Paperclip, Send, X } from "lucide-react";
import { getInvoiceEmailDraft, sendInvoiceEmail, type InvoiceEmailDraft } from "@/app/actions/billing";
import { parseRecipients } from "@/lib/email/invoice-message";

type Props = {
  invoiceId: string;
  invoiceNumber: string;
  isDraft: boolean;
  onClose: () => void;
  onSent: (markedAsSent: boolean) => void;
};

const fieldClass =
  "w-full rounded-xl border border-[#d9d8d1] bg-white px-4 py-3 text-sm outline-none focus:border-[#e8712b] disabled:bg-[#f5f4f0] disabled:text-[#6f7885]";

/**
 * Review-before-send, rather than handing the message to a mail client.
 * mailto: cannot carry an attachment — that is a limit of the scheme itself,
 * not of the browser — so invoices used to go out with a line asking the
 * recipient to be sent the PDF separately. Composing here means the
 * attachment is real, and the user still sees exactly what will leave.
 */
export default function EmailDialog({ invoiceId, invoiceNumber, isDraft, onClose, onSent }: Props) {
  const [draft, setDraft] = useState<InvoiceEmailDraft | null>(null);
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [markAsSent, setMarkAsSent] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getInvoiceEmailDraft(invoiceId)
      .then((result) => {
        if (!active) return;
        setDraft(result);
        setTo(result.to);
        setCc(result.cc);
        setSubject(result.subject);
        setBody(result.body);
      })
      .catch((cause) => active && setError(cause instanceof Error ? cause.message : "Chargement impossible."));
    return () => {
      active = false;
    };
  }, [invoiceId]);

  // Esc closes, as every dialog does. Ignored mid-send so a stray keypress
  // cannot hide a send that is still in flight.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !sending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, sending]);

  const handleSend = async () => {
    setError("");
    setSending(true);
    try {
      await sendInvoiceEmail({
        invoiceId,
        to: to.trim(),
        cc: parseRecipients(cc),
        replyTo: replyTo.trim() || undefined,
        subject: subject.trim(),
        body: body.trim(),
        markAsSent: markAsSent && isDraft,
      });
      onSent(markAsSent && isDraft);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Envoi impossible.");
      setSending(false);
    }
  };

  const ccList = parseRecipients(cc);
  const ready = Boolean(draft?.configured) && to.trim().length > 0 && subject.trim().length > 0;

  return (
    <div
      aria-label={`Envoyer la facture ${invoiceNumber}`}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6"
      role="dialog"
    >
      <div className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-[#fbfaf7] p-5 shadow-xl sm:rounded-2xl sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e8712b]">Envoi par email</p>
            <h2 className="mt-1 text-xl font-semibold text-[#172238]">Facture {invoiceNumber}</h2>
          </div>
          <button aria-label="Fermer" className="rounded-full p-2 text-[#6f7885] hover:bg-[#e4e3dd]" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        {!draft && !error && (
          <p className="flex items-center gap-2 text-sm text-[#6f7885]">
            <Loader2 className="animate-spin" size={16} /> Préparation du message…
          </p>
        )}

        {draft && !draft.configured && (
          <p className="mb-5 rounded-xl border border-[#c13a3a]/30 bg-[#c13a3a]/5 p-4 text-sm text-[#172238]">
            <span className="font-semibold">Envoi non configuré.</span> Variables manquantes :{" "}
            <span className="font-mono text-xs">{draft.missing.join(", ")}</span>. Renseignez-les dans Vercel, puis
            rouvrez cette fenêtre.
          </p>
        )}

        {draft && (
          <div className="grid gap-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">De</span>
              {/* Read-only: a message may only claim an address its mail server
                  is authorised to send for. A free-text sender would be
                  rejected outright or filed as spam. */}
              <input className={fieldClass} disabled readOnly value={draft.from || "—"} />
              <span className="mt-1.5 block text-xs text-[#6f7885]">
                Défini par la configuration d’envoi, pas modifiable ici.
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold">À</span>
              <input
                className={fieldClass}
                onChange={(event) => setTo(event.target.value)}
                placeholder="client@exemple.com"
                type="email"
                value={to}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold">
                Cc <span className="font-normal text-[#6f7885]">(facultatif)</span>
              </span>
              <input
                className={fieldClass}
                onChange={(event) => setCc(event.target.value)}
                placeholder="une@adresse.com, une-autre@adresse.com"
                value={cc}
              />
              {cc.trim() && (
                <span className="mt-1.5 block text-xs text-[#6f7885]">
                  {ccList.length} adresse(s) retenue(s){ccList.length ? ` : ${ccList.join(", ")}` : ""}
                </span>
              )}
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold">
                Répondre à <span className="font-normal text-[#6f7885]">(facultatif)</span>
              </span>
              <input
                className={fieldClass}
                onChange={(event) => setReplyTo(event.target.value)}
                placeholder="Laisser vide pour utiliser l’expéditeur"
                type="email"
                value={replyTo}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Objet</span>
              <input className={fieldClass} onChange={(event) => setSubject(event.target.value)} value={subject} />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Message</span>
              <textarea
                className={`${fieldClass} min-h-44 resize-y`}
                onChange={(event) => setBody(event.target.value)}
                value={body}
              />
            </label>

            {/* Shown read-only: these figures are generated from the invoice
                itself, never typed, so an edited message cannot contradict the
                document attached to it. */}
            <div className="rounded-xl border border-[#e4e3dd] bg-white p-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e8712b]">
                Ajouté automatiquement au message
              </p>
              <dl className="grid gap-1.5">
                {draft.summary.map(([label, value]) => (
                  <div className="flex items-baseline justify-between gap-4 text-xs" key={label}>
                    <dt className="shrink-0 text-[#6f7885]">{label}</dt>
                    <dd className={`text-right text-[#172238] ${label === "Montant total" ? "font-semibold" : ""}`}>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 border-t border-[#e4e3dd] pt-3 text-[11px] text-[#9ba1a7]">
                Suivi des mentions légales (NINEA, RC) et de la pièce jointe.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-[#e4e3dd] bg-white px-4 py-3 text-sm">
              <Paperclip className="shrink-0 text-[#6f7885]" size={16} />
              <span className="truncate font-medium text-[#172238]">{draft.attachmentName}</span>
              <span className="ml-auto shrink-0 text-xs text-[#6f7885]">PDF</span>
            </div>

            {isDraft && (
              <label className="flex items-center justify-between gap-4 rounded-xl border border-[#e4e3dd] bg-white p-4">
                <span>
                  <span className="block text-sm font-semibold">Marquer comme envoyée</span>
                  <span className="mt-1 block text-xs text-[#6f7885]">
                    Décochez pour un essai : la facture restera en brouillon.
                  </span>
                </span>
                <input
                  checked={markAsSent}
                  className="h-5 w-5 shrink-0 accent-[#e8712b]"
                  onChange={(event) => setMarkAsSent(event.target.checked)}
                  type="checkbox"
                />
              </label>
            )}
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-[#c13a3a]/30 bg-[#c13a3a]/5 p-4 text-sm text-[#c13a3a]">{error}</p>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            className="rounded-xl border border-[#e4e3dd] bg-white px-5 py-3 text-sm font-semibold text-[#172238] hover:border-[#d9d8d1] disabled:opacity-50"
            disabled={sending}
            onClick={onClose}
            type="button"
          >
            Annuler
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#e8712b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#d86322] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!ready || sending}
            onClick={handleSend}
            type="button"
          >
            {sending ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}
            {sending ? "Envoi en cours…" : "Envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}
