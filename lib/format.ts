export function formatGroupedNumber(value: number): string {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatCfa(value: number): string {
  return `${formatGroupedNumber(value)} FCFA`;
}

export function formatFrenchDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value.includes("T") ? value : `${value}T12:00:00`) : value;
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
    .format(date)
    .replace(/(^|\s)([a-z])/g, (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
}
