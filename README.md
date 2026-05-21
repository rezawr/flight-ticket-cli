# flight-ticket-cli

`flight-ticket-cli` is a CLI-only npm package for public flight fare discovery across `tiket.com`, `traveloka.com`, and `agoda.com`.

## Install

```bash
npm install -g flight-ticket-cli
```

## Commands

```bash
flight-ticket-pp-cli search --from CGK --to DPS --date 2026-06-15 --json
flight-ticket-pp-cli cheapest --from CGK --to DPS --date 2026-06-15
flight-ticket-pp-cli doctor --json
flight-ticket-pp-cli version
```

## Notes

- This package depends on `cloakbrowser` and `playwright-core` through npm.
- The scraper runs headless by default. Set `PLAYWRIGHT_HEADLESS=false` if you want to watch the browser.
- `fixture` mode is included for local demos:

```bash
flight-ticket-pp-cli search --from CGK --to DPS --date 2026-06-15 --source fixture --json
```
