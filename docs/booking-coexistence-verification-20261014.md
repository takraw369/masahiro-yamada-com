# Booking coexistence verification — 2026-10-14

PR334 remains draft; no live migration, secret update, payment, invitation, or publication was performed.

## Code correction and observed evidence

- Checkout identifies this flow with `booking_flow=smart_booking_v1` plus booking/request UUIDs. Partial or foreign booking metadata fails closed.
- Receiver accepts byte-preserving forwards only after checking the original endpoint signature against separately configured `BOOKING_LEGACY_STRIPE_WEBHOOK_SECRET`. Direct endpoint continues using `BOOKING_STRIPE_WEBHOOK_SECRET`. Endpoint-specific Stripe secrets are not interchangeable.
- Confirmed bookings validate payment-intent binding before duplicate acknowledgement. Existing deterministic Calendar event IDs are reused if Calendar succeeded before DB confirmation; a pending Meet link returns retry without a second invitation.
- Payment arriving after hold expiry enters `refund_required`, even before another request sweeps expired holds. This deliberately uses processing time and may require review of a payment that completed before expiry but arrived late; it never automatically refunds.
- Independent review found the original timestamptz interval exclusion index was not immutable. UTC `tsrange` fixes actual PostgreSQL migration execution. Isolated PGlite + btree_gist tests cover migration, private ACLs, overlap and timezone, replay, payment mismatch, expiry/refund state. PGlite is an isolated PostgreSQL engine; it is not production Supabase or an independent-connection stress test.
- `BOOKING_REVENUE_RECONCILIATION_READY` defaults off and independently blocks all customer requests before provider calls. Core purchases requires contact_id; no verified booking/contact identity exists. Setting this flag is not a substitute for implementing and testing that binding.

## Existing Issue215 route verification

Fresh production deployment run: 38493205716, master a53c2015617db826be1380a7843df51ea8fd1c79, all release gates + protected deploy succeeded.

- `/mental-check`: HTTP200; browser 390/1280px no page overflow; existing LINE and toolkit links present. Browser waited for actual questions: questionnaire API HTTP200, 23 question cards / 100 radio inputs, no page errors and no overflow at 390px. No questionnaire submitted.
- `/api/funnel/mental-check`: unauthorized origin ->403; allowed origin with invalid body ->400 invalid_event. No synthetic conversions inserted.
- Live core DB aggregate `mental_check_%` events returned zero rows. This does not establish acquisition or conversion success.
- `/library/entry-toolkit`: HTTP200; actual content says MEMBER candidate / under preparation, with opt-in preview. It is not a delivered free Quest. No claim of free delivery.
- Existing LINE URL resolves HTTP200 to the official account add surface. Read-only deployed `line-menu-router` v8 contains 勝ち筋 -> existing offer -> 勝ち筋｜申込 -> qualification, plus existing QUEST menu. Friend/add, actual keyword message, response, checkout and delivery on a real user's LINE remain UNVERIFIED. No external message sent.
- `/booking` on production:404, consistent with unmerged draft. No public booking launch.
- Dashboard chart / authenticated runtime / real conversions remain UNVERIFIED.

## Release gate / smallest next action

1. Review PR334 and backend PR236 together. Apply their migrations only after staging checks and explicit production authorization.
2. Implement verified booking/contact binding and canonical purchases reconciliation; test purchase parity before setting the revenue flag. Never infer contact identity from customer email alone.
3. Verify merchant account / existing price, legacy + direct endpoint secrets, selected blocker calendars, Google write consent / online venue.
4. Staging: actual signed Stripe deliveries to both endpoints, replay/concurrency/partial failure, real Calendar/Meet invite, canonical purchase and notification readback. Keep all flags off until receipts pass.
5. Final human operation: approved merge/deploy and only then limited activation with rollback flags. Real-user LINE handoff and toolkit provision are separate receipts.

## Resume

Code source: https://github.com/takraw369/masahiro-yamada-com/pull/334 and https://github.com/takraw369/masa-automation/pull/236.
Stable checkout: `/Users/hondod20/Projects/masa-three-tasks-20261014/work/website`; Documents checkout became iCloud dataless and is not the active checkout.
Acceptance for implementation: focused and full tests + build + preview/security + independent diff review + GitHub current-head CI. Acceptance for launch remains UNVERIFIED until live receipts above.
