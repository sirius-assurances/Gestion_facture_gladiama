import { describe, expect, it } from "vitest";
import { buildAttachmentName, buildInvoiceBody, buildInvoiceSubject, parseRecipients } from "@/lib/email/invoice-message";

const message = {
  invoiceNumber: "N°28",
  clientName: "SOGEA SATOM",
  totalFormatted: "3 835 000 FCFA",
  periodStart: "01 Septembre 2026",
  periodEnd: "17 Septembre 2026",
};

describe("invoice message", () => {
  it("names the invoice in the subject", () => {
    expect(buildInvoiceSubject(message)).toContain("N°28");
  });

  it("states the figures the client needs to reconcile the invoice", () => {
    const body = buildInvoiceBody(message);

    expect(body).toContain("SOGEA SATOM");
    expect(body).toContain("3 835 000 FCFA");
    expect(body).toContain("01 Septembre 2026");
  });

  // The old mailto: route could not carry a file, so the body had to ask the
  // recipient to be sent the PDF separately. The attachment is real now, and
  // that apology must not survive.
  it("no longer tells the recipient to expect the PDF elsewhere", () => {
    expect(buildInvoiceBody(message)).not.toMatch(/téléchargé|joindre/i);
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
