# PRIMARY Distribution OS

Status: feature branch / not production until PR review + release gate.

## Purpose

One operating surface for:

`WHAT -> WHO/WHERE -> CTA -> DRAFT/HANDOFF -> PUBLISH(Human Gate) -> RESULT -> LEARNING`

Do not create another Dashboard or another canonical database.

## Source of truth

- Content: Drive `CONTENT_OS｜コンテンツ資産・商品化台帳`
- Accounts: Drive `SNS_ACCOUNT_REGISTRY`
- Distribution results/KPI: Drive `DISTRIBUTION_OS｜発信・配信・KPI`
- Distribution rules: Drive `📡 配信司令塔｜What × Where × CTA`
- Dashboard: interaction / decision / operating overlay only
- GitHub: implementation source

## Account gate

A content item can be CONTENT READY while still DISTRIBUTION HOLD.

Before public delivery, decide in order:

1. Account Architecture
2. Primary Audience
3. Account Role / Persona
4. Primary Channel
5. CTA / Destination
6. one real test
7. reaction / evidence
8. continue / revise

The Dashboard must not turn an unverified Threads/TikTok/Shorts account into a real media door.

## Reuse policy

- X / Threads: hypothesis, question, conversation
- Instagram: save/trust, Reel/Carousel
- note: deepen themes that deserve long-form treatment
- TikTok / Shorts: reuse winning video material; no dedicated production by default
- LINE: relationship / diagnosis / offer path; reuse the existing LINE harness

## Existing waterways

- Existing `XCommandCenter` stays the X execution surface.
- Existing `ContentScheduler` stays the X/LINE scheduling surface.
- LAB `ace-dashboard` PR #23 is reference-only. Port UX ideas, not the whole implementation.
- note draft creation is handled by `takraw369/masa-automation` MASA OS MCP.

## note dashboard handoff v0.1

The public/cloud Dashboard does not directly call a local stdio MCP or expose the local browser profile.

The Dashboard creates a base64url JSON handoff command:

```text
cd ~/masa-automation/mcp/masa-os && npm run note:handoff -- <payload>
```

The local command creates an unpublished note draft with the authenticated Brave profile and returns the draft URL.

Publication stays Human Gate.

## v0.2 path

Keep the Dashboard action contract stable and replace clipboard/Terminal transport with the existing external-runner queue once a narrow authenticated queue transport is proven. Do not expose CDP or the browser profile to the internet.
