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
`donation_disputes`, `admin_notifications`, `mega_menus`, `menu_widgets`

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

**Always check `scripts/` before creating new migration scripts.**

## Branching & Deployment (CRITICAL)
- **NEVER commit or push directly to `main`** — `main` is production-only
- **Always work on the `dev` branch** — commit and push code to `dev`
- **Deployments are manual** (not auto-deploy on push) — CI was disabled because GitHub Actions secrets don't get properly inlined by Astro/Vite at build time
- Deploy preview: `npm run deploy:preview` → deploys to `dev.qurbani-usa.pages.dev`
- Deploy production: `npm run deploy:production` → deploys to `www.qurbani.com`
- Always deploy to preview first, verify it works, then deploy to production
- A pre-push hook blocks accidental pushes to `main` from other branches
- Run `npm run verify` before production deploy — it builds and tests under the actual Workers runtime

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
# Resend
RESEND_API_KEY, ADMIN_EMAIL=qurbanifoundation@gmail.com
# Cloudflare
CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
```

## My Role & Access
I am the Senior Developer with **FULL ADMIN ACCESS** to the entire stack (Database, Supabase, Git, Cloudflare, Stripe, GHL, Hosting). I execute directly — never ask the user to run SQL, deploy, or configure services.

## Timezone
- Server: UTC | Display: Eastern Time (America/New_York)

## Detailed Documentation
For deep-dive reference on specific systems, see:
- **Payments & Stripe**: `docs/PAYMENTS.md`
- **Notifications & Emails**: `docs/NOTIFICATIONS.md`
- **Mega Menu System**: `docs/MEGA_MENUS.md`
- **Page Templates**: `docs/TEMPLATES.md`
- **Analytics & Tracking**: `docs/TRACKING.md`
- **GHL Integration**: `docs/GHL_INTEGRATION.md`
