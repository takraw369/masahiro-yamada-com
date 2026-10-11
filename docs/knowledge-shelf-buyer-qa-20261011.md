# Knowledge Shelf Buyer Access — 2026-10-11 QA Receipt

## Status: gated development, NOT live sale
- PR #292 remains Draft. New web code is neither merged nor deployed.
- Private asset gate and verified-email claim DB migrations applied to sunlovesflow-core.
- Catalog remains PREVIEW. No real customer email was sent and no Stripe charge or refund was made.
- Protected assets table remains empty.

## DB access tests: 12/12 passed, rolled back
| Scenario | Observed |
|---|---|
| Draft with identity | not_found |
| Live without permission | forbidden |
| Active MEMBER -> MEMBER | ok |
| Expired grant | forbidden |
| Revoked timestamp | forbidden |
| Revoked status | forbidden |
| Different identity | forbidden |
| MEMBER -> PRO | forbidden |
| PRO -> PRO | ok |
| No item grant -> ONE-TIME | forbidden |
| Synthetic paid purchase with item grant | ok |
| Synthetic refunded purchase | forbidden |

All case data was inserted inside a single SQL transaction and rolled back. Postflight confirmed zero test assets, definitions, grants and purchases. These results prove DB entitlement logic under simulated claims, NOT live browser/JWT/Stripe E2E.

## Identity claim migration and tests
- New RPC: knowledge_shelf_claim_verified_email_v1
- Role check: anon EXECUTE false, authenticated EXECUTE true.
- Auth identity absent -> unauthorized; simulated verified linked Auth user -> linked; unknown Auth user -> email_unverified.
- Only a uniquely matching existing Contact with confirmed auth.users email can be linked. No entitlements are granted.
- Postflight: Contacts 2, person entitlements 1, purchases 1, protected assets 0.

## Buyer portal in PR #292
- /library/account: responsive email OTP and private Markdown reader.
- /api/library/auth/config: public Supabase URL and publishable key only.
- /api/library/content/[slug]: bearer token passed to Supabase RPC; no-store; no client-provided contact ID accepted.
- Product detail links to buyer portal, clearly labeled PREVIEW.
- Reader renders retrieved Markdown via textContent; premium content is never placed into public HTML.

## Hard blockers before real sale
1. Confirm Supabase email template sends OTP code (use token placeholder in template) and validate delivery with an owned inbox.
2. Test real browser login, verified-contact linking and 401/403/404/200 reader outcomes; include iPhone.
3. Stripe test-mode checkout and trustworthy webhook must grant entitlement, then revoke on refund, failure or cancellation.
4. Validate subscription expiry/cancel and buyer access recovery; do not assume SQL fixtures prove webhook operation.
5. Complete the actual first paid A3 asset, keep it private until owner approval.
6. Review cache/CORS, rate limits, mobile UX, privacy/consent and secure session handling.
7. Review PR, merge/deploy and activate checkout only through an explicit human gate.