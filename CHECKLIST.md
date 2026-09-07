# CHECKLIST.md — Production Quality Gate

Use this before reporting a task complete. Skip only items that truly do not apply.
If one applicable item fails, fix it and run the checklist again.

## Scope

- [ ] The change solves the requested problem without unrelated refactors.
- [ ] Existing implementation was checked before adding a new component, route, file, service, or abstraction.
- [ ] No duplicate source of truth was introduced.

## Build / code

- [ ] `npm run build` passes for code changes, or the exact blocker is reported.
- [ ] No obvious TypeScript / Astro / React errors were introduced.
- [ ] Changed files were reviewed as a diff, not only individually.
- [ ] No generated or unrelated files changed accidentally.

## Routing / production

- [ ] Canonical domain behavior remains correct.
- [ ] Path and query preservation were considered for redirects.
- [ ] Auth / gate / middleware behavior was not unintentionally widened or tightened.
- [ ] Cloudflare routes, bindings, Worker names, databases, and secrets were not altered unless explicitly required.
- [ ] A code change is not described as deployed unless deployment actually occurred.
- [ ] A deployment is not described as verified unless production behavior was actually checked.

## Data / security

- [ ] No secret, service-role key, token, password, or private content was committed.
- [ ] Public ACE Tips still require explicit public classification before mirroring.
- [ ] Supabase / D1 responsibilities remain consistent with current code/config.
- [ ] No destructive migration or data operation was introduced casually.

## UX / design

- [ ] UI changes follow `DESIGN.md` and reuse the existing visual language.
- [ ] Mobile layout remains usable.
- [ ] Navigation and CTA paths still work logically.
- [ ] Visual cleanup did not remove necessary context, accessibility, or interaction feedback.

## Documentation

- [ ] If executable config contradicted documentation, stale documentation was corrected.
- [ ] New rules were added only when they prevent a recurring class of mistakes.
- [ ] Temporary implementation notes were not promoted into permanent rules without evidence.

## Self-update

- [ ] MASA feedback from this task that should change future behavior was captured in `LEARN.md`.
- [ ] Repeated learning was promoted to the correct canonical rule/checklist/doc instead of duplicated again.
