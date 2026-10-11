# Knowledge Shelf: studio and purchaser keys

Creator: `/dashboard/content-studio`, with the existing Dashboard session and no additional product key. Live owner-guarded reads use CONTENT_OS/Supabase records and retain links to Drive source materials. Drafts save to the existing protected publication table; raw private knowledge is never bundled into public source.

Customer: `/library` -> Stripe Payment Link -> `/library/access?session_id={CHECKOUT_SESSION_ID}` -> an issued key -> `/library/<slug>/read`. A purchaser can paste the same key on another device. The browser stores a scoped HttpOnly/Secure/SameSite cookie. The key is not placed in reader URLs or browser storage.

The new `/api/library/payment-webhook` is separate from the existing winning_os_90 webhook. It requires an endpoint-specific Stripe signing secret, five-minute signature tolerance, JPY amount matching, a live publication and active offer. Both completion event types require `payment_status=paid`. Test purchases do not open live material. Full refunds and disputes revoke access; a late completion replay cannot restore revoked purchases.

Required Worker secrets: `KNOWLEDGE_SHELF_WEBHOOK_SECRET` (the signing secret returned for this new Stripe endpoint) and `KNOWLEDGE_SHELF_ACCESS_SECRET` (a stable random secret of at least 32 characters). Keep the latter separate from Dashboard password changes. Never record either value in source or receipts.

For a released product, configure a one-time JPY Stripe price and Payment Link with `metadata.knowledge_shelf_slug`, exact amount, and redirect after completion to the URL above. Subscribe the endpoint to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `charge.refunded`, and `charge.dispute.created`. Never use the success redirect alone to fulfill.

Sale activation requires a completed customer-readable manuscript, a confirmed product/price/payment account, the two runtime secrets, provider endpoint and delivery testing. Studio saving alone remains a draft. Existing membership price proposals remain proposals.

Verification must distinguish code/build tests, transaction-rolled-back database fixtures, provider test checkout, successful deployment and actual purchaser delivery. Do not mark a live sale workflow complete from a successful build alone.
