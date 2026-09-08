# CLAUDE.md — masahiro-yamada.com

> Claude Code / coding agents must read this before changing the production site.

## Purpose

This repository is the production codebase for `masahiroyamada.com`.
Prefer reliable delivery, canonical data flow, and reversible changes over clever rewrites.

## Read first

1. `CLAUDE.md`
2. `CHECKLIST.md`
3. `package.json`
4. `wrangler.toml` when touching deploy, domains, bindings, auth, storage, or Workers
5. `DESIGN.md` when touching UI / copy layout / visual components
6. Only task-relevant source files after that

Do not load the whole repository unless necessary.

## Source-of-truth order

When documents disagree:

1. Executable config / code (`package.json`, `wrangler.toml`, current source)
2. Current production architecture and verified behavior
3. Repository docs such as `DESIGN.md`
4. Old notes / comments / assumptions

Fix stale documentation when a verified mismatch is found.

## Architecture invariants

- Canonical public domain: `masahiroyamada.com`.
- Legacy domains redirect to the canonical domain; preserve path and query where intended.
- Cloudflare Worker configuration in `wrangler.toml` is production-sensitive.
- Supabase is primary storage where current code/config says so; D1 is legacy/fallback where explicitly retained.
- Drive / MASA_OS is canonical for Knowledge and approved public Tips. Builds consume reviewed, committed exports; retired Obsidian vaults must not be read or synchronized. `scripts/sync-from-vault.mjs` is a no-op compatibility entrypoint.
- Only Tips explicitly marked public may enter this public repository.
- Do not turn mirrored content into a second canonical copy.

## Change rules

- Read existing implementation before creating a replacement.
- MERGE / extend > duplicate.
- Make the smallest change that solves the actual problem.
- Preserve existing routes, auth boundaries, redirects, bindings, and deploy behavior unless the task explicitly requires changing them.
- Never delete or replace Cloudflare routes, Workers, Access rules, secrets, databases, or production bindings as collateral cleanup.
- Never commit secret/service-role keys.
- Do not invent environment variables or infrastructure that is not present.
- Avoid unrelated refactors in bug-fix tasks.

## UI rules

- Follow `DESIGN.md` for visual work.
- Reuse existing tokens/components before introducing a new design language.
- Mobile-first behavior must remain usable.
- A visually nicer result is not acceptable if navigation, auth, performance, accessibility, or funnel flow regresses.

## Validation

Before claiming completion:

1. Run relevant checks available in this repository.
2. For code changes, at minimum run `npm run build` unless impossible for a clearly stated environment reason.
3. Verify changed routes and redirects logically against `wrangler.toml` / middleware when relevant.
4. Review the full diff for accidental config, generated-file, content-sync, or secret changes.
5. Run every applicable item in `CHECKLIST.md`.
6. If any item fails, fix it and re-check before reporting completion.

## Learning loop

When MASA corrects or rejects an implementation, append only actionable learning to `LEARN.md`:

- What was corrected
- Why it happened
- The rule that changes future behavior

Do not store feelings or session summaries.
If the same learning appears twice, promote it into `CLAUDE.md`, `CHECKLIST.md`, `DESIGN.md`, or the relevant canonical code/doc and remove redundant wording from `LEARN.md`.

## Completion language

Only say deployed / fixed / verified / reflected when the corresponding action actually succeeded.
Distinguish clearly between code changed, build passed, deployment executed, and production behavior verified.
