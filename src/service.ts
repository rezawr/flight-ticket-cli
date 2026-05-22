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

    results.providers = this.providers.map(provider => provider.name());

    type ProviderRun =
      | { provider: string; items: FlightOption[] }
      | { provider: string; error: string };

    const providerRuns: ProviderRun[] = await Promise.all(this.providers.map(async provider => {
      try {
        return {
          provider: provider.name(),
          items: await provider.search(req)
        };
      } catch (error) {
        return {
          provider: provider.name(),
          error: toErrorMessage(error)
        };
      }
    }));

    for (const run of providerRuns) {
      if ("error" in run) {
        results.warnings?.push(run.error);
        continue;
      }

      for (const item of run.items) {
        if (req.maxStops >= 0 && item.stops > req.maxStops) {
          continue;
        }
        results.options.push(item);
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
