import { combineDateAndClock, type FlightOption, type Provider, type SearchRequest } from "../types.js";

export class FixtureProvider implements Provider {
  name(): string {
    return "fixture";
  }

  requiredEnv(): string[] {
    return [];
  }

  descriptor(): string {
    return "Local fixture provider for demos and tests";
  }

  async ready(): Promise<boolean> {
    return true;
  }

  async missingReason(): Promise<string> {
    return "";
  }

  async search(req: SearchRequest): Promise<FlightOption[]> {
    const base = combineDateAndClock(req.date, 8 * 60);
    return [
      {
        source: "tiket",
        carrier: "Garuda Indonesia",
        flightNumber: "GA-402",
        from: req.from,
        to: req.to,
        departAt: new Date(base),
        arriveAt: new Date(base.getTime() + 2 * 60 * 60 * 1000),
        stops: 0,
        durationMinutes: 120,
        currency: req.currency,
        totalPrice: 1450000,
        pricePerAdult: Math.floor(1450000 / req.adults),
        deepLink: "https://example.test/tiket/ga-402",
        baggageSummary: "20kg checked"
      },
      {
        source: "traveloka",
        carrier: "Citilink",
        flightNumber: "QG-606",
        from: req.from,
        to: req.to,
        departAt: new Date(base.getTime() + 90 * 60 * 1000),
        arriveAt: new Date(base.getTime() + 4 * 60 * 60 * 1000),
        stops: 1,
        durationMinutes: 240,
        currency: req.currency,
        totalPrice: 980000,
        pricePerAdult: Math.floor(980000 / req.adults),
        deepLink: "https://example.test/traveloka/qg-606",
        baggageSummary: "cabin only"
      },
      {
        source: "traveloka",
        carrier: "Batik Air",
        flightNumber: "ID-6500",
        from: req.from,
        to: req.to,
        departAt: new Date(base.getTime() + 45 * 60 * 1000),
        arriveAt: new Date(base.getTime() + 135 * 60 * 1000),
        stops: 0,
        durationMinutes: 135,
        currency: req.currency,
        totalPrice: 1125000,
        pricePerAdult: Math.floor(1125000 / req.adults),
        deepLink: "https://example.test/traveloka/id-6500",
        baggageSummary: "20kg checked"
      }
    ];
  }
}
