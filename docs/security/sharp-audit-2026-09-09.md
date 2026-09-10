# Baseline security hotfix: sharp / libheif

## Verdict

**A + D: a real vulnerability in the production baseline dependency tree, exposed by changed advisory availability for unchanged lockfiles.** Not introduced by Distribution, Calendar, or the auth stack. The exact npm advisory ingestion time is not available; do not claim every earlier green run preceded publication.

Audit reproduction uses the same Node **22.23.2** / npm **10.9.8** as GitHub CI and `npm audit --omit=dev --audit-level=high --json`. All five original heads return exit 1, five high-severity affected package entries, for the same underlying advisory. Those are transitive impact entries, not five independent vulnerabilities.

| Ref | Commit | Lockfile SHA-256 | Current audit |
| --- | --- | --- | --- |
| master | 940e8215301d4efdd8c5e92fe78b270bdd55b6ea | 915f28c431852a5b18792fa229f8dc30935f77ba82879727b4f9fda3d8c6f352 | FAIL |
| #73 | d9403d9676805ba763f54954d14866f957e9284d | same as master | FAIL |
| #74 | 593eee4bd73ec452b060f06604258ab647615a43 | same as master | FAIL |
| #44 | d91c32070a6355fdfdd457c677c30fc7ee82ff6e | 2fe0a539c6cb9803076be4558c5118225e016c15ecce989b5f86855d29e2dc9a | FAIL |
| #66 | 71d0fa6a8e53cc5a23f9e52aeab0d635aba965a8 | same as #44 | FAIL |

Calendar's only lockfile addition is the dev-only PGlite 0.5.8 test dependency. Every sharp, Miniflare, Wrangler, Vite plugin and Astro adapter resolution is unchanged across the five heads.

## Exact dependency and advisory

[GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c), severity **high**, affects `sharp <0.35.4`; first patched version **0.35.4**, providing libheif **1.23.2**. The sharp advisory has no assigned CVE; its underlying libheif advisories are GHSA-g89c-p67h-r497 and GHSA-2jg2-4ch7-h545. It concerns decoding untrusted AVIF/HEIF input; the advisory describes possible code execution under particular glibc Linux conditions.

The vulnerable dependency is **transitive**:

- `@astrojs/cloudflare@14.3.0` → `@cloudflare/vite-plugin@1.54.5` → `miniflare@5.20260907.0-alpha` → `sharp@0.35.2`.
- The plugin also resolves `wrangler@4.129.1` through that Miniflare version.
- Direct dev tool `wrangler@4.129.0` → `miniflare@5.20260903.0-alpha` → `sharp@0.35.2`.
- Actual vulnerable installed locations: `node_modules/miniflare/node_modules/sharp` and `node_modules/wrangler/node_modules/sharp`. Astro's top-level `sharp@0.35.4` is already patched.

Why `--omit=dev` still catches it: the Astro Cloudflare adapter is a production dependency and pulls in the Vite/Miniflare toolchain. Inspection finds sharp decoding in Miniflare's `imagesLocalFetcher` and `cfImageLocalFetcher`. The site uses compile-time image optimization; a deployed Worker endpoint reaching this native Node decoder is **not established**. Production master is affected as a dependency/build-tool baseline; that does not prove the deployed edge Worker is remotely exploitable.

## Timing evidence

- Upstream sharp advisory publication: August 27; GitHub Advisory Database API publication: **2026-09-08 21:25:11 UTC**, update 21:25:12; not withdrawn.
- #73's successful CI predates that database publication.
- [#44 run 34282758755](https://github.com/takraw369/masahiro-yamada-com/actions/runs/34282758755) used Node 22.23.2/npm 10.9.8 and reported `found 0 vulnerabilities` at **21:51:09 UTC**, after publication.
- [#66 rerun 34286439646](https://github.com/takraw369/masahiro-yamada-com/actions/runs/34286439646) used the same versions and failed the audit at **22:39:02 UTC** with an identical lockfile.
- Fresh audits of all five heads reproduce the same failure. Changed registry/advisory propagation is the supported explanation; a #66 dependency change, withdrawal, or a Linux-only audit discrepancy is not supported.

## Smallest fix

A scoped npm override changes **only Miniflare's sharp to 0.35.4**, within the same 0.35 patch line. Both affected dependency paths now deduplicate onto the already-present patched version. Astro, Wrangler and Miniflare versions stay unchanged. The large lockfile deletion is obsolete native sharp/libvips optional binaries and their duplicated semver dependency; there are no unrelated version upgrades.

Current latest Miniflare `5.20260908.0-alpha` still pins sharp 0.35.2. Remove this override when the accepted Cloudflare toolchain natively selects patched sharp, then repeat audit and native-image/Worker checks. Do not run npm's suggested forced downgrade to Wrangler 4.15.2. No advisory suppression or security gate change is included.

## Verification and release order

The fixed tree audits with **zero vulnerabilities**. Tests exercise synthetic AVIF encoding/decoding through all three Miniflare resolution paths and assert patched sharp/libheif binaries. Existing security tests, release-delta typecheck, production build, isolated Worker preview, dependency gate and secret scan remain required in CI. Local fresh npm ci hit disk exhaustion; only that newly-created incomplete install was removed. Local verification used an APFS copy-on-write dependency copy plus npm install; GitHub CI performs the authoritative clean npm ci on Linux.

This standalone PR is based on production master, ahead of the feature stack. **Its review/merge is the first Human Gate.** Do not bury it in #66 or merge any feature merely to obtain the dependency fix.

After human acceptance: integrate the accepted master security commit into #73 and rerun all gates, then retain #73 → #74 (retarget only after #73 acceptance) → #44 → Calendar activation → #66. Carry the same accepted commit through the stack using normal merges; do not duplicate the fix by cherry-picking it independently. Leave #66's current saved work intact until its turn after Calendar activation. Previously green feature CI is historical and does not override today's failing audit.

Before any authorized deployment record the active Worker version. Immediate code rollback baseline is master `940e821`; reverting the dependency hotfix reintroduces this vulnerability, so prefer pausing a deployment or forward-fixing. Every later PR should retain the accepted security fix when rolling back its own functional changes. Calendar v2/RLS hardening must remain applied; do not rerun or revert its migrations. No production merge, deployment, secret, DNS or publication action is authorized here.
