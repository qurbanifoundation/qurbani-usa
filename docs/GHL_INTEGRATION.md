# GoHighLevel Integration Documentation

**Last Updated:** February 26, 2026
**Status:** Complete and Production-Ready

---

## Overview

This document describes the complete GoHighLevel (GHL) integration for the Qurbani Foundation USA website. The integration enables two-way sync between the website and GHL CRM for lead capture, donation tracking, donor lifecycle management, and pipeline opportunities.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           WEBSITE (Astro SSR on Cloudflare Pages)       │
│                                                                         │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐ │
│  │Contact Form │   │ Newsletter  │   │  Donation   │   │   Zakat     │ │
│  │  /contact   │   │   Footer    │   │  Checkout   │   │ Calculator  │ │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘ │
│         │                 │                 │                 │         │
│         ▼                 ▼                 ▼                 ▼         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    API Endpoints                                 │   │
│  │  POST /api/contact    POST /api/newsletter    Stripe Webhook    │   │
│  └──────────────────────────────┬──────────────────────────────────┘   │
└─────────────────────────────────┼───────────────────────────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼                           ▼
┌────────────────────────────┐   ┌──────────────────────────────────────┐
│     SUPABASE (Database)    │   │          GoHighLevel CRM             │
│                            │   │                                      │
│  leads, ghl_tokens,       │   │  Contacts (upsert w/ custom fields)  │
│  ghl_webhook_logs,        │   │  Notes (donation details)            │
│  donations,               │   │  Opportunities (pipeline tracking)   │
│  donation_subscriptions   │   │  Tags (segmentation)                 │
└────────────────────────────┘   └──────────────────────────────────────┘
```

## Configuration

### Environment Variables

```env
GHL_API_KEY=pit-xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
GHL_LOCATION_ID=W0zaxipAVHwutqUazGwL
```

**IMPORTANT:** These are accessed via `import.meta.env` and get **inlined at build time** by Astro's Cloudflare adapter. They must be available in `.env` during `npm run build`. They are also set as Cloudflare Pages env vars and GitHub Actions secrets for CI/CD builds.

---

## Files Structure

```
src/
├── lib/
│   ├── ghl.ts              # Basic GHL library (contact form, newsletter sync)
│   ├── ghl-advanced.ts     # Advanced GHL library (donation tracking, pipelines)
│   ├── gohighlevel.ts      # Re-exports from ghl.ts (backwards compatibility)
│   ├── donor-emails.ts     # Donor emails via Resend + GHL Conversations logging
│   └── notifications.ts    # Admin notifications via GHL notes
│
├── pages/
│   ├── api/
│   │   ├── contact.ts           # Contact form → leads table + GHL
│   │   ├── newsletter.ts        # Newsletter signup → leads table + GHL
│   │   ├── payments/
│   │   │   └── sync-ghl.ts      # Manual GHL sync for payments
│   │   └── webhooks/
│   │       ├── ghl.ts           # GHL webhook listener (inbound)
│   │       └── stripe.ts        # Stripe webhook → donation tracking + GHL sync
│   └── contact.astro            # Contact page with form
│
└── components/
    └── Footer.astro             # Newsletter form in footer
```

---

## Donation Tracking Flow (Primary Integration)

When a donation is completed, the Stripe webhook (`/api/webhooks/stripe`) triggers the full GHL sync:

```
Stripe payment_intent.succeeded
  → Webhook handler (constructEventAsync for Cloudflare Workers)
    → Update donation status to 'completed'
    → trackDonation() in ghl-advanced.ts
      → Find or create GHL contact
      → Set name, email, phone, billing address
      → Set 20+ custom fields (lifetime giving, donor tier, etc.)
      → Apply tags (donor, recurring-donor, major-donor, etc.)
      → Add detailed donation note
      → Create pipeline opportunity (if Donations pipeline exists)
    → notifyDonationReceived() (admin notification)
    → sendDonationReceipt() (donor email via Resend)
```

### Data Passed to GHL Contact

| Field | Source | Example |
|-------|--------|---------|
| firstName | `donation.donor_name` (split) | "Amal" |
| lastName | `donation.donor_name` (split) | "Khan" |
| email | `donation.donor_email` | "donor@example.com" |
| phone | `donation.donor_phone` | "+16475787800" |
| address1 | `donation.metadata.billing_address.line1` | "30 North Gould Street" |
| city | `donation.metadata.billing_address.city` | "Sheridan" |
| state | `donation.metadata.billing_address.state` | "WY" |
| postalCode | `donation.metadata.billing_address.postal_code` | "82801" |
| country | `donation.metadata.billing_address.country` | "US" |
| source | Hardcoded | "Donation" |

### Custom Fields Set on Every Donation

| Custom Field Key | Description | Example Value |
|-----------------|-------------|---------------|
| `total_lifetime_giving` | Cumulative total across all donations | "2500" |
| `last_donation_amount` | Most recent donation amount | "100" |
| `last_donation_date` | Date of most recent donation | "2026-02-26" |
| `first_donation_date` | Date of very first donation | "2025-11-15" |
| `donation_count` | Total number of donations | "8" |
| `donor_tier` | Calculated tier based on lifetime giving | "regular" |
| `donation_type` | Type of last donation | "single" / "monthly" / "weekly" |
| `campaigns_donated` | Comma-separated campaign slugs | "zakat, emergency-relief" |
| `favorite_cause` | Most recently donated campaign | "zakat" |
| `lead_stage` | Donor lifecycle stage | "donor" / "advocate" |
| `cart_abandoned` | Reset to "no" after purchase | "no" |
| `engagement_score` | Calculated score (50 + count*10, max 100) | "80" |
| `is_recurring_donor` | Whether donor has active recurring | "yes" / "no" |
| `is_monthly_donor` | Monthly subscription active | "yes" / "no" |
| `is_weekly_donor` | Weekly (Jummah) subscription active | "yes" / "no" |
| `recurring_type` | Type of recurring donation | "monthly" / "weekly" / "none" |
| `monthly_donation_amount` | Monthly recurring amount | "50" |
| `monthly_start_date` | When monthly started | "2026-01-15" |
| `is_jummah_donor` | Weekly Jummah donor flag | "yes" |
| `jummah_donation_amount` | Jummah weekly amount | "10" |
| `jummah_start_date` | When Jummah started | "2026-02-01" |
| `zakat_paid` | Zakat amount paid (if Zakat donation) | "500" |
| `zakat_remaining` | Remaining Zakat obligation | "200" |
| `calculated_zakat` | From Zakat calculator | "700" |

### Donor Tier Calculation

| Lifetime Giving | Tier |
|-----------------|------|
| < $1,000 | `donor` |
| $1,000 - $4,999 | `regular` |
| $5,000 - $9,999 | `major` |
| $10,000+ | `vip` |

---

## Tags Strategy

### Automatic Tags Applied

| Source | Tags |
|--------|------|
| Contact Form | `website`, `contact-form`, `inquiry-{subject}` |
| Newsletter | `website`, `newsletter` |
| Any Donation | `donor`, `website`, `donor-{year}` |
| Repeat Donor | `repeat-donor` |
| Monthly Donor | `recurring-donor`, `monthly-donor` |
| Weekly/Jummah Donor | `recurring-donor`, `weekly-donor`, `jummah-donor` |
| $1,000+ Lifetime | `major-donor` |
| $5,000+ Lifetime | `vip-donor` |
| Zakat Calculator | `website`, `zakat-calculator`, `qualified-lead` |
| $1,000+ Zakat | `high-value-prospect` |
| Cart Abandoned | `website`, `cart-abandoned`, `hot-lead` |

---

## Pipeline & Opportunities

### Setup Required

The code automatically creates a pipeline opportunity for each donation **if a "Donations" pipeline exists** in GHL. The current API key does not have `opportunities.write` scope for pipeline creation.

**To set up:**
1. Go to GHL Dashboard → Opportunities → Pipelines
2. Create a pipeline named **"Donations"**
3. Add stages: `New Donation` → `Payment Received` → `Receipt Sent` → `Fulfilled` → `Follow Up`

Once the pipeline exists, the code will:
- Auto-detect the "Donations" pipeline (by name, case-insensitive)
- Create an opportunity for each donation with monetary value
- Place it in the first stage ("New Donation")
- Name format: `$100 - Zakat, Emergency Relief (One-time)`

### Pipeline Opportunity Data

| Field | Value |
|-------|-------|
| name | `$amount - item names (donation type)` |
| monetaryValue | Donation amount |
| contactId | GHL contact ID |
| status | "open" |
| source | "Website Donation" |
| pipelineStageId | First stage of Donations pipeline |

---

## Advanced Tracking Functions

### `src/lib/ghl-advanced.ts`

```typescript
// Track completed donation (called from Stripe webhook)
trackDonation(data: {
  email: string;
  name: string;
  phone?: string | null;
  amount: number;
  campaignSlug: string;
  campaignName: string;
  donationType: 'single' | 'monthly' | 'weekly';
  items?: Array<{ name: string; amount: number }>;
  address?: { line1?, city?, state?, postal_code?, country? } | null;
}): Promise<{ success, contactId, lifetimeGiving, donationCount, donorTier }>

// Track campaign page view (pre-sale lead capture)
trackCampaignView(data: {
  email?: string;
  campaignSlug: string;
  campaignName: string;
}): Promise<{ success, contactId }>

// Track cart abandonment
trackCartAbandonment(data: {
  email: string;
  cartItems: Array<{ name, amount, campaignSlug }>;
  cartTotal: number;
}): Promise<{ success, contactId }>

// Track Zakat calculation (high-intent lead)
trackZakatCalculation(data: {
  email: string;
  firstName?: string;
  lastName?: string;
  zakatAmount: number;
  totalAssets: number;
  wantsReminder?: boolean;
  phone?: string;
}): Promise<{ success, contactId, leadScore }>

// Find contact by email
findContactByEmail(email: string): Promise<GHLContact | null>
```

### Contact Notes

Every donation adds a detailed note to the GHL contact:

```
💰 DONATION RECEIVED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Amount: $100
Type: One-time
Campaign: General Donation

Items:
  • Zakat: $50
  • Emergency Relief: $50

📊 DONOR STATS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Lifetime Giving: $2,500
Total Donations: 8
Tier: REGULAR
Campaigns Supported: 3
```

---

## Basic GHL Library

### `src/lib/ghl.ts`

Used for contact form and newsletter syncs (simpler flows):

```typescript
// Find contact by email
findContactByEmail(email: string): Promise<GHLContactResponse | null>

// Create or update contact
upsertContact(contact: GHLContact): Promise<{success, contactId, isNew, error}>

// Add/remove tags
addTagsToContact(contactId: string, tags: string[]): Promise<{success, error}>
removeTagsFromContact(contactId: string, tags: string[]): Promise<{success, error}>

// Add note to contact
addNoteToContact(contactId: string, body: string): Promise<{success, error}>

// Sync contact form submission
syncContactFormToGHL(data): Promise<{success, contactId, error}>

// Sync newsletter signup
syncNewsletterSignupToGHL(data): Promise<{success, contactId, error}>

// Sync donation (basic - prefer trackDonation from ghl-advanced.ts)
syncDonationToGHL(data): Promise<{success, contactId, error}>
```

---

## API Endpoints

### POST `/api/contact`
Contact form → `leads` table + GHL contact with tags.

### POST `/api/newsletter`
Newsletter signup → `leads` table + GHL contact with `newsletter` tag.

### POST `/api/webhooks/ghl`
Receives webhooks from GHL for two-way sync.

**Handled Events:** `ContactCreate`, `ContactUpdate`, `ContactTagUpdate`, `ContactDelete`, `OpportunityCreate`, `OpportunityUpdate`, `OpportunityStatusUpdate`

### POST `/api/payments/sync-ghl`
Manual sync endpoint for donations not captured by webhook.

### POST `/api/webhooks/stripe`
Stripe webhook handler. On `payment_intent.succeeded`, calls `trackDonation()` to sync the full donation to GHL with all custom fields, tags, notes, address, and pipeline opportunity.

**Critical:** Uses `constructEventAsync()` (not `constructEvent()`) for Cloudflare Workers compatibility.

---

## Database Tables

### `leads` Table
Stores all form submissions (contact, newsletter).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| email | VARCHAR(255) | Contact email |
| first_name | VARCHAR(100) | First name |
| last_name | VARCHAR(100) | Last name |
| phone | VARCHAR(50) | Phone number |
| source | VARCHAR(50) | `contact_form`, `newsletter`, `donation`, `zakat_calculator` |
| ghl_contact_id | VARCHAR(100) | GHL contact ID after sync |
| ghl_synced_at | TIMESTAMPTZ | When synced to GHL |
| status | VARCHAR(50) | `new`, `contacted`, `qualified`, `converted`, `closed` |

### `ghl_tokens` Table
OAuth token storage (for future OAuth implementation).

### `ghl_webhook_logs` Table
Audit trail for incoming GHL webhooks.

---

## Troubleshooting

### GHL Contact Not Created After Donation
1. Check Cloudflare Pages logs for errors in the Stripe webhook
2. Verify `GHL_API_KEY` is inlined in the build (`grep GHL_API_KEY dist/_worker.js/`)
3. Check `webhook_events` table — if empty, webhooks aren't being verified (see Stripe webhook secret)
4. Run manual sync: `POST /api/payments/sync-ghl`

### Webhook Signature Failures
- Must use `constructEventAsync()` on Cloudflare Workers (Web Crypto API, not Node crypto)
- Webhook secret stored in `site_settings.stripe_webhook_secret` in Supabase
- Secret must match the Stripe webhook endpoint (`we_1T4wTSL8P2b9eLxnC6dnZH3Q`)

### Missing Custom Fields in GHL
- Custom fields are created automatically by GHL when first set via API
- Fields show by ID in the API response; map by key name
- If a field doesn't appear, check the GHL custom fields settings page

### Pipeline Opportunity Not Created
- Requires a pipeline named "Donations" in GHL Dashboard → Opportunities
- Current API key lacks `opportunities.write` scope for pipeline creation via API
- Create the pipeline manually, then opportunities will auto-create

---

## Security Notes

1. **API Keys:** Accessed via `import.meta.env`, inlined at build time. Never hardcode.
2. **Webhook Verification:** Stripe uses `constructEventAsync()` with `whsec_` secret. GHL validates location ID.
3. **RLS Policies:** `leads` table allows anonymous inserts but restricts reads to service role.
4. **Env Vars on Cloudflare:** Must be set both in `.env` (for local/build) and Cloudflare Pages dashboard (for runtime).

---

## Changelog

### 2026-02-26
- Fixed Stripe webhook: `constructEvent()` → `constructEventAsync()` for Cloudflare Workers
- Fixed `items` variable scope bug in webhook handler (was inside try block)
- Added billing address sync to GHL contacts (address1, city, state, postalCode)
- Added pipeline opportunity creation (auto-detects "Donations" pipeline)
- Verified end-to-end: webhook → donation update → GHL contact + notes → donor email

### 2026-02-22
- Initial GHL integration implementation
- Created `leads`, `ghl_tokens`, `ghl_webhook_logs` tables
- Consolidated GHL library (`src/lib/ghl.ts`)
- Added advanced donation tracking (`src/lib/ghl-advanced.ts`)
- Added contact form, newsletter, Zakat calculator sync
- Added GHL webhook listener for two-way sync
- Connected Stripe webhook to GHL donation tracking
