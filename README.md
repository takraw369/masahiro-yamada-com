# masahiroyamada.com

Astro + React site and private MASA Dashboard deployed as a Cloudflare Worker.
Production configuration is `wrangler.toml`; the canonical host is
`masahiroyamada.com`. `master` pushes trigger production deployment.

Use Node 22.18+ and `npm ci`, then:

```sh
npm test
npm run typecheck
npm run build
npm run test:preview
npm run security:check
```

`npm run preview` runs the built Worker locally with an isolated configuration,
empty bindings and no inherited service credentials. Private pages redirect to
login; private APIs reject requests. This is not an authenticated production E2E.
`npm run dev` runs Astro without production bindings. Do not copy production
secrets into either environment.

Knowledge, project and operational documents remain in
[Google Drive / MASA_OS](https://drive.google.com/drive/folders/1Annw01eNa25H-MX9CwAi6z6VhudgxnLX).
Tips in `src/content/tips` are reviewed public exports. Build must not discover or
sync retired Obsidian vaults. `scripts/sync-from-vault.mjs` is a harmless legacy
entry point only. Public access is enforced by `src/content/config.ts`.

See [the release evidence and dependency report](docs/release-conductor-2026-09-07.md)
for known blockers and PR disposition. This report describes repository evidence;
it does not replace the operational documents in MASA_OS.

## Otsu4 learning apps

Before adding an Otsu4 test or route, consult
[the app inventory and ownership map](docs/otsu4-test-catalog-20261006.md)
and its [Drive operating record](https://drive.google.com/file/d/1NWE8onjxHlcS8veuo64GICbx6NXCllZe/view).
Check the latest production pages and active PRs as well: the inventory is a dated snapshot.
Topic tests live at `/otsu4/tests/`, reuse `public/otsu4/questions.js`, and
write the existing study state. Dedicated law/Appendix 1 work lives at `/otsu4/hourei/`.
Do not duplicate those tracks.
