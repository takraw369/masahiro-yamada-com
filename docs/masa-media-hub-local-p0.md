# MASA Media Hub — Mac-first local inventory

Status: **Draft PR #374; not deployed or merged.** Local metadata catalog and review; Google Photos originals remain read-only. This extends the existing Media Hub, not a second MASA OS or mobile capture system. IMAGE_ASSET_OS / VIDEO OS / CONTENT_OS in Drive remain canonical; reuse #216 Playground for deliberate Knowledge/Content capture. This catalog is not uploaded to the Dashboard, Drive or an AI provider.

## Mac pilot (Node 22.18+)

```sh
node scripts/media-hub/mac-start.mjs
```

Choose an **extracted** Takeout directory. Default: first 500 supported media in deterministic path order. Reports are private, source-specific directories under `~/Library/Application Support/MASA-Media-Hub/`. Existing sources are never renamed, moved, deleted, re-encoded or uploaded. ZIP input is not supported.

Use explicit paths for reproducible canaries (examples are placeholders):

```sh
node scripts/media-hub/cli.mjs scan "/path/to/Takeout/Google Photos" --out "/path/to/private/report" --limit 500
node scripts/media-hub/cli.mjs status "/path/to/private/report/media-index.sqlite"
node scripts/media-hub/cli.mjs audit "/path/to/private/report/media-index.sqlite" --limit 100
node scripts/media-hub/cli.mjs serve "/path/to/private/report/media-index.sqlite"
```

The viewer uses the same existing local gallery, random per-session URL and loopback binding. Never share the session URL or private catalog. Absolute source root and database are not served. HEIC/TIFF and some video codecs depend on browser support; thumbnails, transcoding, OCR, duration extraction and semantic/vision search remain **unimplemented**.

## Resume / incremental scans

Ctrl+C or SIGTERM checkpoints the current scan. Continue with the same source and report directory:

```sh
node scripts/media-hub/cli.mjs scan "/path/to/Takeout/Google Photos" --out "/path/to/private/report" --resume --limit 0
```

`--limit` is the total media count for this scan, not an additional batch size. `--limit 0` intentionally opts into the complete extracted source. Mac picker equivalent: `mac-start.mjs --resume --full`. Unreadable directories/media leave the scan `incomplete`; `--resume` retries failed tasks. A file changed while paused loses its cached duplicate proof. Exact pilot limits are marked complete only when no work remains. After a completed scan, omit `--resume` to incrementally rescan: unchanged file fingerprints reuse SHA256 and unchanged metadata avoids FTS rewrites; metadata edits are re-read and manual classifications survive. Missing files are retained internally with their reviews, counted as missing after a full completed scan and omitted from normal search. Partial scans do not prove absence.

A hard kill/power loss may leave `media-index.sqlite.scan.lock`. After **verifying no scanner is running**, remove only that lock inside the private report directory, then `--resume`. Never remove the catalog or originals for recovery. Do not run concurrent scanners against one catalog. A different source requires a different report directory.

SQLite keeps traversal tasks, metadata and the trigram search index on disk. Discovery batches hold at most 256 records; search returns at most 72 records. A single very large folder is enumerated fully to establish deterministic order and metadata matches before its media is scanned; a 500-item pilot therefore does not promise only 500 sidecar reads. Sidecar reads are capped at 2 MiB. SQLite cache is 8 MiB, database limit approximately 2 GiB, free-space floor 512 MiB; sorting uses disk. These bound application buffers, not a fixed process RSS. Hashing is sequential, 256 KiB stream buffers, at most 128 MiB per file and **1 GiB total per invocation** by default. `--no-hash` or `--hash-budget-mb 256` lowers that work; unverified equal sizes remain candidates. No near-duplicate recognition is claimed.

## Classification and retrieval

```sh
node scripts/media-hub/cli.mjs query "/path/to/private/report/media-index.sqlite" --q "研究資料"
node scripts/media-hub/cli.mjs review "/path/to/private/report/media-index.sqlite" --id ITEM_ID --category KNOWLEDGE --priority A --tags "論文,参考画像" --project "MASA OS" --privacy PRIVATE --rights REVIEW_REQUIRED
node scripts/media-hub/cli.mjs query "/path/to/private/report/media-index.sqlite" --priority A
```

LIFE / KNOWLEDGE / CREATIVE / EVIDENCE are filename/folder **suggestions**, otherwise UNSORTED. S/A/B/C, tags, project/topic, privacy, rights and useStatus are manually reviewed fields stored only in the private catalog. Reviews override suggestions and enter search immediately; the current gallery is still read-only, so corrections use the CLI. Japanese substring search uses trigram FTS for 3+ characters and SQL substring matching for shorter terms. This searches text metadata, not image meaning. Reviews and handoff receipts must be backed up with the database before rebuilding it.

## Metadata / audit contract

- Exact `<filename>.json` and `<filename>.supplemental-metadata.json`; explicit duplicate variant `photo.jpg(1).json` for `photo(1).jpg`.
- Truncated filenames matched only by an exact, unique sidecar title within the same folder. Ambiguous titles stay unmatched. Edited-file mappings are not guessed.
- Valid capture timestamp, then creation timestamp, then file mtime; the actual selected date source is stored. Invalid timestamp text never earns a Takeout date label.
- Folder context is recorded separately. Album membership is claimed only when that folder's `metadata.json` contains exported album title/access evidence. A year folder alone is not an album claim.
- Audit reports include missing/ambiguous/unmatched or malformed/oversized sidecars, unsupported files, skipped symlinks, read/hash/directory failures. Private relative paths appear only in local audit output. A successful scan can still have audit findings requiring review.
- Exact SHA256 proof is distinct from same-size candidates. Cached hashes are invalidated by source fingerprint changes; failures do not become proof. Hash equality is not a Google Photos media ID.
- Export-supplied Photos links remain **unverified**. No transient Picker baseUrl is persisted as a durable source link.

## Synthetic Mac verification

One command, no private archive needed:

```sh
node scripts/media-hub/canary.mjs
# Optional scale check (synthetic files + sidecars only):
node scripts/media-hub/canary.mjs --count 10000
node --test tests/media-hub*.test.mjs
```

The canary retains only its own synthetic temp fixture/report and prints timing, peak RSS, search latency, permissions/API/review/resume evidence. It is **not real Takeout or Eagle acceptance**. Real corpus throughput, macOS folder-picker interaction, HEIC/codec playback and private-library metadata variants remain UNVERIFIED until an approved representative export is checked.

## Google Photos reflection boundary

[Official scope change](https://developers.google.com/photos/support/updates): since March 31, 2025 Library API lists/searches/edits only app-created content. [Picker](https://developers.google.com/photos/picker/guides/get-started-picker) is user selection, not unattended whole-library enumeration. Do not re-upload originals to bypass this restriction or claim two-way sync.

Existing-media actions must be proposals with `proposed → opened → manually-confirmed → completed` (or skipped/error); opening a link is not evidence of a change. Direct official writes, OAuth scopes and native UI assistance are separate future work requiring meaningful value and approval. There is no Google Photos write transport in this implementation.

## Human gates / remaining acceptance

No merge, production deploy, original deletion/move, Google Photos changes, external personal-photo transmission or public local-media exposure without specific approval. Eagle handoff must use official APIs, one manually selected asset first, without editing internal library files. No live import is accepted until the real small Takeout canary and Eagle receipt are observed. See Issue #373 and `docs/checkpoints/media-hub-20261017.md` for fresh evidence and the next verifiable action.

## Eagle connection and preparation (no live writes yet)

Eagle 4.0.0 is installed on the checked Mac; its localhost API remained unavailable even after starting the app in the background. No library contents or settings were read or changed. `eagle-check` calls only the documented [application info](https://api.eagle.cool/application/info) endpoint on `127.0.0.1:41595`. It returns availability/version/platform and strips executable paths and raw errors. There is no browser credential or remote endpoint override. Authentication-required responses stay explicit; credential setup is not guessed.

```sh
node scripts/media-hub/cli.mjs eagle-check
node scripts/media-hub/cli.mjs eagle-prepare "/path/to/private/report/media-index.sqlite" --id ITEM_ID --mode local-original --approve-local-copy
node scripts/media-hub/cli.mjs eagle-queue "/path/to/private/report/media-index.sqlite"
```

Preparation requires reviewed priority/privacy/rights and an unchanged source fingerprint. It creates a durable, idempotent **pending plan**, with bytes-to-copy estimate and a source-specific marker for future receipt reconciliation. `--approve-local-copy` selects that one original for the plan; it does not execute a copy. `executionEnabled` is always false. No Eagle POST, library mutation or duplicate full-resolution storage occurs in this iteration. Stale plans must be re-prepared after source/review changes.

A bookmark plan instead uses `--mode bookmark --verified-url "https://photos.google.com/photo/VERIFIED_ID"`. The supplied URL must be manually verified by the user, exactly match the exported source URL, and have no query/fragment/credentials; temporary media URLs are rejected. The plan targets the documented [Plugin API `eagle.item.addBookmark`](https://developer.eagle.cool/plugin-api/api/item#atulp), which supports bookmarks; no nonexistent HTTP bookmark endpoint is invented. A local-original plan records the documented [HTTP `addFromPath`](https://api.eagle.cool/item/add-from-path). Its success response lacks an item ID, so a future write adapter must reconcile the marker through bounded item queries and persist a real receipt. A timeout must never trigger a blind second import. That executor, retry/reconciliation and a real Eagle receipt remain **unimplemented** until a real canary and single-item review.

## Local Google Photos action proposals

```sh
node scripts/media-hub/cli.mjs photos-propose "/path/to/private/report/media-index.sqlite" --id ITEM_ID --action add-to-album --note "Review album in native Photos"
node scripts/media-hub/cli.mjs photos-transition "/path/to/private/report/media-index.sqlite" --id PROPOSAL_ID --state opened
node scripts/media-hub/cli.mjs photos-transition "/path/to/private/report/media-index.sqlite" --id PROPOSAL_ID --state manually-confirmed --confirmation "I checked the album in Photos"
node scripts/media-hub/cli.mjs photos-transition "/path/to/private/report/media-index.sqlite" --id PROPOSAL_ID --state completed
```

These commands only record the user's manual report in the same private database. They do not open links or change Photos. Supported proposal types: add-to-album, favorite, archive, review-metadata; deletion is excluded. `opened` cannot transition directly to `completed`. A nonempty manual confirmation is required, retained as `manual-user-report-only`, never API sync proof. Skipped/error states remain explicit. There is no OAuth transport or claim that the actual remote state was independently verified.

## Verification receipts (2026-10-17)

- Focused media tests: 22/22 on Mac Node 22.17.1 and Node 24.19.0. Repository recommendation remains Node 22.18+.
- 10K synthetic physical-file/sidecar canary on the first implementation: 52.328 s inventory/resume, 2.72 ms search p95, 145.5 MiB peak RSS, 27.30 MiB catalog; 10K fingerprints reused on rescan.
- Final 500-item synthetic canary after error-handling fixes: 2.469 s inventory/resume, 1.44 ms p95, 77.8 MiB peak RSS, 1.45 MiB catalog; 500 reused. Timings are machine/fixture specific.
- **100K physical-file trial did not complete**: host disk filled after 81,535 indexed records (231,206,912-byte catalog). Only generated synthetic fixtures were removed; space recovered to approximately 1.4 GiB. No real originals were touched. Capacity planning had been insufficient. Canary now checks estimated file/block/catalog/reserve requirements before creating any fixture and monitors capacity while generating. A 100K request on this host now rejects before creating files. No 100K completion/performance claim.
- SQLite automatic rollback on FULL/IOERR is [documented behavior](https://www.sqlite.org/lang_transaction.html). The original capacity error now survives an already-rolled-back transaction, committed records remain intact, and inability to write a failure marker does not mask the original error. A regression test reproduces SQLITE_FULL using an in-memory page limit without filling the host disk.
- Full local suite: 548/548 PASS using a work-only Playwright adapter to the installed Google Chrome for the existing Pipeline browser test (the system Chromium wrapper is broken); repository tests were not altered for that environment issue.
- Local production build, release-delta typecheck and isolated Worker smoke passed; full repository typecheck still reports 214 pre-existing errors. Dependency security gate passes with the existing http-cache-semantics exception expiring 2026-10-31.
- Existing gallery rendered with synthetic data at 390/1440/1728px, text search/empty state verified, no horizontal overflow. Better Design comprehension PASS; spacing: 0 critical / 0 serious / 3 moderate inherited spacing-scale findings. Status distinguishes pilot/cancel/failure/incomplete, inferred category versus explicit category review, and file-mtime fallback. No Dashboard route or public HTTPS preview was created, so no public Dashboard VALID receipt is claimed.

Synthetic screenshots (no real media): [desktop](media-hub/synthetic-1440.png), [mobile](media-hub/synthetic-390.png).

## MASA OS 3 continuation (2026-10-17)

`node scripts/media-hub/canary.mjs --count 500 --mixed` extends the existing canary with JPEG/HEIC/MP4/MOV/PNG extension labels, Japanese names, missing/malformed sidecars and invalid-date fallback. Non-PNG containers are deliberately synthetic bytes: this validates indexing/metadata, **not codec decoding**. The mixed mode is capped at 1,000. Media and sidecar SHA256 are checked after scanning; duplicate proof, resume/reuse, search, private range transport and one idempotent disabled Eagle plan are tested. Set an OS temp directory on a disk with sufficient free space; do not weaken the 512MiB scanner reserve or repeat the 100K trial.

macOS AppleDouble `._*` resource forks are now audited and skipped before media/JSON classification. On ExFAT they otherwise consumed pilot slots and produced fake photos/sidecars. This was reproduced with synthetic fixtures on the actual external disk and corrected without altering those files. Permission mode checks now verify the reported mode after chmod; this is a current-mount check, not an assertion about portable ExFAT ACLs.

Reviews retain their classification/tags after rescan, but approval is tied to the observed source fingerprint. Changed bytes or legacy reviews without a fingerprint require explicit renewed review before Eagle planning. Category must be explicitly reviewed as well as priority/privacy/rights; inferred category is not exported as reviewed metadata. No Eagle executor is enabled.

CLI rejects unknown/repeated flags before starting a scan, refuses to create a catalog for mistyped read-command paths, and exits nonzero for an incomplete scan while retaining `--resume`. `--help` exits successfully.

Eagle's documented application-info endpoint was available in the current session (4.0.0 / darwin). This supersedes the earlier unavailable observation, not the unverified actual-import status. No library content, tokens or settings were read; no write API was called. A representative real Takeout path has not been explicitly approved in the recovered records; no real media canary was performed.

### Cross-feature connection audit

The existing paths can support the requested sequence, with explicit gaps:

| Stage | Existing asset/path | Boundary still required |
| --- | --- | --- |
| Knowledge search/classification | Drive Canon and `/dashboard/knowledge`; NotebookLM offline packet | Review private source/interpretation/rights, current Canon and owner permissions before LINK/MERGE/REFERENCE |
| Photo/video search/classification | Existing private local SQLite Media Hub, reviewed categories/tags | Approve representative Takeout path, validate 500 real files; codec/semantic recognition remains unverified/unimplemented |
| Select production materials | Existing manual selection and #216 capture/Playground boundary | Keep media local; confirm rights and select exact source IDs/paths intentionally; there is no automatic canonical promotion |
| Content creation | Existing Intelligence/PostDraftShelf and Content Studio | Preserve source IDs/URLs/claim labels and source rights; do not copy internal metadata as public text |
| Save/resume | #376 existing Post editor + Content Scheduler library | Same-browser best-effort store; authenticated queue extension needs canonical writer/revision review, not a new DB |
| Publish after personal review | Existing X compose review and remote publication APIs | Fresh account/text/time confirmation; real actions and production writes remain Human Gate |

This is a connection audit, not a claim that all three unmerged branches are already integrated in production. The PRs keep separate file scopes. No new Dashboard, cloud DB or automatic transfer was added.
