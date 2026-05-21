import { type FlightOption, type Provider, type SearchRequest, type SearchResults } from "./types.js";

export class Service {
  constructor(private readonly providers: Provider[]) {}

  async search(req: SearchRequest): Promise<SearchResults> {
    const results: SearchResults = {
      request: req,
      providers: [],
      options: [],
      warnings: []
    };

    for (const provider of this.providers) {
      results.providers.push(provider.name());
      try {
        const items = await provider.search(req);
        for (const item of items) {
          if (req.maxStops >= 0 && item.stops > req.maxStops) {
            continue;
          }
          results.options.push(item);
        }
      } catch (error) {
        results.warnings?.push(toErrorMessage(error));
      }
    }

    sortOptions(results.options, req.sort);
    if (results.warnings?.length === 0) {
      delete results.warnings;
    }
    return results;
  }
}

export function sortOptions(items: FlightOption[], sortKey: SearchRequest["sort"]): void {
  items.sort((left, right) => {
    switch (sortKey) {
      case "price-desc":
        return right.totalPrice - left.totalPrice;
      case "depart-asc":
        return left.departAt.getTime() - right.departAt.getTime();
      case "duration-asc":
        return left.durationMinutes - right.durationMinutes;
      case "price-asc":
      case "":
      default:
        return left.totalPrice - right.totalPrice;
    }
  });
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
