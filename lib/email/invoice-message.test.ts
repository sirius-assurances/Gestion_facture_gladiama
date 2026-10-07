import { describe, expect, it } from "vitest";
import {
  buildAttachmentName,
  buildInvoiceHtml,
  buildInvoiceLetter,
  buildInvoiceSubject,
  buildInvoiceSummary,
  buildInvoiceText,
  parseRecipients,
  type InvoiceMessageInput,
} from "@/lib/email/invoice-message";

const withTva: InvoiceMessageInput = {
  invoiceNumber: "N°28",
  clientName: "SOGEA SATOM",
  designation: "Fourniture latérite crue",
  quantity: 6000,
  unit: "m³",
  unitPrice: 600,
  hasTva: true,
  tvaRate: 18,
  totalHt: 3_600_000,
  totalTva: 648_000,
  totalTtc: 4_248_000,
  periodStart: "26 Septembre 2026",
  periodEnd: "25 Octobre 2026",
  dueDate: "25 Novembre 2026",
  projectName: "Travaux de terrassement",
  marketNumber: "Marché N°TA3/1087/AGR",
  contractNumber: "Contrat T0032/24",
};

const bare: InvoiceMessageInput = {
  ...withTva,
  hasTva: false,
  totalTva: 0,
  totalTtc: 3_600_000,
  projectName: undefined,
  marketNumber: undefined,
  contractNumber: undefined,
};

describe("buildInvoiceSubject", () => {
  // A large contractor's accounts department files by market reference;
  // without it the invoice sits unmatched in an inbox.
  it("carries the market reference when there is one", () => {
    expect(buildInvoiceSubject(withTva)).toContain("Marché N°TA3/1087/AGR");
  });

  it("stays readable when there is none", () => {
    expect(buildInvoiceSubject(bare)).toBe("Facture N°28 — GLADIAMA SUARL");
  });
});

describe("buildInvoiceLetter", () => {
  it("opens as business correspondence, not a chat message", () => {
    expect(buildInvoiceLetter(withTva)).toMatch(/^Madame, Monsieur,/);
  });

  it("states the payment deadline, which is the point of sending it", () => {
    expect(buildInvoiceLetter(withTva)).toContain("25 Novembre 2026");
  });

  it("refers to the project when the client has one", () => {
    expect(buildInvoiceLetter(withTva)).toContain("Travaux de terrassement");
  });

  it("falls back to the period when the client has no project", () => {
    expect(buildInvoiceLetter(bare)).toContain("du 26 Septembre 2026 au 25 Octobre 2026");
  });

  // The figures live in the generated summary. Repeating them in the editable
  // letter would let a hand-edited message contradict the invoice attached.
  it("quotes no amounts", () => {
    expect(buildInvoiceLetter(withTva)).not.toMatch(/FCFA/);
  });
});

describe("buildInvoiceSummary", () => {
  it("breaks out VAT only when the invoice has it", () => {
    const labels = (input: InvoiceMessageInput) => buildInvoiceSummary(input).map(([label]) => label);

    expect(labels(withTva)).toContain("TVA (18 %)");
    expect(labels(bare)).not.toContain("TVA (18 %)");
  });

  it("omits references the client has not set, rather than printing blanks", () => {
    const labels = buildInvoiceSummary(bare).map(([label]) => label);

    expect(labels).not.toContain("Marché");
    expect(labels).not.toContain("Contrat");
  });

  it("shows the total the client must actually pay", () => {
    const total = buildInvoiceSummary(withTva).find(([label]) => label === "Montant total");

    expect(total?.[1]).toBe("4 248 000 FCFA");
  });
});

describe("buildInvoiceText", () => {
  it("keeps the sender's own wording", () => {
    expect(buildInvoiceText("Bonjour Monsieur Diop,", withTva)).toContain("Bonjour Monsieur Diop,");
  });

  it("appends the figures and the legal identifiers", () => {
    const text = buildInvoiceText(buildInvoiceLetter(withTva), withTva);

    expect(text).toContain("4 248 000 FCFA");
    expect(text).toContain("N.I.N.E.A : 009384629");
  });
});

describe("buildInvoiceHtml", () => {
  it("escapes the sender's text so a stray character cannot break the layout", () => {
    expect(buildInvoiceHtml("Objet : <urgent> & suite", withTva)).toContain("&lt;urgent&gt; &amp; suite");
  });

  it("keeps paragraph breaks from the letter", () => {
    const html = buildInvoiceHtml("Premier paragraphe.\n\nSecond paragraphe.", withTva);

    expect(html.match(/<p /g) ?? []).toHaveLength(2);
  });

  // Mail clients strip <style> blocks and support neither flexbox nor grid.
  it("uses no layout a mail client would drop", () => {
    const html = buildInvoiceHtml(buildInvoiceLetter(withTva), withTva);

    expect(html).not.toMatch(/<style|display:\s*(flex|grid)/);
  });

  it("carries the same total as the text part", () => {
    expect(buildInvoiceHtml(buildInvoiceLetter(withTva), withTva)).toContain("4 248 000 FCFA");
  });
});

describe("buildAttachmentName", () => {
  it("produces a filename a person can file, with no spaces or accents", () => {
    expect(buildAttachmentName("N°28", "SOGEA SATOM")).toBe("Facture_N_28_SOGEA_SATOM.pdf");
  });

  it("leaves no trailing separators when a name ends in punctuation", () => {
    expect(buildAttachmentName("N°3", "PFO AFRICA (SN)")).toBe("Facture_N_3_PFO_AFRICA_SN.pdf");
  });
});

describe("parseRecipients", () => {
  it("accepts the separators people actually type", () => {
    expect(parseRecipients("a@b.com, c@d.com; e@f.com")).toEqual(["a@b.com", "c@d.com", "e@f.com"]);
  });

  it("drops anything that is not an address instead of failing the send", () => {
    expect(parseRecipients("bon@exemple.com, pasuneadresse, autre@exemple.com")).toEqual([
      "bon@exemple.com",
      "autre@exemple.com",
    ]);
  });

  it("returns nothing for an empty field", () => {
    expect(parseRecipients("   ")).toEqual([]);
  });
});
