#!/usr/bin/env node

import { Service } from "./service.js";
import { renderTable, shouldAutoJson } from "./output.js";
import { AgodaProvider } from "./providers/agoda.js";
import { FixtureProvider } from "./providers/fixture.js";
import { TiketProvider } from "./providers/tiket.js";
import { TravelokaProvider } from "./providers/traveloka.js";
import { type Provider, type SearchRequest, type SourceName, validateSearchRequest } from "./types.js";

const VERSION = "0.1.0";

async function main(): Promise<void> {
  try {
    await run(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${toErrorMessage(error)}\n`);
    process.exitCode = 1;
  }
}

async function run(args: string[]): Promise<void> {
  if (args.length === 0) {
    throw new Error(usageText(binaryName()));
  }

  switch (args[0]) {
    case "search":
      await runSearch(args.slice(1), false);
      return;
    case "cheapest":
      await runSearch(args.slice(1), true);
      return;
    case "doctor":
      await runDoctor(args.slice(1));
      return;
    case "version":
      process.stdout.write(`${VERSION}\n`);
      return;
    case "help":
    case "--help":
    case "-h":
      throw new Error(usageText(binaryName()));
    default:
      throw new Error(`unknown command "${args[0]}"\n\n${usageText(binaryName())}`);
  }
}

async function runSearch(args: string[], cheapest: boolean): Promise<void> {
  const parsed = parseFlags(args);
  const flightClass = String(parsed.values.get("class") ?? parsed.values.get("flight-class") ?? "economy");
  const req: SearchRequest = {
    from: String(parsed.values.get("from") ?? ""),
    to: String(parsed.values.get("to") ?? ""),
    date: String(parsed.values.get("date") ?? ""),
    adults: parseIntFlag(parsed.values.get("adults"), 1),
    children: parseIntFlag(parsed.values.get("children"), 0),
    infants: parseIntFlag(parsed.values.get("infants"), 0),
    currency: String(parsed.values.get("currency") ?? "IDR"),
    maxStops: parseIntFlag(parsed.values.get("max-stops"), -1),
    flightClass,
    sort: (String(parsed.values.get("sort") ?? "price-asc")) as SearchRequest["sort"]
  };

  const jsonOut = parsed.flags.has("json");
  const compact = parsed.flags.has("compact");
  let limit = parseIntFlag(parsed.values.get("limit"), 0);
  const source = (String(parsed.values.get("source") ?? "auto")) as SourceName;
  const stdin = parsed.flags.has("stdin");

  if (cheapest) {
    req.sort = "price-asc";
    if (!parsed.values.has("limit")) {
      limit = 10;
    }
  }

  if (stdin) {
    const stdinText = await readStdin();
    const input = JSON.parse(stdinText) as Partial<SearchRequest>;
    Object.assign(req, input);
  }

  validateSearchRequest(req);

  const service = new Service(await selectProviders(source));
  const results = await service.search(req);

  if (results.options.length === 0) {
    if (results.warnings && results.warnings.length > 0) {
      throw new Error(`no flights returned:\n- ${results.warnings.join("\n- ")}`);
    }
    throw new Error("no flights returned; use --source fixture for a local demo");
  }

  if (limit > 0 && results.options.length > limit) {
    results.options = results.options.slice(0, limit);
  }

  if (jsonOut || shouldAutoJson()) {
    process.stdout.write(`${JSON.stringify(results, replacer, 2)}\n`);
    return;
  }

  process.stdout.write(renderTable(results, compact));
}

async function runDoctor(args: string[]): Promise<void> {
  const parsed = parseFlags(args);
  const jsonOut = parsed.flags.has("json");
  const providers = [
    new TiketProvider(),
    new TravelokaProvider(),
    new AgodaProvider(),
    new FixtureProvider()
  ];

  const report = await Promise.all(providers.map(async provider => ({
    name: provider.name(),
    ready: await provider.ready(),
    env_vars: provider.requiredEnv(),
    descriptor: provider.descriptor(),
    missing_reason: await provider.missingReason()
  })));

  if (jsonOut) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  for (const row of report) {
    process.stdout.write(`${row.name}\tready=${row.ready}\tenv=${row.env_vars.join(",")}\n`);
    if (row.missing_reason) {
      process.stdout.write(`  ${row.missing_reason}\n`);
    }
  }
}

async function selectProviders(source: SourceName): Promise<Provider[]> {
  switch (source) {
    case "tiket":
      return [new TiketProvider()];
    case "traveloka":
      return [new TravelokaProvider()];
    case "agoda":
      return [new AgodaProvider()];
    case "fixture":
      return [new FixtureProvider()];
    case "auto":
    default: {
      const providers: Provider[] = [
        new TiketProvider(),
        new TravelokaProvider(),
        new AgodaProvider()
      ];
      const readyProviders: Provider[] = [];
      for (const provider of providers) {
        if (await provider.ready()) {
          readyProviders.push(provider);
        }
      }
      return readyProviders.length > 0 ? readyProviders : [new FixtureProvider()];
    }
  }
}

function parseFlags(args: string[]): { values: Map<string, string>; flags: Set<string> } {
  const values = new Map<string, string>();
  const flags = new Set<string>();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      continue;
    }

    const eq = arg.indexOf("=");
    if (eq >= 0) {
      values.set(arg.slice(2, eq), arg.slice(eq + 1));
      continue;
    }

    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      flags.add(arg.slice(2));
      continue;
    }

    values.set(arg.slice(2), next);
    index += 1;
  }

  return { values, flags };
}

function parseIntFlag(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    return "";
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function usageText(commandName: string): string {
  return [
    `${commandName} is a Printing Press-style flight aggregator.`,
    "",
    "Usage:",
    `  ${commandName} search --from CGK --to DPS --date 2026-06-15 [--adults 1] [--children 0] [--infants 0] [--class economy] [--json]`,
    `  ${commandName} cheapest --from CGK --to DPS --date 2026-06-15 [--adults 1] [--children 0] [--infants 0] [--class economy]`,
    `  ${commandName} doctor [--json]`,
    `  ${commandName} version`,
    "",
    "Passenger And Cabin Flags:",
    "  --adults <n>       Number of adult passengers. Default: 1.",
    "  --children <n>     Number of child passengers. Default: 0.",
    "  --infants <n>      Number of infant passengers. Default: 0.",
    "  --class <name>     Flight class: economy, premium, business, first. Default: economy.",
    "",
    "Notes:",
    "  - tiket/traveloka/agoda use CloakBrowser scrapers against public route pages.",
    "  - --flight-class is also accepted as an alias for --class.",
    "  - No login automation, or checkout scraping is included."
  ].join("\n");
}

function replacer(key: string, value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

function binaryName(): string {
  const raw = process.argv[1]?.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "");
  return raw?.trim() ? raw : "flight-ticket-pp-cli";
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

void main();
