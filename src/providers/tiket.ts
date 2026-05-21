import { buildTiketRouteUrl } from "../routes.js";
import { combineDateAndClock, type FlightOption, type Provider, type SearchRequest } from "../types.js";
import { describeSnapshot, fetchPage, missingReason, newBrowserConfig } from "../browser.js";

const codeLine = /^[A-Z]{3,4}$/;
const priceLine = /^(IDR|USD|Rp)\s*([0-9][0-9\.,]*)$/;

export class TiketProvider implements Provider {
  private readonly config = newBrowserConfig("tiket");

  name(): string {
    return "tiket";
  }

  requiredEnv(): string[] {
    return [];
  }

  descriptor(): string {
    return "Experimental CloakBrowser scraper against tiket.com public route pages";
  }

  async ready(): Promise<boolean> {
    return (await this.missingReason()) === "";
  }

  async missingReason(): Promise<string> {
    return missingReason();
  }

  async search(req: SearchRequest): Promise<FlightOption[]> {
    const reason = await this.missingReason();
    if (reason) {
      throw new Error(reason);
    }
    const url = buildTiketRouteUrl(req.from, req.to, req.date, req.adults);
    const snapshot = await fetchPage(this.config, url);
    try {
      return parseTiketOptions(snapshot.bodyText, req);
    } catch (error) {
      throw new Error(`${toErrorMessage(error)}; ${describeSnapshot(snapshot)}`);
    }
  }
}

export function parseTiketOptions(text: string, req: SearchRequest): FlightOption[] {
  const lines = cleanedLines(text);
  const items: FlightOption[] = [];

  for (let i = 0; i + 7 < lines.length; i += 1) {
    const carrier = lines[i];
    const departClock = parseClock(lines[i + 1]);
    if (departClock === null || !codeLine.test(lines[i + 2])) {
      continue;
    }

    const durationMinutes = parseDuration(lines[i + 3]);
    if (durationMinutes === null) {
      continue;
    }

    const stops = parseStops(lines[i + 4]);
    const arriveClock = parseClock(lines[i + 5]);
    if (arriveClock === null || !codeLine.test(lines[i + 6])) {
      continue;
    }

    let currency = "";
    let amount = 0;
    let foundPrice = false;
    for (let j = i + 7; j < lines.length && j < i + 13; j += 1) {
      const parsed = parseMoney(lines[j]);
      if (!parsed) {
        continue;
      }
      currency = parsed.currency;
      amount = parsed.amount;
      foundPrice = true;
    }
    if (!foundPrice) {
      continue;
    }

    const departAt = combineDateAndClock(req.date, departClock);
    const arriveAt = combineDateAndClock(req.date, arriveClock);
    if (arriveAt < departAt) {
      arriveAt.setUTCDate(arriveAt.getUTCDate() + 1);
    }

    items.push({
      source: "tiket",
      carrier,
      flightNumber: "route-fare",
      from: lines[i + 2],
      to: lines[i + 6],
      departAt,
      arriveAt,
      stops,
      durationMinutes,
      currency,
      totalPrice: amount * req.adults,
      pricePerAdult: amount,
      baggageSummary: "Not disclosed on route page"
    });
  }

  if (items.length === 0) {
    throw new Error(`tiket page loaded, but parser matched 0 flight cards for ${req.from} -> ${req.to} on ${req.date}`);
  }
  return dedupe(items);
}

function parseClock(value: string): number | null {
  const matches = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!matches) {
    return null;
  }
  return Number.parseInt(matches[1], 10) * 60 + Number.parseInt(matches[2], 10);
}

function parseDuration(value: string): number | null {
  const matches = /(?:(\d+)j)?\s*(?:(\d+)m)?/.exec(value.trim());
  if (!matches) {
    return null;
  }
  const hours = matches[1] ? Number.parseInt(matches[1], 10) : 0;
  const minutes = matches[2] ? Number.parseInt(matches[2], 10) : 0;
  const total = hours * 60 + minutes;
  return total > 0 ? total : null;
}

function parseStops(value: string): number {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("langsung")) {
    return 0;
  }
  const matches = /(\d+)\s+transit/.exec(normalized);
  return matches ? Number.parseInt(matches[1], 10) : 0;
}

function parseMoney(value: string): { currency: string; amount: number } | null {
  const matches = priceLine.exec(value.trim());
  if (!matches) {
    return null;
  }
  const currency = matches[1] === "Rp" ? "IDR" : matches[1];
  const amount = Number.parseInt(matches[2].replace(/[.,\s]/g, ""), 10);
  return Number.isFinite(amount) ? { currency, amount } : null;
}

function cleanedLines(text: string): string[] {
  return text.replace(/\r\n/g, "\n").split("\n").map(line => line.trim()).filter(Boolean);
}

function dedupe(items: FlightOption[]): FlightOption[] {
  const seen = new Set<string>();
  const out: FlightOption[] = [];
  for (const item of items) {
    const key = [
      item.source,
      item.carrier,
      item.from,
      item.to,
      item.departAt.toISOString(),
      item.currency,
      String(item.totalPrice)
    ].join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(item);
  }
  return out;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
