<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## BuildSource LT
- Account type (buyer/supplier) lives in `user_roles`, set once via the `choose_account_type` RPC or signup metadata trigger — never on profiles, to prevent role escalation.
- Signed-in pages live under `src/routes/_authenticated/`; `homeFor` in `src/lib/access.ts` decides each user's single allowed place (onboarding → verify → own area) and `requireHome` enforces it in each area's `beforeLoad`.
- Company data lives in `companies` (linked via `profiles.company_id`); clients write it only through the `save_my_company` RPC, and `smart_id_verified` only through `mark_smart_id_verified`, because profile column grants block direct edits.
- Area menus come from `src/lib/nav.ts`; each area has `<area>.$section.tsx` placeholders until a section gets its own route file.
- All UI text goes through `useI18n().t` with keys in `src/lib/translations.ts` (Lithuanian falls back to English).
- Full product spec is `docs/build-spec.md`; follow its section numbers.
- Demo data lives in demo companies (`companies.is_demo`); `reset_demo_data()` (service-role only) wipes and reseeds them, called by the admin-only `resetDemoData` server fn, which first creates any missing demo logins from `src/lib/demo-accounts.ts` — so reset is the single source of demo state.
- RLS helpers (`my_company_id`, `is_rfq_buyer`, `is_rfq_supplier`, `quote_supplier`, …) are security-definer functions so cross-table policies never recurse; reuse them in new policies.
- Trust Score / buyer reliability are computed only in SQL (`compute_trust_score`, `compute_buyer_reliability`, `recompute_all_scores`) from orders, reviews, invitations and disputes, and triggers recompute on order completion, review insert and dispute resolution — the UI only reads `trust_scores.breakdown`, so there is one formula.
- RFQ numbers (`RFQ-YYYY-NNNN`) are assigned by the `rfqs_set_number` insert trigger; clients insert with an empty `rfq_number`, so numbering stays gap-free per year without a client round-trip.
- Stale-code recovery shares one early-script scheduler and sessionStorage budget (3 quick retries + 3 at 10 s per 2 minutes); recovery replaces the current URL with a fresh `__bs_refresh` value and HTML responses are no-store, so cached documents cannot repeatedly request removed modules after updates.
- Snap & Source runs in the `snapSource` server fn (`src/lib/snap.functions.ts`, AI Gateway) on files in the private `rfq-uploads` bucket under `<company_id>/`; validation, the 0.75 low-confidence rule and the demo café fallback live in `src/lib/snap.ts` so they are unit-tested in one place.
- Supplier matching runs in SQL: the `rfqs_match_on_submit` trigger calls `match_rfq` (ranking in `rank_rfq_candidates`), and decline/timeout reroute via `reroute_rfq`; suppliers change invites only through `supplier_view_rfq`/`supplier_decline_rfq` (no direct UPDATE policy). Clients insert RFQs as draft, add items, then set status to submitted so matching sees the items; a non-empty `preferred_supplier_ids` (buyer’s picks on the confirm step) limits invites to those suppliers.
- The public `/q/$token` page talks to the database only through `magic_get`/`magic_ask`/`magic_decline` (security definer, granted to anon), which resolve the token to one invite; never add anon table policies for it.
- Quotes change only through RPCs (`supplier_send_quote`, `magic_send_quote`, `buyer_counter_quote`, `buyer_reject_quote`, `supplier_reject_counter`) which compute line totals server-side and enforce the round limit; there are no direct write policies on `quotes`/`quote_versions`. UI turn rules mirror them in `src/lib/quote.ts`.
- Chat messages are validated and contact-info-flagged by the `messages_check` trigger (mirrored in `src/lib/chat.ts` for the typing warning) and notify the other side via `messages_notify`; `ChatPanel` polls every 4s instead of realtime.
- Agreements open only via `buyer_accept_quote`/`supplier_accept_counter`; `sign_agreement` creates the order on the second signature, using `calc_commission` (SQL, per category commission group). Commission columns on `orders` are column-revoked from clients; suppliers/admin read them via `my_order_commission`.
- Order lifecycle changes only through RPCs (`buyer_pay_order`, `buyer_pay_balance`, `supplier_update_order`, `supplier_add_milestone`, `buyer_approve_milestone`, `buyer_accept_delivery`, `buyer_open_dispute`, `admin_resolve_dispute`), each writing an `order_events` row; rules mirrored in `src/lib/order.ts`. Order photos live in private `order-photos` under `<order_id>/`. Never `select("*")` on orders — commission columns are revoked.
- Group Buy membership and lifecycle change only through RPCs (`pool_join`, `pool_leave`, `close_pool_now`, `pool_confirm`, `end_pool_window_now`, `process_pools`); buyers see totals only via `pool_totals` so pools stay anonymous. Tier rules are mirrored in `src/lib/pool.ts`.
- Dashboard numbers come from the `buyer_dashboard`/`supplier_dashboard` RPCs (savings formula lives there); the Price Index reads the `price_index` view, whose 5-sample rule is mirrored in `src/lib/price-index.ts`.
- External services go through connectors in `src/lib/connectors/` (demo + live per service, picked by `integrations.mode`); live is only allowed when the service's secrets exist, checked server-side in `integrations.functions.ts`, so a half-configured provider can't break the demo.
- Timed work runs through `sync_jobs` via `scheduler_tick` (one pg_cron job every 5 min + nightly trust recompute); `run_sync_jobs` retries with `job_backoff` (mirrored in `services.ts`), so there is a single scheduler and no extra sweeper.
- Delivery tables change only via shipment RPCs funnelled through `_shipment_event`, which also moves the order status (so on-time rate keeps reading `order_events`); rules mirrored in `src/lib/shipment.ts`.
- Public `/d/$token` uses only `driver_*` RPCs (token = credential); photos in private `delivery-photos/<driver_token>/`; site contact sits in `rfq_site_contacts`, hidden from suppliers until an order exists.
- Material Lens: logic and flow notes in `src/lib/AGENTS.md`.
