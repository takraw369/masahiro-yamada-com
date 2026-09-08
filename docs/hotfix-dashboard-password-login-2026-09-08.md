# Dashboard password login hotfix — 2026-09-08

## Production observation

After PR #55 was merged and deployed successfully, Google Dashboard login passed on production. The native password form then returned:

`Cross-site POST form submissions are forbidden`

The failure occurs at Astro 7's native form POST origin guard before the page-level password handler can complete.

## Fix

Do not disable Astro `checkOrigin` globally.

Instead:

- keep the Dashboard login page as GET-only SSR
- submit the password with same-origin `fetch()` and JSON
- add `/api/dashboard/password-login` as an unauthenticated bootstrap endpoint
- keep that endpoint inside the existing `isPrivate` same-origin middleware boundary
- verify the password through the existing `verify_dashboard_login_password` Supabase RPC
- issue the same origin-bound rolling Dashboard session cookie on success

Google login and Google-backed password reset remain unchanged.

## Safety

The hotfix does not weaken the global CSRF/origin policy. Cross-origin mutations still fail in middleware. Publication, content, Calendar, X, LINE, and other Dashboard behavior are unaffected.
