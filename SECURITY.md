# Security Policy

## Supported Versions

Security fixes are provided for the latest published version of flight-ticket-cli.

┌─────────┬───────────┐
│ Version │ Supported │
├─────────┼───────────┤
│ latest  │ yes       │
│ older   │ no        │
└─────────┴───────────┘

## Reporting a Vulnerability

Please do not open public GitHub issues for suspected security vulnerabilities.

Report privately by email:

- security contact: rezawramadhan16@gmail.com

If GitHub private vulnerability reporting is enabled for this repository, you may use that instead.

Please include:

- affected version
- steps to reproduce
- impact
- proof of concept, if available
- whether the issue depends on local environment variables, browser profile data, or third-party provider behavior


## Scope

Examples of issues that may be security-relevant in this project:

- command injection
- unsafe handling of environment variables or credentials
- insecure browser profile/session storage
- leakage of local files, logs, screenshots, or artifacts
- dependency vulnerabilities with real exploit impact
- unsafe scraping behavior that exposes user data

The following are generally not treated as security vulnerabilities by themselves:

- provider layout changes that break scraping
- rate limiting or anti-bot blocking by third-party sites
- incorrect fare results without confidentiality/integrity impact
- local-only demo fixture issues without security impact

## Disclosure Policy

Please allow time for investigation and a fix before public disclosure.
Once resolved, a fix may be released with a short security note in the changelog or release notes.
