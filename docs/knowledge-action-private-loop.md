# Knowledge → practice → feedback

FLOW MIND `/dashboard/knowledge#action` adds a private Action panel to the existing Knowledge cockpit. It reads the existing Fabric, shows source/rights/AI-candidate boundaries, filters by theme/project/audience/use, and creates a practice proposal from selected registered sources. No new knowledge table or public catalog is introduced.

## Shared paths

- Core dependency: masa-automation PR232, `masa_knowledge_action_library_v1` and `masa_knowledge_action_record_v1`. Existing owner-key registry and feedback ledger are reused; install this additive migration only through the release gate.
- Private export: `masa-knowledge-action/v1`, `training_reflection`, 1–12 UUID source references, stable proposal ID, original canonical URLs. The existing ACE `/compiler` explicitly imports the file, compiles a source-linked plan, and stores source lineage in Board/Quest/reflection records.
- Return: `masa-knowledge-action-feedback/v1` contains a stable event ID, original proposal/source IDs, observed outcome/learning/next action, and UTC observation time. Dashboard explicitly imports and records it privately. Re-import returns the same ledger record; conflicting content with the same ID returns409.

Source editing remains in Google Sheets. Practice results and review decisions are pending feedback receipts; they never automatically rewrite a Canonical, promote a relation or publish a customer-facing asset. Human review in this panel records a content-review declaration, distinct from release/publication.

## Verification

Local integration used a fresh readback of23 registered real Factory assets,69 atomic extraction candidates and5 candidate edges, seeded into disposable PostgreSQL-compatible PGlite running the exact migration. It exercised the built Astro Dashboard, existing Next.js ACE compiler and the real source IDs through two selected assets, three Quest entries, reflection export and idempotent feedback return. No real customer practice outcome was fabricated or written to production.

Observed: unauthenticated API401; cross-origin mutation403; source lineage and original observation time preserved; reload recovers a saved proposal; repeat feedback leaves one record;320/390/1280px without horizontal overflow; no external data requests or page errors. Existing font requests were blocked during the isolated test.

Dashboard403 unit/regression tests passed; new helper/API12 tests passed; security gate passed. Changed files pass the release typecheck;207 pre-existing Astro diagnostics remain separate debt. Core9 exact SQL and2 intake tests passed; an independent reviewer found and verified fixes for feedback text, length limits, observation time and conflict classification.

## Release and rollback

Status: draft/review. Production RPC installation and new Dashboard/ACE behavior are not deployed or production-verified. Current public routes remain the canonical daily-use URLs; this document does not claim the new behavior is available there.

Before release: compare current deployed revisions and route inventory; confirm isolated staging for ACE (dev and some feature Workers Builds are connected to production); record rollback versions; install the additive owner RPC migration; deploy gated revisions; run authenticated and negative-auth production canaries and source/feedback readbacks. Keep the private source records and feedback on rollback; revert the UI to its prior revision and remove only these two newly added RPCs if required. Existing tables/RLS are untouched.

Recovery: use the feature PRs, current canonical Factory rows, source stable IDs and the task output resume packet. Private source text is deliberately absent from Git.
