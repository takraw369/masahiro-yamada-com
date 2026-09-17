# Knowledge Shelf Market MVP

## Purpose

Turn MASA's conversations, lived experience, research and project learning into a compounding product asset instead of disposable posts.

The shelf is not a second knowledge database. It is the **member-facing publishing projection** of the existing MASA knowledge system.

## Existing waterways first

- Private thinking / capture: FLOW MIND and Dashboard Knowledge surfaces
- Durable canonical knowledge: Google Drive
- Structured knowledge / relations / state: existing Supabase knowledge tables
- Public market surface: `masahiroyamada.com/library`
- Existing lead capture: `/api/library/lead` -> `library_leads`
- Existing offer / purchase system: `offers`, `purchases`, `contacts`
- Existing payment provider path: Stripe-backed offers

Do not create another repo, another primary database, another CMS or another knowledge truth source for this workstream.

## Product loop

`Conversation / experience / research`
→ `core extraction`
→ `A3 / PDF / template`
→ `Knowledge Shelf preview`
→ `market reaction`
→ `revision`
→ `video / audio / diagram`
→ `Quest / lesson`
→ `paid access`
→ `usage / questions / outcomes`
→ `next revision`

The asset should become more valuable as evidence and usage accumulate.

## Access model

Four labels are supported at the catalog layer:

- `FREE` — public full asset
- `ONE-TIME` — standalone purchase
- `MEMBER` — included in recurring shelf membership
- `PRO` — advanced cases, implementation and deeper learning

### Security rule

The visual lock is not an entitlement mechanism.

Before any paid full text, download URL, video URL or private asset is shipped, access must be enforced server-side. Protected content must not be embedded in public HTML and hidden with CSS.

## Market MVP

This branch deliberately stops before paid activation.

It adds:

1. A clear Knowledge Shelf value proposition to `/library`
2. A visible `FREE / ONE-TIME / MEMBER / PRO` content model
3. A Founding Member pricing hypothesis for validation, not checkout
4. `A3 DECISION FLOW` as the first new knowledge-OS asset
5. A per-item media roadmap so one piece of knowledge can grow into worksheet / video / Quest
6. Existing lead capture remains the validation mechanism while products are PREVIEW

No Stripe product, subscription, database migration, secret, auth policy or production deployment is changed in this branch.

## First launch candidate

### A3 DECISION FLOW

Promise:

> 散らかったメモを「一枚で決められる状態」へ変える。

Initial asset:

- A3 one-page framework
- reusable prompt
- blank worksheet / PPT template
- one real MASA project example

Growth path:

- v1: A3 + prompt
- v2: real case study
- v3: 10-minute walkthrough video
- v4: practical Quest
- v5: AI-assisted A3 generator

## Founding Member hypothesis

Displayed hypothesis: **¥2,980 / month**.

This is not activated in this branch. Validate willingness to join before creating the recurring Stripe offer.

Initial promise should stay narrow:

- core documents and templates
- updates / expanded editions
- connected videos
- practical Quests

Avoid promising an unlimited content volume or community operation before the usage signal exists.

## Quality gates before paid activation

1. At least one complete flagship asset is usable end-to-end.
2. Mobile reading is comfortable.
3. Lead capture works on the new item.
4. Paid entitlement is checked server-side.
5. A purchaser/member can recover access without manual intervention.
6. Protected asset URLs cannot be guessed from public HTML.
7. Purchase cancellation / refund / failed payment state has a defined access behavior.
8. Public copy states clearly what is available now versus planned.

## Recommended entitlement architecture

Reuse current Supabase / Stripe / contacts / offers / purchases.

Prefer a thin publication / entitlement boundary instead of adding access columns to every internal knowledge object.

Conceptually:

- `knowledge_items` = private/structured knowledge state
- publication record = what may be exposed to Library
- `offers` = what can be purchased
- `purchases` / recurring entitlement = who may access it
- server route = resolves access and returns protected content/assets

This separation reduces the chance that private Knowledge OS content leaks into the public Library.

## Market metrics

For the first loop, measure only what can change the next decision:

- Library → item detail click-through
- preview → lead registration
- lead source / item slug
- which shelf theme attracts interest
- founding-member waitlist interest
- first paid conversion after entitlement is ready
- usage / completion of the first asset

Do not optimize vanity traffic before the first paid-use loop exists.

## Build-in-public / note angle

Working title:

**「AIとの会話を流さない。知識が増えるほど価値が上がる“資料庫”を自分で作り始めた」**

Story spine:

1. The problem was not lack of information; useful conversations disappeared into chat history.
2. A Toyota-style A3 prompt revealed that one rough memo can become a decision asset.
3. The next idea was to stop treating documents as finished products.
4. A document can grow: A3 → case → video → Quest → AI.
5. Existing MASA infrastructure already had Library, Knowledge OS, lead capture, offers and purchases; the right move was integration, not another app.
6. Build the smallest market surface first, collect reaction, then harden paid access.
7. The long-term product is not a PDF shop. It is a living knowledge shelf.

Keep the note honest: distinguish what is already implemented, what is on the branch, and what is still a hypothesis.

## Next technical slice

After preview review and before production paid launch:

1. Define the membership offer in the existing offer system.
2. Add recurring payment identity mapping without duplicating customer truth.
3. Add server-side entitlement resolver.
4. Add protected Library content endpoint / page.
5. Add one real A3 asset.
6. Test payment → entitlement → read → cancellation behavior in non-production first.
7. Only then enable live checkout.

Production publication and live charging remain human gates.
