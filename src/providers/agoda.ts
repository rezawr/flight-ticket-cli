import { buildAgodaRouteUrl } from "../routes.js";
import { combineDateAndClock, type FlightOption, type Provider, type SearchRequest } from "../types.js";
import { describeSnapshot, fetchPage, missingReason, newBrowserConfig } from "../browser.js";

const airportCodeLine = /^[A-Z]{3,4}$/;
const clockLine = /^\d{2}:\d{2}$/;
const durationLine = /^(?:(\d+)h)\s*(?:(\d+)m)?$|^(\d+)m$/;
const digitsLine = /^\d[\d,.]*$/;
const stopCountLine = /^\d+$/;
const moneyInline = /^Rp\s*([\d,.]+)$/i;
const terminalLine = /^(?:T\d+|[A-Z])$/;

export class AgodaProvider implements Provider {
  private readonly config = newBrowserConfig("Agoda", 180000);

  name(): string {
    return "agoda";
  }

  requiredEnv(): string[] {
    return [];
  }

  descriptor(): string {
    return "Experimental CloakBrowser scraper against Agoda public flight results";
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
    const url = buildAgodaRouteUrl(req.from, req.to, req.date, req.adults, req.children, req.infants, req.flightClass);
    const snapshot = await fetchPage(this.config, url);
    try {
      return parseAgodaOptions(snapshot.bodyText, req);
    } catch (error) {
      throw new Error(`${toErrorMessage(error)}; ${describeSnapshot(snapshot)}`);
    }
  }
}

export function parseAgodaOptions(text: string, req: SearchRequest): FlightOption[] {
  const lines = cleanedLines(text);
  const items: FlightOption[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const parsed = parseCard(lines, i, req);
    if (!parsed) {
      continue;
    }
    items.push(parsed.item);
    i = parsed.nextIndex - 1;
  }

  if (items.length === 0) {
    throw new Error(`agoda page loaded, but parser matched 0 flight cards for ${req.from} -> ${req.to} on ${req.date}`);
  }
  return dedupe(items);
}

function parseCard(lines: string[], start: number, req: SearchRequest): { item: FlightOption; nextIndex: number } | null {
  let index = start;
  const carrierParts: string[] = [];
  let multipleAirlines = false;

  while (index < lines.length) {
    const line = lines[index];
    if (isBaggageLine(line) || clockLine.test(line)) {
      break;
    }
    if (line === "Multiple airlines") {
      multipleAirlines = true;
    } else if (!line.startsWith("Operated by ") && !line.startsWith("Partially operated by ")) {
      carrierParts.push(line);
    }
    index += 1;
  }

  if (carrierParts.length === 0 || index >= lines.length) {
    return null;
  }
  if (carrierParts.length > 3 || isNoiseCarrier(carrierParts[0]) || digitsLine.test(carrierParts[0])) {
    return null;
  }

  const baggageParts: string[] = [];
  while (index < lines.length && isBaggageLine(lines[index])) {
    baggageParts.push(lines[index]);
    index += 1;
  }
  if (baggageParts.length === 0 || index >= lines.length || !clockLine.test(lines[index])) {
    return null;
  }

  const carrier = carrierName(carrierParts, multipleAirlines);
  const departClock = parseClock(lines[index]);
  if (departClock === null || index + 1 >= lines.length || !airportCodeLine.test(lines[index + 1])) {
    return null;
  }
  const fromCode = lines[index + 1];
  let position = index + 2;

  if (position < lines.length && terminalLine.test(lines[position])) {
    position += 1;
  }

  let stops = 0;
  if (position < lines.length && stopCountLine.test(lines[position])) {
    stops = Number.parseInt(lines[position], 10);
    position += 1;
  }

  const durationMinutes = parseDuration(lines[position]);
  if (durationMinutes === null) {
    return null;
  }
  position += 1;

  if (position >= lines.length || !clockLine.test(lines[position])) {
    return null;
  }
  const arriveClock = parseClock(lines[position]);
  if (arriveClock === null) {
    return null;
  }
  position += 1;

  let arriveDayOffset = 0;
  if (position < lines.length && lines[position].startsWith("+")) {
    const offset = Number.parseInt(lines[position].slice(1), 10);
    if (Number.isFinite(offset)) {
      arriveDayOffset = offset;
      position += 1;
    }
  }

  if (position >= lines.length || !airportCodeLine.test(lines[position])) {
    return null;
  }
  const toCode = lines[position];
  position += 1;

  if (position < lines.length && terminalLine.test(lines[position])) {
    position += 1;
  }

  const finalPrice = findFinalPrice(lines, position);
  if (!finalPrice) {
    return null;
  }

  const departAt = combineDateAndClock(req.date, departClock);
  const arriveAt = combineDateAndClock(req.date, arriveClock);
  arriveAt.setUTCDate(arriveAt.getUTCDate() + arriveDayOffset);
  if (arriveAt < departAt) {
    arriveAt.setUTCDate(arriveAt.getUTCDate() + 1);
  }

  return {
    item: {
      source: "agoda",
      carrier,
      flightNumber: "route-fare",
      from: fromCode,
      to: toCode,
      departAt,
      arriveAt,
      stops,
      durationMinutes,
      currency: "IDR",
      totalPrice: finalPrice.amount * req.adults,
      pricePerAdult: finalPrice.amount,
      baggageSummary: baggageParts.join(", ")
    },
    nextIndex: finalPrice.endIndex
  };
}

function carrierName(parts: string[], multipleAirlines: boolean): string {
  const clean = Array.from(new Set(parts.map(part => part.trim()).filter(Boolean)));
  if (clean.length === 0) {
    return "";
  }
  if (multipleAirlines && clean.length > 1) {
    return clean.join(" + ");
  }
  return clean[0];
}

function findFinalPrice(lines: string[], start: number): { amount: number; endIndex: number } | null {
  let found: { amount: number; endIndex: number } | null = null;

  for (let i = start; i < lines.length && i < start + 14; i += 1) {
    const line = lines[i].trim();
    if (line.includes("OFF") || line.startsWith("Original price:")) {
      continue;
    }

    if (line === "Rp" && i + 1 < lines.length && digitsLine.test(lines[i + 1])) {
      const amount = parseDigits(lines[i + 1]);
      if (amount !== null) {
        found = { amount, endIndex: i + 2 };
      }
      continue;
    }

    const inline = moneyInline.exec(line);
    if (inline) {
      const amount = parseDigits(inline[1]);
      if (amount !== null) {
        found = { amount, endIndex: i + 1 };
      }
    }
  }

  return found;
}

function isBaggageLine(line: string): boolean {
  return line === "Cabin bag" || line === "Checked baggage";
}

function isNoiseCarrier(line: string): boolean {
  return [
    "Sort by",
    "Cheapest",
    "Best",
    "Fastest",
    "Best overall",
    "Flights from Jakarta to Bali",
    "Need a hotel for your Bali trip?",
    "Help"
  ].includes(line);
}

function parseClock(value: string): number | null {
  const matches = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!matches) {
    return null;
  }
  return Number.parseInt(matches[1], 10) * 60 + Number.parseInt(matches[2], 10);
}

function parseDuration(value: string): number | null {
  const matches = durationLine.exec(value.trim());
  if (!matches) {
    return null;
  }
  if (matches[3]) {
    const minutes = Number.parseInt(matches[3], 10);
    return minutes > 0 ? minutes : null;
  }
  const hours = matches[1] ? Number.parseInt(matches[1], 10) : 0;
  const minutes = matches[2] ? Number.parseInt(matches[2], 10) : 0;
  const total = hours * 60 + minutes;
  return total > 0 ? total : null;
}

function parseDigits(value: string): number | null {
  const amount = Number.parseInt(value.trim().replace(/[.,\s]/g, ""), 10);
  return Number.isFinite(amount) ? amount : null;
}

function cleanedLines(text: string): string[] {
  const lines: string[] = [];
  let skippingHotelBlock = false;

  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      continue;
    }
    if (line.startsWith("Need a hotel for your ")) {
      skippingHotelBlock = true;
      continue;
    }
    if (skippingHotelBlock) {
      if (line === "See all") {
        skippingHotelBlock = false;
      }
      continue;
    }
    lines.push(line);
  }

  return lines;
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
      item.arriveAt.toISOString(),
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
