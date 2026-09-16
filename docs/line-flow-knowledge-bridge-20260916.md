# LINE Flow Knowledge bridge — 2026-09-16

## Canonical boundary
- Drive remains the Source of Truth for reusable knowledge assets.
- Supabase FLOW MIND / Knowledge is the searchable reuse layer.
- `/dashboard/lian` remains the PRIMARY LINE Control Plane.
- `/dashboard/line` is the Flow Builder editing surface, not a third admin/runtime.
- No legacy `line-crm-worker` / L Harness runtime is restored.

## This change
- Adds genre → theme → purpose → message-role narrowing in the Message Asset Library.
- Adds related Knowledge lookup and visible provenance/freshness cues when available.
- Expands reusable message roles to Hook / 安心 / 問い / 再定義 / 教育 / Story / Quest / CTA / 返信 / 再開 / Offer.
- Isolates asset → editor insertion behind `masa:line-flow-asset` / `masa:line-flow-asset-result` browser events so the library no longer owns current editor DOM details.
- Anchors the Flow Builder back to PRIMARY `/dashboard/lian`, FLOW MIND, and Graph.

## Safety
This is an editing/reuse UX change only. It does not activate a Flow, send a LINE message, restore `quest_retention`, change a cron, or bypass the existing production/human gates.
