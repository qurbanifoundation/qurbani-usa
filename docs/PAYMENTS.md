# Stripe Payments & Recurring Donations

## Overview
Full payment system using Stripe for one-time and recurring (Monthly/Weekly Jummah) donations.

## Key Files

| File | Purpose |
|------|---------|
| `src/components/DonationCart.astro` | Sidecart with recurring options (Monthly/Jummah checkboxes) |
| `src/pages/api/payments/create-intent.ts` | Creates PaymentIntents (one-time) or Subscriptions (recurring) |
| `src/pages/api/webhooks/stripe.ts` | Handles all Stripe events including subscription lifecycle |
| `src/pages/api/subscriptions/manage.ts` | Pause/resume/skip/cancel subscription API |
| `src/pages/manage-subscription/[token].astro` | Donor-facing subscription management portal |
| `src/pages/admin/subscriptions.astro` | Admin dashboard for viewing all subscriptions |

## Database Tables

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

## Stripe Subscription Flow

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

## SQL Migration
Run `sql/weekly-subscriptions.sql` to add weekly subscription support:
- Adds `interval` column to `donation_subscriptions`
- Updates `donations.donation_type` constraint to allow 'weekly'
- Adds `management_token` for subscription management links

## Stripe Webhook Configuration

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

## Dispute/Chargeback Handling

### Database Tables
```sql
donation_disputes (
  id, stripe_dispute_id, stripe_charge_id, donation_id,
  amount, currency, reason, status, donor_email, donor_name,
  won, created_at, closed_at, metadata
)

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

## DonationCart / Sidecart Features

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
