export type ShareResult =
  | { success: true; method: "webshare" }
  | { success: false; method: "cancelled" | "unsupported" };

export async function sharePDF(
  pdfBlob: Blob,
  fileName: string,
  clientName: string,
  invoiceNumber: string,
  totalFormatted: string,
  periodStart: string,
  periodEnd: string,
): Promise<ShareResult> {
  const file = new File([pdfBlob], fileName, { type: "application/pdf" });
  const shareText = `Bonjour,\n\nVeuillez trouver ci-joint la Facture Définitive ${invoiceNumber} de GLADIAMA SUARL.\n\nClient : ${clientName}\nMontant : ${totalFormatted}\nPériode : du ${periodStart} au ${periodEnd}\n\nCordialement,\nLe Directeur Général\nGLADIAMA SUARL\nTél: +221 77 704 37 90`;

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title: `Facture ${invoiceNumber} - GLADIAMA SUARL`, text: shareText, files: [file] });
      return { success: true, method: "webshare" };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return { success: false, method: "cancelled" };
    }
  }

  return { success: false, method: "unsupported" };
}

export function openWhatsAppFallback(fileName: string, clientName: string, invoiceNumber: string, totalFormatted: string, phone?: string) {
  const message = encodeURIComponent(`Bonjour,\n\nVeuillez trouver la Facture ${invoiceNumber} de GLADIAMA SUARL.\nClient : ${clientName}\nMontant : ${totalFormatted}\n\nLe PDF ${fileName} a été téléchargé.\n\nCordialement,\nGLADIAMA SUARL`);
  const normalizedPhone = phone?.replace(/[^\d+]/g, "").replace(/^\+/, "");
  window.open(normalizedPhone ? `https://wa.me/${normalizedPhone}?text=${message}` : `https://wa.me/?text=${message}`, "_blank", "noopener,noreferrer");
}

export function openEmailFallback(fileName: string, clientName: string, invoiceNumber: string, totalFormatted: string, periodStart: string, periodEnd: string, email?: string) {
  const subject = encodeURIComponent(`Facture Définitive ${invoiceNumber} - GLADIAMA SUARL`);
  const body = encodeURIComponent(`Bonjour,\n\nVeuillez trouver la Facture Définitive ${invoiceNumber}.\n\nClient : ${clientName}\nMontant : ${totalFormatted}\nPériode : du ${periodStart} au ${periodEnd}\n\nLe PDF ${fileName} a été téléchargé. Veuillez le joindre à cet email.\n\nCordialement,\nLe Directeur Général\nGLADIAMA SUARL\nCité Soleil Dalifort Villa N°38\nTél: +221 77 704 37 90\nEmail: abdoulayedrame1@hotmail.com`);
  window.open(`mailto:${email ?? ""}?subject=${subject}&body=${body}`, "_blank");
}