# GoHighLevel Integration Documentation

**Last Updated:** February 22, 2026
**Status:** Complete and Production-Ready

---

## Overview

This document describes the complete GoHighLevel (GHL) integration for the Qurbani Foundation USA website. The integration enables two-way sync between the website and GHL CRM for lead capture, donation tracking, and contact management.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           WEBSITE (Astro)                               │
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
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE (Database)                             │
│                                                                         │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────┐           │
│  │   leads     │   │ ghl_tokens  │   │  ghl_webhook_logs   │           │
│  │  (table)    │   │   (table)   │   │      (table)        │           │
│  └──────┬──────┘   └─────────────┘   └──────────┬──────────┘           │
└─────────┼───────────────────────────────────────┼───────────────────────┘
          │                                       ▲
          ▼                                       │
┌─────────────────────────────────────────────────┼───────────────────────┐
│                      GoHighLevel CRM            │                       │
│                                                 │                       │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────┴─────┐                 │
│  │  Contacts   │   │Opportunities│   │   Webhooks    │                 │
│  │   (API)     │   │    (API)    │   │ (outbound)    │                 │
│  └─────────────┘   └─────────────┘   └───────────────┘                 │
└─────────────────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables (`.env`)

```env
# GoHighLevel Configuration
GHL_API_KEY=pit-4211b952-451c-455b-a568-050c48b5b5a8
GHL_LOCATION_ID=W0zaxipAVHwutqUazGwL
```

**IMPORTANT:** Never hardcode API keys. The GHL library reads from `import.meta.env`.

---

## Database Schema

### Migration File
`supabase/migrations/20260222_ghl_integration.sql`

### Tables Created

#### 1. `leads` Table
Stores all form submissions from the website.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| email | VARCHAR(255) | Contact email (required) |
| first_name | VARCHAR(100) | First name |
| last_name | VARCHAR(100) | Last name |
| phone | VARCHAR(50) | Phone number |
| source | VARCHAR(50) | Source: 'contact_form', 'newsletter', 'donation', 'zakat_calculator' |
| subject | VARCHAR(100) | Form subject (contact form) |
| message | TEXT | Form message |
| form_data | JSONB | Additional form fields |
| page_url | VARCHAR(500) | Page where form was submitted |
| utm_source | VARCHAR(100) | UTM tracking |
| utm_medium | VARCHAR(100) | UTM tracking |
| utm_campaign | VARCHAR(100) | UTM tracking |
| ghl_contact_id | VARCHAR(100) | GHL contact ID after sync |
| ghl_synced_at | TIMESTAMPTZ | When synced to GHL |
| ghl_sync_error | TEXT | Error message if sync failed |
| status | VARCHAR(50) | Lead status: 'new', 'contacted', 'qualified', 'converted', 'closed' |
| created_at | TIMESTAMPTZ | Record creation time |
| updated_at | TIMESTAMPTZ | Last update time |

#### 2. `ghl_tokens` Table
Secure storage for GHL OAuth tokens (for future OAuth implementation).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| location_id | VARCHAR(100) | GHL location ID (unique) |
| access_token | TEXT | OAuth access token |
| refresh_token | TEXT | OAuth refresh token |
| token_type | VARCHAR(50) | Token type (default: 'Bearer') |
| expires_at | TIMESTAMPTZ | Token expiration |
| scopes | TEXT[] | Authorized scopes |

#### 3. `ghl_webhook_logs` Table
Audit trail for incoming GHL webhooks.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| event_type | VARCHAR(100) | Webhook event type |
| contact_id | VARCHAR(100) | GHL contact ID |
| payload | JSONB | Full webhook payload |
| processed | BOOLEAN | Whether successfully processed |
| processed_at | TIMESTAMPTZ | Processing timestamp |
| error | TEXT | Error message if failed |
| created_at | TIMESTAMPTZ | When received |

---

## Files Structure

```
src/
├── lib/
│   ├── ghl.ts              # Main GHL library (consolidated)
│   └── gohighlevel.ts      # Re-exports from ghl.ts (backwards compatibility)
│
├── pages/
│   ├── api/
│   │   ├── contact.ts           # Contact form endpoint
│   │   ├── newsletter.ts        # Newsletter signup endpoint
│   │   ├── payments/
│   │   │   └── sync-ghl.ts      # Manual GHL sync for payments
│   │   └── webhooks/
│   │       ├── ghl.ts           # GHL webhook listener
│   │       └── stripe.ts        # Stripe webhook (includes GHL sync)
│   └── contact.astro            # Contact page with form
│
└── components/
    └── Footer.astro             # Newsletter form in footer
```

---

## API Endpoints

### POST `/api/contact`
Handles contact form submissions.

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "subject": "donation",
  "message": "I want to donate...",
  "newsletter": true,
  "pageUrl": "https://qurbani.com/contact"
}
```

**Response:**
```json
{
  "success": true,
  "leadId": "uuid",
  "ghlSynced": true,
  "message": "Thank you for contacting us!"
}
```

**Flow:**
1. Validate required fields
2. Insert into `leads` table
3. Sync to GHL via `syncContactFormToGHL()`
4. Update lead with `ghl_contact_id`

---

### POST `/api/newsletter`
Handles newsletter signups.

**Request Body:**
```json
{
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "pageUrl": "https://qurbani.com/"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully subscribed to our newsletter!"
}
```

---

### POST `/api/webhooks/ghl`
Receives webhooks from GoHighLevel.

**Handled Events:**
- `ContactCreate` - New contact created in GHL
- `ContactUpdate` - Contact updated in GHL
- `ContactTagUpdate` - Tags added/removed
- `ContactDelete` - Contact deleted
- `OpportunityCreate` - New opportunity created
- `OpportunityUpdate` - Opportunity updated
- `OpportunityStatusUpdate` - Opportunity status changed

**Status Mapping (Tags → Lead Status):**
| GHL Tag | Lead Status |
|---------|-------------|
| client, donor, converted | converted |
| qualified, hot-lead | qualified |
| contacted, follow-up | contacted |
| closed, unsubscribed | closed |

---

### POST `/api/payments/sync-ghl`
Manual sync of donation to GHL.

**Request Body:**
```json
{
  "donorEmail": "john@example.com",
  "donorName": "John Doe",
  "donorPhone": "+1234567890",
  "amount": 100.00,
  "campaignName": "Emergency Relief",
  "donationType": "single",
  "items": [{"name": "Food Pack", "amount": 50}],
  "pipelineId": "optional",
  "stageId": "optional"
}
```

---

## GHL Library Functions

### `src/lib/ghl.ts`

#### Core Functions

```typescript
// Find contact by email
findContactByEmail(email: string): Promise<GHLContactResponse | null>

// Create or update contact
upsertContact(contact: GHLContact): Promise<{success, contactId, isNew, error}>

// Add tags to contact
addTagsToContact(contactId: string, tags: string[]): Promise<{success, error}>

// Remove tags from contact
removeTagsFromContact(contactId: string, tags: string[]): Promise<{success, error}>

// Add note to contact
addNoteToContact(contactId: string, body: string): Promise<{success, error}>

// Update contact status
updateContactStatus(contactId: string, status: string): Promise<{success, error}>

// Create opportunity (for donations)
createOpportunity(opportunity: {...}): Promise<{success, opportunityId, error}>
```

#### High-Level Sync Functions

```typescript
// Sync contact form submission
syncContactFormToGHL(data: {
  email, firstName, lastName, phone?, subject?, message?, newsletter?
}): Promise<{success, contactId, error}>

// Sync newsletter signup
syncNewsletterSignupToGHL(data: {
  email, firstName?, lastName?
}): Promise<{success, contactId, error}>

// Sync donation
syncDonationToGHL(data: {
  donorEmail, donorName, donorPhone?, amount, campaignName?,
  donationType, items?, pipelineId?, stageId?
}): Promise<{success, contactId, error}>

// Sync Zakat calculation
syncZakatCalculationToGHL(data: {
  email, firstName?, lastName?, zakatAmount
}): Promise<{success, contactId, error}>
```

---

## GHL Webhook Setup

To enable two-way sync, configure webhooks in GoHighLevel:

1. Go to **Settings → Webhooks** in GHL
2. Add new webhook:
   - **URL:** `https://qurbani.com/api/webhooks/ghl`
   - **Method:** POST
3. Select events:
   - Contact Created
   - Contact Updated
   - Contact Tag Update
   - Contact Deleted
   - Opportunity Created
   - Opportunity Status Update

---

## Tagging Strategy

### Automatic Tags Applied

| Source | Tags |
|--------|------|
| Contact Form | `website`, `contact-form`, `inquiry-{subject}` |
| Newsletter | `website`, `newsletter` |
| Donation | `donor`, `website`, `{campaign-slug}` |
| Monthly Donor | `monthly-donor` |
| Major Donor ($1000+) | `major-donor` |
| Zakat Calculator | `website`, `zakat-calculator` |

---

## Testing

### Test Contact Form
```bash
curl -X POST http://localhost:4321/api/contact \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "subject": "donation",
    "message": "Test message"
  }'
```

### Test Newsletter
```bash
curl -X POST http://localhost:4321/api/newsletter \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### Verify in Supabase
```sql
SELECT * FROM leads ORDER BY created_at DESC LIMIT 10;
SELECT * FROM ghl_webhook_logs ORDER BY created_at DESC LIMIT 10;
```

---

## Troubleshooting

### GHL Sync Failures
1. Check `leads.ghl_sync_error` for error messages
2. Verify `GHL_API_KEY` and `GHL_LOCATION_ID` in `.env`
3. Check GHL API status at https://status.gohighlevel.com

### Webhook Not Updating Leads
1. Check `ghl_webhook_logs` table for incoming webhooks
2. Verify webhook URL is publicly accessible
3. Check `processed` and `error` columns in webhook logs

### Missing Contacts in GHL
1. Lead may have been created before GHL sync was added
2. Run manual sync: `POST /api/payments/sync-ghl`

---

## Security Notes

1. **API Keys:** Never hardcode. Always use environment variables.
2. **Webhook Verification:** Currently validates location ID. Consider adding signature verification.
3. **RLS Policies:** `leads` table allows anonymous inserts but restricts reads to service role.
4. **OAuth Tokens:** `ghl_tokens` table is service-role only access.

---

## Future Improvements

1. **OAuth Implementation:** Replace API key with OAuth flow for better security
2. **Webhook Signature Verification:** Add HMAC signature validation
3. **Retry Queue:** Add retry mechanism for failed GHL syncs
4. **Bulk Sync:** Add admin endpoint to bulk sync historical leads
5. **Pipeline Integration:** Configure donation pipelines and stages in GHL

---

## Changelog

### 2026-02-22
- Initial GHL integration implementation
- Created `leads`, `ghl_tokens`, `ghl_webhook_logs` tables
- Consolidated GHL library (`src/lib/ghl.ts`)
- Added contact form API with GHL sync
- Added newsletter API with GHL sync
- Added GHL webhook listener
- Connected Footer newsletter form
- Updated Stripe webhook to use new GHL library
