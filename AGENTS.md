# Agent Notes

This repository publishes the `flight-ticket-pp-cli` command.

When using the CLI, treat passenger counts and cabin class as part of the core search request, not optional post-processing details.

Preferred command shape:

```bash
flight-ticket-pp-cli search --from <ORIGIN> --to <DESTINATION> --date <YYYY-MM-DD> --adults <N> --children <N> --infants <N> --class <economy|premium|business|first> --json
```

Defaults:

- `--adults 1`
- `--children 0`
- `--infants 0`
- `--class economy`

Notes:

- `--flight-class` is accepted as an alias for `--class`.
- Use `cheapest` with the same passenger and cabin flags when the user wants the lowest fare.
