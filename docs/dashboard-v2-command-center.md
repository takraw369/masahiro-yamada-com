# Dashboard V2 — Command Center Redesign

Date: 2026-09-11
Status: UX prototype / Draft PR only
Route: `/dashboard/ui-v2`

## Purpose

Rebuild the private MASA OS Dashboard around daily decisions rather than around the number of available features.

The current Dashboard has useful tools, but its information architecture makes the user scan too many destinations and too much explanation before deciding what to do next.

V2 changes the top-level question from:

> Which feature should I open?

To:

> What do I need to move now?

## Current-state diagnosis

### 1. Flat navigation

The existing global sidebar exposes around fifteen destinations in one continuous list. Voice, Intelligence, Evidence, posting, calendar, quests, money, investment and wishlist all compete at the same hierarchy level.

Result: every visit begins with navigation cost.

### 2. Dashboard home is carrying too many jobs

The current home combines:

- strategic focus cards
- AI operating metrics
- visual prompt entry points
- social-media/account hub
- operating principles

All are individually useful, but together they make the home page behave like a directory + report + strategy document.

### 3. Strategic cards are too expanded

Center Pin / Tipping Point / Next Task are valuable concepts, but displaying every explanation in large cards makes scanning slow. The V2 overview keeps Center Pin + Next visible and pushes deeper explanation down one level.

### 4. Brand design is being used as application design

The existing black/gold design language is strong and should remain. The issue is not the palette. The issue is that generous landing-page spacing, editorial typography and large cards are also being used in a high-frequency operational tool.

V2 keeps the brand but raises information density and interaction clarity.

## V2 information architecture

### Level 1 — Today

The home page should answer three questions in under five seconds:

1. What matters now?
2. What is the next action?
3. Where do I go to execute it?

Top page composition:

1. Today header
2. One dominant Next Action panel
3. Four Quick Start doors
4. Compact Active Loops
5. Purpose-based Workspaces

### Level 2 — Workspaces

Group functions by user intent instead of technical feature name.

#### NOW
- Today
- Voice Inbox
- Calendar

#### CREATE
- X Post
- Visual Prompt
- Trinity Funnel
- Distribution after its canonical PR lands

#### THINK
- Intelligence
- Evidence Lab
- Graph

#### BUILD
- 0→9 Flow
- Quest
- リアン

#### ASSETS
- Treasury
- Investment
- Wish List

## Interaction principles

### Progressive disclosure

Home shows enough to choose the next action. Detailed metrics, evidence and state belong inside their workspaces.

### One primary CTA per state

The most important current loop gets one dominant CTA. Secondary destinations remain visually quieter.

### Scan before read

Rows and compact cards replace tall narrative cards where the user is choosing rather than learning.

### No fake data

The preview uses the same focus text that is currently hard-coded on the existing Dashboard. Any future counts, alerts, recency indicators or system status must be connected to a real read model before they are shown.

### Mobile is a first-class operating surface

The V2 sidebar becomes a drawer below 900px. Quick actions and workspaces collapse from four columns to two, then one.

## Visual direction

Keep:

- true-black / warm-black surfaces
- restrained gold accent
- Cormorant Garamond for display typography
- Zen Kaku Gothic New for UI copy
- sharp geometry
- quiet motion

Change:

- reduce oversized editorial whitespace inside the private app
- improve body-text contrast
- make labels smaller but clearer
- prefer rows for operational state
- reserve large typography for the single most important decision on the page
- group navigation visibly

## Prototype boundaries

This PR intentionally does not replace:

- `src/layouts/DashboardLayout.astro`
- `src/pages/dashboard/index.astro`
- authentication
- middleware
- APIs
- database schema
- deployment configuration

It adds an isolated preview route and layout so it can be reviewed without colliding with active Calendar / Distribution / release work.

## Recommended integration order

### Phase 1 — Review V2 preview

Review `/dashboard/ui-v2` on desktop and mobile. Confirm the information hierarchy before wiring additional data.

### Phase 2 — Navigation consolidation

After active PRs touching `DashboardLayout.astro` are settled, port the grouped navigation structure into the canonical layout.

Include Distribution only after the canonical Distribution PR is accepted.

### Phase 3 — Replace canonical home

Move the V2 Today composition into `/dashboard`.

Keep one dominant Next Action, Quick Start, compact Active Loops and Workspaces. Do not restore all existing homepage modules by default.

### Phase 4 — Connect live operational state

Only add live badges when a trustworthy read source exists, for example:

- Voice inbox unprocessed count
- Distribution hold / ready state
- Calendar next fixed constraint
- Intelligence unread / queued items
- publishing result or post ID state

### Phase 5 — Command palette

Expand the current lightweight `⌘K` quick jump into a unified command palette only after canonical navigation is stable.

Potential commands:

- capture idea
- open latest Voice item
- create X draft
- open current Center Pin
- open next Calendar constraint
- search Dashboard destinations

## Success criteria

The redesign is successful if:

- the next action can be identified within five seconds
- common actions are reachable in one click from Today
- no more than five top-level mental categories are required
- mobile use does not require scanning the entire navigation list
- operational status is shown only when it is real
- the Dashboard feels like an OS, not a collection of feature pages

## Collision note

As of 2026-09-11, active work includes Dashboard layout/navigation changes in Calendar and Distribution lanes. This prototype deliberately avoids editing the canonical layout or home page so those workstreams can be merged/rebased independently.
