# masahiro-yamada.com — 3D Experience Build Spec

Status: BUILD-READY SPEC / NOT IMPLEMENTED

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

## Proposed first experience

Working route: `/flow-compass/world`

Do not treat the route name as final until integrated with the live information architecture.

### Core scene

Use primitive geometry first:

- Center = SELF / NOW
- surrounding nodes = a small set of Phase/Field positions
- subtle connection/flow lines
- one selected node at a time

### Core interaction

1. Scene emerges after the primary content shell is usable.
2. Visitor can rotate/orbit or tap a node using touch-safe controls.
3. Selecting a node reveals one short question or meaning outside/alongside the canvas.
4. CTA leads to the appropriate FLOW/ACE next action rather than deeper 3D for its own sake.

## Architecture

Current repository context:

- Astro 6+ with React support where needed.
- Cloudflare Workers deployment.
- current design system in `DESIGN.md`.

Implementation should prefer a small isolated island/component that does not turn the entire site into a client-rendered application.

Candidate runtime: direct Three.js or the smallest abstraction justified after inspecting the live bundle and current dependencies.

Do not add a second frontend framework or server dependency for this feature.

## Loading strategy

Required:

- page copy/navigation renders without waiting for 3D;
- 3D code is lazy-loaded when practical;
- generated/custom GLB assets are not required for v0;
- static fallback image/diagram is present;
- loading failure leaves a coherent page rather than an empty black canvas;
- reduced-motion preference removes non-essential motion.

## Asset phases

### v0 — interaction validation

Primitive geometry only.

Goal: prove the interaction communicates FLOW more effectively than a static illustration.

### v1 — branded asset upgrade

After v0 is validated, use the shared 3D Asset Manifest.

Possible assets:

- receptacle / lotus core;
- subtle torus/flow structure;
- symbolic gate/node geometry.

Tripo may generate candidate GLB assets, but the production contract is format/performance/rights based rather than Tripo dependent.

## Rights

Every external 3D asset/reference must be classified:

`OWNED / LICENSED / REFERENCE_ONLY / REVIEW_REQUIRED`

A prompt/example being visible in a public catalog is not sufficient commercial reuse permission.

## Performance / accessibility

Measure rather than guess.

Record:

- incremental JS cost;
- runtime load timing;
- asset sizes;
- interaction on mobile/touch;
- impact on page start/render;
- fallback behavior.

Preserve a useful non-3D path for WebGL-disabled/unsupported/failed states and users who prefer reduced motion.

## Copy / interaction rule

3D should answer one question:

`Where am I, and what is one next direction I can choose?`

Avoid displaying the whole FLOW theory inside the scene. Details remain accessible in normal semantic HTML.

## Acceptance criteria

All begin `UNVERIFIED`.

- [ ] UNVERIFIED — existing build/CI passes.
- [ ] UNVERIFIED — page remains usable before/without 3D loading.
- [ ] UNVERIFIED — one meaningful node interaction works on touch and desktop.
- [ ] UNVERIFIED — reduced-motion/fallback behavior is present.
- [ ] UNVERIFIED — design matches `DESIGN.md` rather than generic 3D-demo aesthetics.
- [ ] UNVERIFIED — incremental runtime/bundle/asset cost is measured.
- [ ] UNVERIFIED — production assets have explicit rights status.
- [ ] UNVERIFIED — CTA connects to an existing FLOW/ACE journey rather than creating a dead-end demo.

## Implementation sequence

1. Fresh-read current routes, layout, dashboard/public boundaries, and package dependencies.
2. Select the smallest appropriate public route/section.
3. Build the full non-3D semantic/fallback surface first.
4. Add primitive Three.js scene as an isolated lazy island.
5. Bind one node-selection interaction.
6. Measure bundle/runtime/mobile behavior.
7. Run visual review against `DESIGN.md`.
8. Decide whether custom Tripo-generated assets improve meaning enough to justify their cost.
9. Only then add branded GLB assets.

## Cross-repo references

- Drive: `CANONICAL｜3D EXPERIENCE LAYER｜Tripo × Astra × Three.js × FLOW/ACE｜v1.0`
- `takraw369/ace-method/docs/3D_LEARNING_LAYER.md`
- `takraw369/masa-automation/skills/3d-experience-builder/SKILL.md`

## Human gate

Public production deployment of the first 3D surface should follow the repository's normal release/review path. Do not silently make it the site-wide primary navigation or hero experience from a spike.
