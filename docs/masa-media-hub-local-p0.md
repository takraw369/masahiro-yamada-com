# MASA Media Hub — Mac-first media inventory P0

Status: **Feature-branch prototype; not deployed; no Google Photos or Eagle sync.**

## Intent
Google Photos is MASA's primary library: personal life photos, screenshots, design references and athlete history are mixed together. This P0 adds a **local read-only index and gallery** from an *extracted Google Takeout export*, so no bulk data is uploaded to GitHub, MASA Dashboard, or an AI provider.

As of March 31, 2025 the official Google Photos Library API cannot read/edit the user's entire pre-existing library. Picker API works for user-selected media. The goal of Google Photos-side write-back remains gated; do not promise automatic two-way synchronization.

## Start on a Mac (Node 22+)

1. Export a small representative Google Photos album or period via https://takeout.google.com/ and unzip it **locally**. Google Photos originals stay unchanged.
2. Use the actual extracted path, not the example path below:

    node scripts/media-hub/cli.mjs scan "/Volumes/takraw555/Takeout/Google Photos" --out "/Volumes/takraw555/MASA-Media-Hub-Private" --limit 500
    node scripts/media-hub/cli.mjs serve "/Volumes/takraw555/MASA-Media-Hub-Private/media-index.json"

3. Open the printed **http://127.0.0.1/...** URL in the same Mac's browser. Ctrl+C stops the server.

The sample paths are illustrative; local directories have NOT been verified. Only unpacked Takeout directories are supported, not ZIP input. Omit --limit after the pilot; use --no-hash for faster scanning if same-sized files may remain unverified duplicates.

## Implemented
- Recursive read-only scan of photos/videos, no symlinks, no source rename/move/delete.
- Exact supported Takeout sidecar names: <filename>.json and <filename>.supplemental-metadata.json.
- Capture-time metadata where present; otherwise **file mtime clearly labeled as fallback**.
- Export-supplied photos.google.com URL recorded only as **unverified**, not a guaranteed durable link.
- Heuristic LIFE / KNOWLEDGE / CREATIVE / EVIDENCE suggestions; UNSORTED if uncertain. Image-content AI recognition is NOT implemented.
- SHA256 exact duplicates among same-size candidates <=128MB; larger same-size candidates remain unverified.
- File-count/size summary, mobile-responsive local gallery with filename/description search, filters, paginated cards, manual video-preview click and a duplicate filter.
- Private JSON report file (0600) and directory (0700); random per-session URL token; HTTP bound strictly to 127.0.0.1; no remote CDN or network ingestion; no Eagle or Google credentials.

## Gaps / non-goals at P0
- No Google Photos OAuth, existing album changes, deletions, or claims of synchronization.
- No Eagle API calls yet; this is a safe prerequisite for verified bookmark linking.
- No persistent user-edited tags, OCR, embeddings, video transcription, incremental resume, bulk archive reading, AI facial processing, or full 100K-file performance claims.
- Google Takeout sometimes truncates filenames and varies sidecar naming; unmatched metadata deliberately falls back to file timestamps. When different albums contain duplicates, exact file hashes are not identical Google Photos IDs.
- Previews of HEIC, TIFF, MOV and unusual video codecs depend on browser support.
- Index root path and filenames are private and must not be checked into GitHub or uploaded to public services.

## Next engineering slices
1. P0.2: real small Takeout pilot on MASA's Mac, performance profiling and improved sidecar matching; make scan resumable, add human-review tags and evidence.
2. P0.3: Mac-only authenticated Eagle adapter on one user-selected asset. The app must not expose Eagle token to a public website. Confirm any Google Photos URL before creating bookmarks; otherwise use approved local file handoff.
3. P1: Google Photos **native-action review queue** for existing files, with manual confirmation rather than false 'synced' status; direct API changes only for app-created items.
4. P2: reuse existing #216 mobile Share Sheet / private Playground rather than constructing duplicate Inbox or mobile-first architecture.

## Verify
Run: node --test tests/media-hub.test.mjs

Repository-level suite: npm test
GitHub: #373 MASA Media Hub; #216 Mobile Capture Bridge.

Guardrail: private media never leaves the device, no automatic delete/share/post/deploy, and no unconditional 2-way Google Photos sync.
