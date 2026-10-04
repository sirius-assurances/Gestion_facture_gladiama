/** VAT rate applied to invoices, as a percentage. */
export const TVA_RATE_PERCENT = 18;

export type InvoiceTotals = {
  totalHt: number;
  totalTva: number;
  totalTtc: number;
};

/**
 * The one place invoice totals are derived. The formula previously lived in
 * three copies — the creation form, the detail screen and the server action
 * — and they had already drifted apart once over the VAT rate. The server
 * recomputes totals with this on every write, so the client copies are only
 * ever a preview of what will be stored.
 */
export function computeInvoiceTotals(quantity: number, unitPrice: number, hasTva: boolean): InvoiceTotals {
  const totalHt = Math.max(0, quantity) * Math.max(0, unitPrice);
  const totalTva = hasTva ? totalHt * (TVA_RATE_PERCENT / 100) : 0;
  return { totalHt, totalTva, totalTtc: totalHt + totalTva };
}
