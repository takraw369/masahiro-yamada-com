# Security Policy

## Reporting

Do not open a public issue containing a vulnerability, credential, personal data,
customer data, request body, or production log. Report privately to the repository
owner or use a GitHub private vulnerability report when that feature is enabled.

Never paste secret values into issues, pull requests, commit messages, test output,
or screenshots. Identify a secret only by provider, type, environment, and location.

## Data boundary

This repository may contain public website code, but it must not contain raw personal
finance, health, family, customer, contract, journal, chat, or MASA_LENS_RAW data.
Production data belongs in an access-controlled data store. Production credentials
belong in Cloudflare secrets or another approved secret manager.

## Required controls

- Production and development use separate credentials.
- Dashboard routes and private APIs require a server-verified signed session.
- X/LINE side effects require a short-lived explicit operator authorization.
- Harness proxy routes are disabled by default and allow only enumerated actions.
- Pull requests must pass security tests, build verification, and secret scanning.
- The default branch must reject direct pushes, force pushes, and deletion.

## Incident response

When a credential may have entered Git history, rotate or revoke it before rewriting
history. Treat old clones and pull-request refs as compromised until verified.
