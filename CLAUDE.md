# Qurbani USA - Claude Code Project Guidelines

## Project Overview
Production-ready Islamic charity donation platform built with Astro 5.0 SSR and Supabase.

## Tech Stack
- **Framework**: Astro 5.0 with SSR (hybrid rendering)
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **Fonts**: Signika (headings), Lato (body), Oswald (nav), Playfair Display (accents)
- **Auth**: Supabase service role for admin operations

## Key Architecture Patterns

### SSR Routes
All API routes and dynamic pages require:
```typescript
export const prerender = false;
```

### Caching Strategy
Use in-memory caching with TTL for frequently accessed data:
```typescript
let cache: T[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getCachedData(): Promise<T[]> {
  const now = Date.now();
  if (cache && (now - cacheTimestamp) < CACHE_TTL) {
    return cache;
  }
  // Fetch from database...
  cache = data;
  cacheTimestamp = now;
  return cache;
}
```

### Error Handling
Always include fallback data for critical UI components:
```typescript
try {
  const { data, error } = await supabaseAdmin.from('table').select('*');
  if (error) throw error;
  return data || fallbackData;
} catch (e) {
  console.error('Operation failed:', e);
  return fallbackData;
}
```

## Directory Structure
```
src/
├── components/     # Reusable Astro components
├── layouts/        # Page layouts (AdminLayout, BaseLayout)
├── lib/            # Utility functions and Supabase client
│   ├── supabase.ts   # Supabase admin client
│   ├── settings.ts   # Site settings with caching
│   ├── categories.ts # Categories with 5-min cache
│   └── templates.ts  # Template options
├── pages/
│   ├── admin/      # Admin dashboard pages
│   ├── api/        # API routes (all require prerender = false)
│   └── appeals/    # Campaign pages
└── styles/         # Global CSS
```

## Database Tables
- `campaigns` - Donation campaigns
- `categories` - Campaign categories (mega menu)
- `site_settings` - Site configuration
- `donations` - Donation records
- `template_options` - Page/donation box templates
- `leads` - Form submissions (contact, newsletter) with GHL sync status
- `ghl_tokens` - GoHighLevel OAuth tokens (secure storage)
- `ghl_webhook_logs` - Incoming GHL webhook audit trail
- `orders` - Donation orders
- `order_items` - Order line items
- `packages` - Donation packages

## Coding Standards

### TypeScript
- Use strict TypeScript with proper interfaces
- No `any` types except for Supabase error handling
- Export types for cross-component usage

### Components
- Keep components focused and single-purpose
- Use Astro's `define:vars` for passing data to client scripts
- Serialize complex data with JSON.stringify

### API Routes
```typescript
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    // Validate input...
    // Process...
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
```

### Performance Requirements
- Never compromise on speed
- Use caching for repeated database queries
- Minimize client-side JavaScript
- Lazy load images with `loading="lazy"`

## Scripts Reference

### Database Migration Scripts
Located in `scripts/` directory. **ALWAYS USE EXISTING SCRIPTS - DO NOT CREATE DUPLICATES.**

| Script | Purpose | Usage |
|--------|---------|-------|
| `create-table-direct.mjs` | Create tables with auto-fallback | `node scripts/create-table-direct.mjs` |
| `setup-categories.mjs` | Setup categories table + seed | `node scripts/setup-categories.mjs` |
| `create-categories-table.mjs` | Legacy categories setup | Use `setup-categories.mjs` instead |
| `seed-emergency-campaigns.mjs` | Seed emergency campaigns | `node scripts/seed-emergency-campaigns.mjs` |
| `run-migration.mjs` | Run generic migrations | `node scripts/run-migration.mjs` |

### SQL Migration Files
| File | Purpose |
|------|---------|
| `migrate-categories.sql` | Categories table DDL + seed data |

### How Database Scripts Work
1. Scripts first try Supabase Management API
2. Then try direct PostgreSQL connection (requires DATABASE_URL)
3. Fall back to outputting SQL for manual execution

## Common Commands
```bash
# Development
npm run dev

# Build
npm run build

# Database setup (run in order for new project)
node scripts/create-table-direct.mjs    # Creates categories table
node scripts/seed-emergency-campaigns.mjs  # Seeds campaigns
```

## Environment Variables
Required in `.env`:
- `PUBLIC_SUPABASE_URL` - Supabase project URL
- `PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `DATABASE_URL` - **CONFIGURED** - Direct PostgreSQL connection for table creation

## My Database Access
**I have full database access via DATABASE_URL.** I can:
- Create tables (DDL)
- Insert/update/delete data
- Run migrations
- No need to ask user to run SQL manually

**Always use existing scripts in `scripts/` directory - do not create duplicates.**

## Programmatic Database Operations

### To Enable Auto Table Creation:
1. Go to Supabase Dashboard > Settings > Database
2. Copy the "Connection string" (URI format)
3. Add to `.env`: `DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres`

### If DATABASE_URL Not Available:
Scripts will output SQL - copy and paste into Supabase Dashboard > SQL Editor

## Important Notes
- Admin operations use `supabaseAdmin` (service role key)
- Public operations use `supabase` (anon key)
- Clear relevant caches after database mutations
- Use bulk operations for multiple updates (`.in('id', ids)`)
- **ALWAYS check scripts/ directory before creating new migration scripts**
- Categories use 5-minute in-memory cache for performance

## GoHighLevel Integration (Completed Feb 2026)

**Full documentation:** `docs/GHL_INTEGRATION.md`

### Quick Reference
- **GHL Library:** `src/lib/ghl.ts` (consolidated, uses env vars)
- **Legacy re-exports:** `src/lib/gohighlevel.ts`

### Environment Variables
```env
GHL_API_KEY=pit-xxxx...
GHL_LOCATION_ID=W0zaxipAVHwutqUazGwL
```

### API Endpoints
| Endpoint | Purpose |
|----------|---------|
| `POST /api/contact` | Contact form → Supabase + GHL |
| `POST /api/newsletter` | Newsletter signup → Supabase + GHL |
| `POST /api/webhooks/ghl` | Receives GHL status changes |
| `POST /api/payments/sync-ghl` | Manual donation sync to GHL |

### Two-Way Sync Flow
```
Website Forms → Supabase (leads) → GHL (contacts)
                      ↑
GHL Webhooks → /api/webhooks/ghl → Supabase (leads.status)
```

### Key Functions
```typescript
import { syncContactFormToGHL, syncNewsletterSignupToGHL, syncDonationToGHL } from '../lib/ghl';
```

## Zakat Calculator (Completed Feb 2026)

- **Page:** `/zakat-calculator`
- **Live metal prices API:** `/api/metal-prices` (gold-api.com, 1hr cache)
- **Features:** Info tooltips, gray input boxes, live gold/silver prices
- **Nisab:** Silver = 595g, Gold = 87.48g

## Contact Page (Completed Feb 2026)

- **Page:** `/contact`
- **Features:** Hero, quick contact cards, form with GHL sync, office hours, FAQ accordion, Google Maps
- **Form submits to:** `/api/contact`

## Recent Fixes & Updates

### Domain/Branding
- All URLs updated to `qurbani.com` (not qurbaniusa.org)
- Email: `info@qurbani.com`
- Organization name: "Qurbani Foundation USA" (removed all Al Mustafa references)

### Footer
- Toll-free number (1-800-900-0027) appears first
- Email is clickable (mailto link)
- Newsletter form connected to `/api/newsletter`

### Payments
- Stripe checkout: `/api/checkout`
- Stripe webhooks: `/api/webhooks/stripe` (syncs donations to GHL)
