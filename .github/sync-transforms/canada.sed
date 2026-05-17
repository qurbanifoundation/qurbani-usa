# ─────────────────────────────────────────────────────────────────────────────
# canada.sed — USA → Canada string rewrites applied during the sister-site sync.
#
# IMPORTANT: this file is applied ONLY to the target/ checkout (the Canada
# clone) inside the GitHub Actions runner. It NEVER touches the USA source.
#
# Order matters. More-specific patterns must run BEFORE more-general ones
# (e.g., email domain rewrites BEFORE the bare-domain rewrite, otherwise
# "donations@qurbani.com" would partially-rewrite to "donations@qurbanifoundation.ca"
# before the email rule sees it).
#
# Every pattern below is intentionally narrow. We prefer over-anchoring (and
# missing a few edge cases that a human will catch in PR review) over
# blanket regexes that clobber comments, GHL tag strings, or SKUs.
#
# If a transform turns out to be wrong, edit it here — the workflow re-runs
# the file on every sync, so corrections take effect on the next push.
# ─────────────────────────────────────────────────────────────────────────────

# ── 1. Email addresses ──────────────────────────────────────────────────────
# Must run BEFORE the qurbani.com → qurbanifoundation.ca domain rewrite.
s|donations@receipts\.qurbani\.com|donations@qurbanifoundation.ca|g
s|donorcare@qurbani\.com|donorcare@qurbanifoundation.ca|g
s|info@qurbani\.com|info@qurbanifoundation.ca|g
s|support@qurbani\.com|support@qurbanifoundation.ca|g
s|contact@qurbani\.com|contact@qurbanifoundation.ca|g
s|noreply@qurbani\.com|noreply@qurbanifoundation.ca|g
s|hello@qurbani\.com|hello@qurbanifoundation.ca|g
# Catch-all for any remaining @qurbani.com — runs after the specific ones.
s|@qurbani\.com|@qurbanifoundation.ca|g

# ── 2. Domains / URLs ───────────────────────────────────────────────────────
# We rewrite ONLY URLs hosted at the primary "qurbani.com" / "www.qurbani.com"
# host. We intentionally do NOT rewrite "staging9.qurbani.com" — that's the
# legacy WordPress CDN where ~30 stock images are hosted. Canada has no
# equivalent staging server, so leaving those URLs alone keeps the images
# loading. Migrate them to a CA-hosted CDN later as a separate task.
s|https://www\.qurbani\.com|https://www.qurbanifoundation.ca|g
s|http://www\.qurbani\.com|http://www.qurbanifoundation.ca|g
s|https://qurbani\.com|https://qurbanifoundation.ca|g
s|http://qurbani\.com|http://qurbanifoundation.ca|g
# Bare "qurbani.com" in body copy (no protocol, no subdomain). We rely on a
# leading space, paren, quote, or angle-bracket boundary to avoid clobbering
# "staging9.qurbani.com" or "www.qurbani.com" (already handled above).
s|\([ (\"'>]\)qurbani\.com\([ ,.;:!?<\"')]\)|\1qurbanifoundation.ca\2|g
# Edge case: line begins with "qurbani.com"
s|^qurbani\.com|qurbanifoundation.ca|g

# ── 3. Organization names ───────────────────────────────────────────────────
# "Qurbani Foundation USA" → "Qurbani Foundation Canada"
s|Qurbani Foundation USA|Qurbani Foundation Canada|g
# Short form "Qurbani USA" → "Qurbani Canada"
# (intentionally case-sensitive — we don't want to match "qurbani USA" in URLs)
s|Qurbani USA|Qurbani Canada|g

# ── 4. Currency ─────────────────────────────────────────────────────────────
# Anchor on quotes and key:value patterns. NEVER do a bare s/USD/CAD/g —
# it would hit comments, ISO country lists, and GHL campaign metadata.
s|'USD'|'CAD'|g
s|"USD"|"CAD"|g
s|currency: 'usd'|currency: 'cad'|g
s|currency: "usd"|currency: "cad"|g
s|currency:'usd'|currency:'cad'|g
s|currency:"usd"|currency:"cad"|g

# ── 5. Country flag URLs and attributes ─────────────────────────────────────
s|flagcdn\.com/w20/us\.png|flagcdn.com/w20/ca.png|g
s|flagcdn\.com/w40/us\.png|flagcdn.com/w40/ca.png|g
s|flagcdn\.com/w80/us\.png|flagcdn.com/w80/ca.png|g
s|data-flag="us"|data-flag="ca"|g
s|data-flag='us'|data-flag='ca'|g

# ── 6. Logo (Supabase-hosted CDN) ───────────────────────────────────────────
# USA logo at epsjdbnxhmeprjrgcbyw → Canada logo at bbihmrctudiqifwfplef
s|epsjdbnxhmeprjrgcbyw\.supabase\.co/storage/v1/object/public/[^"'\)\s]*1771815889576-drvcgb\.png|bbihmrctudiqifwfplef.supabase.co/storage/v1/object/public/site-assets/qurbani-logo-ca.png|g

# ── 7. Supabase project URL (any references to USA project in code) ─────────
# Most Supabase URLs live in env vars (never synced), but if any URL is
# inlined in a template (e.g., an OG image hosted on Supabase storage),
# rewrite the project ref.
s|epsjdbnxhmeprjrgcbyw\.supabase\.co|bbihmrctudiqifwfplef.supabase.co|g

# ── 8. GA4 ──────────────────────────────────────────────────────────────────
s|G-0WC0W1PBKC|G-JRT5F8QWPP|g
s|_ga_0WC0W1PBKC|_ga_JRT5F8QWPP|g

# ── 9. GHL location ID ──────────────────────────────────────────────────────
# These IDs are unique enough that a direct rewrite is safe.
s|W0zaxipAVHwutqUazGwL|pit-7fa744b5-7eb8-4832-b87c-846fc4bb7ff4|g

# ── 10. Phone numbers (3 format variants) ───────────────────────────────────
# Canonical: +1 (989) 787-2265 → +1 (365) 536-6283
s|+1 (989) 787-2265|+1 (365) 536-6283|g
s|(989) 787-2265|(365) 536-6283|g
s|989-787-2265|365-536-6283|g
s|9897872265|3655366283|g
# Vanity form
s|+1 (989) QURBANI|+1 (365) 536-6283|g
s|(989) QURBANI|(365) 536-6283|g

# ── 11. Toll-free (US-only; Canada doesn't have one yet) ────────────────────
# Leave as-is — Canada repo's src/config sets tollFree to empty and templates
# hide the row when empty. No transform needed.

# ── 12. Country selector defaults in checkout dropdowns ─────────────────────
# Order: full-line patterns first (catch the "United States" label too),
# then attribute-only patterns as fallbacks.
s|<option value="US" selected>United States</option>|<option value="CA" selected>Canada</option>|g
s|<option value='US' selected>United States</option>|<option value='CA' selected>Canada</option>|g
s|<option value="US" selected>|<option value="CA" selected>|g
s|<option value='US' selected>|<option value='CA' selected>|g
s|<option value="US" selected="selected">|<option value="CA" selected="selected">|g
s|<option value="US" selected=true>|<option value="CA" selected=true>|g

# ── 13. Mailing address ─────────────────────────────────────────────────────
# This is fragile — addresses appear formatted differently per file. Order
# matters: full forms (including "Suite 100" / "Suite NNN") must run BEFORE
# the bare-street rule to avoid duplicate-Suite output like
# "30 Eglinton Ave W, Suite #400, Suite 100, Mississauga…".
s|5900 Balcones Dr, Suite [0-9][0-9]*, Austin, TX 78731|30 Eglinton Ave W, Suite #400, Mississauga, ON L4Z 3X3|g
s|5900 Balcones Dr, Suite [0-9][0-9]*, Austin TX 78731|30 Eglinton Ave W, Suite #400, Mississauga, ON L4Z 3X3|g
s|5900 Balcones Dr, Austin, TX 78731|30 Eglinton Ave W, Suite #400, Mississauga, ON L4Z 3X3|g
s|5900 Balcones Dr, Austin TX 78731|30 Eglinton Ave W, Suite #400, Mississauga, ON L4Z 3X3|g
s|5900 Balcones Dr|30 Eglinton Ave W, Suite #400|g
s|Austin, TX 78731|Mississauga, ON L4Z 3X3|g
s|Austin, TX|Mississauga, ON|g

# ── 14. Legacy NJ address (still appears in current src/config/site.ts) ────
# Older copy from when the foundation was registered in Teaneck, NJ.
s|145 Sherwood Ave, Teaneck, NJ 07666|30 Eglinton Ave W, Suite #400, Mississauga, ON L4Z 3X3|g
s|145 Sherwood Ave|30 Eglinton Ave W, Suite #400|g
s|Teaneck, NJ 07666|Mississauga, ON L4Z 3X3|g
s|Teaneck, NJ|Mississauga, ON|g

# ── NOT handled here (need refactor, see PR review checklist): ──────────────
# - 501(c)(3) / EIN 38-4109146 / "Established 1999" badge / "Real Stories" section.
#   These are content REMOVED on Canada, not transformed. A sed delete is
#   too fragile. They should be wrapped in src/config flags in the USA repo
#   (e.g., {siteConfig.features.show501c3 && ...}) so Canada hides them via
#   config. Until that refactor lands, you'll see these blocks re-appear in
#   every sync PR — delete them manually before merging.
