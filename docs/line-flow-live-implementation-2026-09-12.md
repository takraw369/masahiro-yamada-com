# MASA OS LINE Flow — Live Integration

Status: implementation branch only. Canonical `/dashboard` remains unchanged until review.

## Purpose

Connect the V2.2 right-brain LINE Flow UI to the existing LINE Harness instead of creating a second LINE backend.

## Safety model

The existing dashboard proxy is intentionally allow-listed. This implementation keeps that model and only adds explicit scenario/tag actions needed by the editor. It does not create a generic passthrough proxy.

Allowed read actions:
- LINE accounts
- tags
- scenarios
- scenario detail
- scenario stats

Allowed write actions:
- create scenario
- update scenario metadata / active state
- add step
- update step
- reorder steps
- delete a step

Not added in this phase:
- scenario deletion
- friend enrollment
- broadcast execution from Flow
- arbitrary Harness endpoints

## UI model

`/dashboard/line`

- account selector
- scenario rail
- visual Step Flow timeline
- selected-step inspector
- scenario stats / reach rate
- create scenario
- add/edit/reorder/delete step
- active/inactive toggle

The UI is intentionally visual-first: semantic colors, icons, timeline, message preview and a single selected inspector rather than a dense settings table.

## Delivery safety

Editing a flow is separate from sending a broadcast. Existing live scenarios may execute according to LINE Harness once active, so active state is always visible and separately controllable.
