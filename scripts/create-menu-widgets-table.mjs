import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL not found');
  process.exit(1);
}

const sql = `
-- Create menu_widgets table for configurable mega menu content
CREATE TABLE IF NOT EXISTS menu_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id VARCHAR(50) NOT NULL REFERENCES mega_menus(id) ON DELETE CASCADE,
  position VARCHAR(20) NOT NULL CHECK (position IN ('left', 'center', 'right')),
  widget_type VARCHAR(50) NOT NULL,
  title VARCHAR(200),
  config JSONB DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_menu_widgets_menu ON menu_widgets(menu_id, position, sort_order);

-- RLS policies
ALTER TABLE menu_widgets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read menu_widgets" ON menu_widgets;
  DROP POLICY IF EXISTS "Service role menu_widgets" ON menu_widgets;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Public read menu_widgets" ON menu_widgets FOR SELECT USING (true);
CREATE POLICY "Service role menu_widgets" ON menu_widgets FOR ALL USING (auth.role() = 'service_role');

-- Insert default widgets based on current menu designs

-- OUR WORK MENU
INSERT INTO menu_widgets (menu_id, position, widget_type, title, config, sort_order) VALUES
('our-work', 'left', 'category-tabs', 'Categories', '{"showViewAll": true, "viewAllLink": "/appeals", "viewAllText": "View All Appeals"}', 1),
('our-work', 'center', 'campaign-grid', 'Campaigns', '{"columns": 2, "maxItems": 6}', 1),
('our-work', 'right', 'promo-card', 'Featured', '{
  "title": "Sponsor an Orphan",
  "description": "Change a child''s life with monthly support for education, food & healthcare.",
  "image": "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=400&q=80",
  "link": "/appeals/sponsor-an-orphan",
  "buttonText": "Sponsor Now",
  "price": "$50",
  "priceLabel": "Starting from",
  "pricePeriod": "/month",
  "badge": "FEATURED",
  "bgColor": "#01534d"
}', 1)
ON CONFLICT DO NOTHING;

-- ZAKAT MENU
INSERT INTO menu_widgets (menu_id, position, widget_type, title, config, sort_order) VALUES
('zakat', 'left', 'link-list', 'Zakat Resources', '{
  "links": [
    {"label": "Pay Your Zakat", "href": "/zakat", "icon": "money", "color": "#0096D6"},
    {"label": "Zakat Calculator", "href": "/zakat-calculator", "icon": "calculator", "color": "#16a34a"},
    {"label": "Zakat FAQ", "href": "/zakat-faq", "icon": "question", "color": "#7c3aed"},
    {"label": "What is Zakat?", "href": "/what-is-zakat", "icon": "book", "color": "#ea580c"},
    {"label": "Zakat on Gold & Silver", "href": "/zakat-on-gold", "icon": "gold", "color": "#eab308"}
  ]
}', 1),
('zakat', 'center', 'info-box', 'Understanding Zakat', '{
  "heading": "The Third Pillar of Islam",
  "description": "Zakat is an obligatory form of charity for Muslims who meet the necessary criteria of wealth (nisab). It purifies your wealth and helps those in need.",
  "stats": [
    {"value": "2.5%", "label": "Of qualifying wealth", "link": "/zakat-calculator", "bgColor": "#e6f4fa"},
    {"value": "$5,500", "label": "Approx. Nisab threshold", "link": "/zakat-calculator", "bgColor": "#fef3c7"}
  ],
  "buttonText": "Calculate Your Zakat Now",
  "buttonLink": "/zakat-calculator",
  "buttonColor": "#0096D6"
}', 1),
('zakat', 'right', 'quick-form', 'Quick Zakat', '{
  "title": "Quick Zakat Payment",
  "subtitle": "Give Zakat",
  "amounts": [100, 250, 500],
  "defaultAmount": 500,
  "buttonText": "Pay Zakat Now",
  "buttonLink": "/zakat",
  "buttonColor": "#0096D6",
  "footnote": "100% Zakat policy - all funds reach those in need",
  "fundType": "zakat"
}', 1)
ON CONFLICT DO NOTHING;

-- RAMADAN MENU
INSERT INTO menu_widgets (menu_id, position, widget_type, title, config, sort_order) VALUES
('ramadan', 'left', 'link-list', 'Ramadan Giving', '{
  "links": [
    {"label": "30 Days of Giving", "href": "/ramadan-giving", "icon": "calendar", "color": "#16a34a"},
    {"label": "Feed Iftar", "href": "/iftar", "icon": "food", "color": "#ea580c"},
    {"label": "Fidya", "href": "/fidya", "icon": "heart", "color": "#0096D6"},
    {"label": "Kaffarah", "href": "/kaffarah", "icon": "scale", "color": "#7c3aed"},
    {"label": "Zakat ul-Fitr", "href": "/zakat-ul-fitr", "icon": "gift", "color": "#db2777"}
  ]
}', 1),
('ramadan', 'center', 'program-cards', 'Ramadan Programs', '{
  "programs": [
    {"title": "Iftar Meals", "description": "Feed a fasting person", "price": "$5", "link": "/iftar", "color": "#ea580c"},
    {"title": "Food Packs", "description": "Family food package", "price": "$50", "link": "/food-packs", "color": "#16a34a"},
    {"title": "Zakat ul-Fitr", "description": "Per person", "price": "$15", "link": "/zakat-ul-fitr", "color": "#0096D6"},
    {"title": "Fidya", "description": "Per missed fast", "price": "$15", "link": "/fidya", "color": "#7c3aed"}
  ]
}', 1),
('ramadan', 'right', 'quick-form', 'Quick Ramadan', '{
  "title": "Ramadan Donation",
  "subtitle": "Give Generously",
  "amounts": [30, 50, 100],
  "defaultAmount": 50,
  "buttonText": "Donate Now",
  "buttonLink": "/ramadan-giving",
  "buttonColor": "#16a34a",
  "footnote": "Multiply your rewards in the blessed month",
  "fundType": "ramadan"
}', 1)
ON CONFLICT DO NOTHING;

-- ABOUT MENU
INSERT INTO menu_widgets (menu_id, position, widget_type, title, config, sort_order) VALUES
('about', 'left', 'link-list', 'About Us', '{
  "links": [
    {"label": "About Us", "href": "/about", "icon": "info", "color": "#01534d"},
    {"label": "Our Team", "href": "/team", "icon": "users", "color": "#0096D6"},
    {"label": "Our Impact", "href": "/impact", "icon": "chart", "color": "#16a34a"},
    {"label": "Reports", "href": "/reports", "icon": "document", "color": "#7c3aed"},
    {"label": "Contact Us", "href": "/contact", "icon": "phone", "color": "#ea580c"},
    {"label": "Media", "href": "/media", "icon": "camera", "color": "#db2777"}
  ]
}', 1),
('about', 'center', 'info-box', 'Our Mission', '{
  "heading": "Serving Humanity Since 1999",
  "description": "Qurbani Foundation USA is a Muslim charity dedicated to alleviating suffering of the world''s poorest people. We operate in 53+ countries providing emergency relief, food aid, clean water, education, and healthcare.",
  "stats": [
    {"value": "53+", "label": "Countries served", "bgColor": "#e6f4fa"},
    {"value": "25+", "label": "Years of service", "bgColor": "#dcfce7"}
  ],
  "buttonText": "Learn More About Us",
  "buttonLink": "/about",
  "buttonColor": "#01534d"
}', 1),
('about', 'right', 'contact-card', 'Contact', '{
  "title": "Get in Touch",
  "phone": "1-800-900-0027",
  "email": "info@qurbani.com",
  "address": "145 Sherwood Ave, Teaneck, NJ 07666",
  "socialLinks": [
    {"platform": "facebook", "url": "https://facebook.com/qurbani"},
    {"platform": "instagram", "url": "https://instagram.com/qurbani"},
    {"platform": "youtube", "url": "https://youtube.com/qurbani"},
    {"platform": "twitter", "url": "https://twitter.com/qurbani"}
  ],
  "buttonText": "Contact Us",
  "buttonLink": "/contact"
}', 1)
ON CONFLICT DO NOTHING;
`;

async function run() {
  console.log('🚀 Creating menu_widgets table...\n');

  try {
    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    console.log('✅ Connected to database');

    await client.query(sql);
    console.log('✅ menu_widgets table created and populated!');

    // Verify
    const result = await client.query(`
      SELECT m.name as menu_name, w.position, w.widget_type, w.title
      FROM menu_widgets w
      JOIN mega_menus m ON w.menu_id = m.id
      ORDER BY m.sort_order, w.position, w.sort_order
    `);

    console.log('\n📋 Menu Widgets:');
    let currentMenu = '';
    result.rows.forEach(row => {
      if (row.menu_name !== currentMenu) {
        currentMenu = row.menu_name;
        console.log(`\n  ${currentMenu}:`);
      }
      console.log(`    [${row.position}] ${row.widget_type}: ${row.title || '(no title)'}`);
    });

    await client.end();
    console.log('\n✅ Done!');
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

run();
