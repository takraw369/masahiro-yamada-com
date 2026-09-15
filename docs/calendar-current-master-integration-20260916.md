# Calendar current-master integration — 2026-09-16

## Boundary

This integration selectively ports Calendar assets from historical PR #44 onto the current control-plane baseline.

- Google Calendar remains the canonical fact/source of truth.
- `/dashboard/schedule` is a read-only Calendar presentation layer.
- `/dashboard/content-schedule` preserves the X/LINE content scheduler as a separate concern.
- only exact `POST /api/dashboard/calendar/sync` bypasses browser session/origin checks; it still requires its independent Bearer secret.
- GET, trailing-slash, and sibling Calendar API paths remain under normal Dashboard authentication.
- the existing v2 owner-gate migration already present in the repository is reused; no migration is applied by this change.

## Human gates still required

This code integration does not activate Calendar synchronization. Production activation remains separate and requires explicit authorization for the Worker secret, matching Apps Script configuration, Google Calendar authorization, one manual sync verification, and only then any recurring trigger.

No production deployment, secret mutation, database migration, or Apps Script activation is part of this PR.
