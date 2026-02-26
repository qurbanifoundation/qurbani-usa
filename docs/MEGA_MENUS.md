# Mega Menu System

## Overview
Fully dynamic mega menu system with database-driven widgets and a template system for quick setup.

## Architecture
```
Database Tables
  mega_menus (menu defs) → menu_widgets (left/center/right columns)
       ↓                          ↓
  Navbar.astro      →      DynamicMegaMenu → MegaMenuWidget
```

## Database Tables

### `mega_menus` - Menu Definitions
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

### `menu_widgets` - Widget Configurations
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

## Widget Types

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

## Key Files

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

## Template System

### Available Templates
| Template ID | Description | Color |
|-------------|-------------|-------|
| `our-work` | Category Tabs + Campaign Grid + Promo Card | `#D97718` (orange) |
| `zakat` | Link List + Info Box + Quick Form | `#0096D6` (blue) |
| `about` | Link List + Stats Grid + Newsletter | `#D97718` (orange) |
| `ramadan` | Link List + Promo Box + Feature Card | `#024139` (dark teal) |
| `appeals` | Alias for ramadan template | `#024139` |

### Applying a Template

**Via Admin UI:** `/admin/menu-builder` → Select menu → "Apply Template"

**Via API:**
```bash
POST /api/seed-menu-widgets?menu=your-menu-id&template=ramadan
POST /api/seed-menu-widgets?menu=all  # Seed all defaults
```

### Creating a New Template
1. Define widgets array in `src/pages/api/seed-menu-widgets.ts`
2. Register in `templateColors` and `templates` maps
3. Optionally add to legacy seeding block

### Changing Menu IDs
```bash
PUT /api/mega-menus
{ "id": "old-id", "newId": "new-id" }
```
Automatically updates menu record, widgets, and categories.

## Hardcoded Menu IDs
4 main menus have fallback HTML in `Navbar.astro`:
- `our-work`, `zakat`, `appeals`, `about`

Extra menus are rendered dynamically.

## Caching
- Cache TTL: 1 year (effectively permanent)
- Cleared manually via `clearNavbarCache()` from `src/lib/menus.ts`
- APIs call `clearNavbarCache()` after mutations

## Mobile Menu
Accordion-style on hamburger:
- Light cream background (`#f8f6f2`)
- Expandable sections per menu
- Quick donate section ($25, $50, $100, $250)

## Icon Reference
Available icons (defined in `src/lib/categories.ts`):
```
heart, emergency, water, orphan, education, food, healthcare,
sadaqah, qurbani, user, document, image, email, money, calculator,
question, book, gold, shopping-bag, moon, star, x-circle
```
