/**
 * WooCommerce Customer & Order Import Script
 *
 * Reads WooCommerce orders CSV, deduplicates customers,
 * imports into Supabase (woo_customers + woo_orders tables),
 * and optionally syncs to GHL with tags + custom fields.
 *
 * Usage:
 *   node scripts/import-woocommerce.mjs                    # Import to Supabase only
 *   node scripts/import-woocommerce.mjs --sync-ghl         # Import + sync to GHL
 *   node scripts/import-woocommerce.mjs --dry-run           # Preview without importing
 */

import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const CSV_PATH = path.join(__dirname, '..', 'data', 'woocommerce-orders.csv');
const DRY_RUN = process.argv.includes('--dry-run');
const SYNC_GHL = process.argv.includes('--sync-ghl');

// GHL config
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || 'W0zaxipAVHwutqUazGwL';
const GHL_BASE_URL = 'https://services.leadconnectorhq.com';
const GHL_RATE_LIMIT_MS = 350; // ~3 req/sec to stay under GHL limits

// Valid (successful) order statuses
const SUCCESSFUL_STATUSES = [
  'processing', 'completed', 'qurbani charged', 'payment charged',
  'monthly charged', 'aqiqah completed'
];

// Category mapping from item names → tags
function categorizeItem(itemName) {
  const name = (itemName || '').toLowerCase();
  const categories = [];

  // Qurbani / Animal sacrifice
  if (name.includes('goat') || name.includes('sheep') || name.includes('cow share') ||
      name.includes('full cow') || name.includes('camel') || name.includes('bull') ||
      name.includes('qurbani') || name.includes('prophetic qurbani')) {
    categories.push('qurbani');
  }

  // Aqiqah
  if (name.includes('aqiqah') || name.includes('aqeeqah')) {
    categories.push('aqiqah');
  }

  // Zakat
  if (name.includes('zakat')) {
    categories.push('zakat');
  }

  // Ramadan / Iftar / Fidya / Kaffarah
  if (name.includes('ramadan') || name.includes('iftar') || name.includes('fidya') ||
      name.includes('kaffarah') || name.includes('food pack')) {
    categories.push('ramadan');
  }

  // Orphan sponsorship
  if (name.includes('orphan') || name.includes('sponsor')) {
    categories.push('orphan-sponsorship');
  }

  // Education
  if (name.includes('education') || name.includes('school') || name.includes('girl')) {
    categories.push('education');
  }

  // Emergency / Crisis
  if (name.includes('emergency') || name.includes('crisis') || name.includes('relief') ||
      name.includes('appeal') || name.includes('rohingya') || name.includes('syria') ||
      name.includes('yemen') || name.includes('flood')) {
    categories.push('emergency');
  }

  // Gaza / Palestine
  if (name.includes('gaza') || name.includes('palestine')) {
    categories.push('palestine');
  }

  // Water
  if (name.includes('water') || name.includes('well') || name.includes('sanitation')) {
    categories.push('water');
  }

  // Healthcare
  if (name.includes('health') || name.includes('medical') || name.includes('clinic')) {
    categories.push('healthcare');
  }

  // Sadaqah / General
  if (name.includes('sadaqah') || name.includes('sadaqa') || name.includes('general donation')) {
    categories.push('sadaqah');
  }

  // If no category matched, tag as general
  if (categories.length === 0) {
    categories.push('general');
  }

  return categories;
}

// Extract country from item name
function extractCountry(itemName) {
  const name = (itemName || '').trim();
  // Patterns like "Kenya - Goat/Sheep", "Kashmir India - Cow Share", "Palestine Gaza - Cow Share"
  const match = name.match(/^(.+?)\s*-\s*(Goat|Sheep|Cow|Full Cow|Camel|Bull)/i);
  if (match) return match[1].trim();
  return null;
}

async function ghlFetch(endpoint, options = {}) {
  const headers = {
    'Authorization': `Bearer ${GHL_API_KEY}`,
    'Version': '2021-07-28',
    'Content-Type': 'application/json',
    ...options.headers,
  };
  return fetch(`${GHL_BASE_URL}${endpoint}`, { ...options, headers });
}

async function syncCustomerToGHL(customer) {
  if (!GHL_API_KEY) {
    console.warn('⚠️  GHL_API_KEY not set, skipping GHL sync');
    return { success: false, error: 'No API key' };
  }

  try {
    // ─── Structured prefix-based tags ───
    const tags = [
      'source:woocommerce',
      'migration:woocommerce',
      'donor:existing',
    ];

    // Donor behavior tags
    if (customer.order_count > 1) tags.push('donor:repeat');
    if (customer.total_donated >= 1000) tags.push('donor:major');

    // Campaign tags (prefix-based)
    const campaignTagMap = {
      'qurbani': 'campaign:qurbani',
      'aqiqah': 'campaign:aqiqah',
      'zakat': 'campaign:zakat',
      'ramadan': 'campaign:ramadan',
      'orphan-sponsorship': 'campaign:orphan',
      'education': 'campaign:education',
      'emergency': 'campaign:emergency',
      'palestine': 'campaign:palestine',
      'water': 'campaign:water',
      'healthcare': 'campaign:healthcare',
      'sadaqah': 'campaign:sadaqah',
      'general': 'campaign:general',
    };
    for (const cat of customer.categories) {
      const tag = campaignTagMap[cat];
      if (tag) tags.push(tag);
    }

    // Donor tier
    let donorTier = 'bronze';
    if (customer.total_donated >= 5000) donorTier = 'platinum';
    else if (customer.total_donated >= 1000) donorTier = 'gold';
    else if (customer.total_donated >= 250) donorTier = 'silver';

    // Tier tag
    tags.push(`tier:${donorTier}`);

    // Find largest donation
    const largestDonation = customer.last_donation_amount; // Will be overridden below if we have order data

    const contactData = {
      firstName: customer.first_name,
      lastName: customer.last_name,
      email: customer.email,
      phone: customer.phone || undefined,
      address1: customer.address || undefined,
      city: customer.city || undefined,
      state: customer.state || undefined,
      postalCode: customer.zip || undefined,
      country: customer.country || undefined,
      tags,
      source: 'WooCommerce Import',
      locationId: GHL_LOCATION_ID,
      customFields: [
        { key: 'total_lifetime_giving', field_value: customer.total_donated.toString() },
        { key: 'donation_count', field_value: customer.order_count.toString() },
        { key: 'first_donation_date', field_value: customer.first_order_date || '' },
        { key: 'last_donation_date', field_value: customer.last_order_date || '' },
        { key: 'largest_donation', field_value: customer.largest_donation?.toString() || customer.last_donation_amount.toString() },
        { key: 'campaigns_donated', field_value: customer.categories.join(', ') },
        { key: 'donor_tier', field_value: donorTier },
      ],
    };

    // Search for existing contact first
    const searchRes = await ghlFetch(
      `/contacts/search/duplicate?locationId=${GHL_LOCATION_ID}&email=${encodeURIComponent(customer.email)}`
    );

    let method, endpoint;
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.contact?.id) {
        method = 'PUT';
        endpoint = `/contacts/${searchData.contact.id}`;
      } else {
        method = 'POST';
        endpoint = '/contacts/';
      }
    } else {
      method = 'POST';
      endpoint = '/contacts/';
    }

    const res = await ghlFetch(endpoint, {
      method,
      body: JSON.stringify(contactData),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: err };
    }

    const data = await res.json();
    return { success: true, contactId: data.contact?.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🛒 WooCommerce Import Script');
  console.log('━'.repeat(50));

  if (DRY_RUN) console.log('🔍 DRY RUN — no data will be written\n');
  if (SYNC_GHL) console.log('📡 GHL sync enabled\n');

  // ─── 1. Read & Parse CSV ───
  console.log('📄 Reading CSV...');
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });
  console.log(`   Found ${records.length} rows\n`);

  // ─── 2. Group orders by Order Number (multi-item orders) ───
  console.log('📦 Grouping orders...');
  const ordersMap = new Map();

  for (const row of records) {
    const orderNum = row['Order Number'];
    if (!orderNum) continue;

    if (!ordersMap.has(orderNum)) {
      ordersMap.set(orderNum, {
        order_number: orderNum,
        status: (row['Order Status'] || '').trim(),
        order_date: row['Order Date'] || null,
        email: (row['Email (Billing)'] || '').trim().toLowerCase(),
        first_name: (row['First Name (Billing)'] || '').trim(),
        last_name: (row['Last Name (Billing)'] || '').trim(),
        phone: (row['Phone (Billing)'] || '').trim(),
        address: (row['Address 1&2 (Billing)'] || '').trim(),
        city: (row['City (Billing)'] || '').trim(),
        state: (row['State Code (Billing)'] || '').trim(),
        zip: (row['Postcode (Billing)'] || '').trim(),
        country: (row['Country Code (Billing)'] || '').trim(),
        company: (row['Company (Billing)'] || '').trim(),
        payment_method: (row['Payment Method Title'] || '').trim(),
        order_total: parseFloat(row['Order Total Amount'] || '0'),
        refund_amount: parseFloat(row['Order Refund Amount'] || '0'),
        items: [],
      });
    }

    // Add line item
    const itemName = (row['Item Name'] || '').trim();
    if (itemName) {
      ordersMap.get(orderNum).items.push({
        name: itemName,
        quantity: parseInt(row['Quantity (- Refund)'] || '1', 10),
        cost: parseFloat(row['Item Cost'] || '0'),
        sku: (row['SKU'] || '').trim(),
        item_number: parseInt(row['Item #'] || '0', 10),
      });
    }
  }

  const orders = Array.from(ordersMap.values());
  console.log(`   ${orders.length} unique orders\n`);

  // ─── 3. Group customers by email (deduplicate) ───
  console.log('👥 Deduplicating customers...');
  const customersMap = new Map();

  for (const order of orders) {
    const email = order.email;
    if (!email || email === '' || !email.includes('@')) continue;

    const isSuccessful = SUCCESSFUL_STATUSES.includes(order.status.toLowerCase());

    if (!customersMap.has(email)) {
      customersMap.set(email, {
        email,
        first_name: order.first_name,
        last_name: order.last_name,
        phone: order.phone,
        address: order.address,
        city: order.city,
        state: order.state,
        zip: order.zip,
        country: order.country,
        total_donated: 0,
        total_orders: 0,
        successful_orders: 0,
        order_count: 0,
        last_donation_amount: 0,
        largest_donation: 0,
        first_order_date: order.order_date,
        last_order_date: order.order_date,
        categories: new Set(),
        countries: new Set(),
        items_purchased: [],
        order_numbers: [],
      });
    }

    const customer = customersMap.get(email);

    // Update with most recent contact info (latest order wins)
    if (order.order_date > customer.last_order_date) {
      customer.last_order_date = order.order_date;
      customer.last_donation_amount = order.order_total;
      // Update contact details with most recent
      if (order.first_name) customer.first_name = order.first_name;
      if (order.last_name) customer.last_name = order.last_name;
      if (order.phone) customer.phone = order.phone;
      if (order.address) customer.address = order.address;
      if (order.city) customer.city = order.city;
      if (order.state) customer.state = order.state;
      if (order.zip) customer.zip = order.zip;
    }

    if (order.order_date < customer.first_order_date) {
      customer.first_order_date = order.order_date;
    }

    customer.total_orders++;
    customer.order_numbers.push(order.order_number);

    if (isSuccessful) {
      customer.total_donated += order.order_total;
      customer.successful_orders++;
      customer.order_count++;
      if (order.order_total > customer.largest_donation) {
        customer.largest_donation = order.order_total;
      }
    }

    // Categorize items
    for (const item of order.items) {
      const cats = categorizeItem(item.name);
      cats.forEach(c => customer.categories.add(c));
      const country = extractCountry(item.name);
      if (country) customer.countries.add(country);
      customer.items_purchased.push(item.name);
    }
  }

  // Convert Sets to Arrays
  const customers = Array.from(customersMap.values()).map(c => ({
    ...c,
    categories: Array.from(c.categories),
    countries: Array.from(c.countries),
    items_purchased: [...new Set(c.items_purchased)], // deduplicate items
  }));

  console.log(`   ${customers.length} unique customers\n`);

  // ─── 4. Stats Summary ───
  const totalRevenue = customers.reduce((sum, c) => sum + c.total_donated, 0);
  const repeatDonors = customers.filter(c => c.order_count > 1).length;

  console.log('📊 Summary');
  console.log('━'.repeat(50));
  console.log(`   Unique customers:  ${customers.length}`);
  console.log(`   Unique orders:     ${orders.length}`);
  console.log(`   Total revenue:     $${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log(`   Repeat donors:     ${repeatDonors}`);
  console.log(`   Single donors:     ${customers.length - repeatDonors}`);
  console.log('');

  // Category breakdown
  const catCounts = {};
  for (const c of customers) {
    for (const cat of c.categories) {
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    }
  }
  console.log('📋 Category Breakdown:');
  Object.entries(catCounts).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`   ${cat}: ${count} donors`);
  });
  console.log('');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN complete — no data written');
    console.log('   Run without --dry-run to import');
    return;
  }

  // ─── 5. Create tables & Import to Supabase ───
  console.log('🗄️  Connecting to database...');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Create tables
  console.log('📋 Creating tables...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS woo_customers (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      phone VARCHAR(50),
      address TEXT,
      city VARCHAR(100),
      state VARCHAR(10),
      zip VARCHAR(20),
      country VARCHAR(10) DEFAULT 'US',
      total_donated DECIMAL(12,2) DEFAULT 0,
      order_count INTEGER DEFAULT 0,
      last_donation_amount DECIMAL(12,2) DEFAULT 0,
      first_order_date TIMESTAMP WITH TIME ZONE,
      last_order_date TIMESTAMP WITH TIME ZONE,
      categories TEXT[] DEFAULT '{}',
      countries TEXT[] DEFAULT '{}',
      items_purchased TEXT[] DEFAULT '{}',
      donor_tier VARCHAR(20) DEFAULT 'bronze',
      ghl_contact_id VARCHAR(100),
      ghl_synced BOOLEAN DEFAULT false,
      ghl_synced_at TIMESTAMP WITH TIME ZONE,
      source VARCHAR(50) DEFAULT 'woocommerce',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS woo_orders (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      order_number VARCHAR(20) NOT NULL,
      email VARCHAR(255) NOT NULL,
      status VARCHAR(50),
      order_date TIMESTAMP WITH TIME ZONE,
      order_total DECIMAL(12,2) DEFAULT 0,
      refund_amount DECIMAL(12,2) DEFAULT 0,
      payment_method VARCHAR(100),
      items JSONB DEFAULT '[]',
      categories TEXT[] DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(order_number)
    );

    CREATE INDEX IF NOT EXISTS idx_woo_customers_email ON woo_customers(email);
    CREATE INDEX IF NOT EXISTS idx_woo_customers_categories ON woo_customers USING GIN(categories);
    CREATE INDEX IF NOT EXISTS idx_woo_customers_donor_tier ON woo_customers(donor_tier);
    CREATE INDEX IF NOT EXISTS idx_woo_orders_email ON woo_orders(email);
    CREATE INDEX IF NOT EXISTS idx_woo_orders_order_number ON woo_orders(order_number);
    CREATE INDEX IF NOT EXISTS idx_woo_orders_order_date ON woo_orders(order_date);
  `);
  console.log('   ✅ Tables created\n');

  // Insert customers
  console.log('👥 Importing customers...');
  let customerInserted = 0;
  let customerSkipped = 0;

  for (const c of customers) {
    let donorTier = 'bronze';
    if (c.total_donated >= 5000) donorTier = 'platinum';
    else if (c.total_donated >= 1000) donorTier = 'gold';
    else if (c.total_donated >= 250) donorTier = 'silver';

    try {
      await client.query(`
        INSERT INTO woo_customers (
          email, first_name, last_name, phone, address, city, state, zip, country,
          total_donated, order_count, last_donation_amount,
          first_order_date, last_order_date, categories, countries,
          items_purchased, donor_tier
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        ON CONFLICT (email) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          phone = COALESCE(EXCLUDED.phone, woo_customers.phone),
          address = COALESCE(EXCLUDED.address, woo_customers.address),
          city = COALESCE(EXCLUDED.city, woo_customers.city),
          state = COALESCE(EXCLUDED.state, woo_customers.state),
          zip = COALESCE(EXCLUDED.zip, woo_customers.zip),
          total_donated = EXCLUDED.total_donated,
          order_count = EXCLUDED.order_count,
          last_donation_amount = EXCLUDED.last_donation_amount,
          first_order_date = EXCLUDED.first_order_date,
          last_order_date = EXCLUDED.last_order_date,
          categories = EXCLUDED.categories,
          countries = EXCLUDED.countries,
          items_purchased = EXCLUDED.items_purchased,
          donor_tier = EXCLUDED.donor_tier,
          updated_at = NOW()
      `, [
        c.email, c.first_name, c.last_name, c.phone || null,
        c.address || null, c.city || null, c.state || null, c.zip || null,
        c.country || 'US',
        c.total_donated, c.order_count, c.last_donation_amount,
        c.first_order_date ? new Date(c.first_order_date) : null,
        c.last_order_date ? new Date(c.last_order_date) : null,
        c.categories, c.countries, c.items_purchased, donorTier,
      ]);
      customerInserted++;
    } catch (err) {
      console.error(`   ⚠️  Error inserting ${c.email}:`, err.message);
      customerSkipped++;
    }
  }
  console.log(`   ✅ ${customerInserted} customers imported (${customerSkipped} skipped)\n`);

  // Insert orders
  console.log('📦 Importing orders...');
  let orderInserted = 0;
  let orderSkipped = 0;

  for (const o of orders) {
    if (!o.email || !o.email.includes('@')) {
      orderSkipped++;
      continue;
    }

    const orderCategories = new Set();
    for (const item of o.items) {
      categorizeItem(item.name).forEach(c => orderCategories.add(c));
    }

    try {
      await client.query(`
        INSERT INTO woo_orders (
          order_number, email, status, order_date, order_total,
          refund_amount, payment_method, items, categories
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (order_number) DO UPDATE SET
          status = EXCLUDED.status,
          order_total = EXCLUDED.order_total,
          refund_amount = EXCLUDED.refund_amount,
          items = EXCLUDED.items,
          categories = EXCLUDED.categories
      `, [
        o.order_number, o.email, o.status,
        o.order_date ? new Date(o.order_date) : null,
        o.order_total, o.refund_amount, o.payment_method,
        JSON.stringify(o.items), Array.from(orderCategories),
      ]);
      orderInserted++;
    } catch (err) {
      console.error(`   ⚠️  Error inserting order ${o.order_number}:`, err.message);
      orderSkipped++;
    }
  }
  console.log(`   ✅ ${orderInserted} orders imported (${orderSkipped} skipped)\n`);

  await client.end();

  // ─── 6. GHL Sync ───
  if (SYNC_GHL) {
    console.log('📡 Syncing to GoHighLevel...');
    console.log(`   ${customers.length} customers to sync`);
    console.log('   Using structured tags: source:, migration:, donor:, campaign:, tier:\n');

    const ghlDb = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await ghlDb.connect();

    let ghlSuccess = 0;
    let ghlFailed = 0;

    for (let i = 0; i < customers.length; i++) {
      const c = customers[i];
      const result = await syncCustomerToGHL(c);

      if (result.success) {
        ghlSuccess++;
        // Update Supabase with GHL contact ID
        if (result.contactId) {
          await ghlDb.query(
            'UPDATE woo_customers SET ghl_contact_id = $1, ghl_synced = true, ghl_synced_at = NOW() WHERE email = $2',
            [result.contactId, c.email]
          );
        }
      } else {
        ghlFailed++;
        if (ghlFailed <= 10) console.error(`   ⚠️  ${c.email}: ${result.error}`);
      }

      // Progress
      if ((i + 1) % 50 === 0) {
        console.log(`   Progress: ${i + 1}/${customers.length} (✅ ${ghlSuccess} | ❌ ${ghlFailed})`);
      }

      // Rate limit — ~3 req/sec (search + upsert = 2 calls per customer)
      await new Promise(r => setTimeout(r, GHL_RATE_LIMIT_MS));
    }

    await ghlDb.end();
    console.log(`\n   ✅ GHL sync complete: ${ghlSuccess} synced, ${ghlFailed} failed\n`);
  }

  console.log('━'.repeat(50));
  console.log('🎉 Import complete!');
  console.log(`   Customers: ${customerInserted}`);
  console.log(`   Orders:    ${orderInserted}`);
  if (SYNC_GHL) console.log('   GHL:       synced');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
