---
name: masa-webapp-security
description: Project adapter for MASA Security OS on masahiro-yamada.com. Use for secure design, auth/dashboard/API review, Cloudflare runtime review, pre-deploy security checks and incident follow-up.
---

# MASA Web App Security — masahiro-yamada.com Adapter

This repository consumes the canonical MASA Security OS maintained in `takraw369/masa-automation`.

Canonical source:
- `.agents/skills/masa-webapp-security/SKILL.md`
- `docs/security/MASA_SECURITY_OS_v1.md`
- `config/security/security-gate.yml`
- `docs/security/SECURITY_TEST_MATRIX.md`

## Repository-specific precedence

1. executable code and verified runtime behavior
2. `CLAUDE.md`, `CHECKLIST.md`, existing security helpers and tests
3. this adapter and `security/app-security-profile.json`
4. canonical MASA Security OS
5. generic upstream guidance

Do not weaken existing auth/session middleware, same-origin checks, private response headers, Cloudflare secret handling or deployment Human Gates.

## Current profile

Treat this repo as containing these active trust surfaces unless current code proves otherwise:

- public web pages and public endpoints
- private Dashboard/FLOW MIND routes
- cookie-backed dashboard session authority
- privileged/admin-like dashboard operations
- machine-to-machine dashboard sync endpoints
- X/LINE harness APIs
- Cloudflare Workers runtime and bindings

Default profiles:

- `public-only`
- `auth-account`
- `admin`
- `webhook`

Stack overlays:

- `astro`
- `cloudflare`

Add `payments`, `file-upload`, `supabase`, `stripe`, or `ai-llm` only when the reviewed code path actually uses them.

## High-value checks for this repo

1. middleware coverage for every `/dashboard`, `/api/dashboard`, `/mind`, and harness route
2. same-origin enforcement on browser-authenticated mutations
3. session cookie flags, rotation/rolling behavior and invalidation semantics
4. bootstrap login/reset endpoints: rate limits, error leakage, token/password handling
5. machine-to-machine exceptions: exact path/method scope, secret verification, replay resistance where needed
6. authorization inside handlers; middleware login alone is not sufficient for object/function authorization
7. Cloudflare secrets stay in bindings and never enter client bundles
8. redirect/host handling cannot become an open redirect
9. outbound fetch paths are checked for SSRF where user-controlled URLs exist
10. production errors and private responses do not leak sensitive state

## Pre-deploy usage

Run:

```bash
npm run security:check
npm run security:gate
```

`security:check` keeps the existing dependency audit. `security:gate` evaluates `security/audit-state.json` against the repository profile.

A missing or incomplete audit state is intentionally BLOCKED rather than false-green.

## Required result format

Return one of:

- `PASS`
- `PASS_WITH_TRACKED_P2_P3`
- `BLOCKED`

For every P0/P1 fix, add a permanent regression test when technically feasible and record its test path/name in the audit state.
