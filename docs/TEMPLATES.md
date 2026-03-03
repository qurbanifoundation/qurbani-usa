# Page Templates

## Available Templates
| Template | Slug | Description |
|----------|------|-------------|
| Appeals | `appeals` | Standard donation campaign page |
| Emergency Appeals | `emergency-appeals` | Urgent appeals with goal progress |
| Pennybill Homepage | `pennybill-homepage` | Penny-per-day campaigns |
| Orphan Sponsorship | `orphan-sponsorship` | Monthly orphan sponsorship |
| TileStack Sponsorship | `tilestack-sponsorship` | Grid-based sponsorship campaigns |
| Aqiqah | `aqiqah` | High-converting Aqiqah service page |

## Adding New Templates
1. Create template in `src/templates/`
2. Add entry to `template_options` table
3. Export from `src/lib/templates.ts`

---

## GreenWithYellow Template

### Overview
Default campaign page template used by most appeals (yemen-emergency, afghanistan-emergency, etc.). Features a hero section, "Choose Your Impact" tier system, and content sections.

### File
`src/templates/GreenWithYellowTemplate.astro`

### "Choose Your Impact" Tier System
- **Give Once / Monthly toggle**: Tab-style toggle at top
- **Pricing**: Monthly amounts are 40% of one-time amounts (60% less)
- **Format**: `$150 USD` (give once) / `$60 USD/mo` (monthly)
- **Tier rows**: Each row has `data-tier-single-amount` and `data-tier-monthly-amount` attributes
- **Cart integration**: Works with all donation box templates (CW, teal-yellow, etc.)
- **Bug fix (Mar 2026)**: Null check on `donateBtn` — CW donation box template doesn't have `id="donate-btn"`, so the addEventListener was crashing and preventing tier handlers from registering

### Donation Box Templates
Campaign's `donation_box_template` field determines which donation box to render:
- `cw-donation` → CWDonationBox.astro (uses `window.addToCart()` global)
- `teal-yellow` → Default teal/yellow donation box (has `id="donate-btn"`)

### Key JS Function
`initGreenYellowTemplate()` — initializes tier system, toggle, and click handlers. Called on DOMContentLoaded or immediately if DOM already ready.

---

## Aqiqah Template

### Overview
High-converting Aqiqah page for parents to order Aqiqah service for child's birth.

### Files
| File | Purpose |
|------|---------|
| `src/templates/AqiqahTemplate.astro` | Main template component |
| `src/pages/appeals/[slug].astro` | Routes 'aqiqah' slug to template |
| `supabase/migrations/20260223_aqiqah_campaign.sql` | DB migration |

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

### URL
`/appeals/aqiqah`

---

## Orphan Sponsorship Template

### Features
- **Recent Sponsors Widget**: Dynamic display with localStorage persistence
- **Pool of Sample Names**: 16 diverse sponsor names
- **Time-based Aging**: Sponsors fade after 10 hours
- **Donation Triggers**: Real donations add to recent sponsors list

### File
`src/templates/OrphanSponsorshipTemplate.astro`

---

## Ramadan Amanah Template

### Files
| File | Purpose |
|------|---------|
| `src/templates/ramadan/AmanahTemplate.astro` | Main template component |
| `src/pages/ramadan-amanah.astro` | Page route |
| `public/images/ramadan/bg-full.png` | Full-page background image |

### URL
`/ramadan-amanah`

### Background Configuration
```css
body {
  background-image: url('/images/ramadan/bg-full.png');
  background-size: 100% auto;
  background-position: center -300px;
  background-repeat: no-repeat;
  background-color: #e8e4e0;
  background-attachment: scroll;
}
```

### Color Scheme
| Element | Color |
|---------|-------|
| Hero title/subtitle text | `#F7DEC3` |
| Stats box text | `#F7DEC3` |
| CTA button background | `#16434B` |
| CTA button border | `#002329` |
| Stats box background | `rgba(150, 140, 160, 0.15)` (transparent) |

### Typography
| Element | Font | Style |
|---------|------|-------|
| Hero title | Playfair Display | Normal (non-italic), 48px, 400 weight |
| Stats values | Signika | 26px, 600 weight |
| Step headings | Signika | 28px, 700 weight |

### 4-Step Flow
1. **Hero + Date Selection**: Confirm Ramadan start date
2. **Choose Schedule**: All nights / Last 10 / Last 5 odd
3. **Choose Amount**: $5/$10/$25/$50 per night
4. **Review & Confirm**: Summary + checkout
