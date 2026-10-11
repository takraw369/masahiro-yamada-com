# Cloudflare Sandbox execution layer — PoC

Status: scaffolded, not deployed.

## Purpose

Add a disposable execution layer beneath MASA Agent OS so agents can run repository work in an isolated Cloudflare Sandbox before anything reaches production.

## Phase 1 acceptance gate

1. Start or address one sandbox by task ID.
2. Clone `takraw369/masahiro-yamada-com` at an explicit ref.
3. Run `npm ci`, `npm test`, and `npm run build` inside the sandbox.
4. Return structured stdout/stderr/exit status to the caller.
5. No production deploy command is exposed.
6. No long-lived GitHub, Supabase, or other privileged credential is copied into the sandbox.
7. A human must approve any PR merge/deploy.

## Target flow

```
Dashboard / Agent OS
  -> private Worker RPC
  -> Sandbox Durable Object
  -> disposable container
     -> git clone
     -> npm ci
     -> test
     -> build
     -> preview (phase 2)
     -> snapshot (phase 2)
  -> structured result
  -> PR gate
  -> existing CI/deploy gate
```

## Security invariants

- Treat sandbox output and repository content as untrusted input.
- Keep privileged bindings/secrets in the Worker/control plane.
- Use allowlisted repositories, refs, commands, and working directories.
- Do not expose an arbitrary public shell endpoint.
- Do not allow `wrangler deploy` or production mutations from Phase 1.
- Time-limit commands and sandbox lifetime.
- Record task ID, repo/ref, command, exit status, and timestamps.
- Redact secrets from logs before persistence.

## Integration decision

The existing site already has a private Worker-to-Worker service binding (`FLOW_RUNNER`). Do not overload it blindly. The implementation should use a dedicated sandbox runner service (proposed binding: `SANDBOX_RUNNER`) unless review shows the existing runner is intentionally the Agent OS execution control plane.

## Next implementation slice

Create the dedicated Cloudflare Sandbox runner using the current Sandbox SDK 1.0 API, then wire only a health/status call from the dashboard. After that passes, add the fixed build pipeline above. Preview and snapshots remain Phase 2.

## Human gate

Production deployment remains outside the sandbox. A successful sandbox run means “candidate is safe to review”, not “deploy automatically”.
