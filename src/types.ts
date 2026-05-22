export type SortKey = "" | "price-asc" | "price-desc" | "depart-asc" | "duration-asc";
export type SourceName = "auto" | "tiket" | "traveloka" | "agoda" | "fixture";

export interface SearchRequest {
  from: string;
  to: string;
  date: string;
  adults: number;
  currency: string;
  maxStops: number;
  flightClass: string;
  children: number;
  infants: number;
  sort: SortKey;
}

export interface FlightOption {
  source: string;
  carrier: string;
  flightNumber: string;
  from: string;
  to: string;
  departAt: Date;
  arriveAt: Date;
  stops: number;
  durationMinutes: number;
  currency: string;
  totalPrice: number;
  pricePerAdult: number;
  deepLink?: string;
  baggageSummary?: string;
}

export interface SearchResults {
  request: SearchRequest;
  providers: string[];
  options: FlightOption[];
  warnings?: string[];
}

export interface Provider {
  name(): string;
  requiredEnv(): string[];
  descriptor(): string;
  ready(): Promise<boolean>;
  missingReason(): Promise<string>;
  search(req: SearchRequest): Promise<FlightOption[]>;
}

export function validateSearchRequest(req: SearchRequest): void {
  if (!req.from.trim()) {
    throw new Error("missing required --from");
  }
  if (!req.to.trim()) {
    throw new Error("missing required --to");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(req.date) || Number.isNaN(Date.parse(`${req.date}T00:00:00Z`))) {
    throw new Error(`invalid --date "${req.date}"; expected YYYY-MM-DD`);
  }
  if (req.adults <= 0) {
    throw new Error("--adults must be greater than 0");
  }
  if (req.children < 0) {
    throw new Error("--children must be 0 or greater");
  }
  if (req.infants < 0) {
    throw new Error("--infants must be 0 or greater");
  }
  if (!["economy", "premium", "business", "first"].includes(req.flightClass)) {
    throw new Error(`unsupported --class "${req.flightClass}"; expected economy, premium, business, or first`);
  }
  if (!["", "price-asc", "price-desc", "depart-asc", "duration-asc"].includes(req.sort)) {
    throw new Error(`unsupported sort "${req.sort}"`);
  }
}

export function combineDateAndClock(date: string, minutesFromMidnight: number): Date {
  const base = new Date(`${date}T00:00:00.000Z`);
  base.setUTCMinutes(base.getUTCMinutes() + minutesFromMidnight);
  return base;
}

export function formatUtcDateTime(value: Date): string {
  return value.toISOString().slice(0, 16).replace("T", " ");
}
