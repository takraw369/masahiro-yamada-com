# MASA Sandbox Runner (isolated PoC)

This is a **separate Worker**, not a change to the live Astro site's Worker.

## Deployment prerequisites

- Cloudflare account with Containers enabled and billing reviewed.
- Docker available to Wrangler for image builds.
- From this directory: `npm install`, `npm run check`, then `npm run deploy`.
- `workers_dev: false` intentionally prevents a public workers.dev route.
- Add a **private service binding** named `SANDBOX_RUNNER` to the *authorized control-plane Worker*, not the public site until authentication and rate limits are reviewed.

## Service interface

`GET /health`: returns Worker health without starting a container.

`POST /build`: JSON `{"taskId":"poc-001","ref":"master"}`. Runs the fixed public-repository clone/CI/test/build pipeline; no arbitrary command input.

**Do not expose this Worker publicly.** The caller must authenticate its users and enforce quotas, budgets, task deduplication and rate limits before forwarding a build. Container egress currently uses `enableInternet: true` to support public GitHub/npm; restrict outbound traffic before using untrusted tasks.

## Known limitations / acceptance gates

- First build only per fresh taskId: reusing a taskId leaves `/workspace/repo` populated, so use a new taskId.
- `npm ci --ignore-scripts` may prevent native dependencies from installing correctly. Do not loosen this without a reviewed dependency policy.
- SDK 1.0 uses the native Durable Object container API. Validate Wrangler's generated types, container image build and actual runtime on Cloudflare.
- No test/build has been executed on Cloudflare yet.
- No dashboard wiring, preview, snapshot, PR automation, or production deploy.
- This prototype does not enforce a hard build deadline or cap output memory; implement these and persistence before wider rollout.
