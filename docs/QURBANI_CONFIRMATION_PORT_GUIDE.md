# Qurbani Confirmation Email System — Port Guide

This document is the complete instructions for porting the Qurbani Confirmation Email System from the USA site (`qurbani.com`) to the Canada site (`qurbani.ca` or equivalent). Hand this entire file to an agent and they should be able to complete the port without further questions.

**Source repo:** `qurbani-usa` on the `main` branch (production).
**Target repo:** The Canada Qurbani site.

---

## What this feature does

After each day of Eid al-Adha (10, 11, 12 Dhul Hijjah), admin sends a "Your Qurbani Has Been Performed" confirmation email to every donor whose Qurbani was completed that day. The system:

1. **Lists pending orders** filtered by cutoff date, with checkboxes for batch selection.
2. **Auto-detects the Hijri date** from the admin's Eid start date + cutoff date (no human picks the day).
3. **Sends in batches** (20 per HTTP request, 120ms throttle, server cap 25) via Resend.
4. **Uses atomic claim** in the database to prevent duplicate sends — even if the Cloudflare Worker times out mid-batch, no donor can receive a second email.
5. **Logs every outcome** to `qurbani_send_log` so admin can look up exactly which donor was sent / skipped (already sent) / failed.
6. **Detects typo emails** before sending (gmail.vom, yahoo.con, etc.), flags them with NEEDS FIX badge, lets admin edit inline.
7. **Search bar** for finding specific donors in long pending lists.
8. **Per-row Send/Preview buttons** for one-off retries.

The email template displays only the Hijri date (no Gregorian, no "Day 1/2/3" labels — admin specifically removed these for clarity).

---

## 1. Files to copy verbatim

Copy these files from `qurbani-usa` to the same paths in the Canada repo:

```
src/lib/qurbani-confirmation.ts
src/lib/order-number.ts

emails/qurbani-confirmation.html

src/pages/api/donations/send-qurbani-confirmation.ts
src/pages/api/donations/qurbani-pending.ts
src/pages/api/donations/qurbani-confirmation-preview.ts
src/pages/api/donations/qurbani-confirmation-test.ts
src/pages/api/donations/qurbani-send-log.ts
src/pages/api/donations/fix-donor-email.ts

src/pages/api/settings/fulfillment.ts

src/pages/admin/qurbani-confirmations.astro
```

**Prerequisites that must already exist on the Canada site** (do NOT copy unless missing):
- `src/lib/supabase.ts` — exports `supabaseAdmin` (service role client) and `supabase` (anon client).
- `src/layouts/AdminLayout.astro` — admin frame with auth.
- Admin auth middleware on `/admin/*`.

If any are missing, copy them from `qurbani-usa` as well.

---

## 2. Database migration

Run the following SQL against the Canada Supabase database. The fastest path is via the Supabase SQL Editor, or via a Node script using `pg` + `DATABASE_URL`.

```sql
-- =============================================================
-- A. donations table additions
-- =============================================================
ALTER TABLE donations
  ADD COLUMN IF NOT EXISTS order_number int,
  ADD COLUMN IF NOT EXISTS qurbani_confirmation_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS qurbani_confirmation_hijri_day int,
  ADD COLUMN IF NOT EXISTS qurbani_confirmation_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS qurbani_confirmation_last_error text,
  ADD COLUMN IF NOT EXISTS qurbani_confirmation_attempt_count int DEFAULT 0;

-- =============================================================
-- B. Backfill order_number sequentially by created_at
--    (Skip if Canada site already has order_number populated)
-- =============================================================
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM donations
  WHERE order_number IS NULL
)
UPDATE donations d
SET order_number = n.rn
FROM numbered n
WHERE d.id = n.id;

-- =============================================================
-- C. site_settings additions
-- =============================================================
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS eid_ul_adha_start date,
  ADD COLUMN IF NOT EXISTS eid_ul_adha_end date,
  ADD COLUMN IF NOT EXISTS qurbani_fulfillment_enabled boolean DEFAULT true;

-- Set the Eid dates (verify with admin which date Canada Muslims observed)
UPDATE site_settings
SET eid_ul_adha_start = '2026-05-27',
    eid_ul_adha_end   = '2026-05-30'
WHERE id = 'main';

-- =============================================================
-- D. New send-outcome log table
-- =============================================================
CREATE TABLE IF NOT EXISTS qurbani_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id uuid NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
  order_number int,
  donor_name text,
  donor_email text,
  hijri_day int,
  outcome text NOT NULL,   -- 'sent' | 'already_sent' | 'failed' | 'invalid'
  reason text,
  email_id text,           -- Resend message ID for successful sends
  sent_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS qurbani_send_log_sent_at_idx     ON qurbani_send_log (sent_at DESC);
CREATE INDEX IF NOT EXISTS qurbani_send_log_donation_id_idx ON qurbani_send_log (donation_id);
CREATE INDEX IF NOT EXISTS qurbani_send_log_outcome_idx     ON qurbani_send_log (outcome);
```

**Verification:** After running, confirm the columns exist:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'donations' AND column_name LIKE 'qurbani%';
-- Should return 5 rows.

SELECT column_name FROM information_schema.columns
WHERE table_name = 'qurbani_send_log';
-- Should return all 10 columns.
```

---

## 3. Environment variables

Set these in Cloudflare Pages dashboard for the Canada project (Settings -> Environment variables). They are also needed locally in `.env`.

```env
# Required for the feature
RESEND_API_KEY=<Canada Resend API key>
PUBLIC_SUPABASE_URL=<Canada Supabase project URL>
SUPABASE_SERVICE_ROLE_KEY=<Canada Supabase service role key>
DATABASE_URL=<Canada Postgres connection string for SQL migrations>
```

The `RESEND_API_KEY` can be a "send-only" restricted key — the feature does not need list/read permissions on Resend.

---

## 4. Canada-specific code changes (REQUIRED)

After copying the files, edit these three locations with Canada-specific values:

### 4a. `src/lib/qurbani-confirmation.ts` — change from/reply-to addresses

Find the Resend `fetch` call and update the `from` and `reply_to`:

```typescript
// BEFORE (USA):
body: JSON.stringify({
  from: 'Qurbani Foundation <donorcare@receipts.qurbani.com>',
  to: donation.donor_email,
  reply_to: 'donorcare@qurbani.com',
  subject: 'Alhamdulillah — Your Qurbani Has Been Performed',
  html,
}),

// AFTER (Canada — adjust to match Canada's verified Resend subdomain):
body: JSON.stringify({
  from: 'Qurbani Foundation Canada <donorcare@receipts.qurbani.ca>',
  to: donation.donor_email,
  reply_to: 'donorcare@qurbani.ca',
  subject: 'Alhamdulillah — Your Qurbani Has Been Performed',
  html,
}),
```

The `from` domain MUST be verified in Canada's Resend account (see section 5).
The `reply_to` does NOT need to be verified — it's just where donor replies land.

### 4b. `src/lib/order-number.ts` — pick a non-overlapping offset

USA uses `QF-2026-12000+`. Canada must use a different range so order numbers never collide if you ever merge analytics. Pick one of:

**Option 1 — change the offset (keep QF prefix):**
```typescript
// BEFORE:
export const ORDER_NUMBER_OFFSET = 12000;
// AFTER:
export const ORDER_NUMBER_OFFSET = 50000;  // Canada: QF-2026-50001+
```

**Option 2 — use a distinct prefix (cleaner, recommended):**
```typescript
// In formatOrderNumber, change the return template:
return `QFC-${year}-${displayed}`;  // 'QFC' for Qurbani Foundation Canada
// Also update parseOrderNumber's regex: /QFC-\d{4}-(\d+)$/i
```

Whichever you choose, also update the `+ 12000` constant in `src/pages/admin/qurbani-confirmations.astro` (search for `+ 12000` and replace with the new offset) and the same constant in any admin scripts.

### 4c. `emails/qurbani-confirmation.html` — Canada branding

Search and replace these strings throughout the file:

| USA value | Canada equivalent |
|---|---|
| `5900 Balcones Dr, Suite 100, Austin, TX 78731` | Canada office address |
| `EIN 37-2234647` (or any EIN reference) | Canada CRA Charitable Registration Number (format: `BN/RR####`) |
| `+1 (800) 900 0027` | Canada toll-free number |
| `donorcare@qurbani.com` | `donorcare@qurbani.ca` |
| Any `qurbani.com` link | `qurbani.ca` equivalent |
| Logo URL hosted on `qurbani.com` | Canada-hosted logo URL |

**Important — Tax receipt language:** The USA template uses `501(c)(3)` tax-deductibility wording. Canada uses CRA charitable receipts, which have different legal wording and rules. Have a Canadian charity-compliance person review the receipt language BEFORE the first batch goes out.

### 4d. `src/pages/admin/qurbani-confirmations.astro` — fallback default date

In the frontmatter:
```typescript
let eidStartIso = '2026-05-27';
```

This is just a fallback if `site_settings.eid_ul_adha_start` is null. The DB value takes precedence, so you can leave this as-is. Update only if the Canada team observes a different starting date.

---

## 5. Resend domain verification (do BEFORE first send)

In the Canada Resend account:

1. Go to **Domains -> Add Domain**.
2. Add the sending subdomain you used in step 4a, e.g. `receipts.qurbani.ca`.
3. Resend will give you DNS records (SPF, DKIM, DMARC). Add them to the Canada DNS provider.
4. Wait until Resend shows "Verified" status (usually 5-30 min).
5. Test: visit `/api/donations/qurbani-confirmation-test` after deploy to send yourself a test email.

**Common failure mode:** Trying to send `from: donorcare@qurbani.ca` without verifying `qurbani.ca` itself. Either verify the root domain OR use a subdomain (`receipts.qurbani.ca`) you DO verify, and put the friendly reply-to on the root.

---

## 6. Behavior the agent must understand (so they don't break it)

### Atomic claim — the anti-duplicate guarantee

The critical safety property of this system is in `src/lib/qurbani-confirmation.ts` -> `sendQurbaniConfirmationInner`. The ORDER of operations is:

1. **CLAIM** the row: `UPDATE donations SET sent_at = NOW() WHERE id = X AND sent_at IS NULL RETURNING id;`
   - If 0 rows updated -> another request already claimed it -> return `{ sent: false, reason: 'Already confirmed (atomic claim already taken)' }`.
   - If 1 row updated -> we own the claim, proceed.
2. **SEND** via Resend.
3. **ON FAILURE** -> roll back the claim: `UPDATE donations SET sent_at = NULL WHERE id = X AND sent_at = <our claim timestamp>;`.

The `WHERE ... AND sent_at IS NULL` is what makes the claim atomic — Postgres guarantees only one request can win.

**DO NOT REORDER these steps.** Sending first and updating second is the original bug — Cloudflare Workers can be killed mid-request after the email goes out but before the DB UPDATE lands, leaving the row "pending" and ready to be re-sent on the next batch. That's how duplicate emails happen.

### Hijri date auto-detection

The admin page (`src/pages/admin/qurbani-confirmations.astro`) computes the Hijri date from `cutoff_date - eid_start_date`:
- Difference 0 days -> 10 Dhul Hijjah
- Difference 1 day  -> 11 Dhul Hijjah
- Difference 2 days -> 12 Dhul Hijjah

The Hijri dropdown is `disabled` and labeled "auto-detected" so admin cannot manually pick the wrong day. The Eid start date is configurable inline via the date picker that POSTs to `/api/settings/fulfillment`.

### Email template — no day labels

The email template intentionally shows ONLY `{{hijri_date}}` (e.g. "11 Dhul Hijjah, 1447 AH"). It does NOT show:
- Gregorian date
- "Day 1 / Day 2 / Day 3" labels
- "Yawm an-Nahr" or "Ayyam al-Tashreeq"

Admin removed these because a recipient mistook "First Day of Tashreeq" for "First Day of Eid." DO NOT add them back without admin's explicit approval.

### Workers wall-time

Cloudflare Workers Pages has a wall-time limit (~30s). With 20 rows per request and 120ms throttle plus Resend latency, batches can take 15-20s. If you increase `MAX_PER_REQUEST` past 25, you risk wall-time timeouts that break the atomic-claim rollback path.

If timeouts become a problem, REDUCE batch size to 10 — don't increase it.

---

## 7. Smoke test after deploy

Once code is deployed and Resend domain is verified:

1. Open `/admin/qurbani-confirmations` on Canada production.
2. **Verify the Eid start date** input shows your saved date.
3. **Change the cutoff date** and confirm the green helper line below the Hijri dropdown shows the right Hijri date (10/11/12 Dhul Hijjah).
4. **Click Send** on ONE row (yourself, or a test donor inbox you control):
   - Email lands in inbox with Canada branding (CRA #, address, logo, reply-to).
   - `qurbani_send_log` table receives a row with `outcome: 'sent'`.
   - The row drops off the pending list after page refresh.
5. **Click Send AGAIN on the same row** (or include it in a Select All batch):
   - Modal shows it under "Already Sent (duplicate prevented)".
   - `qurbani_send_log` receives a row with `outcome: 'already_sent'`.
   - Donor inbox receives NO second email.
6. **Click Show per-row details** in the modal after the batch:
   - Confirms the per-row outcome viewer is wired up correctly.

If all 6 pass, the port is complete.

---

## 8. Reference — what `qurbani_send_log` looks like

```
id           | uuid       | row id
donation_id  | uuid       | links back to donations.id
order_number | int        | raw order number from donations (add the offset for display)
donor_name   | text       | snapshot at send time (so it stays accurate if donor renames)
donor_email  | text       | snapshot at send time
hijri_day    | int        | 10, 11, or 12
outcome      | text       | 'sent' | 'already_sent' | 'failed' | 'invalid'
reason       | text       | error message or 'Already confirmed...' explanation
email_id     | text       | Resend message ID (for successful sends, lookup in Resend dashboard)
sent_at      | timestamptz| when this attempt was made
```

Admin can query "which donor was skipped in the last batch?" via:
```
GET /api/donations/qurbani-send-log?minutes=10&outcome=already_sent&hijri_day=11
```

Or in SQL:
```sql
SELECT donor_name, donor_email, reason
FROM qurbani_send_log
WHERE sent_at > NOW() - INTERVAL '10 minutes'
  AND outcome = 'already_sent'
  AND hijri_day = 11
ORDER BY sent_at DESC;
```

---

## 9. One-page checklist

```
[ ] Copy all 10 files listed in section 1
[ ] Run the SQL migration in section 2 against Canada Supabase
[ ] Set env vars in section 3 in Cloudflare Pages + .env
[ ] Edit src/lib/qurbani-confirmation.ts from/reply-to (section 4a)
[ ] Edit src/lib/order-number.ts offset/prefix (section 4b)
[ ] Update emails/qurbani-confirmation.html with Canada branding (section 4c)
[ ] Verify Canada Resend sending subdomain (section 5)
[ ] Run smoke test in section 7
[ ] Have a CRA-compliance reviewer check the tax-receipt language in the email
```

When all 9 boxes are ticked, the system is ready for Eid al-Adha sends from the Canada site.
