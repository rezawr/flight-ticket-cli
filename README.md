![npm](https://img.shields.io/npm/v/flight-ticket-cli)
![license](https://img.shields.io/github/license/rezawr/flight-ticket-cli)
![node](https://img.shields.io/node/v/flight-ticket-cli)

# flight-ticket-cli

`flight-ticket-cli` is a CLI-only npm package for public flight fare discovery.

It is designed for developers, automation scripts, and AI agents that need normalized flight fare data from the terminal.

## Features

- Search public flight fares from the command line
- Find the cheapest available fare
- Output results as JSON
- Includes fixture mode for safe local demos
- Built with TypeScript
- Works with Node.js 18+
- Follows printingpresscli design and features

## Install

```bash
npm install -g flight-ticket-cli
```

## Quick Start

```bash
flight-ticket-pp-cli search --from CGK --to DPS --date 2026-06-15 --json
```

Passenger and cabin options are available on both `search` and `cheapest`:

```bash
flight-ticket-pp-cli search --from CGK --to DPS --date 2026-06-15 --adults 2 --children 1 --infants 1 --class business --json
```

## Commands

```bash
flight-ticket-pp-cli search --from CGK --to DPS --date 2026-06-15 --json
flight-ticket-pp-cli cheapest --from CGK --to DPS --date 2026-06-15
flight-ticket-pp-cli doctor --json
flight-ticket-pp-cli version
```

## Passenger And Cabin Flags

- `--adults <n>`: number of adult passengers. Default: `1`
- `--children <n>`: number of child passengers. Default: `0`
- `--infants <n>`: number of infant passengers. Default: `0`
- `--class <economy|premium|business|first>`: requested cabin class. Default: `economy`
- `--flight-class <...>`: alias for `--class`

## For AI Agents

If an AI agent installs this package, it should treat passenger counts and cabin class as first-class search inputs and pass them explicitly when provided by the user.

Recommended command template:

```bash
flight-ticket-pp-cli search --from <ORIGIN> --to <DESTINATION> --date <YYYY-MM-DD> --adults <N> --children <N> --infants <N> --class <economy|premium|business|first> --json
```

Defaults when the user does not specify them:

- adults: `1`
- children: `0`
- infants: `0`
- class: `economy`

## Example JSON Output

```json
[
  {
    "source": "fixture",
    "airline": "Example Air",
    "from": "CGK",
    "to": "DPS",
    "departureTime": "09:10",
    "arrivalTime": "12:05",
    "price": 1250000,
    "currency": "IDR"
  }
]
```

## Supported Sources

| Source | Status |
|---|---|
| tiket.com | Stable |
| traveloka.com | Experimental |
| agoda.com | Experimental |

## Use Cases

- Flight fare comparison
- CLI automation
- Travel research
- Agent-friendly flight search
- Indonesian flight market experiments

## Notes

- This package depends on `cloakbrowser` and `playwright-core` through npm.
- The scraper runs headless by default.
- Set `PLAYWRIGHT_HEADLESS=false` if you want to watch the browser.

```bash
PLAYWRIGHT_HEADLESS=false flight-ticket-pp-cli search --from CGK --to DPS --date 2026-06-15
```

## Disclaimer

This project searches publicly available flight fare information. Prices, availability, routes, and schedules may change at any time.

This tool is experimental and should not be used as the only source for booking or financial decisions.
