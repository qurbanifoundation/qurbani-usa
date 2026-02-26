# Notification System

## Architecture
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

## Admin Notifications (via GHL)
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

## Donor Emails (via Resend → logged to GHL)
**File:** `src/lib/donor-emails.ts`

| Email Type | When Sent | Template |
|------------|-----------|----------|
| Donation Receipt | After successful payment | Beautiful HTML with tax info |
| Subscription Confirmation | New recurring setup | Welcome + next billing date |
| Payment Failed | Card declined | Alert + how to fix |
| Subscription Cancelled | After cancellation | Confirmation + win-back CTA |
| Refund Confirmation | After refund | Professional notice |

## Email → GHL Conversations Logging
Every email sent via Resend is also logged to GHL Conversations tab:
- Creates outbound email message on contact
- Shows full subject line and complete email body
- Visible in Conversations tab (not just Notes)

## Key Functions
```typescript
// Admin notifications
import { notifyDonationReceived, notifySubscriptionStarted, ... } from '../lib/notifications';

// Donor emails
import { sendDonationReceipt, sendSubscriptionConfirmation, ... } from '../lib/donor-emails';
```

## Resend Email Configuration

### Sender Address
```
Qurbani Foundation <donations@receipts.qurbani.com>
```

### Domain Setup (COMPLETED)
- Subdomain: `receipts.qurbani.com`
- Verified in Resend
- DNS records configured in Cloudflare
