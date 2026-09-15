# Manual Production Deploy Gate

This branch separates acceptance of code into `master` from production deployment.

## Change

- Production deploy no longer starts automatically on every `master` push.
- `.github/workflows/deploy.yml` remains manually runnable through `workflow_dispatch`.
- The deploy job refuses to run unless the selected ref is `master`.
- The existing deploy-time validation remains unchanged: clean install, tests, release-delta typecheck, production build, isolated Worker preview, dependency security gate, rebuild, then Wrangler deploy.

## Intent

A production release now has two distinct decisions:

1. merge accepted code to `master`
2. explicitly authorize and run production deploy

This preserves a real Human Gate between code acceptance and production release.

No application code, Cloudflare configuration, secrets, DNS, database, Calendar state, or public content is changed by this branch.
