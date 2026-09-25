import jsPDF from "jspdf";
import { numberToFrenchWords } from "@/lib/pdf/number-to-words";
import { formatCfa, formatFrenchDate, formatGroupedNumber } from "@/lib/format";
import { TVA_RATE_PERCENT } from "@/lib/invoice-storage";

export type InvoicePdfData = {
  invoiceNumber: string;
  clientName: string;
  clientLocation: string;
  projectName?: string;
  marketNumber?: string;
  contractNumber?: string;
  periodStart: string;
  periodEnd: string;
  designation: string;
  quantity: number;
  unitPrice: number;
  hasTva: boolean;
  totalHt: number;
  totalTva: number;
  totalTtc: number;
};

const colors = {
  red: [211, 47, 47] as [number, number, number],
  navy: [27, 42, 74] as [number, number, number],
  orange: [232, 113, 43] as [number, number, number],
  yellow: [255, 215, 0] as [number, number, number],
};

function getCountry(location: string): string {
  return (location.includes(",") ? location.split(",").at(-1) ?? location : location).trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Invoice header/stamp/footer images are static assets, so their data-URL
// conversion is cached across PDF generations instead of being refetched
// and re-encoded on every invoice.
const imageCache = new Map<string, string>();

async function loadImage(path: string): Promise<string | null> {
  const cached = imageCache.get(path);
  if (cached) return cached;

  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    imageCache.set(path, dataUrl);
    return dataUrl;
  } catch {
    return null;
  }
}

export async function generateInvoiceDocument(data: InvoicePdfData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const [header, stamp, footer] = await Promise.all([
    loadImage("/images/logo-gladiama.png").then((image) => image ?? loadImage("/images/logo_entete_gladiama.png")).then((image) => image ?? loadImage("/images/Picture3.png")),
    loadImage("/images/cachet_gladiama.png").then((image) => image ?? loadImage("/images/Picture1.png")),
    loadImage("/images/pied_de_page_gladiama.png").then((image) => image ?? loadImage("/images/Picture2.png")),
  ]);

  if (header) doc.addImage(header, "PNG", 20, 15, 170, 26.7);
  else {
    doc.setTextColor(...colors.orange);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(25);
    doc.text("GLADIAMA", 20, 32);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.text("SUARL", 76, 32);
  }

  doc.setDrawColor(...colors.navy);
  doc.setLineWidth(1.2);
  doc.line(20, 47, 190, 47);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  const datePrefix = "Dakar le, ";
  doc.text(datePrefix, 20, 65);
  let dateX = 20 + doc.getTextWidth(datePrefix);
  const dateParts = formatFrenchDate(new Date()).split(" ");
  const dayMonth = `${dateParts[0]} ${dateParts[1]}`;
  doc.setTextColor(...colors.red);
  doc.text(dayMonth, dateX, 65);
  dateX += doc.getTextWidth(dayMonth);
  doc.setTextColor(0, 0, 0);
  doc.text(` ${dateParts[2]}`, dateX, 65);

  doc.setFont("times", "bolditalic");
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  const clientNameY = 80;
  const countryY = clientNameY + 6;
  doc.text(data.clientName.toUpperCase(), 190, clientNameY, { align: "right" });
  doc.text(getCountry(data.clientLocation).toUpperCase(), 190, countryY, { align: "right" });

  let lastClientLineY = countryY;
  if (data.projectName) {
    doc.setFontSize(11);
    doc.setTextColor(...colors.red);
    const country = getCountry(data.clientLocation);
    const details = [
      `${data.clientName} ${country}`,
      data.projectName,
      data.marketNumber,
      data.contractNumber,
    ].filter(Boolean) as string[];
    const projectStartY = countryY + 14;
    details.forEach((line, index) => doc.text(line.toUpperCase(), 190, projectStartY + index * 6, { align: "right" }));
    lastClientLineY = projectStartY + (details.length - 1) * 6;
  }

  const objetY = lastClientLineY + 15;
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("OBJET :", 20, objetY);
  const objetWidth = doc.getTextWidth("OBJET :");
  doc.line(20, objetY + 1, 20 + objetWidth, objetY + 1);
  doc.setFont("helvetica", "normal");
  const subject = ` FACTURE DEFINITIVE ${data.invoiceNumber} ${data.clientName} du ${data.periodStart} au ${data.periodEnd}`;
  doc.text(doc.splitTextToSize(subject, 170 - objetWidth), 20 + objetWidth, objetY);

  const tableY = objetY + 13;
  const columns = data.hasTva ? [20, 91, 135, 190] : [20, 68, 106, 143, 190];
  const rowHeight = data.hasTva ? 15 : 17;
  const headers = data.hasTva ? ["DESIGNATION", "PRIX UNITAIRE", "QUANTITE", "TOTAL"] : ["DESIGNATION", "QUANTITE", "PRIX M3", "TOTAL"];
  doc.setFillColor(...colors.yellow);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(20, tableY, 170, rowHeight, "FD");
  headers.forEach((header, index) => {
    const center = (columns[index] + columns[index + 1]) / 2;
    doc.setTextColor(...colors.red);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(header, center, tableY + 9, { align: "center" });
    const headerWidth = doc.getTextWidth(header);
    doc.line(center - headerWidth / 2, tableY + 10, center + headerWidth / 2, tableY + 10);
    if (index > 0) doc.line(columns[index], tableY, columns[index], tableY + rowHeight);
  });

  const dataY = tableY + rowHeight;
  doc.setFillColor(255, 255, 255);
  doc.rect(20, dataY, 170, rowHeight, "FD");
  columns.slice(1, -1).forEach((column) => doc.line(column, dataY, column, dataY + rowHeight));
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (data.hasTva) {
    doc.text(data.designation, 23, dataY + 10);
    doc.text(formatCfa(data.unitPrice), (columns[1] + columns[2]) / 2, dataY + 10, { align: "center" });
    doc.text(`${formatGroupedNumber(data.quantity)} m³`, (columns[2] + columns[3]) / 2, dataY + 10, { align: "center" });
    doc.text(formatCfa(data.totalHt), 187, dataY + 10, { align: "right" });
  } else {
    doc.text(data.designation, 23, dataY + 10);
    doc.text(`${formatGroupedNumber(data.quantity)} m³`, (columns[1] + columns[2]) / 2, dataY + 10, { align: "center" });
    doc.text(formatCfa(data.unitPrice), (columns[2] + columns[3]) / 2, dataY + 10, { align: "center" });
    doc.text(formatCfa(data.totalHt), 187, dataY + 10, { align: "right" });
  }

  let totalY = dataY + rowHeight;
  if (data.hasTva) {
    [`TVA (${TVA_RATE_PERCENT}%)`, "TTC"].forEach((label, index) => {
      doc.rect(20, totalY, 170, rowHeight, "D");
      doc.text(label, 23, totalY + 10);
      doc.text(formatCfa(index === 0 ? data.totalTva : data.totalTtc), 187, totalY + 10, { align: "right" });
      totalY += rowHeight;
    });
  } else {
    doc.rect(20, totalY, 170, rowHeight, "D");
    doc.setFont("helvetica", "bold");
    doc.text("COUT TOTAL", 105, totalY + 10, { align: "center" });
    doc.text(formatCfa(data.totalHt), 187, totalY + 10, { align: "right" });
  }

  const tableRowCount = data.hasTva ? 4 : 3;
  const tableBottomY = tableY + tableRowCount * rowHeight;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  const amountWords = numberToFrenchWords(data.totalTtc);
  const amountPrefix = "« Soit Un Total De ";
  const amountWordsText = `${amountWords} Francs CFA `;
  const amountDigitsText = `${formatGroupedNumber(data.totalTtc)} FCFA`;
  const amountSuffix = "). »";
  const amountLine = `${amountPrefix}${amountWordsText}(${amountDigitsText}${amountSuffix}`;
  const amountLines = doc.splitTextToSize(amountLine, 170);
  const amountY = tableBottomY + 15;
  if (amountLines.length === 1) {
    let amountX = 20;
    doc.setFont("helvetica", "normal");
    doc.text(amountPrefix, amountX, amountY);
    amountX += doc.getTextWidth(amountPrefix);
    doc.setFont("helvetica", "bold");
    doc.text(amountWordsText, amountX, amountY);
    amountX += doc.getTextWidth(amountWordsText);
    doc.setFont("helvetica", "normal");
    doc.text("(", amountX, amountY);
    amountX += doc.getTextWidth("(");
    doc.setFont("helvetica", "bold");
    doc.text(amountDigitsText, amountX, amountY);
    amountX += doc.getTextWidth(amountDigitsText);
    doc.setFont("helvetica", "normal");
    doc.text(amountSuffix, amountX, amountY);
  } else {
    doc.setFont("helvetica", "normal");
    doc.text(amountLines, 20, amountY);
  }
  doc.setTextColor(...colors.red);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("LE DIRECTEUR GENERAL", 190, 252, { align: "right" });
  const signatureWidth = doc.getTextWidth("LE DIRECTEUR GENERAL");
  doc.line(190 - signatureWidth, 253, 190, 253);
  if (stamp) doc.addImage(stamp, "PNG", 142, 258, 40, 21.2);

  if (footer) doc.addImage(footer, "PNG", 20, 278, 170, 9);
  else {
    doc.setFillColor(...colors.navy);
    doc.rect(20, 278, 170, 12, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text("Cité Soleil Dalifort Villa N°38 - Tél: +221 77 704 37 90", 105, 284, { align: "center" });
    doc.text("N.I.N.E.A : 009384629 - RC N° SN.DKR.2022.B.14972", 105, 288, { align: "center" });
  }

  return doc;
}

export async function downloadInvoicePdf(data: InvoicePdfData) {
  const doc = await generateInvoiceDocument(data);
  doc.save(`facture-${data.invoiceNumber.replace(/[^a-z0-9]/gi, "-")}.pdf`);
}
