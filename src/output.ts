import { formatUtcDateTime, type SearchResults } from "./types.js";

export function shouldAutoJson(): boolean {
  return !process.stdout.isTTY;
}

export function renderTable(results: SearchResults, compact: boolean): string {
  const lines: string[] = [];

  if (compact) {
    lines.push("SOURCE\tCARRIER\tROUTE\tDEPART\tPRICE");
    for (const item of results.options) {
      lines.push([
        item.source,
        item.carrier,
        `${item.from}-${item.to}`,
        formatUtcDateTime(item.departAt),
        `${item.currency} ${item.totalPrice}`
      ].join("\t"));
    }
  } else {
    lines.push("SOURCE\tCARRIER\tFLIGHT\tROUTE\tDEPART\tARRIVE\tSTOPS\tDURATION\tPRICE\tBAGGAGE");
    for (const item of results.options) {
      lines.push([
        item.source,
        item.carrier,
        item.flightNumber,
        `${item.from}-${item.to}`,
        formatUtcDateTime(item.departAt),
        formatUtcDateTime(item.arriveAt),
        String(item.stops),
        `${item.durationMinutes}min`,
        `${item.currency} ${item.totalPrice}`,
        item.baggageSummary ?? ""
      ].join("\t"));
    }
  }

  if (results.warnings && results.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const warning of results.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return `${lines.join("\n")}\n`;
}
