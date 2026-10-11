# Relationship OS MVP

## Why this exists

MASA OS already has CRM OS, Product OS, Revenue Mission, Evidence Lab, FLOW Board and owner-scoped Supabase storage. The CRM MVP therefore does not introduce a second system of record. It adds a thin operating surface for the human relationship state that sits between attention and revenue.

Flow:

`Person → Relationship → Opportunity → Offer → Purchase → Delivery → Outcome → Next Relationship`

The first release intentionally stops at the relationship/opportunity surface. Purchase, delivery and outcome continue to use Revenue Mission / Evidence Lab.

## Storage

- UI: `/dashboard/relationships`
- API: existing `/api/dashboard/board`
- Scene: `crm`
- Persistence: existing `masa_flow_canvas_get_v1` / `masa_flow_canvas_save_v1`
- Concurrency: revision compare-and-swap is required for the CRM scene
- New database tables or migrations: none

## Stored fields

- name
- organization / role
- relationship type
- relationship stage
- opportunity / offer
- next action and date
- last contact date
- value hypothesis
- source and tags
- minimal notes
- HTTPS reference to the external canonical record

Do not store payment credentials, message bodies, authentication data, or other unnecessary sensitive payloads here.

## Stages

`DISCOVERED → WARM → CONVERSATION → OPPORTUNITY → CUSTOMER → DELIVERED → ALUMNI`

`PAUSED` is a holding state.

## Human / AI boundary

The CRM surface can store and prioritize relationship state. It does not send messages, charge cards, accept contracts, publish externally, or change a live offer. Those remain explicit Human Gate or existing system responsibilities.

## Source reference

The public `kargulstudio/sales-crm` repository was treated as a design/reference input only. Its source code was not copied. The implementation is original and shaped around MASA OS's existing Dashboard and storage contracts.
