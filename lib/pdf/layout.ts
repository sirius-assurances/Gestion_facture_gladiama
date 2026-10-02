export const TABLE_LEFT = 20;
export const TABLE_WIDTH = 170;
export const TABLE_RIGHT = TABLE_LEFT + TABLE_WIDTH;

export type InvoiceTableLayout = {
  headers: string[];
  /** Column boundaries: always one more entry than there are headers. */
  columns: number[];
  rowHeight: number;
  /** Header row + data row + the total row(s) below it. */
  rowCount: number;
};

// Boundaries are derived from widths rather than written out by hand. The
// hand-written list for the VAT layout used to be one entry short, so the
// last header resolved `columns[index + 1]` to undefined, its x coordinate
// became NaN, and jsPDF rejected the whole document — every invoice with
// VAT enabled failed to generate. Deriving them keeps the count in sync
// with the headers by construction.
export function getInvoiceTableLayout(hasTva: boolean): InvoiceTableLayout {
  const { headers, widths, rowHeight, rowCount } = hasTva
    ? {
        headers: ["DESIGNATION", "PRIX UNITAIRE", "QUANTITE", "TOTAL"],
        widths: [60, 45, 30, 35],
        rowHeight: 15,
        rowCount: 4,
      }
    : {
        headers: ["DESIGNATION", "QUANTITE", "PRIX M3", "TOTAL"],
        widths: [48, 38, 37, 47],
        rowHeight: 17,
        rowCount: 3,
      };

  const columns = widths.reduce<number[]>(
    (boundaries, width) => [...boundaries, boundaries[boundaries.length - 1] + width],
    [TABLE_LEFT],
  );

  return { headers, columns, rowHeight, rowCount };
}
