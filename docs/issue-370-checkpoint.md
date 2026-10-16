# Issue #370 resume checkpoint

Goal: creation-first entry into existing editors in <=2 intentional taps on 375/390px. Preserve saved themes, drafts, provenance, all publishing/auth/payment gates. Draft PR only; no merge/deployment/paid API.

Base: current master 786d8db229316818df0877c220665551e6863988; branch codex/issue370-creation-first-dashboard.

Discovery complete: read issue #370 and current Home, Cockpit, Studio, Flow, Post, publishingHandoff, design gallery/mobile grammar and CI. No repository AGENTS.md found. Drive DESIGN INTELLIGENCE (1897 paragraphs), PUBLISHING_FLOW_OS (1027 paragraphs), SELLABLE_BOX read via native connector 2026-10-17. Principles: one main task, task-based entry, progressive disclosure, preserve source and draft, explicit human review; research source remains Drive.

PR overlap: #364 inserts status-first task navigation on Home (same insertion point, different goal; reconcile before merge). #325 owns opportunity widget/Design Studio, #345 screenshot composer, #366 video style; no cherry-pick or duplicated features. #359 app catalog and #333 Intelligence do not belong to this change. #365/#339/#357/#331 already merged on master.

Scope: Home task entry before nudge/apps/operations; reuse Post/Knowledge Studio/Publishing Flow. Studio material selection folds after a successful choice and moves focus to editor; saved drafts link and preview jump; no new ingest/generation/MP4. Unsupported article/product packaging remains explicit copy handoff in existing studio.

UNVERIFIED: implementation, visual tests, CI. Local Homebrew Node is broken (missing llhttp); use bundled Node via PATH=/Users/hondod20/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH. npm ci started. Do not change dependency versions to bypass registry/runtime issues.

Next: capture matching baseline renders with synthetic data and no production credentials; implement bounded changes, run tests/typecheck-release/build/security/isolated preview and mobile task log.

Human Gate: MASA KEEP/REFINE/DROP and real iPhone Safari; merge/publication/deployment not authorized. Better Design public HTTPS receipt conflicts with issue's no-deploy gate; use local rendered evidence and explicitly leave that receipt UNVERIFIED, do not publish a private dashboard to satisfy tool validation.
