import { readFile } from "node:fs/promises";
import path from "node:path";
import { INVOICE_IMAGE_FILES, renderInvoice, type InvoiceImages, type InvoicePdfData } from "@/lib/pdf/generator";

/**
 * Server-side PDF generation. The drawing itself is shared with the browser
 * (renderInvoice); only the assets load differently — read off disk here
 * rather than fetched, since there is no origin to fetch from.
 *
 * This exists so that producing an invoice PDF never depends on someone
 * having opened it in a browser first: a scheduled reminder at 6am has no
 * browser, and neither does an automatic send.
 *
 * Node only. Importing this from a client component pulls in node:fs and
 * fails the build, which is the intended signal.
 */
const IMAGE_DIR = path.join(process.cwd(), "public", "images");

async function readImage(file: string): Promise<string | null> {
  try {
    const bytes = await readFile(path.join(IMAGE_DIR, file));
    return `data:image/png;base64,${bytes.toString("base64")}`;
  } catch {
    // Matches the browser loader: a missing asset degrades to the drawn
    // text fallback rather than failing the whole invoice.
    return null;
  }
}

// Static assets read once per server instance rather than on every invoice.
let cachedImages: Promise<InvoiceImages> | null = null;

function loadImages(): Promise<InvoiceImages> {
  cachedImages ??= Promise.all([
    readImage(INVOICE_IMAGE_FILES.header),
    readImage(INVOICE_IMAGE_FILES.stamp),
    readImage(INVOICE_IMAGE_FILES.footer),
  ]).then(([header, stamp, footer]) => ({ header, stamp, footer }));
  return cachedImages;
}

/** The finished PDF, ready to upload to Storage or attach to an email. */
export async function generateInvoicePdfBuffer(data: InvoicePdfData): Promise<Buffer> {
  const doc = renderInvoice(data, await loadImages());
  return Buffer.from(doc.output("arraybuffer"));
}
