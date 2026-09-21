const units = [
  "zero",
  "un",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
  "onze",
  "douze",
  "treize",
  "quatorze",
  "quinze",
  "seize",
];

function underHundred(value: number): string {
  if (value < 17) return units[value];
  if (value < 20) return `dix-${units[value - 10]}`;
  if (value < 70) {
    const tens = Math.floor(value / 10);
    const remainder = value % 10;
    const labels = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];
    if (remainder === 0) return labels[tens];
    if (remainder === 1) return `${labels[tens]} et un`;
    return `${labels[tens]}-${units[remainder]}`;
  }
  if (value < 80) {
    const remainder = value - 60;
    if (remainder === 11) return "soixante et onze";
    return `soixante-${underHundred(remainder)}`;
  }
  if (value < 100) {
    const remainder = value - 80;
    if (remainder === 0) return "quatre-vingts";
    return `quatre-vingt-${underHundred(remainder)}`;
  }
  return "";
}

function underThousand(value: number): string {
  if (value < 100) return underHundred(value);
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  const prefix = hundreds === 1 ? "cent" : `${units[hundreds]} cent`;
  if (remainder === 0) return hundreds > 1 ? `${prefix}s` : prefix;
  return `${prefix} ${underHundred(remainder)}`;
}

function segment(value: number, label: string): string {
  if (value === 0) return "";
  const words = underThousand(value);
  if (label === "mille") return value === 1 ? "mille" : `${words} mille`;
  if (label === "million") return value === 1 ? "un million" : `${words} millions`;
  return value === 1 ? "un milliard" : `${words} milliards`;
}

export function numberToFrenchWords(value: number): string {
  const integer = Math.max(0, Math.round(value));
  if (integer === 0) return "zero";

  const billions = Math.floor(integer / 1_000_000_000);
  const millions = Math.floor((integer % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((integer % 1_000_000) / 1_000);
  const remainder = integer % 1_000;
  const parts = [segment(billions, "milliard"), segment(millions, "million"), segment(thousands, "mille"), remainder ? underThousand(remainder) : ""].filter(Boolean);

  return parts.join(" ").replace(/(^|[ -])([a-z])/g, (_, separator: string, letter: string) => `${separator}${letter.toUpperCase()}`);
}
