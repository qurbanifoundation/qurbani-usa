# Qurbani USA - Development Context

This document summarizes all development work completed and serves as context for future Claude Code sessions.

---

## Project Overview

- **Framework**: Astro with TypeScript
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS v4
- **Fonts**: Signika (headings), Lato (body)
- **Brand Colors**:
  - Primary: `#01534d` (teal)
  - Secondary: `#fbefdd` (cream)
  - Accent: `#fdc448` (yellow/gold)

---

## Template System Architecture

### Centralized Template Utilities

**File**: `/src/lib/templates.ts`

Provides centralized template fetching from the database. All admin dropdowns use these functions:

```typescript
getPageTemplates()        // Returns page template options
getDonationBoxTemplates() // Returns donation box template options
getAllTemplates()         // Returns both
```

Features:
- Fetches from `template_options` database table
- Includes fallback options if database fails
- Automatically sorts by `sort_order`

### Database Table: `template_options`

```sql
CREATE TABLE template_options (
  id SERIAL PRIMARY KEY,
  template_type VARCHAR(50) NOT NULL,  -- 'page' or 'donation_box'
  template_key VARCHAR(50) NOT NULL,   -- e.g., 'emergency-appeal'
  template_label VARCHAR(100) NOT NULL, -- e.g., 'Urgent Appeal'
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_type, template_key)
);
```

### Current Page Templates

| Key | Label | Description |
|-----|-------|-------------|
| `green-with-yellow` | Sticky Sidebar | Campaign page with sticky donation box on the right |
| `emergency-appeal` | Urgent Appeal | Dramatic page with red accents, progress bar |

Note: "Standard" and "Minimal" templates were removed as duplicates of Sticky Sidebar.

### Current Donation Box Templates

| Key | Label |
|-----|-------|
| `teal-yellow` | Teal Yellow |
| `dark-teal` | Dark Teal |
| `white` | White |
| `compact` | Compact |
| `list-style` | List Style |
| `urgent-appeal` | Urgent Appeal |

### Template Resolution Order

When displaying a campaign, templates are resolved in this order:
1. Campaign-specific template (`campaign.page_template`)
2. Site default template (`site_settings.default_campaign_page_template`)
3. Hardcoded fallback (`'green-with-yellow'`)

### How to Add a New Page Template

1. **Create the template component**:
   ```
   /src/templates/NewTemplate.astro
   ```

2. **Add to database**:
   ```sql
   INSERT INTO template_options (template_type, template_key, template_label, sort_order)
   VALUES ('page', 'new-template', 'New Template', 3);
   ```

3. **Update display pages** to import and render:
   - `/src/pages/campaigns/[slug].astro`
   - `/src/pages/appeals/[slug].astro`

   Add import and conditional:
   ```astro
   import NewTemplate from '../../templates/NewTemplate.astro';

   {pageTemplate === 'new-template' ? (
     <NewTemplate campaign={campaignProps} donationBoxTemplate={donationBoxTemplate} />
   ) : pageTemplate === 'emergency-appeal' ? (
     ...
   )}
   ```

After step 2, the template automatically appears in all admin dropdowns.

---

## Key Files Reference

### Template Files

| File | Purpose |
|------|---------|
| `/src/lib/templates.ts` | Centralized template fetching utilities |
| `/src/templates/GreenWithYellowTemplate.astro` | Default campaign template |
| `/src/templates/EmergencyAppealTemplate.astro` | Emergency appeal template (red accents) |

### Display Pages (render templates)

| File | Purpose |
|------|---------|
| `/src/pages/campaigns/[slug].astro` | Campaign display at `/campaigns/{slug}` |
| `/src/pages/appeals/[slug].astro` | Appeals display at `/appeals/{slug}` |

### Admin Pages (template selection)

| File | Purpose |
|------|---------|
| `/src/pages/admin/campaigns/[slug].astro` | Edit campaign - template dropdowns |
| `/src/pages/admin/campaigns/new.astro` | New campaign - template dropdowns |
| `/src/pages/admin/settings/templates.astro` | Site default template settings |

### SQL Migrations

| File | Purpose |
|------|---------|
| `/sql/template-settings.sql` | Creates `template_options` table and initial data |
| `/sql/template-colors.sql` | Template color customization |
| `/sql/sudan-emergency-campaign.sql` | Sudan Emergency campaign data |

---

## Mega Menu Implementation

### File: `/src/components/Navbar.astro`

The mega menu for "Appeals" uses click-to-open behavior (not hover):

**Key Features**:
- Opens on click, closes on click outside or ESC
- Centered on viewport with `left-0 right-0 mx-auto`
- Dynamic top position via JavaScript (`--menu-top` CSS variable)
- 36%/64% column split (categories | appeals grid)
- Categories switch content on click (tab-like behavior)
- ARIA attributes for accessibility

**Structure**:
```html
<div id="appeals-mega-menu" class="fixed left-0 right-0 z-[9999] hidden w-full max-w-[1400px] mx-auto">
  <div class="flex">
    <!-- Left: Categories (36%) -->
    <div class="w-[36%]">...</div>
    <!-- Right: Appeals Grid (64%) -->
    <div class="w-[64%]">...</div>
  </div>
</div>
```

**JavaScript Events**:
- Click appeals button → toggle menu
- Click category → switch tab panel
- Click outside → close menu
- ESC key → close menu

---

## Sudan Emergency Campaign

**URL**: `/appeals/sudan-emergency`

**Template**: Uses `emergency-appeal` page template

**Features**:
- Red accent color scheme for urgency
- Progress bar showing fundraising goal
- Impact statistics grid
- Expandable content sections
- Gallery section
- Custom donation amounts

**Database Fields** (JSONB):
- `impact_stats`: Array of {icon, value, label}
- `content_sections`: Array of {title, content, image}
- `donation_options`: Array of {amount, label, description}
- `gallery_images`: Array of image URLs

---

## Important Technical Notes

### Tailwind CSS v4 Limitations

`@apply` directives do NOT work inside Astro `<style>` blocks in Tailwind v4. Use regular CSS instead:

```css
/* DON'T DO THIS - will cause 500 error */
<style>
  .heading { @apply text-2xl font-bold; }
</style>

/* DO THIS INSTEAD */
<style>
  .heading {
    font-size: 1.5rem;
    font-weight: 700;
  }
</style>
```

### Supabase Client

Use `supabaseAdmin` from `/src/lib/supabase.ts` for server-side database access.

### Prerender

All dynamic pages must include:
```astro
export const prerender = false;
```

---

## Database Schema Notes

### Campaigns Table Key Fields

```sql
campaigns (
  id, slug, title, name,
  description, long_description,
  featured_image, hero_image_url, image_url,
  page_template,           -- Override page template
  donation_box_template,   -- Override donation box template
  donation_options JSONB,  -- [{amount, label, description}]
  content_sections JSONB,  -- [{title, content, image}]
  gallery_images JSONB,    -- [url1, url2, ...]
  impact_stats JSONB,      -- [{icon, value, label}]
  goal_amount, raised_amount,
  is_active, is_featured, show_on_homepage,
  meta_title, meta_description
)
```

### Site Settings Table

```sql
site_settings (
  default_donation_box_template,  -- Default for all campaigns
  default_campaign_page_template  -- Default for all campaigns
)
```

---

## Common Issues & Solutions

### Issue: Template dropdown not showing new template
**Solution**: Add template to `template_options` database table

### Issue: Campaign shows wrong template
**Solution**: Check `page_template` field in campaigns table. NULL = use site default.

### Issue: HTML tags showing as raw text (not rendered)
**Solution**: Use `set:html={variable}` instead of `{variable}` in Astro templates
```astro
<!-- WRONG - displays raw HTML tags -->
<p>{campaign.subtitle}</p>

<!-- CORRECT - renders HTML -->
<div set:html={campaign.subtitle}></div>
```

### Text Formatting System
**File**: `/src/lib/textFormatting.ts`

Plain text is automatically formatted to HTML:
- `formatTextToHtml(text)` - Converts plain text to paragraphs (blank lines = new paragraph, *text* = bold)
- `formatLineBreaks(text)` - Converts newlines to `<br>` (for short text like subtitles)

If text already contains HTML tags, it passes through unchanged (backward compatible).

Data entry users just type plain text - no HTML knowledge required.

### Issue: 500 error with "Cannot apply unknown utility class"
**Solution**: Replace `@apply` with regular CSS in `<style>` blocks

### Issue: Mega menu not centered
**Solution**: Use `left-0 right-0 mx-auto` instead of transform-based centering

### Issue: JSON parsing error when inserting campaign data
**Solution**: Don't paste SQL with multiline strings directly. Use Node.js script or properly escape.

---

## File Structure Overview

```
/src
├── components/
│   ├── Navbar.astro              # Main navigation with mega menu
│   └── admin/
│       └── SettingsTabs.astro    # Admin settings navigation
├── layouts/
│   └── AdminLayout.astro         # Admin page wrapper
├── lib/
│   ├── supabase.ts               # Supabase client
│   └── templates.ts              # Centralized template utilities
├── pages/
│   ├── appeals/[slug].astro      # Dynamic appeal pages
│   ├── campaigns/[slug].astro    # Dynamic campaign pages
│   ├── admin/
│   │   ├── campaigns/
│   │   │   ├── [slug].astro      # Edit campaign
│   │   │   └── new.astro         # New campaign
│   │   └── settings/
│   │       └── templates.astro   # Template settings
│   └── api/                      # API routes
├── templates/
│   ├── GreenWithYellowTemplate.astro
│   └── EmergencyAppealTemplate.astro
└── styles/
    └── global.css

/sql
├── template-settings.sql         # Template options table
├── template-colors.sql           # Template colors
└── sudan-emergency-campaign.sql  # Sudan campaign data
```

---

## Quick Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

*Last Updated: February 2026*
