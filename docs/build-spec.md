# BuildSource LT – Build Spec for Lovable

**Product:** BuildSource LT – B2B sourcing platform for Lithuania
**Tagline:** Snap a photo, get verified quotes, buy together.
**Team:** Hassan Issa Hassan Abdalrahman, Efecan Gulec
**Goal of this build:** a working platform where every external service (Smart-ID, payments, financing, company data, messaging, delivery, supplier catalogues, AI) has a **live connector** and a **demo connector**. Each service switches from demo to live on its own once its account, contract and API keys are ready (Sections 15–19), so the hackathon demo always works and nothing has to be rewritten to go live.

---

## 0. How to use this file with Lovable

1. Create a new Lovable project and **connect Supabase** (Lovable's built-in integration) before the first build prompt.
2. Add this whole file to the project's **Knowledge** (project settings → Knowledge), so every prompt follows it.
3. Send the prompts one at a time, in order, from the companion file **BuildSource_LT_Lovable_Step_by_Step_Prompts.md** (23 smaller steps with a check list after each; Section 12 below is the short version). Test each step in the preview before the next one.
4. If something breaks, ask Lovable to fix only that step ("Fix the quote comparison page so…") rather than rebuilding.
5. Keep the **demo seed data** (Section 11) loaded so the demo always works.

**Rule for Lovable:** build incrementally, keep components small, use TypeScript, and don't remove working features when adding new ones.

---

## 1. Product summary

BuildSource LT connects **buyers** (small renovation contractors, interior designers, restaurants / offices / shops) with **suppliers** (manufacturers, distributors, fabricators, furniture makers, equipment suppliers) in Lithuania.

Buyers turn a photo, plan or material list into a **request for quotes (RFQ)** with AI. The platform sends it to the best-matched **verified suppliers**. Suppliers **quote or decline**, both sides **negotiate**, the buyer **compares** offers, both **sign agreed terms**, the buyer **pays into escrow**, the supplier **delivers**, and the buyer **accepts or disputes**. Pilots: **Group Buy**, **Pay later (financing)**, **Price Index**.

**Stage 1 scope**
- Regions: Kaunas, Vilnius
- Build categories: Insulation, Facade systems, Windows & doors, Roofing, Steel
- Fit-out categories: Furniture, Business fit-out kits, Commercial equipment
- Project types: New construction, Renovation, Interior design, Business fit-out

**Business model:** buyers free; suppliers pay commission only on won orders (deducted at escrow release).

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind + shadcn/ui (Lovable default) |
| Backend | Supabase: Postgres, Auth, Row Level Security, Storage, Edge Functions, Realtime |
| AI (Snap & Source) | Supabase Edge Function calling a vision-capable LLM. Use Lovable's built-in AI if available in the project; otherwise an API key stored as a Supabase secret |
| Files | Supabase Storage buckets: `rfq-uploads`, `quote-attachments`, `certificates`, `delivery-photos`, `product-images` |
| Realtime | Supabase Realtime for chat messages and notifications |
| i18n | English first, Lithuanian (`lt`) toggle; all UI strings in a translations file |
| Currency / units | EUR, metric units (m², m³, kg, t, pcs, m) |

**Demo and live modes (see Section 15):** every external service runs through a connector with two implementations. `demo` works with no accounts (used for the hackathon); `live` calls the real provider. The mode is set per service in the `integrations` table, so payments can be live while financing is still demo.

| Service | Demo connector | Live connector (Section 16) |
|---|---|---|
| Smart-ID / Mobile-ID | Dialog with a 4-digit code, confirms after 2 s | Identity provider API (e.g. Dokobit Identity Gateway or SK ID Solutions) |
| Payments / escrow | Internal `payments` table | Marketplace payment provider (e.g. Stripe Connect, Mangopay, or Paysera; choose one) |
| Financing (pay later) | Instant approval ≤ €20,000 | Licensed B2B pay-later partner API |
| Company data | Seeded `company_public_data` | Nightly import: Registrų centras open data, Sodra open data, VMI debtor list, EU VIES API, tender data |
| Places / contacts | Seed data | Google Places API |
| Email | In-app notification + copyable link | Transactional email API (e.g. Resend, Postmark, SendGrid) |
| WhatsApp / SMS | Copyable link | WhatsApp Business Cloud API (opt-in only), SMS API |
| Delivery tracking | Manual status updates | Driver link (built in) + carrier APIs or a multi-carrier tracking service |
| Supplier catalogues | Sample XML file | XML/CSV feeds, shop connectors (WooCommerce, Shopify, PrestaShop), ERP connectors |
| AI (Snap & Source, mapping) | Fixed sample result | Vision-capable LLM API |
| Translation | Original text | LLM or DeepL API |

The top bar shows "Demo mode" only while at least one service used on that screen is in demo mode.

---

## 3. Design guidelines

- **Brand colours:** dark navy `#1F272E` (headers, landing hero), warm beige `#E8D5C4` (accents on dark), primary green `#0F5D3A` (sidebar, primary buttons), light background `#F7F8F6`, text `#1A1A1A`.
- **Status colours:** success green, warning amber, danger red, info blue (shadcn defaults are fine).
- **Font:** Inter (body), a bold geometric display font for headings (e.g. "Plus Jakarta Sans").
- **Layout:** left sidebar app shell (like the deck mock-ups): logo "BuildSource LT", nav items per role, top bar with search, notifications bell, user menu.
- **Components:** cards with subtle borders, data tables, status badges, stepper for RFQ creation, side-by-side comparison table, chat panel on the right of RFQ/quote pages.
- **Trust Score badge:** circular score 0–100 with colour (≥80 green, 60–79 blue, 40–59 amber, <40 red) and a "Why this score?" popover showing the breakdown and data date.
- **Mobile:** responsive; supplier quoting via magic link must work well on a phone.
- Show a small **"Demo mode"** pill in the top bar.

---

## 4. User roles

| Role | Description |
|---|---|
| `buyer` | Contractor, designer or business. Creates RFQs, negotiates, orders, pays, accepts deliveries |
| `supplier` | Claimed supplier company. Receives RFQs, quotes, negotiates, fulfils orders, runs Group Buy pools |
| `admin` | BuildSource team. Manages categories, suppliers, disputes, data sync, demo reset |
| Unclaimed supplier (no login) | Accesses a single RFQ through a magic link token; can quote, decline, ask, negotiate |

A user belongs to one **company** (buyer company or supplier company). Company code (įmonės kodas) is required.

---

## 5. Database schema (Supabase / Postgres)

Use `uuid` primary keys (`gen_random_uuid()`), `created_at timestamptz default now()`, `updated_at`. Enums as Postgres enums or text with check constraints.

### 5.1 Enums

```
user_role: buyer | supplier | admin
company_type: buyer | supplier
buyer_segment: contractor | designer | business
project_type: new_construction | renovation | interior_design | business_fitout
rfq_status: draft | submitted | matched | quotes_received | negotiating | closed | cancelled
recipient_status: sent | viewed | declined | quoted | expired | rerouted | not_selected | selected
quote_status: draft | sent | negotiating | accepted | rejected | expired | withdrawn
offer_party: buyer | supplier
order_status: created | awaiting_payment | paid_escrow | processing | shipped | in_transit | delivered | accepted | disputed | completed | cancelled
payment_status: pending | held | partially_released | released | refunded | failed
payment_method: escrow | pay_later
dispute_status: open | resolved_replacement | resolved_partial_refund | resolved_full_refund | rejected
pool_status: open | closed | confirming | ordered | cancelled
pool_member_status: joined | left | confirmed | declined | no_response
decline_reason: out_of_stock | cannot_meet_date | order_too_small | not_our_product | other
```

### 5.2 Tables

**profiles** – one per auth user
`id (= auth.users.id)`, `full_name`, `email`, `phone`, `role user_role`, `company_id → companies`, `language ('en'|'lt')`, `smart_id_verified bool`, `created_at`

**companies**
`id`, `type company_type`, `name`, `company_code text unique`, `vat_code`, `country (default 'LT')`, `city`, `address`, `buyer_segment` (buyers only), `is_claimed bool` (suppliers), `claimed_at`, `bank_account_iban`, `bank_account_verified bool`, `logo_url`, `website`, `description`, `created_at`

**company_public_data** – seeded mock of open data, one row per company
`company_id`, `registered_date`, `status ('active'|'bankrupt'|'liquidation')`, `activity_codes text[]` (NACE, e.g. `{'46.73','23.99'}`), `employees int`, `avg_wage numeric`, `sodra_debt bool`, `tax_debt bool`, `vat_valid bool`, `tender_wins int`, `data_date date`

**categories** – two levels
`id`, `parent_id → categories (null for top level)`, `slug`, `name_en`, `name_lt`, `group ('build'|'fitout')`, `field_template jsonb` (extra RFQ fields per category, see 5.3), `default_unit`, `commission_group ('materials'|'furniture_equipment')`, `sort_order`

**supplier_profiles** – extra info for supplier companies
`company_id (pk)`, `regions_served text[]` (e.g. `{'Kaunas','Vilnius'}`), `warehouse_locations jsonb` (`[{city, country}]`), `min_order_eur numeric`, `typical_lead_time_days int`, `weekly_capacity jsonb` (per category), `certificates jsonb` (`[{name, file_url, standard}]`), `installation_offered bool`, `warranty_months int`, `service_area text[]`, `response_rate numeric (0–1)`, `avg_response_hours numeric`, `on_time_rate numeric (0–1)`, `avg_rating numeric (0–5)`, `review_count int`, `disputes_lost int`, `pro_subscription bool`, `product_feed_url`

**supplier_categories**
`supplier_id → companies`, `category_id → categories` (subcategory level)

**trust_scores** – current score and breakdown
`company_id (pk)`, `score int (0–100)`, `breakdown jsonb` (see 7.2), `public_data_date date`, `computed_at`

**projects** (optional grouping, used in the café demo)
`id`, `buyer_company_id`, `name`, `project_type`, `city`, `address`, `notes`

**rfqs**
`id`, `rfq_number text unique` (e.g. `RFQ-2026-0001`), `buyer_company_id`, `created_by → profiles`, `project_id (nullable)`, `project_type`, `title`, `description`, `delivery_city`, `delivery_address`, `delivery_date_requested date`, `delivery_week text` (ISO week, e.g. `2026-W48`), `status rfq_status`, `source ('manual'|'snap_source'|'kit')`, `ai_upload_urls text[]`, `min_trust_score int default 40`, `max_suppliers int default 5`, `negotiation_round_limit int default 3`, `submitted_at`, `closed_at`

**rfq_items**
`id`, `rfq_id`, `category_id` (subcategory), `description`, `specs jsonb` (category template values, e.g. thickness, grade, dimensions, finish, colour), `quantity numeric`, `unit`, `standard text` (e.g. `EN 10025`), `waste_pct numeric default 0`, `ai_confidence numeric (0–1, null if manual)`, `buyer_confirmed bool default false`, `sort_order`

**rfq_recipients** – matching result, one row per supplier per RFQ
`id`, `rfq_id`, `supplier_company_id`, `match_score numeric`, `rank int`, `status recipient_status`, `magic_token text unique` (for unclaimed suppliers), `sent_at`, `viewed_at`, `responded_at`, `decline_reason decline_reason`, `decline_message`, `reminder_sent_at`

**quotes** – one per supplier per RFQ (the thread)
`id`, `rfq_id`, `recipient_id → rfq_recipients`, `supplier_company_id`, `status quote_status`, `current_version int`, `round_count int default 0`, `created_at`, `updated_at`

**quote_versions** – every offer and counter-offer, immutable
`id`, `quote_id`, `version int`, `party offer_party` (supplier = quote/revision, buyer = counter-offer), `lines jsonb` (`[{rfq_item_id, unit_price, quantity, line_total, note}]`), `subtotal numeric`, `delivery_cost numeric`, `total numeric`, `lead_time_days int`, `delivery_date date`, `warehouse_origin text` (city, country), `valid_until date`, `payment_terms text`, `certificates jsonb`, `attachments text[]`, `message text`, `created_by → profiles (nullable for magic link)`, `created_at`
→ For furniture/custom items also: `images text[]`, `drawing_url`, `sample_available bool`

**messages** – private chat per quote thread (also used for questions before a quote)
`id`, `rfq_id`, `quote_id (nullable)`, `recipient_id → rfq_recipients`, `sender_party offer_party`, `sender_profile_id (nullable)`, `body`, `attachments text[]`, `translated_body (nullable)`, `contains_contact_info bool`, `created_at`, `read_at`

**agreements** – agreed terms both sides sign
`id`, `rfq_id`, `quote_id`, `quote_version_id`, `total numeric`, `lead_time_days`, `delivery_date`, `payment_terms`, `buyer_signed_at`, `buyer_signature_code`, `supplier_signed_at`, `supplier_signature_code`, `status ('pending'|'signed'|'cancelled')`

**orders**
`id`, `order_number` (e.g. `ORD-2026-0001`), `agreement_id`, `rfq_id`, `buyer_company_id`, `supplier_company_id`, `pool_id (nullable)`, `total numeric`, `commission_rate numeric`, `commission_amount numeric`, `supplier_payout numeric`, `payment_method payment_method`, `status order_status`, `staged_payment bool` (custom furniture), `created_at`

**payments** – mock escrow
`id`, `order_id`, `milestone ('full'|'drawing_approval'|'delivery')`, `amount numeric`, `status payment_status`, `provider ('demo_escrow'|'demo_financing')`, `held_at`, `released_at`, `refunded_amount numeric`

**financing_requests** (pilot)
`id`, `order_id`, `buyer_company_id`, `amount`, `term_days (30|60)`, `status ('approved'|'rejected'|'repaid')`, `partner_fee_rate numeric`, `decided_at`

**order_events** – delivery timeline
`id`, `order_id`, `status order_status`, `note`, `photo_urls text[]`, `created_by`, `created_at`

**production_milestones** (furniture/custom)
`id`, `order_id`, `name ('drawing_approved'|'sample_approved'|'in_production'|'ready')`, `photo_urls`, `approved_by_buyer bool`, `created_at`

**disputes**
`id`, `order_id`, `opened_by`, `reason`, `description`, `photo_urls text[]`, `held_amount numeric`, `status dispute_status`, `resolution_note`, `created_at`, `resolved_at`

**reviews** – only after completed order
`id`, `order_id unique`, `reviewer_company_id`, `supplier_company_id`, `rating int (1–5)`, `comment`, `created_at`

**buyer_reliability**
`company_id (pk)`, `score int (0–100)`, `rfqs_created int`, `orders_completed int`, `pool_no_shows int`, `late_confirmations int`

**group_buy_pools** (pilot)
`id`, `supplier_company_id`, `category_id`, `product_name`, `product_specs jsonb`, `images text[]`, `datasheet_url`, `certificates jsonb`, `unit`, `base_price numeric` (= maximum price), `tiers jsonb` (`[{min_qty, discount_pct}]`), `region text`, `delivery_week text`, `deadline timestamptz`, `min_qty numeric`, `confirm_window_hours int default 24`, `keep_tier_threshold numeric default 0.8`, `status pool_status`, `closed_qty numeric`, `final_discount_pct numeric`, `final_unit_price numeric`

**pool_members**
`id`, `pool_id`, `buyer_company_id`, `rfq_id (nullable)`, `quantity numeric`, `if_pool_fails ('order_alone'|'cancel')`, `status pool_member_status`, `joined_at`, `confirmed_at`, `order_id (nullable)`

**price_index** – Postgres view (beta)
Average accepted unit price per `category_id` + `region` + month, **only where count ≥ 5** accepted quote lines. Columns: `category_id`, `region`, `month`, `avg_unit_price`, `min`, `max`, `sample_count`.

**kits** – fit-out and renovation kits
`id`, `name` (e.g. "Café, 40 seats", "Block renovation – series 1-464 stairwell"), `project_type`, `items jsonb` (`[{category_id, description, specs, quantity_formula, unit}]`)

**notifications**
`id`, `profile_id (nullable)`, `company_id`, `type`, `title`, `body`, `link`, `read_at`, `created_at`

**audit_log**
`id`, `entity`, `entity_id`, `action`, `actor_profile_id`, `data jsonb`, `created_at`

### 5.3 Category field templates (examples for `categories.field_template`)

```json
// Insulation
[{"key":"material","label":"Material","type":"select","options":["EPS","Stone wool","PIR","XPS"]},
 {"key":"grade","label":"Grade","type":"text","placeholder":"EPS 100"},
 {"key":"thickness_mm","label":"Thickness (mm)","type":"number"}]
// Windows & doors
[{"key":"type","label":"Type","type":"select","options":["Window","Balcony door","Entrance door"]},
 {"key":"frame","label":"Frame","type":"select","options":["PVC","Wood","Aluminium","Wood-aluminium"]},
 {"key":"width_mm","type":"number","label":"Width (mm)"},{"key":"height_mm","type":"number","label":"Height (mm)"},
 {"key":"u_value","type":"number","label":"U-value (W/m²K)"}]
// Steel
[{"key":"product","type":"select","label":"Product","options":["Rebar","Beam","Sheet","Tube","Stainless sheet"]},
 {"key":"grade","type":"text","label":"Grade","placeholder":"S355 / AISI 304"},{"key":"dimensions","type":"text","label":"Profile / dimensions"}]
// Furniture
[{"key":"item","type":"text","label":"Item","placeholder":"Dining table"},
 {"key":"dimensions","type":"text","label":"Dimensions (cm)"},{"key":"material","type":"text","label":"Material"},
 {"key":"finish","type":"text","label":"Finish / colour"},{"key":"use","type":"select","label":"Use","options":["Home","Commercial (heavy use)"]},
 {"key":"assembly","type":"bool","label":"Assembly / installation needed"}]
// Commercial equipment
[{"key":"item","type":"text","label":"Equipment"},{"key":"power","type":"text","label":"Power / connection"},
 {"key":"dimensions","type":"text","label":"Dimensions (cm)"},{"key":"installation","type":"bool","label":"Installation needed"},
 {"key":"warranty_months_min","type":"number","label":"Minimum warranty (months)"}]
```

### 5.4 Row Level Security (summary)

- Buyers see and edit only their company's RFQs, items, orders, payments, disputes, pool memberships.
- Suppliers see only RFQs where their company is in `rfq_recipients`, only **their own** quote threads and messages, and their own orders.
- **A supplier never sees other suppliers' quotes.** A buyer never sees other buyers' pool memberships (only pool totals).
- Unclaimed supplier access goes through an edge function that validates `magic_token` and returns only that RFQ + that thread (no direct table access).
- `company_public_data`, `trust_scores`, `categories`, `kits`, `price_index` are readable by all authenticated users.
- Admin has full access.

---

## 6. Screens and routes

### Public
- `/` Landing page: hero "Snap a photo, get verified quotes, buy together", 3 feature cards (Snap & Source, Trust Score, Group Buy), how it works (5 steps), for buyers / for suppliers sections, CTA buttons. Dark navy hero with beige accents.
- `/login`, `/signup` – sign-up asks: role (buyer/supplier), name, email, password, company code, company name, segment (buyers), then "Verify with Smart-ID (demo)".
- `/q/:token` – **magic link page** for unclaimed suppliers (mobile-first): RFQ details, actions Decline / Ask / Send quote, chat, negotiation, then "Claim your profile" banner after first quote.

### Buyer app (`/app/...`)
- **Dashboard:** open RFQs, quotes waiting for response, active orders timeline, open pools joined, savings to date.
- **Create RFQ** (stepper):
  1. Project type (4 cards) + optional project / kit selection
  2. **Snap & Source:** upload area (images, PDF) + "Or type items" + "Start from kit". AI result table: category, description, specs, quantity, unit, standard, waste %, confidence. Rows with confidence < 0.75 highlighted yellow; each row has a "Confirm" checkbox; "Confirm all" disabled until every yellow row is reviewed
  3. Delivery: city, address, requested date (auto delivery week), notes, attachments
  4. Review → shows "Group Buy available" cards for matching open pools (join free / order alone) → Submit
- **My RFQs:** table with status badges.
- **RFQ detail:** tabs `Matched suppliers` (with Trust Score badges, status per recipient), `Quotes` (comparison), `Details`, `Activity`. Right side: chat panel per supplier.
- **Compare quotes:** columns per supplier (latest version): supplier + Trust Score, product lines, unit and total price, delivery cost, total, lead time, delivery date, warehouse origin (flag), certificates, valid until, version + "Negotiating" badge, images/drawing for furniture. Labels: **Best value** (lowest total among Trust Score ≥ 60), **Fastest** (shortest lead time). Actions per column: Accept, Counter-offer, Reject, Ask.
- **Counter-offer dialog:** pre-filled from latest version; buyer edits unit prices / quantity / delivery date / lead time + message; shows round count "Round 2 of 3".
- **Agreement page:** summary of agreed terms → "Sign with Smart-ID (demo)". Shows status waiting for supplier signature.
- **Checkout:** payment method `Escrow (pay now, held until delivery)` or `Pay later 30/60 days (pilot)`; for custom furniture shows staged plan 30% / 70%; commission is **not** shown to buyers.
- **Orders:** list + detail with timeline (order_events), production milestones (furniture), certificates, delivery photos, buttons **Accept delivery** / **Open dispute**.
- **Group Buy:** browse open pools (filters: category, region, week), pool page with product photos, specs, supplier Trust Score, max price, **tier progress bar** ("320 m² more → −8%"), deadline countdown, join form (quantity + if pool fails: order alone / cancel). Confirm screen after closing (24 h countdown).
- **Price Index (beta):** chart of average unit price per category and region by month; hidden categories show "Not enough data yet (needs 5+ quotes)".
- **Settings / Company profile.**

### Supplier app (`/supplier/...`)
- **Dashboard:** new RFQs, threads waiting for reply, orders to fulfil, won value this month, response rate, Trust Score with breakdown.
- **RFQ inbox:** table (RFQ ID, project title, buyer company (verified badge), city, categories, quantity, deadline, status). Filters: category, region, deadline.
- **RFQ detail + quote builder:** RFQ info, items, attachments; actions **Decline** (reason + message), **Ask question**, **Send quote** (line prices, delivery cost, lead time, delivery date, warehouse origin, valid until, payment terms, certificates, images/drawing, message). Live total.
- **Negotiation thread:** version history timeline (v1 supplier, v2 buyer counter, v3 supplier…), actions **Accept counter**, **Send revised quote**, **Reject**.
- **Agreements to sign**, **Orders:** update status, upload certificates, production photos, delivery photos.
- **Group Buy pools:** create pool (product, specs, images, base price, tiers editor, region, delivery week, deadline, minimum qty) and monitor progress.
- **Company profile & claim flow:** Smart-ID / e-seal (demo), IBAN must match company (demo check), categories, regions, warehouses, certificates, capacity, product feed URL, Pro subscription toggle (demo).
- **Earnings:** orders, commission deducted, payouts.

### Admin (`/admin/...`)
- Categories & templates, companies & public data (edit seed), Trust Score recompute button, disputes queue (resolve with outcome), pools overview, **Reset demo data** button.

---

## 7. Business logic

### 7.1 Matching (edge function `match-suppliers`, runs on RFQ submit)
1. Candidate suppliers = companies with `type = supplier`, `company_public_data.status = 'active'`, and at least one `supplier_categories` match with any `rfq_items.category_id`.
2. Filter: `regions_served` contains `rfqs.delivery_city`; `trust_scores.score ≥ rfqs.min_trust_score`; capacity not exceeded (if set).
3. Rank: `match_score = 0.5 × trust_score/100 + 0.3 × category_coverage + 0.2 × response_rate`, where `category_coverage` = share of the RFQ's categories the supplier covers.
4. Take the top `max_suppliers` (default 5; minimum 3 if available). Insert into `rfq_recipients` with `status = 'sent'`; create a `magic_token` for unclaimed suppliers; create notifications.
5. Set `rfqs.status = 'matched'`.
6. **Reroute:** when a recipient declines, or has no response 48 h after `sent_at` (reminder at 24 h), mark it `rerouted`/`declined` and send the RFQ to the next-ranked supplier not yet contacted. For the demo add an admin button "Simulate 48 h passing".

### 7.2 Trust Score (edge function `compute-trust-score`, 0–100)
**Public data (max 60):**
- Company age: 1 point per full year, max 15
- No tax debt (VMI): 15 (else 0)
- No social-insurance debt (Sodra): 10 (else 0)
- Employees: 0 → 0, 1–4 → 4, 5–19 → 7, 20+ → 10
- VAT valid (VIES): 5
- Public tender wins: 0 → 0, 1–4 → 3, 5+ → 5
- Company status not active → total score 0

**Platform data (max 40; new suppliers get a neutral 20 until they have 3 completed orders):**
- On-time delivery rate × 15
- Response rate × 10
- Average rating / 5 × 10
- 5 minus 2 per lost dispute (min 0)

Store the `breakdown` JSON with each component, its points, max points and source, plus `public_data_date`. Recompute on order completion, review, dispute resolution, and nightly (cron or admin button).

**Buyer reliability (0–100):** starts at 70; +5 per completed order (max 100); −10 per pool no-show; −5 per agreement not signed within 48 h. Buyers below 40 can't join pools.

### 7.3 Negotiation state machine
- Supplier on a recipient: `decline` → recipient `declined` (+ reroute) · `ask` → message · `quote` → create `quotes` + `quote_versions v1 (party = supplier)`, quote `sent`, RFQ `quotes_received`.
- Buyer on a quote: `accept` → create `agreements` from that version · `reject` (reason) → quote `rejected` · `counter` → new version `party = buyer`, quote `negotiating`, `round_count + 1` · `ask` → message.
- Supplier on a counter: `accept counter` → agreement from the buyer's version · `revise` → new version `party = supplier` · `reject` → quote `rejected`.
- **Limits:** a counter is blocked when `round_count = negotiation_round_limit` (default 3): only accept or reject remain. Quotes past `valid_until` become `expired` (buyer can ask for a refresh).
- **Price changes only via versions**, never via chat. Chat messages are scanned with a regex for phone numbers / emails before an order exists; if found, set `contains_contact_info = true` and show a soft warning "Contact details are shared after the order is confirmed."
- When an agreement is signed by both sides: quote `accepted`, other quotes on the RFQ `rejected` with recipient status `not_selected`, notify them with optional feedback: "Your total was X% above the selected offer." RFQ `closed`.
- Every action writes to `audit_log`.

### 7.4 Agreement and order
- Both parties sign with the demo Smart-ID dialog (store a 4-digit control code + timestamp).
- On both signatures → create `orders` with `status = 'awaiting_payment'`, commission calculated (7.5).
- Custom furniture / made-to-order lines (category group `fitout` with `assembly` or custom dimensions) → `staged_payment = true`.

### 7.5 Commission (function `calc_commission(total, commission_group, is_repeat)`)
- If repeat order (same buyer + supplier has ≥ 1 completed order) → **1%**
- `materials`: ≤ €5,000 → **3%**; €5,000.01–50,000 → **2%**; > €50,000 → **1%**, capped at **€2,000**
- `furniture_equipment`: **4%** (configurable)
- Mixed orders: apply per line by category group and sum.
- Supplier Pro subscription: −0.5 percentage points (minimum 1%).
- `supplier_payout = total − commission_amount`. Commission is shown to suppliers only.

### 7.6 Escrow (mock)
- **Escrow:** buyer clicks "Pay" → `payments.status = 'held'`, order `paid_escrow`, supplier notified to start.
- **Staged (custom furniture):** payment 1 = 30% `drawing_approval` (held when the buyer approves the drawing), payment 2 = 70% `delivery`.
- **Accept delivery** → all held payments `released`, order `accepted` → `completed`, payout shown to supplier minus commission.
- **Dispute** → order `disputed`; hold a buyer-chosen amount (default 30% of total) as `held_amount`; admin resolves: replacement (release after re-delivery), partial refund, or full refund.
- **Pay later (pilot):** creates `financing_requests` (auto-approve ≤ €20,000), supplier is shown as paid immediately (`provider = 'demo_financing'`); buyer sees due date. Partner referral fee 1.5% of amount stored for revenue reporting.

### 7.7 Group Buy (pilot)
- Supplier creates a pool with tiers, e.g. `[{min_qty:1000,discount_pct:5},{min_qty:2000,discount_pct:8},{min_qty:3000,discount_pct:12}]`, `base_price` = maximum price.
- Buyers see everything (supplier, product, images, specs, certificates, max price, tiers, deadline) and **join free** (no deposit). Members can leave any time before the deadline.
- Tier bar: current total vs next tier → "X more → −Y%".
- At the deadline (or admin "Close pool now"): `closed_qty` = sum of joined quantities.
  - If `closed_qty < min_qty` → pool `cancelled`; members with `if_pool_fails = 'order_alone'` get an RFQ auto-created to that supplier at base price; others are released.
  - Else → final tier from `closed_qty`, `final_unit_price = base_price × (1 − discount)`, pool `confirming`; each member gets "Confirm within 24 h" with their exact total.
- On confirmation (demo Smart-ID) → member `confirmed` and an order is created for that member (own order, own invoice, own escrow payment).
- After the window: if confirmed quantity ≥ `keep_tier_threshold × closed_qty` (80%), the tier price stays; otherwise recalculate the tier on confirmed quantity and notify members. Non-confirming members → `no_response` and buyer reliability −10.
- Pools are **anonymous**: buyers see only total quantity and number of members.

### 7.8 Snap & Source (edge function `snap-source`)
- Input: uploaded file URLs (images/PDF), project type, optional kit, buyer notes.
- Prompt the LLM to return **strict JSON**:
```json
{"items":[{"category_slug":"insulation-eps","description":"EPS 100 facade insulation boards","specs":{"material":"EPS","grade":"EPS 100","thickness_mm":150},"quantity":520,"unit":"m2","standard":"EN 13163","waste_pct":7,"confidence":0.86,"reasoning":"Facade area 486 m² from elevation drawing + 7% waste"}]}
```
- Only use `category_slug` values from the provided category list (send it in the prompt).
- Validate the JSON (zod); on failure retry once, then show "We couldn't read this file, please add items manually."
- Never auto-submit: items are created with `buyer_confirmed = false`.
- **Demo fallback:** if the AI call fails or no key is set, return a fixed sample result for the café demo plan so the live demo never breaks.

### 7.9 Price Index (beta)
- View over accepted quote lines joined to RFQ city; monthly averages per subcategory and region; return rows only where `sample_count ≥ 5`. Show on a chart page and as a small "Market average" hint in the comparison table.

### 7.10 Notifications
In-app notifications (bell + realtime) for: new RFQ, quote received, counter-offer, message, agreement to sign, payment held, status change, delivery accepted, dispute, pool tier reached, pool closed / confirm needed. Show magic links as copyable text (demo for email/WhatsApp).

---

## 8. Status reference

| Object | Flow |
|---|---|
| RFQ | draft → submitted → matched → quotes_received → negotiating → closed (or cancelled) |
| Quote | draft → sent → negotiating → accepted / rejected / expired / withdrawn |
| Group Buy | open → closed → confirming → ordered (or cancelled) |
| Order | created → awaiting_payment → paid_escrow → processing → shipped → in_transit → delivered → accepted / disputed → completed |

---

## 9. Edge functions list

| Function | Purpose |
|---|---|
| `snap-source` | AI extraction of RFQ items from uploads (with demo fallback) |
| `match-suppliers` | Matching + recipients + magic tokens + notifications |
| `reroute-rfq` | Decline / 48 h timeout reroute to next supplier |
| `magic-link` | Validates token; read RFQ/thread; submit decline / message / quote / revision / accept for unclaimed suppliers |
| `compute-trust-score` | Recalculate scores (one company or all) |
| `sign-agreement` | Demo Smart-ID signing; creates order when both signed |
| `escrow` | Pay, hold, release, refund, staged milestones, pay later |
| `close-pool` | Close pool, compute tier, create confirmations, finalise |
| `translate` (optional) | Translate a message to the reader's language |
| `reset-demo` | Wipe and reload seed data |

---

## 10. Non-functional requirements

- **NFR1 Security & GDPR:** Supabase RLS on every table; HTTPS; files in private buckets with signed URLs; business contacts only; opt-out link text on outreach notifications; EU-hosted Supabase region.
- **NFR2 Performance:** dashboard and comparison pages load in < 5 s on normal data (paginate lists, index foreign keys).
- **NFR3 Data accuracy:** quote versions immutable; agreed price always taken from the signed version; audit log for every state change.
- **NFR4 Usability:** a first-time buyer can submit an RFQ in under 5 minutes; supplier can quote from a phone via magic link.

---

## 11. Demo seed data

### Buyer companies
| Company | Code | Segment | City | Login |
|---|---|---|---|---|
| Tomas Renovacija UAB (demo) | 300000001 | contractor | Kaunas | `buyer@demo.lt` / `demo1234` |
| Studija Erdvė (demo) | 300000002 | designer | Vilnius | `designer@demo.lt` / `demo1234` |
| Kavinė Laisvė (demo) | 300000003 | business | Kaunas | `cafe@demo.lt` / `demo1234` |

### Supplier companies (fictional names, mark as demo)
| Company | City | Categories | Trust inputs | Claimed |
|---|---|---|---|---|
| Baltic Insulation UAB | Kaunas | Insulation, Facade systems | 14 yrs, no debts, 48 staff, 6 tenders | yes (`supplier@demo.lt`) |
| Nemunas Windows UAB | Kaunas | Windows & doors | 11 yrs, no debts, 120 staff | yes |
| Vilnius Steel Trade UAB | Vilnius | Steel | 8 yrs, no debts, 25 staff | no (magic link) |
| Nordic Materials Sp. z o.o. | Białystok, PL | Insulation, Steel, Roofing | 9 yrs, VAT valid | no |
| Ąžuolas Furniture UAB | Kaunas | Furniture | 6 yrs, no debts, 18 staff | yes (`furniture@demo.lt`) |
| ProKitchen Equipment UAB | Vilnius | Commercial equipment | 10 yrs, no debts, 30 staff | no |
| Stogas Plus UAB | Kaunas | Roofing | 3 yrs, **tax debt** | no (low score, shows filtering) |
| FitOut Pro UAB | Vilnius | Business fit-out kits, Furniture | 5 yrs | no |

Seed `supplier_profiles`, `company_public_data`, computed `trust_scores`, categories with templates, and 2 kits ("Café, 40 seats"; "Block renovation – facade insulation").

### Demo story: Kavinė Laisvė café fit-out (Kaunas)
- RFQ A (contractor): 520 m² EPS 100 / 150 mm, 220 m² facade render system, 6 windows 1500×1500 PVC.
- RFQ B (café): 10 tables 80×80 oak, 40 commercial chairs, 1 bar counter 4 m, combi oven, 2 refrigerated counters, extraction hood.
- Existing quotes: Baltic Insulation v1 €9.20/m² + €180 delivery; buyer counter v2 €8.80/m² free delivery for 600 m²; supplier v3 €8.90/m² delivery included (shows negotiation history).
- Open Group Buy pool: Ąžuolas Furniture, "Commercial bistro chair, oak", Kaunas, base €95, tiers 100 pcs −5%, 200 pcs −8%, 300 pcs −12%; current 160 pcs from 3 members.
- One completed past order with a 5-star review (feeds Trust Score).
- Price Index: seed ≥ 5 accepted lines for EPS insulation Kaunas over 6 months.

### 3-minute live demo script
1. Café owner uploads the floor plan → Snap & Source drafts 12 lines → confirms yellow lines → sees "Group Buy available: bistro chairs" → joins the pool → bar shows "40 more → −8%" → submits RFQ.
2. Switch to supplier (magic link on phone) → quotes; show the negotiation history on the insulation RFQ.
3. Buyer compares quotes (Trust Score popover, Best value, Market average) → accepts → signs with Smart-ID (demo).
4. Checkout: choose "Pay later 30 days (pilot)" → order created.
5. Supplier marks shipped → delivered with photos → buyer accepts → supplier earnings show commission deducted → Trust Score ticks up.

---

## 12. Lovable prompts (send one at a time)

**Prompt 1 – Foundation**
> Read the BuildSource LT build spec in Knowledge. Set up the app shell: landing page (Section 6 Public), Supabase auth with sign-up/login, `profiles` and `companies` tables, roles buyer/supplier/admin, role-based routing to `/app`, `/supplier`, `/admin`, left sidebar layout, top bar with "Demo mode" pill, notification bell placeholder, EN/LT language toggle. Use the design guidelines in Section 3. Add the demo Smart-ID dialog component (Section 2) and use it in sign-up.

**Prompt 2 – Data model and seed**
> Create all enums and tables from Section 5 with RLS from 5.4. Seed categories with field templates (5.3), kits, and all demo companies, supplier profiles and public data from Section 11. Add an admin "Reset demo data" button that reloads the seed.

**Prompt 3 – Trust Score**
> Build the `compute-trust-score` edge function exactly as in 7.2, store breakdown JSON, and show the Trust Score badge with a "Why this score?" popover (components, points, data date). Add buyer reliability. Add an admin "Recompute all" button.

**Prompt 4 – Create RFQ + Snap & Source**
> Build the buyer Create RFQ stepper (Section 6) with dynamic fields from each category's `field_template`. Build the `snap-source` edge function (7.8) with strict JSON validation and the demo fallback. Low-confidence rows are highlighted yellow and must be confirmed. Support "Start from kit". Save RFQ as draft or submit.

**Prompt 5 – Matching + supplier inbox + magic link**
> On RFQ submit run `match-suppliers` (7.1). Build the supplier RFQ inbox and RFQ detail, and the public `/q/:token` magic link page for unclaimed suppliers (mobile-first). Implement decline with reason, ask question (messages), reroute on decline, and an admin "Simulate 48 h" button for timeouts.

**Prompt 6 – Quotes, negotiation, chat**
> Implement quotes and immutable quote_versions, the supplier quote builder, buyer counter-offer dialog, and the negotiation state machine in 7.3 (round limit 3, expiry, version history timeline). Add a realtime private chat per supplier thread with contact-info warning. Price changes only through versions.

**Prompt 7 – Comparison + agreement**
> Build the buyer comparison page (Section 6) showing each supplier's latest version, Best value / Fastest labels, Trust Score badges, market average hint (if Price Index data exists), images/drawings for furniture. Accept → agreement page → both parties sign with demo Smart-ID → order created; other suppliers notified "not selected" with % feedback.

**Prompt 8 – Checkout, escrow, orders, delivery, disputes**
> Build checkout with Escrow and Pay later (pilot) and staged 30/70 payments for custom furniture (7.6), commission calculation (7.5) visible only to suppliers, order detail with timeline, production milestones, supplier status updates with photo uploads, buyer Accept delivery / Open dispute, admin dispute resolution, and reviews after completion (which trigger Trust Score recompute).

**Prompt 9 – Group Buy (pilot)**
> Build Group Buy (7.7): supplier pool creator with tiers editor, buyer pool browser and pool page with tier progress bar and deadline countdown, free join/leave, the `close-pool` function with confirm window, auto-RFQ when the pool fails for "order alone" members, anonymous totals only, and an admin "Close pool now" button. Show matching pools in step 4 of Create RFQ.

**Prompt 10 – Price Index + dashboards**
> Create the `price_index` view (≥ 5 samples rule) and a Price Index (beta) page with a line chart per category and region. Build buyer and supplier dashboards (Section 6) and supplier earnings page.

**Prompt 11 – Polish for demo**
> Load the café demo story from Section 11, make every screen work with it, add empty states, loading skeletons, toasts, Lithuanian translations for main screens, mobile check of the magic link page, and make sure the 3-minute demo script runs end to end without errors.

**Prompt 12 – Integration framework**
> Implement Section 15: connector interfaces with `demo` and `live` implementations and a factory that reads `integrations.mode`; tables `integrations`, `integration_logs`, `webhook_events`, `sync_jobs`, `identity_sessions`, `provider_accounts`; retry queue with backoff; pg_cron schedules; Admin → Integrations page with status, last error, Test connection and demo/live switch. Move all existing demo behaviour (Smart-ID dialog, mock escrow, mock financing, seeded company data, copyable links) behind the demo connectors without changing the UI.

**Prompt 13 – Live identity and company data**
> Implement the live `IdentityConnector` for our chosen provider (Section 16.1) for login, verification, agreement signing (PDF hash), company claim and pool confirmation, using secrets I will add. Implement the live `CompanyDataConnector` (16.4): nightly imports for company register, Sodra and VMI data, VIES VAT check API, TED tender counts, then Trust Score recompute.

**Prompt 14 – Live payments and financing**
> Implement the live `PaymentConnector` for our chosen marketplace payment provider (16.2): supplier onboarding with hosted KYB and `provider_accounts`, buyer checkout, held funds, release with platform fee, partial/full refunds, signed webhooks with idempotency, and sandbox mode. Block live orders to suppliers without `payouts_enabled`. Implement the `FinancingConnector` skeleton (16.3) with eligibility and webhooks.

**Prompt 15 – Messaging**
> Implement the live `MessagingConnector` (16.6): transactional email templates for every notification type with unsubscribe link; WhatsApp only for opted-in users with an opt-in checkbox on the magic link page and supplier profile; optional SMS for delivery day.

**Prompt 16 – Delivery and tracking**
> Implement Section 17: delivery fields on RFQ and quotes, `shipments`, `tracking_events`, `proof_of_delivery`, the mobile driver page `/d/:token`, carrier tracking via `CarrierConnector` with polling or webhooks, late-delivery alerts, partial deliveries, and proof of delivery feeding disputes and on-time rate.

**Prompt 17 – Supplier catalogue integrations**
> Implement Section 18: integration levels badge, spreadsheet template upload, XML/CSV feed import with field mapping, AI category mapping with confidence review, `products`, `product_feeds`, `feed_runs`, scheduled imports, catalogue price hints when quoting, and WooCommerce / Shopify / PrestaShop connectors with order push-back. Signed quote versions always override catalogue prices.

**Prompt 18 – Live readiness**
> Add acceptance tests TC15–TC22 as a checklist page in Admin, make sure no secret reaches the frontend, verify RLS on all new tables, and add a "Go-live status" card per service on the Integrations page.

---

## 13. Acceptance tests

| ID | Scenario | Expected result |
|---|---|---|
| TC01 | Buyer creates RFQ (Renovation, Insulation → EPS) and submits | RFQ gets unique number, status `submitted` → `matched` |
| TC02 | Matching for Kaunas insulation RFQ | Baltic Insulation and Nordic Materials matched; Stogas Plus (tax debt, low score) excluded |
| TC03 | Snap & Source with café plan | Items drafted; low-confidence rows yellow; cannot submit until confirmed |
| TC04 | Unclaimed supplier quotes via magic link | Quote v1 saved; buyer notified; "Claim profile" banner shown |
| TC05 | Supplier declines | Recipient `declined`; next-ranked supplier receives the RFQ |
| TC06 | Buyer counter-offers 3 times | 4th counter blocked; only accept / reject available |
| TC07 | Buyer accepts quote; both sign | Agreement `signed`; order created with commission; other suppliers `not_selected` |
| TC08 | Escrow pay → delivered → accept | Payment `held` → `released`; supplier payout = total − commission |
| TC09 | Dispute opened | Order `disputed`; held amount shown; admin resolves with partial refund |
| TC10 | Group Buy pool reaches 200 pcs and closes | Members see −8% final price; confirmation creates individual orders |
| TC11 | Pool below minimum | Pool `cancelled`; "order alone" members get auto-RFQ at base price |
| TC12 | Supplier A opens RFQ thread | Cannot see supplier B's quotes or messages (RLS) |
| TC13 | Price Index for a category with 3 samples | Hidden with "Not enough data yet" |
| TC14 | Repeat order same buyer + supplier | Commission 1% |

---

## 14. What Lovable can't do for you

Lovable builds the connectors, but these need your action: signing contracts and passing business verification with each provider, creating accounts and API keys, legal and tax checks, and testing with real money in each provider's sandbox first (Section 19). Still out of scope: an in-house truck fleet, non-EU suppliers, native mobile apps.

---

## 15. Integration architecture

**Rule:** the app never calls a provider directly. Every external call goes through a **connector** in a Supabase Edge Function, chosen by the service's mode.

### 15.1 Connector interfaces (TypeScript, in `supabase/functions/_shared/connectors/`)

```ts
interface IdentityConnector {      // Smart-ID / Mobile-ID
  startAuth(input: { method: 'smart_id'|'mobile_id'; personalCode: string; phone?: string; country: 'LT' }): Promise<{ sessionId: string; verificationCode: string }>;
  pollAuth(sessionId: string): Promise<{ status: 'pending'|'ok'|'failed'; personalCode?: string; firstName?: string; lastName?: string }>;
  startSign(input: { sessionId?: string; personalCode: string; documentHash: string; documentName: string }): Promise<{ signSessionId: string; verificationCode: string }>;
  pollSign(signSessionId: string): Promise<{ status: 'pending'|'ok'|'failed'; signatureRef?: string }>;
}
interface PaymentConnector {        // escrow-style marketplace payments
  onboardSupplier(companyId: string): Promise<{ onboardingUrl: string; providerAccountId: string }>;
  createPayment(input: { orderId: string; milestone: string; amountCents: number; currency: 'EUR'; buyerCompanyId: string }): Promise<{ checkoutUrl?: string; providerPaymentId: string }>;
  release(input: { paymentId: string; supplierAccountId: string; amountCents: number; platformFeeCents: number }): Promise<{ providerTransferId: string }>;
  refund(input: { paymentId: string; amountCents: number }): Promise<{ providerRefundId: string }>;
  verifyWebhook(req: Request): Promise<WebhookEvent>;
}
interface FinancingConnector { checkEligibility(companyId: string, amountCents: number): Promise<{ approved: boolean; limitCents?: number; termDays: number[] }>; createFinancing(orderId: string, termDays: 30|60): Promise<{ providerRef: string; status: string }>; verifyWebhook(req: Request): Promise<WebhookEvent>; }
interface CompanyDataConnector { importAll(): Promise<SyncResult>; lookup(companyCode: string): Promise<PublicCompanyData|null>; checkVat(vatCode: string): Promise<{ valid: boolean; name?: string; address?: string }>; }
interface MessagingConnector { sendEmail(to: string, template: string, data: object): Promise<string>; sendWhatsApp?(to: string, template: string, data: object): Promise<string>; sendSms?(to: string, text: string): Promise<string>; }
interface CarrierConnector { createShipment?(order: object): Promise<{ trackingNumber: string; labelUrl?: string }>; track(carrier: string, trackingNumber: string): Promise<TrackingEvent[]>; verifyWebhook?(req: Request): Promise<WebhookEvent>; }
interface CatalogConnector { fetch(feed: ProductFeed): Promise<RawProduct[]>; pushOrder?(order: object): Promise<{ externalOrderId: string }>; }
interface AIConnector { extractRfqItems(files: string[], context: object): Promise<RfqDraft>; mapProduct(raw: RawProduct, categories: object[]): Promise<MappedProduct>; translate(text: string, to: 'en'|'lt'|'pl'|'de'): Promise<string>; }
```

Each interface has a `demo` and a `live` implementation. A factory reads the mode from `integrations` and returns the right one.

### 15.2 New tables

**integrations**
`id`, `service ('identity'|'payments'|'financing'|'company_data'|'places'|'email'|'whatsapp'|'sms'|'carrier'|'catalog'|'ai'|'translation')`, `provider text` (e.g. `dokobit`, `stripe`, `mangopay`, `paysera`, `resend`, `meta_whatsapp`, `dpd`), `mode ('demo'|'live')`, `is_enabled bool`, `config jsonb` (non-secret settings only), `last_success_at`, `last_error`, `updated_at`

**integration_logs**
`id`, `service`, `provider`, `action`, `request_summary jsonb` (no secrets, no full personal codes), `response_status int`, `duration_ms int`, `error text`, `created_at`

**webhook_events**
`id`, `provider`, `event_type`, `external_id text unique` (idempotency), `payload jsonb`, `signature_valid bool`, `processed_at`, `error`, `created_at`

**sync_jobs**
`id`, `job ('company_data_import'|'feed_import'|'tracking_poll'|'trust_recompute'|'pool_close'|'rfq_timeouts')`, `target_id (nullable)`, `status ('queued'|'running'|'done'|'failed')`, `attempts int`, `run_after timestamptz`, `result jsonb`, `created_at`

**identity_sessions**
`id`, `profile_id`, `purpose ('login'|'verify'|'sign_agreement'|'claim_company'|'confirm_pool')`, `provider_session_id`, `verification_code`, `status`, `result_personal_code_hash`, `expires_at`, `created_at`

**provider_accounts** (supplier payout accounts)
`company_id`, `provider`, `provider_account_id`, `onboarding_status ('pending'|'verified'|'restricted')`, `payouts_enabled bool`, `updated_at`

Add to **payments**: `provider_payment_id`, `provider_transfer_id`, `provider_refund_id`, `platform_fee_cents`.

### 15.3 Engineering rules

- **Secrets** only in Supabase secrets (environment variables), never in the database or frontend. Name them `PROVIDER_*`, e.g. `STRIPE_SECRET_KEY`, `DOKOBIT_API_KEY`.
- **Webhooks:** one edge function per provider (`webhook-payments`, `webhook-financing`, `webhook-carrier`, `webhook-identity`), verify the signature, store in `webhook_events`, skip duplicates by `external_id`, then update the order.
- **Idempotency keys** on every payment, refund and transfer call (use `payments.id`).
- **Retries:** failed calls go to `sync_jobs` with exponential backoff (1 min, 5 min, 30 min, 2 h), max 5 attempts, then admin alert.
- **Scheduler:** Supabase `pg_cron` runs nightly company-data import (02:00), feed imports (hourly / daily per feed), tracking polls (every 30 min for active shipments), Trust Score recompute (03:00), pool closing and RFQ timeouts (every 5 min).
- **Sandbox first:** each live connector has a `test` config (provider sandbox keys) before production keys.
- **Admin → Integrations page:** list of services with mode, provider, status, last success, last error, a "Test connection" button, and a demo/live switch (admin only).
- **Privacy:** never store full personal codes; store a hash and the verified name. Log summaries only.

---

## 16. Live integrations by service

Provider names are suggestions. Check each provider's current API docs, prices, availability in Lithuania and contract terms before choosing; the connector interface stays the same whichever you pick.

### 16.1 Identity: Smart-ID / Mobile-ID
- **Provider options:** an identity gateway that covers Smart-ID, Mobile-ID and ID cards in one API (e.g. Dokobit), or SK ID Solutions directly (needs a relying-party contract).
- **Flow (login / verify / sign):** user enters personal code (and phone for Mobile-ID) → `startAuth` → show the **verification code** on screen → user confirms on their phone → poll `pollAuth` every 2 s up to 90 s → store verified name + hashed personal code.
- **Signing agreements:** generate a PDF of the agreed terms → hash it → `startSign` → poll → store `signatureRef` and the signed PDF in Storage.
- **Company link:** check that the signer is a manager or authorised representative of the company (from register data where available; otherwise upload a power of attorney for admin review).

### 16.2 Payments and escrow
- **Provider type:** a marketplace payment platform that supports holding buyer funds and paying out to many sellers with a platform fee (e.g. Stripe Connect, Mangopay; Paysera as a local option to check). The provider holds the money and handles KYC/KYB, so BuildSource doesn't need its own payment licence (confirm with the provider and a legal advisor).
- **Supplier onboarding:** when a supplier claims its profile → `onboardSupplier` → provider-hosted onboarding (company documents, IBAN) → webhook sets `payouts_enabled`. Suppliers can't receive live orders until verified.
- **Buyer payment:** order `awaiting_payment` → `createPayment` (card or bank transfer / open-banking payment if the provider supports it) → webhook `payment succeeded` → payment `held`, order `paid_escrow`.
- **Release:** delivery accepted → `release` with `platformFeeCents` = commission → payment `released`.
- **Refunds / disputes:** `refund` full or partial; disputes keep the held amount until admin resolution.
- **Check:** how long the provider can hold funds before payout; long furniture lead times may need staged payments (already in 7.6).

### 16.3 Financing (pay later)
- **Provider type:** licensed B2B "buy now, pay later" or invoice-financing partner operating in Lithuania (check availability; several EU providers exist).
- **Flow:** at checkout `checkEligibility` → show approved terms (30/60 days) → `createFinancing` → partner pays the supplier (through BuildSource payments or directly) → partner collects from the buyer → webhook updates `financing_requests`.
- BuildSource earns a referral fee; the partner carries the credit risk.

### 16.4 Company data and verification
- **Registrų centras** (company register) open data: company code, name, status, registration date, address, legal form, activity codes where published. Nightly import job into `company_public_data` (check the open-data portal's dataset format and terms).
- **Sodra** open data: insured employees, average wage, social-insurance debt by company code. Monthly/nightly import.
- **VMI** tax-debtor list: import as published; match by company code.
- **EU VIES:** public VAT-check API; call on supplier claim and before each foreign order.
- **Public tenders:** EU TED API (open) and Lithuanian procurement data if available; count wins per company code.
- After each import: queue Trust Score recompute for changed companies; show `data_date` in the badge.

### 16.5 Google Places
- Find suppliers' phone, website, location, opening hours for unclaimed profiles.
- **Check Google's terms:** they limit storing Places content. Store the `place_id` and fetch details when needed; cache only what the terms allow.

### 16.6 Email, WhatsApp, SMS
- **Email (main channel for unclaimed suppliers):** transactional email API with a verified sending domain (`buildsource.lt`, SPF/DKIM/DMARC). Templates: new RFQ, reminder, quote received, counter-offer, agreement to sign, payment held, shipped, delivered, dispute, pool closing. Every outreach email has an unsubscribe / "don't send RFQs" link (GDPR).
- **WhatsApp Business Cloud API:** **only for users who opted in** (WhatsApp requires opt-in and pre-approved templates for business-initiated messages). Don't use it for first contact with unclaimed suppliers; add an opt-in checkbox on the magic link page and supplier profile.
- **SMS:** optional backup for delivery-day notifications.

### 16.7 AI and translation
- **AI connector:** Snap & Source extraction (7.8), product-to-category mapping for feeds (Section 18), optional quote-summary text.
- **Translation:** messages and RFQs for Polish / German / Latvian suppliers.
- Keep the demo fallback active if the AI call fails, so the RFQ flow never blocks.

---

## 17. Delivery and tracking

BuildSource doesn't run trucks. It connects whoever delivers and shows one tracking timeline.

### 17.1 Delivery methods (chosen by the supplier in the quote)
| Method | Who delivers | Tracking source |
|---|---|---|
| `supplier_own` | Supplier's own truck or regular carrier | **Driver link** (no app needed) |
| `carrier` | External carrier booked by supplier or BuildSource | Carrier API / multi-carrier tracking service via tracking number |
| `pickup` | Buyer collects | Supplier marks "ready", buyer confirms collection |
| `pool_consolidated` | One truck for a Group Buy, several stops or a pickup point | Driver link with stops |

### 17.2 New fields and tables
- **rfqs / rfq delivery step:** `unloading ('manual'|'crane_needed'|'forklift_on_site')`, `site_access_notes`, `delivery_window ('morning'|'afternoon'|'any')`, `site_contact_name`, `site_contact_phone` (shown to the supplier only after the order is confirmed), `incoterm ('DAP'|'FCA'|'EXW')`.
- **quote_versions:** `delivery_method`, `delivery_cost`, `planned_delivery_date`, `partial_deliveries bool`.

**shipments**
`id`, `order_id`, `method`, `carrier (nullable)`, `tracking_number`, `driver_token text unique` (for driver link), `planned_date`, `eta timestamptz`, `status ('planned'|'ready_for_pickup'|'picked_up'|'in_transit'|'out_for_delivery'|'delivered'|'failed')`, `lines jsonb` (which order lines and quantities, for partial deliveries), `last_location jsonb (optional)`, `created_at`

**tracking_events**
`id`, `shipment_id`, `status`, `description`, `location text`, `source ('driver'|'carrier_api'|'supplier'|'buyer')`, `occurred_at`, `created_at`

**proof_of_delivery**
`id`, `shipment_id`, `photo_urls text[]`, `receiver_name`, `signature_url` (drawn on phone), `line_quantities jsonb` (received per line), `notes`, `created_at`

### 17.3 Screens
- **Supplier order page:** create shipment(s), choose method, enter tracking number and carrier, or generate a **driver link** (copy / send by SMS).
- **Driver page `/d/:token` (mobile-first, no login):** order summary, address, site contact, unloading notes, buttons "Picked up", "On the way" (optional location sharing), "Delivered" → photos, received quantities per line, receiver name and finger signature.
- **Buyer order page:** timeline from `tracking_events`, ETA, map pin (optional), proof of delivery, then **Accept delivery** or **Open dispute**. A quantity mismatch in proof of delivery pre-fills a dispute.

### 17.4 Rules
- Carrier shipments: poll tracking every 30 min (or receive webhooks) until delivered.
- Planned date passed without "delivered" → alert buyer and supplier; counts against on-time rate.
- Partial deliveries: each shipment accepted separately; escrow releases proportionally (or at the end; setting per order).
- Delivery data feeds Trust Score on-time rate.

---

## 18. Supplier catalogue integrations

### 18.1 Integration levels (shown as a badge on the supplier profile)
| Level | Method | Data |
|---|---|---|
| 0 | Magic link / dashboard only | Quotes, messages, statuses |
| 1 | Spreadsheet upload (template download) | Products, list prices |
| 2 | XML/CSV feed URL, imported on a schedule | Products, prices, stock, images |
| 3 | Shop connector (WooCommerce REST API keys, Shopify app, PrestaShop webservice key) | Live prices and stock; orders pushed back |
| 4 | ERP / accounting connector (per system, via its API) | Stock, customer prices, automatic orders, invoices back |

### 18.2 New tables
**product_feeds**
`id`, `supplier_company_id`, `type ('spreadsheet'|'xml'|'csv'|'woocommerce'|'shopify'|'prestashop'|'erp')`, `url`, `credentials_secret_ref` (name of the stored secret, never the key itself), `field_mapping jsonb`, `schedule ('hourly'|'daily')`, `last_run_at`, `last_status`, `products_count int`

**products**
`id`, `supplier_company_id`, `feed_id`, `external_id`, `name`, `description`, `category_id`, `specs jsonb`, `unit`, `list_price numeric`, `currency`, `stock_qty numeric (nullable)`, `lead_time_days`, `images text[]`, `datasheet_url`, `mapping_confidence numeric`, `mapping_confirmed bool`, `price_updated_at`, `is_active bool`

**feed_runs**
`id`, `feed_id`, `started_at`, `finished_at`, `added int`, `updated int`, `deactivated int`, `errors jsonb`

### 18.3 Import flow
1. Supplier adds a feed (or uploads a sheet) → field-mapping screen (their column → our field) with auto-suggestions.
2. Import job fetches and parses → AI maps each product to a category and specs → products with confidence < 0.75 go to a "Check mapping" list for the supplier.
3. Products appear in matching (suppliers with matching in-stock products rank higher) and as "Catalogue price" hints when quoting.
4. **The signed quote version always overrides catalogue prices.** A feed update never changes an agreed order.
5. Level 3–4: when an order is signed, `pushOrder` creates it in the supplier's shop/ERP; status updates come back by webhook or polling.

### 18.4 Rules
- Connect only with the supplier's permission; no scraping.
- Store API keys as Supabase secrets referenced by name; prefer read-only keys.
- Show "Price updated on …" everywhere a catalogue price appears.

---

## 19. Go-live checklist

Do these in order; each service can go live separately. Times are rough guesses and depend on each provider.

| # | Task | Who | Notes |
|---|---|---|---|
| 1 | Register the company (UAB or MB), business bank account, domain `buildsource.lt` | You | Needed by almost every provider |
| 2 | Privacy policy, terms of service (intermediary role, supplier liability, disputes, commission), cookie notice, GDPR legitimate-interest assessment for supplier outreach | You + legal advisor | Required before real users |
| 3 | Email provider + verified domain (SPF, DKIM, DMARC) | You | Fast; switch `email` to live first |
| 4 | Company-data imports (Registrų centras, Sodra, VMI, VIES, TED) | Lovable build + you check terms | No contract for most open data |
| 5 | AI provider key | You | Switch `ai` and `translation` to live |
| 6 | Identity provider contract (Smart-ID / Mobile-ID) | You | Business verification + contract; test environment first |
| 7 | Payment provider: platform account, KYB, marketplace/Connect setup, webhooks | You | Confirm escrow-style holding and payout timing; test with sandbox, then small real payments |
| 8 | Google Places API key with billing and usage limits | You | Respect storage terms |
| 9 | Carrier accounts / tracking service | You | Optional in Stage 1; driver link works without it |
| 10 | WhatsApp Business account, template approval | You | Opt-in users only |
| 11 | Financing partner agreement | You | Pilot; can stay in demo mode longest |
| 12 | Accountant: commission invoicing to suppliers, VAT, e-invoicing / reporting rules | You + accountant | BuildSource invoices its commission; suppliers invoice buyers |
| 13 | Security review: RLS tests (TC12), secrets, webhook signatures, backups, admin 2FA | Both | Before real money |
| 14 | Pilot with 5–10 real suppliers and 5 buyers, small orders | Both | Then open Kaunas + Vilnius |

**Switching a service to live:** add the secrets → set `integrations.mode = 'live'` in Admin → Integrations → run "Test connection" → run its acceptance tests (TC15–TC22).

### Extra acceptance tests for live integrations
| ID | Scenario | Expected result |
|---|---|---|
| TC15 | Smart-ID login in provider test environment | Verification code shown; name returned; personal code stored only as hash |
| TC16 | Buyer pays in payment sandbox | Webhook received once (duplicate ignored); payment `held` |
| TC17 | Delivery accepted | Transfer to supplier = total − commission; platform fee recorded |
| TC18 | Partial refund in dispute | Refund amount correct; order and payment statuses updated |
| TC19 | Nightly company-data import | Changed companies updated; Trust Scores recomputed; data date shown |
| TC20 | Supplier XML feed import with 100 products | Products created; low-confidence mappings flagged |
| TC21 | Carrier tracking number added | Events appear on buyer timeline within 30 min |
| TC22 | Driver link delivery with photos and quantities | Proof of delivery saved; quantity mismatch pre-fills a dispute |
