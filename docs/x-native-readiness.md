# X Native read-only Dashboard diagnostics (draft)

The existing `/dashboard/post` page keeps using the X Harness poster and
scheduler. Nothing in this change selects a native account for posting.

When an operator opens the existing **接続と分析** tab, a separate panel calls
`GET /api/dashboard/x-native-accounts`. This new route:
- is already covered by centralized Dashboard session and same-origin checks
  in `src/middleware.ts`, and repeats session verification locally;
- refuses access unless Worker runtime variable `X_NATIVE_READ_ENABLED` is
  **exactly** `true` (default OFF, 423 response);
- uses the existing private Cloudflare `FLOW_RUNNER` service binding and its
  `xNativeAccountsReadOnly()` method from masa-automation Draft PR #245;
- strips unknown fields and refuses multi-account/write-capable responses;
- never returns API tokens or X provider raw errors;
- has **no POST or publishing route**, no Account OS switch, and no new secrets.

Until the Flow Runner #245 code passes review and is explicitly deployed,
keep this feature OFF. Changing this flag and deploying either production
Worker needs a separate explicit human approval. When permitted, validate
one real user-context token and `GET /2/users/me` first; do not equate a brand
playbook with a connected X OAuth account.

Existing X Harness and the Dashboard's `/api/x-harness/*` publishing
paths remain unchanged. Do not enable X official API posting from this panel.

Related:
- Flow Runner prerequisite: https://github.com/takraw369/masa-automation/pull/245
- X Harness recovery runbook: docs/x-connection-recovery.md
