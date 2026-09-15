# Distribution read-model integration — 2026-09-16

## Purpose

Restore the useful Distribution read path from historical PR #66 on the current MASA OS baseline without carrying its stale Calendar/Auth/package history or its static operating assumptions.

## Source-of-truth boundary

Current phase:

`Drive CONTENT_OS → existing Sheet Sync → Supabase os_content_items → masa_distribution_content_get_v1 → private Dashboard`

- Drive remains canonical for content facts.
- Supabase is a read model, not a competing source of truth.
- Dashboard is read-only for this phase.
- API outages return an explicit unavailable state; the UI does not silently substitute fixture/static business data.
- No content is published from this surface.

## Removed from historical PR #66

The current implementation intentionally does **not** carry forward:

- hard-coded SNS account registry snapshots
- hard-coded C034/C033/C035 draft bodies
- browser-local queue edits as if they were canonical
- note MCP terminal handoff UI
- automatic publication
- historical Calendar/Auth/package changes

Those are separate concerns and should only return through current canonical contracts.

## Database parity

Production Supabase migration history contains:

- `20260908014031 distribution_dashboard_read_model_v1`

The repository now records that already-applied migration as:

- `migrations/20260908014031_distribution_dashboard_read_model_v1.sql`

Adding the file restores repository/live schema parity. This integration does not apply or re-apply the production migration.

## Next phase

Put `SNS_ACCOUNT_REGISTRY` onto the same canonical sync/read-model path. Only then add Account Selection to Distribution, so media doors are live facts rather than embedded snapshots.

After that, publication/draft actions can remain separate Human-Gated adapters that consume selected content + selected verified account.

## Human gates

This integration performs no:

- production deploy
- database migration execution
- secret mutation
- social publication
- note publication
- external-runner activation
