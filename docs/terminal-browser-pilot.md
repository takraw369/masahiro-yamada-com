# terminal-browser bounded pilot

This is a development-only experiment for `masahiro-yamada-com`. It does not replace Playwright/E2E checks, normal browser verification, or production release gates.

## Goal

Reduce the context switching between:

1. Codex/agent implementation
2. local visual/browser inspection
3. MASA Human Gate
4. fix + re-verify

The pilot is successful only if it lowers manual browser round-trips without weakening regression coverage or final human judgment.

## Scope

Use for:
- localhost UI inspection
- reversible visual debugging
- public/test pages
- pre-Human-Gate agent checks
- remote localhost previews where appropriate

Do not use as the default path for:
- banking or payment surfaces
- production admin consoles
- high-risk authenticated sessions
- final E2E proof

## Prerequisites

terminal-browser requires a terminal with Kitty graphics protocol support. The upstream README currently lists Ghostty, Kitty, cmux and VS Code among supported examples.

Install terminal-browser outside this repository:

```sh
brew install terminal-browser
```

No package dependency is added to this project.

## Run the pilot

Start Astro as usual:

```sh
npm run dev
```

In the same terminal workspace, launch the browser adapter:

```sh
npm run pilot:terminal-browser
```

The launcher opens:

```text
http://127.0.0.1:4321
```

To inspect another local/test URL:

```sh
npm run pilot:terminal-browser -- http://127.0.0.1:4321/dashboard
```

The launcher uses the upstream documented form:

```sh
terminal-browser open --split right <url>
```

For this bounded pilot, telemetry is disabled by default with `TERMINAL_BROWSER_NO_TELEMETRY=1`. This can be explicitly overridden by the operator.

## Human Gate protocol

Use this order:

```text
spec / intent
→ agent implementation
→ terminal-browser first-pass inspection
→ agent fixes obvious defects
→ MASA Human Gate for judgment / feel / priority
→ deterministic tests / E2E
→ normal Chrome/Safari final environment check when relevant
→ receipt
```

terminal-browser is the live visual interaction layer. It is not the deterministic regression layer.

## Pilot receipt

Record these after one real UI task:

- task / route tested
- ordinary-browser baseline
- manual browser round-trips
- Human intervention count
- visual defects found before Human Gate
- defects agent closed without human help
- regression/E2E result
- rework count
- terminal/permission friction
- telemetry/privacy friction
- whether final normal-browser verification differed
- decision: ADOPT / DEFER / REJECT

## Adoption rule

Adopt more broadly only when the pilot measurably reduces context switching or visual-debug friction while preserving Human Gate quality and deterministic verification.
