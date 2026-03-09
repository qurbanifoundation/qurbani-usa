# Qurbani USA - Claude Code Project Guidelines

## Project Overview
Production-ready Islamic charity donation platform built with Astro 5.0 SSR and Supabase.
- **Domain**: `www.qurbani.com` | **Org**: Qurbani Foundation USA
- **Email**: `info@qurbani.com` | **Toll-free**: 1-800-900-0027

## Tech Stack
- **Framework**: Astro 5.0 with SSR (hybrid rendering)
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **Fonts**: Signika (headings), Lato (body), Oswald (nav), Playfair Display (accents)
- **Payments**: Stripe (keys in `site_settings` table)
- **CRM**: GoHighLevel | **Email**: Resend | **Hosting**: Cloudflare Pages

## Existing Infrastructure (DO NOT ASK - ALREADY CONFIGURED)
Google Places API, Stripe, Supabase, Cloudflare, GHL, Resend email — all set up.
When implementing new features: check existing components for patterns, reuse env vars, don't create new configs.

## Key Architecture Patterns

### SSR Routes
All API routes and dynamic pages require:
```typescript
export const prerender = false;
```

### Caching Strategy
Use in-memory caching with 5-min TTL for frequently accessed data (see `src/lib/categories.ts` for pattern).

### Error Handling
Always include fallback data for critical UI components. Try/catch with console.error and return fallbackData.

## Directory Structure
```
src/
├── components/     # Reusable Astro components
├── layouts/        # Page layouts (AdminLayout, BaseLayout)
├── lib/            # Utility functions and Supabase client
│   ├── supabase.ts, settings.ts, categories.ts, templates.ts
│   ├── ghl.ts, ghl-advanced.ts        # GoHighLevel integration
│   ├── notifications.ts               # Admin notifications
│   ├── donor-emails.ts                # Donor email templates
│   └── menus.ts                       # Mega menu data + cache
├── pages/
│   ├── admin/      # Admin dashboard pages
│   ├── api/        # API routes (all require prerender = false)
│   ├── appeals/    # Campaign pages ([slug].astro)
│   └── ramadan/    # Ramadan-specific pages
├── templates/      # Page templates (Aqiqah, Orphan, Ramadan, etc.)
└── styles/         # Global CSS
```

## Database Tables
`campaigns`, `categories`, `site_settings`, `donations`, `donation_subscriptions`,
`subscription_payments`, `webhook_events`, `donor_notifications`, `template_options`,
`leads`, `ghl_tokens`, `ghl_webhook_logs`, `orders`, `order_items`, `packages`,
`donation_disputes`, `admin_notifications`, `mega_menus`, `menu_widgets`,
`woo_customers`, `woo_orders`

## API Endpoints
| Endpoint | Purpose |
|----------|---------|
| `POST /api/contact` | Contact form → Supabase + GHL |
| `POST /api/newsletter` | Newsletter signup → Supabase + GHL |
| `POST /api/webhooks/ghl` | Receives GHL status changes |
| `POST /api/payments/create-intent` | Create PaymentIntent or Subscription |
| `POST /api/webhooks/stripe` | Handle Stripe payment & subscription events |
| `GET/POST/DELETE /api/subscriptions/manage` | Donor subscription management |
| `POST /api/payments/sync-ghl` | Manual donation sync to GHL |
| `GET/PUT/DELETE /api/mega-menus` | Menu CRUD (supports ID changes) |
| `GET/POST/PUT/DELETE /api/menu-widgets` | Widget CRUD |
| `POST /api/seed-menu-widgets` | Template seeding |

## Coding Standards
- Strict TypeScript, no `any` except Supabase error handling
- Components: focused, single-purpose, use `define:vars` for client data
- API routes: try/catch, JSON responses, proper status codes
- Performance: caching, minimal client JS, lazy load images
- Admin operations use `supabaseAdmin` (service role), public uses `supabase` (anon key)

## Scripts Reference
| Script | Purpose |
|--------|---------|
| `scripts/create-table-direct.mjs` | Create tables with auto-fallback |
| `scripts/setup-categories.mjs` | Categories table + seed |
| `scripts/seed-emergency-campaigns.mjs` | Seed emergency campaigns |
| `scripts/run-migration.mjs` | Run generic migrations |
| `scripts/import-woocommerce.mjs` | Import WooCommerce customers & orders from CSV into Supabase + GHL sync |

**Always check `scripts/` before creating new migration scripts.**

## Branching & Deployment (CRITICAL)
- **NEVER commit or push directly to `main`** — `main` is production-only
- **Always work on the `dev` branch** — commit and push code to `dev`
- **Deployments are manual** (not auto-deploy on push) — CI was disabled because GitHub Actions secrets don't get properly inlined by Astro/Vite at build time
- A pre-push hook blocks accidental pushes to `main` from other branches
- Run `npm run verify` before production deploy — it builds and tests under the actual Workers runtime

### Deployment Workflow (ALWAYS FOLLOW THIS ORDER)
1. **Local first** — test on `localhost:4321` (`npm run dev`)
2. **Deploy to preview** — `npm run deploy:preview` → verify on `dev.qurbani-usa.pages.dev`
3. **Deploy to production** — ONLY when the user explicitly says to → `npm run deploy:production` → `www.qurbani.com`
- **NEVER skip steps** — always go local → dev → production in order
- **NEVER deploy to production** unless the user explicitly asks for it

## Common Commands
```bash
npm run dev              # Development (localhost:4321)
npm run build            # Build
npm run verify           # Build + test under Cloudflare Workers runtime
npm run deploy:preview   # Build + deploy to dev.qurbani-usa.pages.dev
npm run deploy:production # Build + deploy to www.qurbani.com
```

## Environment Variables
```env
# Supabase
PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL
# Stripe
PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
# GoHighLevel
GHL_API_KEY, GHL_LOCATION_ID=W0zaxipAVHwutqUazGwL
# Google Places
PUBLIC_GOOGLE_PLACES_API_KEY
# Google Analytics (GA4 server-side)
GA4_API_SECRET, GA4_MEASUREMENT_ID=G-0WC0W1PBKC
# Resend
RESEND_API_KEY, ADMIN_EMAIL=qurbanifoundation@gmail.com
# Cloudflare
CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
```

## My Role & Access
I am the Senior Developer with **FULL ADMIN ACCESS** to the entire stack (Database, Supabase, Git, Cloudflare, Stripe, GHL, Hosting). I execute directly — never ask the user to run SQL, deploy, or configure services.

## Timezone
- Server: UTC | Display: Eastern Time (America/New_York)

## GA4 Server-Side Tracking
- **Architecture**: Stripe webhook → GA4 Measurement Protocol (no client-side `purchase` event)
- **Flow**: DonationCart.astro captures `client_id` (from `_ga` cookie) + `session_id` (from `_ga_0WC0W1PBKC` cookie) → passed as Stripe metadata → webhook reads metadata and sends `purchase` event server-side
- **Measurement ID**: `G-0WC0W1PBKC`
- **API Secret**: Set in `.env` and Cloudflare Pages dashboard as `GA4_API_SECRET`
- **Key files**: `src/components/DonationCart.astro` (cookie capture), `src/pages/api/webhooks/stripe.ts` (sends GA4 event), `src/pages/api/payments/create-intent.ts` & `create-subscription.ts` (pass metadata)
- **Why server-side**: Prevents phantom conversions from client-side firing without payment validation

## WooCommerce Import System
- **Purpose**: Imported 992 customers and 1,154 orders from old WordPress/WooCommerce site for remarketing
- **Data source**: `data/woocommerce-orders.csv` (1,646 rows, multi-row per order)
- **Script**: `scripts/import-woocommerce.mjs` — parses CSV, deduplicates, categorizes, imports to Supabase, optionally syncs to GHL
  - Flags: `--dry-run` (analyze only), `--sync-ghl` (sync to GoHighLevel)
- **Tables**: `woo_customers` (992 rows) and `woo_orders` (1,154 rows) in Supabase
- **Admin page**: `/admin/woo-customers` — Customers tab (search, filter by category/tier) + Orders tab + click-through customer detail view
- **GHL sync**: 981 contacts synced with structured prefix-based tags

## GHL Tag Architecture (Structured / Prefix-Based)
All GHL tags for WooCommerce imports use prefix-based structure (NOT flat tags):
- `source:woocommerce`, `migration:woocommerce`, `donor:existing`, `donor:repeat`, `donor:major`
- Campaign tags: `campaign:qurbani`, `campaign:aqiqah`, `campaign:zakat`, `campaign:ramadan`, `campaign:orphan`, `campaign:education`, `campaign:emergency`, `campaign:palestine`, `campaign:water`, `campaign:healthcare`, `campaign:sadaqah`, `campaign:general`
- Tier tags: `tier:platinum` (≥$5K), `tier:gold` (≥$1K), `tier:silver` (≥$250), `tier:bronze` (<$250)
- Custom fields: `total_lifetime_giving`, `donation_count`, `first_donation_date`, `last_donation_date`, `largest_donation`, `campaigns_donated`, `donor_tier`

## Email Architecture
- **Resend** = Transactional emails ONLY (donation receipts, subscription confirmations, password resets)
- **GoHighLevel** = Marketing / relationship emails (re-introduction campaigns, newsletters, appeals, follow-ups)
- Re-marketing campaigns (e.g., WooCommerce donor re-introduction) go through GHL, NOT Resend

## Detailed Documentation
For deep-dive reference on specific systems, see:
- **Payments & Stripe**: `docs/PAYMENTS.md`
- **Notifications & Emails**: `docs/NOTIFICATIONS.md`
- **Mega Menu System**: `docs/MEGA_MENUS.md`
- **Page Templates**: `docs/TEMPLATES.md`
- **Analytics & Tracking**: `docs/TRACKING.md`
- **GHL Integration**: `docs/GHL_INTEGRATION.md`
