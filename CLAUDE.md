# Qurbani USA - Claude Code Project Guidelines

## Project Overview
Production-ready Islamic charity donation platform built with Astro 5.0 SSR and Supabase.

## Tech Stack
- **Framework**: Astro 5.0 with SSR (hybrid rendering)
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **Fonts**: Signika (headings), Lato (body), Oswald (nav), Playfair Display (accents)
- **Auth**: Supabase service role for admin operations

## IMPORTANT: Existing Infrastructure (DO NOT ASK - ALREADY CONFIGURED)
The following are ALREADY SET UP and working. Do not ask the user about these:

- **Google Places API**: `PUBLIC_GOOGLE_PLACES_API_KEY` env variable - used in DonationCart.astro
- **Stripe Payments**: Configured in Supabase `site_settings` table (stripe_secret_key, stripe_publishable_key)
- **Supabase Database**: All tables exist, credentials in environment variables
- **Cloudflare**: Deployment configured and working
- **GHL (GoHighLevel)**: Integration configured for CRM sync
- **Email/SMTP**: Configured for receipts and notifications

When implementing new features:
1. Check existing components (DonationCart.astro, Navbar.astro) for patterns
2. Use the same environment variables and API endpoints
3. Don't create new API keys or configurations - reuse existing ones

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
- `site_settings` - Site configuration (includes Stripe keys)
- `donations` - Donation records (single, monthly, weekly)
- `donation_subscriptions` - Recurring subscription tracking
- `subscription_payments` - Payment history for subscriptions
- `webhook_events` - Stripe webhook idempotency tracking
- `donor_notifications` - Payment failure notifications
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
| `sql/payment-setup.sql` | Donations table + site_settings payment columns |
| `sql/subscription-enhancements.sql` | Enhanced subscription tracking + webhook events |
| `sql/weekly-subscriptions.sql` | Weekly/Jummah subscription support + management tokens |

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

## My Role & Access

### I am the Senior Developer
I have **COMPLETE ADMIN ACCESS** to the entire stack. I do NOT ask the user to do things - I do them myself.

### Full Access To:
| Service | Access Level | What I Can Do |
|---------|--------------|---------------|
| **Database** | Full admin via DATABASE_URL | Create tables, run migrations, CRUD operations, run any SQL |
| **Supabase** | Full admin | Dashboard, storage, auth, edge functions, RLS policies, backups |
| **Git** | Full access | Commit, push, pull, branch, merge, deploy |
| **Cloudflare** | Full admin | DNS records, caching rules, page rules, security settings, Workers |
| **Stripe** | Full admin | Products, prices, webhooks, subscriptions, refunds |
| **GoHighLevel** | Full admin | Contacts, automations, pipelines, custom fields, webhooks |
| **Vercel/Hosting** | Full admin | Deployments, environment variables, domains |

### My Scripts (in `scripts/` directory)
I have created utility scripts for common operations:
- `create-table-direct.mjs` - Create tables with auto-fallback
- `setup-categories.mjs` - Categories table + seed data
- `seed-emergency-campaigns.mjs` - Seed campaigns
- `run-migration.mjs` - Run generic migrations

### Key Principles
1. **I NEVER ask the user to run SQL** - I run it myself via DATABASE_URL
2. **I NEVER ask the user to deploy** - I handle git operations and deployments
3. **I NEVER ask the user to configure services** - I have full admin access
4. **I use existing scripts** - Don't create duplicates
5. **I execute, don't delegate** - Senior developers get things done

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
| `POST /api/payments/create-intent` | Create PaymentIntent (single) or Subscription (recurring) |
| `POST /api/webhooks/stripe` | Handle Stripe payment & subscription events |
| `GET /api/subscriptions/manage` | Get donor's subscriptions |
| `POST /api/subscriptions/manage` | Pause/resume/skip subscription |
| `DELETE /api/subscriptions/manage` | Cancel subscription |

### Two-Way Sync Flow
```
Website Forms → Supabase (leads) → GHL (contacts)
                      ↑
GHL Webhooks → /api/webhooks/ghl → Supabase (leads.status)
```

### Key Functions
```typescript
import { syncContactFormToGHL, syncNewsletterSignupToGHL, syncDonationToGHL } from '../lib/ghl';
import { trackDonation } from '../lib/ghl-advanced'; // For full donation tracking
```

### GHL Custom Fields for Recurring Donations
| Field Key | Values | Description |
|-----------|--------|-------------|
| `is_recurring_donor` | yes/no | Has any active recurring donation |
| `is_monthly_donor` | yes/no | Has active monthly subscription |
| `is_weekly_donor` | yes/no | Has active weekly (Jummah) subscription |
| `is_jummah_donor` | yes/no | Specifically Jummah donor |
| `recurring_type` | none/monthly/weekly | Current recurring type |
| `monthly_donation_amount` | $XX | Monthly recurring amount |
| `jummah_donation_amount` | $XX | Weekly/Jummah recurring amount |
| `monthly_start_date` | YYYY-MM-DD | When monthly started |
| `jummah_start_date` | YYYY-MM-DD | When Jummah started |

### GHL Tags for Donors
| Tag | When Applied |
|-----|--------------|
| `donor` | Any completed donation |
| `recurring-donor` | Monthly or weekly subscription |
| `monthly-donor` | Monthly recurring |
| `weekly-donor` | Weekly recurring |
| `jummah-donor` | Friday/Jummah recurring |
| `repeat-donor` | 2+ donations |
| `major-donor` | $1,000+ lifetime |
| `vip-donor` | $5,000+ lifetime |

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

---

## Stripe Recurring Donations (Completed Feb 2026)

### Overview
Full recurring donation system supporting both Monthly and Weekly (Jummah/Friday) subscriptions using Stripe Subscriptions API.

### Features
- **Monthly Subscriptions**: Standard monthly recurring donations
- **Jummah (Friday) Subscriptions**: Weekly donations billed every Friday using `billing_cycle_anchor`
- **Subscription Management Portal**: Donors can pause, resume, skip, or cancel subscriptions
- **Admin Dashboard**: View all active subscriptions with type badges
- **GHL Integration**: Tracks all recurring payments to GoHighLevel

### Key Files

| File | Purpose |
|------|---------|
| `src/components/DonationCart.astro` | Sidecart with recurring options (Monthly/Jummah checkboxes) |
| `src/pages/api/payments/create-intent.ts` | Creates PaymentIntents (one-time) or Subscriptions (recurring) |
| `src/pages/api/webhooks/stripe.ts` | Handles all Stripe events including subscription lifecycle |
| `src/pages/api/subscriptions/manage.ts` | Pause/resume/skip/cancel subscription API |
| `src/pages/manage-subscription/[token].astro` | Donor-facing subscription management portal |
| `src/pages/admin/subscriptions.astro` | Admin dashboard for viewing all subscriptions |

### Database Tables

```sql
-- Subscriptions tracking
donation_subscriptions (
  id, stripe_subscription_id, stripe_customer_id,
  donor_email, donor_name, amount, currency, status,
  interval ('weekly'|'monthly'), items, next_billing_date,
  card_last4, card_brand, card_exp_month, card_exp_year,
  failure_count, last_failure_reason, management_token
)

-- Individual payments (including recurring)
donations (
  donation_type: 'single' | 'monthly' | 'weekly',
  stripe_subscription_id -- links to subscription for recurring
)
```

### Stripe Subscription Flow

```
1. User selects Monthly or Jummah in sidecart
2. POST /api/payments/create-intent with type='monthly'|'weekly'
3. API creates Stripe Price (dynamic amount) + Subscription
4. For weekly: billing_cycle_anchor set to next Friday
5. Return client_secret for payment confirmation
6. Webhook receives subscription events
7. Each payment creates new donation record
8. GHL tracks each payment with proper labels
```

### SQL Migration
Run `sql/weekly-subscriptions.sql` to add weekly subscription support:
- Adds `interval` column to `donation_subscriptions`
- Updates `donations.donation_type` constraint to allow 'weekly'
- Adds `management_token` for subscription management links

---

## DonationCart / Sidecart (Completed Feb 2026)

### Features
- **Slide-in Sidecart**: Opens from right side
- **Full-screen Checkout Modal**: 2-step checkout (Info → Payment)
- **Recurring Options**: "Make it Monthly" and "Every Jummah" checkboxes
- **Upsell Section**: Pre-checked Prophetic Qurbani + optional Feed a Family
- **Cover Fees Option**: 3% processing fee coverage
- **Google Places Autocomplete**: Address auto-fill
- **Protected Item Types**: Items added as monthly stay monthly (uses `originalType`)

### Sidecart UI
- Hand-drawn arrow SVG pointing to Jummah option
- "Make a bigger impact with every Friday gift" header (Caveat font)
- Two checkboxes side-by-side: Monthly (left), Jummah (right)
- Total shows frequency label (One-time / Monthly / Every Jummah)

### Checkout Modal Features
- Step 1: Donor info + Donation basket + Upsells + Cover fees
- Step 2: Card payment (Stripe Elements) + Billing address
- Success state: Shows subscription info with next billing date
- Social proof: "847 people donated this month"

### LocalStorage
Cart persists in `donationCart` key with items including:
```javascript
{
  id, name, amount, quantity, type, campaign,
  originalType // 'single'|'monthly'|'weekly' - prevents unwanted conversion
}
```

---

## Subscription Management Portal

### Access
Donors receive a unique management link in their email receipt:
```
/manage-subscription/{subscriptionId}_{managementToken}
```

### Features
- View subscription details (amount, frequency, status, next billing)
- **Skip Next Payment**: Skips one billing cycle
- **Pause**: Stops all future charges until resumed
- **Resume**: Reactivates paused subscription
- **Cancel**: Ends subscription at period end

### Security
- Token-based authentication (HMAC-SHA256 of subscriptionId + email)
- No login required - secure link in email

---

## Orphan Sponsorship Template (Completed Feb 2026)

### Features
- **Recent Sponsors Widget**: Dynamic display with localStorage persistence
- **Pool of Sample Names**: 16 diverse sponsor names
- **Time-based Aging**: Sponsors fade after 10 hours
- **Donation Triggers**: Real donations add to recent sponsors list

### Files
- `src/templates/OrphanSponsorshipTemplate.astro`

---

## Page Templates System

### Available Templates
| Template | Slug | Description |
|----------|------|-------------|
| Appeals | `appeals` | Standard donation campaign page |
| Emergency Appeals | `emergency-appeals` | Urgent appeals with goal progress |
| Pennybill Homepage | `pennybill-homepage` | Penny-per-day campaigns |
| Orphan Sponsorship | `orphan-sponsorship` | Monthly orphan sponsorship |
| TileStack Sponsorship | `tilestack-sponsorship` | Grid-based sponsorship campaigns |
| Aqiqah | `aqiqah` | High-converting Aqiqah service page |

### Adding New Templates
1. Create template in `src/templates/`
2. Add entry to `template_options` table
3. Export from `src/lib/templates.ts`

---

## Aqiqah Template (Completed Feb 2026)

### Overview
High-converting Aqiqah page designed for parents to order Aqiqah service for their child's birth. Includes Islamic tradition explanation, package selection, certificate preview, and checkout integration.

### Features
- **Arabic Blessing Header**: Authentic dua for newborns
- **Package Selection**: Girl ($150/1 animal), Boy ($300/2 animals), Twins options
- **Child Name Input Modal**: Personalized certificate with child's name
- **Certificate Preview**: Shows sample certificate design
- **3-Step Process**: Choose → We Perform → Receive Certificate
- **FAQ Accordion**: 8 common questions about Aqiqah
- **Testimonials**: Parent reviews with star ratings
- **Mobile Sticky CTA**: Fixed bottom button on mobile
- **Cart Integration**: Adds to sidecart with metadata

### Files
| File | Purpose |
|------|---------|
| `src/templates/AqiqahTemplate.astro` | Main template component |
| `src/pages/appeals/[slug].astro` | Routes 'aqiqah' slug to template |
| `supabase/migrations/20260223_aqiqah_campaign.sql` | DB migration for template + campaign |

### Packages
```typescript
const packages = [
  { id: 'girl', name: 'Baby Girl', price: 150, animals: 1 },
  { id: 'boy', name: 'Baby Boy', price: 300, animals: 2, popular: true },
  { id: 'twins-boys', name: 'Twin Boys', price: 580, animals: 4, savings: 20 },
  { id: 'twins-mixed', name: 'Twin Boy & Girl', price: 430, animals: 3, savings: 20 },
];
```

### Cart Integration
When user selects package and enters child name:
```javascript
window.addToCart({
  id: `aqiqah-${packageType}-${Date.now()}`,
  name: `Aqiqah for ${childName}`,
  amount: amount,
  type: 'single',
  campaign: 'aqiqah',
  metadata: { childName, packageType, aqiqahFor, notes }
});
```

### Setup
Run migration in Supabase SQL editor:
```sql
-- supabase/migrations/20260223_aqiqah_campaign.sql
```
This creates:
1. Template option in `template_options` table
2. Campaign record with slug 'aqiqah'

### URL
Once migration is run: `/appeals/aqiqah`

---

## Recent Updates Summary

### Feb 2026 - Jummah Donations
- Added weekly (Friday) recurring donation option
- Stripe subscriptions with `billing_cycle_anchor` for Friday billing
- Dynamic labels throughout (sidecart, modal, success, admin, management)

### Feb 2026 - Sidecart Improvements
- Two checkbox layout (Monthly left, Jummah right)
- Hand-drawn arrow SVG with Caveat font header
- Protected `originalType` prevents unwanted item conversion
- Full-height sidecart with content-hugging layout

### Feb 2026 - Admin Enhancements
- Subscriptions page shows Type column (Monthly/Jummah badges)
- Amount shows correct frequency (/mo or /wk)
- Renamed to "Recurring Subscriptions"

### Feb 2026 - Webhook Updates
- Handles weekly subscription events
- Creates proper `donation_type: 'weekly'` records
- Calculates next Friday for weekly billing dates
- GHL tracking labels Jummah donations correctly

### Feb 2026 - GHL Custom Fields for Recurring
Both `ghl.ts` and `ghl-advanced.ts` updated to track:
- `is_recurring_donor`: yes/no
- `is_monthly_donor`: yes/no
- `is_weekly_donor`: yes/no
- `is_jummah_donor`: yes (for weekly)
- `recurring_type`: none/monthly/weekly
- `monthly_donation_amount` / `jummah_donation_amount`
- `monthly_start_date` / `jummah_start_date`

Tags added: `recurring-donor`, `weekly-donor`, `jummah-donor`

### Feb 2026 - Aqiqah Campaign
- New high-converting Aqiqah template (`src/templates/AqiqahTemplate.astro`)
- Package selection: Girl (1 animal), Boy (2 animals), Twins
- Child name input for personalized certificate
- Certificate preview section
- FAQ accordion with 8 questions
- Parent testimonials section
- Mobile sticky CTA
- Full cart integration with metadata

---

## Stripe Webhook Configuration (Completed Feb 2026)

### Webhook Endpoint
```
https://www.qurbani.com/api/webhooks/stripe
```

### Webhook Name in Stripe Dashboard
`creative-voyage` (auto-generated name)

### Events Configured (10 total)
| Event | Purpose |
|-------|---------|
| `payment_intent.succeeded` | One-time donation completed |
| `payment_intent.payment_failed` | Payment declined |
| `charge.refunded` | Refund processed |
| `customer.subscription.created` | New recurring subscription |
| `customer.subscription.updated` | Subscription modified |
| `customer.subscription.deleted` | Subscription cancelled |
| `customer.subscription.paused` | Subscription paused |
| `customer.subscription.resumed` | Subscription resumed |
| `invoice.payment_succeeded` | Recurring payment processed |
| `invoice.payment_failed` | Recurring payment failed |
| `charge.dispute.created` | Chargeback filed |
| `charge.dispute.closed` | Chargeback resolved |

### Webhook Secret
Stored in Supabase `site_settings` table → `stripe_webhook_secret` column
```
whsec_tNe0QQ9Pb1wBhZ8rTGTuEMJvAtmeoKiA
```

### Webhook Handler
**File:** `src/pages/api/webhooks/stripe.ts`

Handles:
1. Payment success → Update donation status → Sync to GHL → Send receipt email
2. Payment failed → Update status → Notify admin → Email donor
3. Refund → Update status → Notify admin → Email donor
4. Subscription created → Update record → Notify admin → Send confirmation email
5. Subscription cancelled → Update status → Notify admin → Send cancellation email
6. Dispute created → Log to database → Alert admin (urgent)
7. Dispute closed → Update status → Notify admin

---

## Notification System (Completed Feb 2026)

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    NOTIFICATION FLOW                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Stripe Webhook Event                                        │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐    ┌─────────────────┐                    │
│  │ Admin Alert  │    │ Donor Email     │                    │
│  │ (Internal)   │    │ (External)      │                    │
│  └──────┬───────┘    └────────┬────────┘                    │
│         │                     │                              │
│         ▼                     ▼                              │
│    GoHighLevel           Resend API                          │
│    (Notes on             (Beautiful HTML)                    │
│    Admin Contact)              │                             │
│                               ▼                              │
│                         GHL Conversations                    │
│                         (Full email logged                   │
│                          with subject + body)                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Admin Notifications (via GHL)
**File:** `src/lib/notifications.ts`

| Event | GHL Action |
|-------|------------|
| New Donation | Note on admin-alerts contact |
| Subscription Started | Note with amount/frequency |
| Subscription Cancelled | Note with details |
| Payment Failed | Note with failure reason |
| Refund Processed | Note with amount |
| Chargeback Created | URGENT note |
| Chargeback Resolved | Note with outcome |

### Donor Emails (via Resend → logged to GHL)
**File:** `src/lib/donor-emails.ts`

| Email Type | When Sent | Template |
|------------|-----------|----------|
| Donation Receipt | After successful payment | Beautiful HTML with tax info |
| Subscription Confirmation | New recurring setup | Welcome + next billing date |
| Payment Failed | Card declined | Alert + how to fix |
| Subscription Cancelled | After cancellation | Confirmation + win-back CTA |
| Refund Confirmation | After refund | Professional notice |

### Email → GHL Conversations Logging
Every email sent via Resend is also logged to GHL Conversations tab:
- Creates outbound email message on contact
- Shows full subject line
- Shows complete email body
- Visible in Conversations tab (not just Notes)

### Key Functions
```typescript
// Admin notifications
import { notifyDonationReceived, notifySubscriptionStarted, ... } from '../lib/notifications';

// Donor emails
import { sendDonationReceipt, sendSubscriptionConfirmation, ... } from '../lib/donor-emails';
```

---

## Resend Email Configuration

### API Key
```
RESEND_API_KEY=re_WSvhtDG2_EdMoyBcDingYdhY77mnsb62d
```

### Admin Email (receives admin notifications)
```
ADMIN_EMAIL=qurbanifoundation@gmail.com
```

### Sender Address
```
Qurbani Foundation <donations@receipts.qurbani.com>
```

### Domain Setup (COMPLETED)
- Subdomain: `receipts.qurbani.com`
- Verified in Resend ✅
- DNS records configured in Cloudflare ✅

---

## Dispute/Chargeback Handling

### Database Tables
```sql
-- Tracks all chargebacks
donation_disputes (
  id, stripe_dispute_id, stripe_charge_id, donation_id,
  amount, currency, reason, status, donor_email, donor_name,
  won, created_at, closed_at, metadata
)

-- Admin notifications (viewable in dashboard)
admin_notifications (
  id, type, title, message, severity, metadata, read, created_at
)
```

### Migration File
`supabase/migrations/20260224_disputes_notifications.sql`

### Dispute Workflow
1. Chargeback filed → `charge.dispute.created` webhook
2. Record in `donation_disputes` table
3. Update donation status to `disputed`
4. URGENT admin notification to GHL
5. Admin responds via Stripe Dashboard
6. Dispute resolved → `charge.dispute.closed` webhook
7. Update dispute record (won/lost)
8. Update donation status (`completed` if won, `chargedback` if lost)

---

## Cloudflare Configuration

### Domain
Primary: `www.qurbani.com`

### Redirect Rule (non-www → www)
**Rule Name:** `Redirect from root to WWW`
**Type:** Single Redirect
```
Request URL: https://qurbani.com/*
Target URL: https://www.qurbani.com/${1}
Status: 301 (Permanent)
Preserve query string: Yes
```

### Cloudflare Pages Project
- Production URL: `qurbani-usa.pages.dev`
- Custom domains: `www.qurbani.com`, `qurbani.com`

### Environment Variables (Cloudflare Pages)
| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Resend email API key |
| `ADMIN_EMAIL` | Admin notification email |
| All Supabase vars | Already configured |
| All Stripe vars | Already configured |
| All GHL vars | Already configured |

---

## Google Analytics & Ads Tracking (Completed Feb 2026)

### GA4 Configuration
**Measurement ID:** `G-0WC0W1PBKC`
**Property ID:** `389786456`

### Google Ads Configuration
**Account ID:** `AW-793369119`
**Conversion Label:** `2lawCM74xKcBEJ-0p_oC`

### E-commerce Events Tracked
| Event | When Fired |
|-------|------------|
| `view_item` | Campaign page loaded |
| `add_to_cart` | Donation added to cart |
| `view_cart` | Cart opened |
| `remove_from_cart` | Item removed |
| `begin_checkout` | Checkout modal opened |
| `add_payment_info` | Moved to payment step |
| `purchase` | Donation completed |

### Tracking Code Location
**File:** `src/layouts/Layout.astro` (lines 38-179)

### Global Tracking Functions
```javascript
window.trackAddToCart(item)
window.trackBeginCheckout(items, total)
window.trackPurchase(transactionId, items, total)
window.trackViewItem(item)
window.trackViewCart(items, total)
window.trackRemoveFromCart(item)
window.trackAddPaymentInfo(items, total, paymentType)
window.trackDonationEvent(eventName, params)
```

### 30 Days of Ramadan Page
Has its own checkout tracking in `src/pages/30-days-of-ramadan.astro`

---

## Environment Variables Summary

### Required (.env)
```env
# Supabase
PUBLIC_SUPABASE_URL=https://epsjdbnxhmeprjrgcbyw.supabase.co
PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
DATABASE_URL=postgresql://postgres:...@db.epsjdbnxhmeprjrgcbyw.supabase.co:5432/postgres

# Stripe
PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# GoHighLevel
GHL_API_KEY=pit-...
GHL_LOCATION_ID=W0zaxipAVHwutqUazGwL

# Google Places (address autocomplete)
PUBLIC_GOOGLE_PLACES_API_KEY=AIzaSy...

# Resend (donor emails)
RESEND_API_KEY=re_...
ADMIN_EMAIL=qurbanifoundation@gmail.com

# Cloudflare (deployments)
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=b6195a0024d2e1a0ce36df147349ddd5
```

### Cloudflare Pages Environment Variables
Must add these in Cloudflare Pages Dashboard → Settings → Environment Variables:
- `RESEND_API_KEY`
- `ADMIN_EMAIL`

---

## Timezone Configuration

### Server Timezone
All server timestamps use **UTC** (`new Date().toISOString()`)

### Display Timezone
Emails and notifications display **Eastern Time** (America/New_York):
```javascript
new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
```

### Admin Dashboard
Timestamps should be converted to Eastern when displaying to admin

---

## Quick Reference - Key Files

| Purpose | File |
|---------|------|
| Stripe Webhook Handler | `src/pages/api/webhooks/stripe.ts` |
| Admin Notifications | `src/lib/notifications.ts` |
| Donor Emails | `src/lib/donor-emails.ts` |
| GHL Integration | `src/lib/ghl.ts`, `src/lib/ghl-advanced.ts` |
| Payment Creation | `src/pages/api/payments/create-intent.ts` |
| Donation Cart | `src/components/DonationCart.astro` |
| Layout (GA4 tracking) | `src/layouts/Layout.astro` |
| Site Settings | `src/lib/settings.ts` |

---

## Pending Setup Tasks

### 1. Resend Domain Verification
- [ ] Add `qurbani.com` domain in Resend
- [ ] Add DNS records to Cloudflare
- [ ] Verify domain

### 2. Supabase Migration
Run in SQL Editor:
```sql
-- Create dispute and notification tables
-- See: supabase/migrations/20260224_disputes_notifications.sql
```

### 3. Cloudflare Environment Variables
- [ ] Add `RESEND_API_KEY` to Cloudflare Pages
- [ ] Add `ADMIN_EMAIL` to Cloudflare Pages

---

## Ramadan Amanah Template (Feb 2026)

### Overview
Multi-step wizard Ramadan donation page with mobile-first design, 4-step micro-commitment flow.

### Files
| File | Purpose |
|------|---------|
| `src/templates/ramadan/AmanahTemplate.astro` | Main template component |
| `src/pages/ramadan-amanah.astro` | Page route |
| `public/images/ramadan/bg-full.png` | Full-page background image |

### URL
`/ramadan-amanah`

### Design Reference Point (Checkpoint Feb 24, 2026)

#### Background Configuration
```css
body {
  background-image: url('/images/ramadan/bg-full.png');
  background-size: 100% auto;
  background-position: center -300px;  /* Adjusted so light clouds appear at Step 1 */
  background-repeat: no-repeat;
  background-color: #e8e4e0;
  background-attachment: scroll;
}
```

#### Color Scheme
| Element | Color |
|---------|-------|
| Hero title/subtitle text | `#F7DEC3` |
| Stats box text | `#F7DEC3` |
| CTA button background | `#16434B` |
| CTA button border | `#002329` |
| Stats box background | `rgba(150, 140, 160, 0.15)` (transparent) |

#### Typography
| Element | Font | Style |
|---------|------|-------|
| Hero title | Playfair Display | Normal (non-italic), 48px, 400 weight |
| Stats values | Signika | 26px, 600 weight |
| Step headings | Signika | 28px, 700 weight |

#### Stats Box (Transparent Glass Effect)
```css
.hero-stats {
  display: inline-flex;
  background: rgba(150, 140, 160, 0.15);
  border-radius: 8px;
  padding: 14px 0;
  margin-bottom: 32px;
  border: none;  /* No border */
  /* No backdrop-filter blur - allows background to show through */
}
```

#### CTA Button
```css
.hero-cta {
  display: inline-block;
  background: #16434B;
  color: white;
  padding: 16px 40px;
  border-radius: 8px;
  font-size: 17px;
  font-weight: 600;
  border: 2px solid #002329;
  box-shadow: 0 4px 12px rgba(13, 46, 51, 0.5);
}
```

### 4-Step Flow
1. **Hero + Date Selection**: Confirm Ramadan start date
2. **Choose Schedule**: All nights / Last 10 / Last 5 odd
3. **Choose Amount**: $5/$10/$25/$50 per night
4. **Review & Confirm**: Summary + checkout

### Background Image Notes
- Single full-page image (`bg-full.png`)
- Dark sky/mosque at top, light clouds at bottom
- Position: `-300px` shifts image up so light clouds appear at Step 1 section
- If user wants to adjust: increase negative value to move background up, decrease to move down

---

## Mega Menu Template System (Feb 2026)

### Overview
Fully dynamic mega menu system with database-driven widgets and a template system for quick setup.

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    MEGA MENU SYSTEM                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Database Tables                                             │
│  ┌──────────────┐    ┌─────────────────┐                    │
│  │ mega_menus   │───▶│ menu_widgets    │                    │
│  │ (menu defs)  │    │ (left/center/   │                    │
│  └──────────────┘    │  right columns) │                    │
│                      └─────────────────┘                    │
│         │                    │                              │
│         ▼                    ▼                              │
│  ┌──────────────┐    ┌─────────────────┐                    │
│  │ Navbar.astro │───▶│ DynamicMegaMenu │                    │
│  │ (renders     │    │ (widget         │                    │
│  │  menus)      │    │  renderer)      │                    │
│  └──────────────┘    └─────────────────┘                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Database Tables

#### `mega_menus` - Menu Definitions
```sql
mega_menus (
  id VARCHAR PRIMARY KEY,      -- 'our-work', 'zakat', 'appeals', 'about'
  name VARCHAR,                -- Display name
  sort_order INT,              -- Order in navbar (1, 2, 3, 4)
  is_active BOOLEAN,           -- Show/hide menu
  color VARCHAR,               -- Accent color (hex)
  icon VARCHAR,                -- Icon identifier
  created_at, updated_at
)
```

#### `menu_widgets` - Widget Configurations
```sql
menu_widgets (
  id UUID PRIMARY KEY,
  menu_id VARCHAR REFERENCES mega_menus(id),
  position VARCHAR,            -- 'left', 'center', 'right'
  widget_type VARCHAR,         -- See widget types below
  title VARCHAR,               -- Optional widget title
  config JSONB,                -- Widget-specific configuration
  sort_order INT,
  is_active BOOLEAN,
  created_at, updated_at
)
```

### Widget Types

| Type | Description | Config Options |
|------|-------------|----------------|
| `link-list` | List of navigation links with icons | `links[]`, `hoverColor` |
| `category-tabs` | Category buttons (Our Work style) | `categories[]`, `viewAllLink` |
| `campaign-grid` | Grid of campaign cards | `limit`, `viewAllText`, `viewAllHref` |
| `promo-card` | Featured promotion with image | `href`, `badge`, `heading`, `price`, `buttonText`, colors |
| `promo-box` | Dark card with price tiers | `bgColor`, `heading`, `priceTiers[]`, `button` |
| `info-box` | Stats grid with button | `stats[]`, `button`, or `heading`, `description` |
| `quick-form` | Quick donation amount buttons | `amounts[]`, `buttonText`, `buttonLink` |
| `newsletter` | Email signup with social links | `heading`, `placeholder`, `socialLinks[]` |

### Key Files

| File | Purpose |
|------|---------|
| `src/components/Navbar.astro` | Main navbar with mega menu triggers |
| `src/components/DynamicMegaMenu.astro` | Renders widgets based on database config |
| `src/components/MegaMenuWidget.astro` | Individual widget renderer |
| `src/lib/menus.ts` | Menu data fetching with caching |
| `src/pages/api/mega-menus.ts` | CRUD API for menus (supports ID changes) |
| `src/pages/api/menu-widgets.ts` | CRUD API for widgets |
| `src/pages/api/seed-menu-widgets.ts` | Template seeding API |
| `src/pages/admin/menus.astro` | Admin: Menu list with drag-drop reorder |
| `src/pages/admin/menu-builder.astro` | Admin: Widget configuration UI |

### Template System

#### Available Templates
| Template ID | Description | Color |
|-------------|-------------|-------|
| `our-work` | Category Tabs + Campaign Grid + Promo Card | `#D97718` (orange) |
| `zakat` | Link List + Info Box + Quick Form | `#0096D6` (blue) |
| `about` | Link List + Stats Grid + Newsletter | `#D97718` (orange) |
| `ramadan` | Link List + Promo Box + Feature Card | `#024139` (dark teal) |
| `appeals` | Alias for ramadan template | `#024139` |

#### Applying a Template

**Via Admin UI:**
1. Go to `/admin/menu-builder`
2. Select a menu tab
3. Click "Apply Template" dropdown
4. Choose a template

**Via API:**
```bash
# Apply template to a menu
POST /api/seed-menu-widgets?menu=your-menu-id&template=ramadan

# Seed all default menus
POST /api/seed-menu-widgets?menu=all
```

### Creating a New Template

1. **Define widgets** in `src/pages/api/seed-menu-widgets.ts`:
```typescript
const automateWidgets = [
  {
    menu_id: 'automate',
    position: 'left',
    widget_type: 'link-list',
    title: null,
    config: {
      links: [
        { label: '30 Days of Ramadan', href: '/30-days-of-ramadan', icon: 'star', color: '#024139' },
        { label: 'Jummah Giving', href: '/jummah', icon: 'moon', color: '#7c3aed' },
        // ... more links
      ]
    },
    sort_order: 0,
    is_active: true
  },
  {
    menu_id: 'automate',
    position: 'center',
    widget_type: 'promo-box',
    title: 'Automate Your Impact',
    config: {
      bgColor: '#7c3aed',
      heading: 'Set It & Forget It',
      description: 'Schedule your giving and never miss a chance to earn rewards.',
      priceTiers: [
        { price: '$1', label: 'Per day', href: '/30-days-of-ramadan' },
        { price: '$5', label: 'Per Jummah', href: '/jummah' },
      ],
      button: { label: 'Start Automating', href: '/automate', color: '#7c3aed' }
    },
    sort_order: 0,
    is_active: true
  },
  {
    menu_id: 'automate',
    position: 'right',
    widget_type: 'promo-card',
    // ... config
  }
];
```

2. **Register the template**:
```typescript
// In templateColors
const templateColors: Record<string, string> = {
  'our-work': '#D97718',
  'zakat': '#0096D6',
  'about': '#D97718',
  'ramadan': '#024139',
  'appeals': '#024139',
  'automate': '#7c3aed',  // Add new template color
};

// In templates
const templates: Record<string, typeof aboutWidgets> = {
  'our-work': ourWorkWidgets,
  'zakat': zakatWidgets,
  'about': aboutWidgets,
  'ramadan': ramadanWidgets,
  'appeals': ramadanWidgets,
  'automate': automateWidgets,  // Add new template
};
```

3. **Add to legacy seeding** (optional):
```typescript
if (menuParam === 'automate' || menuParam === 'all') {
  await applyTemplate('automate', 'automate');
}
```

### Changing Menu IDs

The API supports changing menu IDs (e.g., 'ramadan' → 'appeals'):

```bash
PUT /api/mega-menus
Content-Type: application/json

{
  "id": "old-menu-id",
  "newId": "new-menu-id"
}
```

This automatically updates:
- The menu record
- All widgets linked to that menu (`menu_widgets.menu_id`)
- All categories assigned to that menu (`categories.menu`)

### Admin UI Features

#### Menu Overview (`/admin/menus`)
- Drag & drop reorder menus
- Click color picker to change accent color
- Click name to edit inline
- Click pencil icon next to ID to change menu ID
- Toggle active/inactive status
- Delete menus (with confirmation)

#### Menu Builder (`/admin/menu-builder`)
- Tab-based interface for each menu
- 3-column layout (left/center/right)
- Add/edit/delete widgets
- Apply templates via dropdown
- Preview mega menu appearance

### Hardcoded Menu IDs

The 4 main menus have hardcoded fallback HTML in `Navbar.astro`:
- `our-work` - Category tabs with campaign grid
- `zakat` - Zakat resources and calculator
- `appeals` - Ramadan-style giving options (formerly 'ramadan')
- `about` - Organization info and newsletter

Extra menus created in the database are rendered dynamically.

### Caching

Menu data uses in-memory caching in `src/lib/menus.ts`:
- Cache TTL: 1 year (effectively permanent)
- Cleared manually via `clearNavbarCache()`
- APIs call `clearNavbarCache()` after mutations

To force refresh:
```typescript
import { clearNavbarCache } from '../lib/menus';
clearNavbarCache();
```

### Mobile Menu

The mobile menu (hamburger) shows an accordion-style layout:
- Light cream background (`#f8f6f2`) matching desktop mega menus
- Expandable sections for each menu
- Featured campaigns with images in Our Work section
- Quick donate section with preset amounts ($25, $50, $100, $250)
- Smooth animations for accordion open/close

### Icon Reference

Available icons for widgets (defined in `src/lib/categories.ts`):
```
heart, emergency, water, orphan, education, food, healthcare,
sadaqah, qurbani, user, document, image, email, money, calculator,
question, book, gold, shopping-bag, moon, star, x-circle
```
