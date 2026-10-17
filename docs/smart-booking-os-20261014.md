# MASA Smart Booking OS — owner-only Booking Lab (2026-10-14)

## Outcome and boundaries
- Customer goal: appointment suggestion based on MASA's calendar, client's preferred area, nearby prior/next appointments, travel time, and venue permissions.
- Reuse PRIMARY masahiro-yamada-com /dashboard, Google Calendar as facts, Supabase sunlovesflow-core as operational data, existing LINE → winning_os_90 → Stripe purchase flow.
- No new product, independent calendar SoT, public user database, hosting service, or new subscription.
- Existing active offer as inspected 2026-10-14: winning_os_90, 90 minutes, JPY 19,800. Premium hotel-lounge package is NOT priced or for sale yet.

## This PR / milestone A — verified scope
- New private route: /dashboard/booking (uses existing DashboardLayout authentication).
- Existing Calendar /dashboard/schedule links to it.
- Client area + session format selection, 90-minute candidate slot generation.
- Uses existing private /api/dashboard/calendar snapshot endpoint; displays no event titles in candidate list.
- Fail-closed: missing/malformed calendar data, source sync >60m old, incomplete date coverage => no candidates.
- Collision protection 20 minutes before/after any registered event; starting times 10:00–18:00 JST, rolling 14d, >=24h booking lead.
- Venue choices are examples ONLY. No confirmed availability, no guessed routing. Verified travel lookup can exclude physically impossible candidate times. Unknown route -> manual confirmation.
- Every result is needs_review, never available, bookable, paid, or automatically reserved.
- Tests: stale window, calendar overlap, all-day, region ranking, missing travel, impossible transitions, corrupt data.
- No SQL migrations, public endpoint, secrets, outbound messages, webhook change, or production mutation.

## Current source limitations (must not be handwaved)
- masa_calendar_events is a snapshot/read model and can omit non-primary calendars. Verify family, partner, coaching, and personal schedules.
- Snapshot currently stores location free text, not verified geocoding areaKey. An unknown areaKey must NOT become a zero-minute travel guess.
- Every third-party venue requires business-use, sound/privacy and room-availability confirmation; Yagawa Plus public spaces are not automatically appropriate for confidential 1:1 sessions.
- A hotel lounge's opening hours, permission, minimum spend, noise level and private information exposure must be checked; a lounge is not automatically a private room.
- External routing travel minutes must come from a real routing API or confirmed table with departure time, mode and safety buffer. No fixed invented cross-city ETA.
- Calendar events carry personal information; public clients should receive only sanitized available slot IDs, never busy event descriptions, location history, or owner keys.
- Current Google calendar sync enabling / secret provision / watch refresh still needs human-controlled integration; /dashboard/booking must not be mistaken for live, customer-facing availability.
- The code uses Google Calendar snapshot only; for actual bookings use live Google Calendar FreeBusy at submission and separate private hold validation.

## Proposed milestone B — verified sale of EXISTING winning_os_90 (not in this PR)
1. Confirm which calendars are blockers vs informational. Explicitly exclude zero-access calendars only after owner approval; failed FreeBusy requests block publishing.
2. Refresh schedule from Google Calendar FreeBusy, not just snapshots; implement source stale policy, watch channel renewal and polling fallback.
3. Select mode and client area without requesting home address; exact preferred hotel chosen only after consent.
4. Transit-aware engine backed by accurate routing service for relevant times, only when endpoints and credentials are ready. Venue is a resource to reserve, not a fact inferred by the model.
5. Supabase booking state with unique timeslot/idempotency, transactional temporary holds and expiry; no accidental double selling in concurrent requests.
6. Client-facing sanitized proposal endpoint plus rate limits/bot protection, reservation confirm after venue availability and Stripe payment succeeds. Payment goes through EXISTING flow; confirm only after webhook verified. Idempotent webhook handling.
7. Calendar event creation with customer consent, privacy-safe title/location, email / LINE confirmation, reschedule/refund windows.
8. Owner approval, release preview, staging E2E for collisions, venue rejection, stale cache, canceled payment, concurrent booking and partial Stripe success.
9. Only after human sign-off: publish limited booking slots, monitor funnel and first paid customer. Keep rollback switch/feature flag.

## Human gate to call milestone A done
- Run npm test, npm run typecheck, npm run build, npm run test:preview and npm run security:check.
- Owner-preview: private login /dashboard/booking; switch online / premium / in_person + areas, confirm all are review-only, confirm no customer PII shown.
- Simulate a missing event calendar, stale snapshot and back-to-back location transition.
- Do not merge without current release and baseline regression checks; master pushes may deploy production.

## Reference
- PRIVATE dashboard: https://masahiroyamada.com/dashboard
- Calendar: /dashboard/schedule
- PRIMARY code: takraw369/masahiro-yamada-com
- Revenue canonical in MASA_OS: 03_CURRENT_STATE｜勝ち筋OS Revenue E2E完了 → Social Growth Sprint 30D
- Google freebusy: https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
