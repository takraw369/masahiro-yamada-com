# Knowledge Shelf | Entitlement Gate v1 (2026-10-11)

## Why
The public Shelf and first-party learning analytics are already merged and recording activity. The lock shown on preview pages is visual only, so it must never be used to distribute paid text or file URLs.

## Implemented in this PR
- New private `knowledge_shelf_protected_assets` table (no client read policies; draft by default).
- `knowledge_shelf_content_read_v1(slug)` database RPC, gated by actual Supabase Auth `auth.uid()`.
- Existing `contacts.auth_user_id` -> `person_entitlements` -> `entitlement_definitions` determines access.
- One-time access via `knowledge_shelf_item:<slug>`; member/pro via `knowledge_shelf_tier:member|pro`, with item-specific grants also recognized.
- Expired/revoked entitlements fail closed; purchase-sourced grants must still link to a paid purchase.
- `GET /api/library/content/:slug` accepts Supabase Auth Bearer token and forwards it to Supabase PostgREST. Never accepts a contact_id, email or visitor ID as proof.
- Private/no-store response; 401 not logged in, 403 no entitlement, 404 draft/not found.
- Contract tests for anonymous denial, publication state, entitlement checks and no-store.

## Explicitly NOT enabled
- New Stripe product, subscription or checkout.
- Paid text in public source, HTML, social snippet or public Storage bucket.
- Publishing any asset: all new DB rows default to draft and the present catalog stays PREVIEW.
- Browser sign-in / member reader UI.
- Signed premium video/file URLs.
- Production site deployment / charge activation.

## Deployment order
1. CI pass; security review on PR.
2. Apply DB migration through controlled migration process. It is additive and creates no live content.
3. Authenticate with a **test** Supabase user linked to a test Contact.
4. Create a test draft asset and verify it returns 404 even with a valid entitlement.
5. In a rollback transaction, flip that test asset to live and test no token (401), invalid token (401), valid token but no entitlement (403), valid token and active asset entitlement (200), expired entitlement (403), revoked (403), and refunded purchase (403).
6. Remove/rollback test fixtures.
7. Build browser sign-in/reader and purchaser recovery flow.
8. Real Stripe test payment → purchase → entitlement → read → refund/cancel → denied read.
9. Check iPhone 320/375/390/430 CSS px; consent/analytics disclosures; no premium data in HTML, response cache or client bundle.
10. Only after human approval, make a completed asset LIVE and enable real checkout.

## Sensitive implementation boundary
The dashboard owner password is **not** buyer authentication. Only a verified Supabase Auth access token grants access to a buyer's own Contact-linked entitlements. Never assume that a Knowledge Journey visitor cookie or email lead proves ownership.

## First content
`a3-decision-flow`: retain the complete A3 template and original examples in **private Drive** as canonical, then copy only a reviewed release version into the protected database table. Do not commit full premium text to the public GitHub repository.

## Related note story
**「資料を鍵付きで売る前に、見た目の鍵と本当の鍵を分けた話」**

Flow: public knowledge preview → learning signals → buyer identity → entitlement → secure asset delivery → actual feedback → revised version. Explain that no content is live or charged until the end-to-end gate is validated.
