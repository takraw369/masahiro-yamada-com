# Publishing Flow OS

Status: feature branch / Human Gate before production merge.

## Purpose

Make publishing understandable from one operating surface:

`JOURNEY -> WHAT -> WHERE / CTA -> WHEN -> CREATE -> RESULT -> LEARNING -> NEXT`

The primary question is not only “what should I post?” but:

`Who is where now -> what state change should happen next -> what content / channel / ask serves that change?`

## Canonical ownership

- Drive `CONTENT_OS｜コンテンツ資産・商品化台帳` = content / Core canonical
- Drive `SNS_ACCOUNT_REGISTRY` = account canonical
- Drive `DISTRIBUTION_OS｜発信・配信・KPI` = publish result / KPI canonical
- Drive `📡 配信司令塔｜What × Where × CTA` = operating rules
- `/dashboard/content-flow` = decision / interaction overlay
- `/dashboard/content-schedule` = timing surface
- `/dashboard/post` = X draft / Human Gate surface
- GitHub = implementation source

Dashboard localStorage is not canonical and must not overwrite Drive by itself.

## Journey phases

1. TOUCH — notice
2. MIRROR — self-recognition
3. SHIFT — reframe
4. MAP — connect structure
5. QUEST — try
6. PROOF — reflect / evidence
7. FLOW — share / participate / circulate

The canonical journey has order. The public feed does not have to be linear: people enter at different times, so weekly publishing can spiral across phases.

## Ask-size rule

CTA strength follows readiness, not platform.

- TOUCH / MIRROR: save, reply, follow, reflect
- SHIFT / MAP: continue, read, inspect a map / deeper asset
- QUEST: try one experiment
- PROOF: report result / case / evidence
- FLOW: share, teach, join, co-create, next question

A content item may be CONTENT READY while distribution is still HOLD if audience / account / channel is unresolved.

## UI contract

`/dashboard/content-flow` stores only lightweight decision overlay state:

- current Journey phase
- weekly question / theme
- Core ID / Big Idea
- Primary Audience
- Primary Channel
- CTA
- material notes
- local Result / Learning notes

It links to Drive canonicals and hands the current decision context to `/dashboard/post` through localStorage key `masa-publishing-handoff-v1`.

`/dashboard/post` displays the handoff and can insert a non-published scaffold into the existing composer. Publication remains Human Gate.

## Distribution PR #66

PR #66 is an older, larger Media Doors / Next Post Deck implementation based on a stale master baseline. It remains reference-only while this current-master Publishing Flow integration is reviewed. Do not merge #66 as-is.

Useful concepts from #66 that may be reused later:

- account verification gate
- verified media-door snapshot
- live Drive -> Supabase read model
- note MCP handoff
- Result / Learning loop

Do not reintroduce a second canonical store or direct browser writes to Drive.
