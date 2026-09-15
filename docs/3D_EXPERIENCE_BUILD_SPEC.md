# masahiro-yamada.com — 3D Experience Build Spec

Status: MVP v0 IMPLEMENTED IN DRAFT PR / PRODUCTION NOT RELEASED

## Purpose

Create a small public 3D interaction that lets a visitor feel the FLOW / ACE worldview before reading a long explanation, while preserving the site's current Astro/Cloudflare architecture and ACE METHOD design system.

The first recommended experience is a FLOW COMPASS micro-experience, not an open world.

## Design contract

Follow `DESIGN.md`.

The 3D surface should feel like approaching a dojo at dawn: quiet intensity, earned beauty, nothing wasted.

Preserve:

- true-black / warm gold visual language;
- cinematic, atmospheric, high-contrast treatment;
- restrained emergence rather than bounce/spin spectacle;
- sharp, precise UI outside the canvas;
- mobile-first composition;
- no generic purple-gradient or stock-game aesthetic.

## First experience

Current MVP route: `/flow-compass-3d`

Keep it isolated until visual/touch review and release review are complete. Do not add it to primary public navigation from the spike branch.

### Core scene

Use primitive geometry first:

- Center = SELF / NOW
- Phase 01 = POINT
- Phase 02 = CONNECT
- Phase 03 = DEPTH
- Phase 04 = FLOW
- Phase 05 = VECTOR
- subtle connection/flow guides
- one selected node at a time

### Core interaction

1. Page copy/navigation is usable independently of the spatial view.
2. Visitor can orbit using pointer/touch drag.
3. Visitor can change depth using wheel where available.
4. Visitor can tap/select a node or use semantic phase buttons.
5. Selecting a node reveals one short question and one action outside the canvas.
6. Keyboard Left/Right can move through the five phases.

## Architecture

Current repository context:

- Astro with React support where needed.
- Cloudflare Workers deployment.
- current design system in `DESIGN.md`.

Implementation should prefer a small isolated island/component that does not turn the entire site into a client-rendered application.

Long-term candidate runtime remains direct Three.js or the smallest abstraction justified after inspecting the live bundle and current dependencies.

Do not add a second frontend framework or server dependency for this feature.

### Collision-safe renderer decision — 2026-09-08

Open security/release integration work currently owns `package.json`, `package-lock.json`, middleware, CI and deployment boundaries. Adding Three.js in parallel would create unnecessary package/lock conflict risk before interaction value is known.

Therefore MVP v0 uses a dependency-free Canvas renderer with real 3D coordinates, rotation and perspective projection.

This is an adapter decision, not a canonical meaning change:

`Canonical Meaning -> Spatial Interaction Contract -> Rendering Adapter`

After the package/security integration lane lands, fresh-read `master` and compare:

- keep the zero-dependency renderer when it remains sufficient;
- move to Three.js when camera/geometry/GLB/lighting capability provides material value;
- measure bundle/mobile/maintenance cost before changing renderer.

## Loading strategy

Required:

- page copy/navigation renders without waiting for 3D;
- generated/custom GLB assets are not required for v0;
- semantic phase navigation remains available independently of node hit-testing;
- loading/rendering failure must not erase the explanatory HTML;
- reduced-motion preference removes non-essential motion.

## Asset phases

### v0 — interaction validation

Primitive nodes only.

Goal: prove the interaction communicates FLOW more effectively than a static illustration.

### v1 — rendering / branded asset upgrade

Only after v0 interaction value and current package boundary are reviewed.

Possible upgrades:

- Three.js renderer;
- receptacle / lotus core;
- subtle torus/flow structure;
- symbolic gate/node geometry;
- GLB loading path.

Tripo may generate candidate GLB assets, but the production contract is format/performance/rights based rather than Tripo dependent.

## Rights

Every external 3D asset/reference must be classified:

`OWNED / LICENSED / REFERENCE_ONLY / REVIEW_REQUIRED`

A prompt/example being visible in a public catalog is not sufficient commercial reuse permission.

MVP v0 uses no third-party 3D asset.

## Performance / accessibility

Measure rather than guess.

Record:

- incremental JS cost;
- runtime load timing;
- asset sizes;
- interaction on mobile/touch;
- impact on page start/render;
- fallback behavior.

Preserve a useful non-3D path for rendering failure and users who prefer reduced motion.

## Copy / interaction rule

3D should answer one question:

`Where am I, and what is one next direction I can choose?`

Avoid displaying the whole FLOW theory inside the scene. Details remain accessible in normal semantic HTML.

## Acceptance criteria

Current evidence for Draft PR #59:

- [x] PASS — existing CI / production build verification passes.
- [x] PASS — secret scan passes.
- [x] PASS — page meaning remains in semantic HTML around the spatial surface.
- [x] PASS — node-selection interaction is implemented for pointer plus semantic buttons.
- [x] PASS — reduced-motion behavior is implemented.
- [x] PASS — no package/auth/middleware/API/DB change is introduced.
- [x] PASS — no third-party 3D assets are used in v0.
- [ ] UNVERIFIED — real-device touch usability.
- [ ] UNVERIFIED — visual review against `DESIGN.md` in a rendered browser.
- [ ] UNVERIFIED — measured learning advantage over a static diagram.
- [ ] UNVERIFIED — incremental runtime cost measurement on target devices.
- [ ] UNVERIFIED — final existing FLOW/ACE CTA placement.
- [ ] UNVERIFIED — production release.

## Implementation sequence

1. Fresh-read current routes, layout, dashboard/public boundaries, package dependencies and open PR file ownership. — DONE for v0.
2. Select the smallest appropriate public route. — DONE: isolated `/flow-compass-3d`.
3. Build semantic explanatory surface. — DONE.
4. Build primitive spatial interaction without package collision. — DONE.
5. Bind node selection. — DONE.
6. Run repository CI. — DONE / PASS.
7. Run rendered browser + touch review. — NEXT.
8. After the package/security integration lane lands, decide whether Three.js materially improves the experience. — NEXT ENGINE GATE.
9. Only after interaction value is clear, consider Tripo-generated branded GLB assets. — LATER.

## Cross-repo collision boundaries

- `takraw369/ace-quest-board` has its own FLOW WORLD SEED product lane. Do not duplicate that product/world state implementation here.
- `takraw369/masa-automation` owns the reusable 3D Builder procedure, not the public runtime.
- `takraw369/ace-method` owns education/meaning contracts, not rendering/runtime.
- Google Drive owns canonical FLOW meaning and current cross-repo execution state.

## Cross-repo references

- Drive: `CANONICAL｜3D EXPERIENCE LAYER｜Tripo × Astra × Three.js × FLOW/ACE｜v1.0`
- Drive: `FLOW COMPASS TRAINING v0.1｜5分×35日｜5D羅針盤を育てる`
- `takraw369/ace-method/docs/3D_LEARNING_LAYER.md`
- `takraw369/masa-automation/skills/3d-experience-builder/SKILL.md`

## Current implementation receipt

- Draft PR: #59
- Branch: `feat/flow-compass-3d-mvp`
- Route: `/flow-compass-3d`
- initial MVP commit: `a5bba93fc96176487cbec719753e840898419b7c`
- CI run: #65 — SUCCESS
- production deployment: NOT PERFORMED

## Human gate

Public production deployment of the first 3D surface should follow the repository's normal release/review path. Do not silently make it the site-wide primary navigation or hero experience from a spike.