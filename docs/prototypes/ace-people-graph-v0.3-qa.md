# ACE People Graph v0.3 — Codex Review Handoff

## Status
Draft PR only. No product integration or production deployment. All initial people and relationships are fictional.

## Improvements in v0.3
- Obsidian-style graph physics: force links, repulsion, damped movement, dragging and zoom.
- Pause and resume the whole graph; pin/unpin an individual person; dragging a person pins it at the released position; clear all pins; save the visible layout.
- User-created groups with assignment from person detail, group-lens colored boundary, group-header dragging (moves all members and pins them), collapse to a single summary node, expand on tap; external relationships projected to summary without mutating actual edges.
- Person category tags (multiple), clickable category chips emphasizing matches, and text search.
- Four graph views: free-moving, 1–4-hop layers, social channel types, and custom groups.
- Manual fictional person and relationship creation, shortest connection route, export to JSON, browser-local fixture persistence with storage-unavailable fallback.
- Mobile first-focus camera adjustment in layers mode; no script/CDN/network fetch.

## Verification
Chromium via HTML set_content:
- Desktop 1440x900 and touch-emulated mobile 390x844. 24 fictional people, 37 initial edges; 21 shown at three hops; all 24 shown at four hops.
- Group mode shows three boxed groups. Group create, assign, edit categories, filter by tag, collapse/expand, fictional person add (24 to 25), edge add, shortest path, reset, all passed.
- Global stop/resume, individual pin/unpin, mouse node drag pinning passed at both sizes.
- Group-header drag moved and pinned four group members.
- JSON export downloads ace-people-graph-demo.json. Mock localStorage serialized state. Browser errors: zero; horizontal page overflow: none.
- Limitations: real iPhone Safari and production auth/RLS not tested. Browser persistence across reload was not independently verified. ChatGPT inline HTML previews may block JavaScript.

## Codex handoff and canonical scope
- [Human Graph blueprint](https://docs.google.com/document/d/1QjII1jKwce6oBp3-Za8IQVq37LTuxbBvVyubRKk885I/edit)
- [FLOW MAP](https://docs.google.com/document/d/1evH8KF_4bY8CiUX7T5Iub5Yg4Ra9UJgQ5aowWFmilb4/edit)
- Existing PRIMARY: takraw369/masahiro-yamada-com dashboard graph and relationships routes; #173.
- First implement a **read-only People lens** in the existing graph using current auth, same PERSON/identity/relationship schema and verified RLS. Do not create separate person masters, CRM, auth, app or parallel Knowledge OS. Do not import these fictional people into production.
- Ensure category and group state are presentation/curation overlays, distinct from real relationship facts; preserve consent, per-user ACL, evidence and audit history when real data is ever enabled.
- Test performance for hundreds of nodes and real mobile Safari before deployment.
- No production deployment without explicit user approval.
