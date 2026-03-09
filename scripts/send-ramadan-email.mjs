#!/usr/bin/env node

/**
 * Ramadan/Zakat Reactivation Campaign — 3-Email Drip via GHL Conversations API
 *
 * Usage:
 *   node scripts/send-ramadan-email.mjs --test hhk800@gmail.com           # Send ALL 3 emails to test address
 *   node scripts/send-ramadan-email.mjs --test hhk800@gmail.com --email 1 # Send only Email 1
 *   node scripts/send-ramadan-email.mjs --test hhk800@gmail.com --email 2 # Send only Email 2
 *   node scripts/send-ramadan-email.mjs --test hhk800@gmail.com --email 3 # Send only Email 3
 *   node scripts/send-ramadan-email.mjs --dry-run                         # Show who would receive
 *   node scripts/send-ramadan-email.mjs --dry-run --stats                 # Show segment breakdown
 *   node scripts/send-ramadan-email.mjs --send --email 1 --batch 1        # Send Email 1, batch 1 (first 250)
 *   node scripts/send-ramadan-email.mjs --send --email 1 --batch 2        # Send Email 1, batch 2 (next 400)
 *   node scripts/send-ramadan-email.mjs --send --email 1 --batch 3        # Send Email 1, batch 3 (remainder)
 *   node scripts/send-ramadan-email.mjs --send --email 2 --batch all      # Send Email 2 to all
 *
 * Segments (auto-detected from donor_tier):
 *   Major donors: tier:platinum or tier:gold (lifetime >= $1K)
 *   Regular donors: tier:silver (lifetime >= $250, repeat donors)
 *   One-time/inactive: tier:bronze (< $250 or single donation)
 *
 * Batch sizes (for deliverability):
 *   Batch 1: first 250 contacts (highest value first)
 *   Batch 2: next 400 contacts
 *   Batch 3: remainder
 *
 * Environment: Reads from .env (GHL_API_KEY, GHL_LOCATION_ID, SUPABASE)
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
const GHL_BASE_URL = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!GHL_API_KEY || !GHL_LOCATION_ID) {
  console.error('❌ Missing GHL_API_KEY or GHL_LOCATION_ID in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================
// EMAIL CONFIGS
// ============================================

const EMAILS = {
  1: {
    subject: 'A reminder about Zakat during Ramadan',
    file: 'emails/ramadan-email-1.html',
    majorFile: 'emails/ramadan-email-1-major.html',
  },
  2: {
    subject: 'Ramadan is a beautiful time to give Zakat',
    file: 'emails/ramadan-email-2.html',
  },
  3: {
    subject: 'Fulfill your Zakat during the blessed days of Ramadan',
    file: 'emails/ramadan-email-3.html',
  },
};

// Batch sizes for deliverability protection
const BATCH_SIZES = { 1: 250, 2: 400, 3: Infinity };

// ============================================
// GHL API HELPERS
// ============================================

async function ghlFetch(endpoint, options = {}) {
  const res = await fetch(`${GHL_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${GHL_API_KEY}`,
      'Version': GHL_API_VERSION,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return res;
}

async function findContactByEmail(email) {
  const res = await ghlFetch(
    `/contacts/search/duplicate?locationId=${GHL_LOCATION_ID}&email=${encodeURIComponent(email)}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.contact || null;
}

async function createContact(email, firstName, lastName) {
  const res = await ghlFetch('/contacts/', {
    method: 'POST',
    body: JSON.stringify({
      email,
      firstName: firstName || '',
      lastName: lastName || '',
      locationId: GHL_LOCATION_ID,
      source: 'Ramadan Campaign Test',
      tags: ['ramadan-2026', 'test-email'],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('Create contact failed:', err);
    return null;
  }
  const data = await res.json();
  return data.contact || null;
}

async function sendEmailViaGHL(contactId, subject, htmlContent) {
  const res = await ghlFetch('/conversations/messages', {
    method: 'POST',
    body: JSON.stringify({
      type: 'Email',
      contactId,
      subject,
      html: htmlContent,
      emailFrom: `Qurbani Foundation USA <donorcare@us.qurbani.com>`,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return { success: false, error: errText, status: res.status };
  }

  const data = await res.json();
  return { success: true, data };
}

async function addTagToContact(contactId, tags) {
  await ghlFetch(`/contacts/${contactId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tags }),
  });
}

// ============================================
// SEGMENT HELPERS
// ============================================

function getSegment(customer) {
  const tier = customer.donor_tier || 'bronze';
  if (tier === 'platinum' || tier === 'gold') return 'major';
  if (tier === 'silver') return 'regular';
  return 'one-time';
}

function isMajorDonor(customer) {
  return getSegment(customer) === 'major';
}

// ============================================
// FETCH RECIPIENTS
// ============================================

async function fetchRecipients() {
  const { data: customers, error } = await supabase
    .from('woo_customers')
    .select('email, first_name, last_name, ghl_contact_id, donor_tier, total_donated, order_count')
    .eq('ghl_synced', true)
    .not('ghl_contact_id', 'is', null)
    .order('total_donated', { ascending: false });

  if (error) {
    console.error('❌ Failed to fetch customers:', error.message);
    process.exit(1);
  }

  return customers;
}

// ============================================
// MAIN
// ============================================

async function main() {
  const args = process.argv.slice(2);

  const isTest = args.includes('--test');
  const isSend = args.includes('--send');
  const isDryRun = args.includes('--dry-run');
  const showStats = args.includes('--stats');

  const emailNumIdx = args.indexOf('--email');
  const emailNum = emailNumIdx !== -1 ? parseInt(args[emailNumIdx + 1]) : null;

  const batchIdx = args.indexOf('--batch');
  const batchArg = batchIdx !== -1 ? args[batchIdx + 1] : null;

  const testEmail = isTest ? args[args.indexOf('--test') + 1] : null;

  // ---- HELP ----
  if (!isTest && !isSend && !isDryRun) {
    console.log(`
📧 Ramadan/Zakat Reactivation Campaign (3-Email Drip)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TEST MODE:
  --test <email>                     Send ALL 3 emails to test address
  --test <email> --email 1           Send only Email 1 to test
  --test <email> --email 2           Send only Email 2 to test
  --test <email> --email 3           Send only Email 3 to test

DRY RUN:
  --dry-run                          Show all recipients
  --dry-run --stats                  Show segment & batch breakdown

LIVE SEND (per email, per batch):
  --send --email 1 --batch 1         Email 1, batch 1 (first 250)
  --send --email 1 --batch 2         Email 1, batch 2 (next 400)
  --send --email 1 --batch 3         Email 1, batch 3 (remainder)
  --send --email 2 --batch all       Email 2, all contacts
  --send --email 3 --batch all       Email 3, all contacts

SCHEDULE:
  Email 1: Send immediately
  Email 2: Send 3-4 days after Email 1
  Email 3: Send 2-3 days after Email 2
    `);
    process.exit(0);
  }

  // ---- TEST MODE ----
  if (isTest) {
    if (!testEmail) {
      console.error('❌ Please provide an email: --test your@email.com');
      process.exit(1);
    }

    // Find or create contact in GHL
    let contact = await findContactByEmail(testEmail);
    if (!contact) {
      console.log('  Contact not found in GHL, creating...');
      contact = await createContact(testEmail, 'Hasnain', 'Khan');
      if (!contact) {
        console.error('❌ Failed to create contact in GHL');
        process.exit(1);
      }
    }
    console.log(`  Found contact: ${contact.id} (${contact.firstName || ''} ${contact.lastName || ''})\n`);

    const emailsToSend = emailNum ? [emailNum] : [1, 2, 3];

    for (const num of emailsToSend) {
      const config = EMAILS[num];
      if (!config) {
        console.error(`❌ Invalid email number: ${num}`);
        continue;
      }

      // For Email 1, use major donor variant (since user is a major donor / test)
      const filePath = num === 1 && config.majorFile ? config.majorFile : config.file;
      const html = readFileSync(filePath, 'utf8');

      console.log(`📧 Email ${num}: "${config.subject}"`);
      console.log(`   Template: ${filePath}`);

      const result = await sendEmailViaGHL(contact.id, config.subject, html);

      if (result.success) {
        console.log(`   ✅ Sent! Message ID: ${result.data?.messageId || result.data?.id || 'N/A'}`);
      } else {
        console.log(`   ❌ Failed: ${result.error}`);
      }

      // Small delay between emails
      if (emailsToSend.length > 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    console.log(`\n📬 Check inbox at: ${testEmail}`);
    return;
  }

  // ---- DRY RUN ----
  if (isDryRun) {
    const customers = await fetchRecipients();

    if (showStats) {
      // Segment breakdown
      const segments = { major: [], regular: [], 'one-time': [] };
      customers.forEach(c => segments[getSegment(c)].push(c));

      console.log(`\n📊 Campaign Stats`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Total recipients: ${customers.length}`);
      console.log(`\nSegments:`);
      console.log(`  🏆 Major donors (Platinum/Gold, ≥$1K): ${segments.major.length}`);
      console.log(`  🥈 Regular donors (Silver, ≥$250): ${segments.regular.length}`);
      console.log(`  🥉 One-time/inactive (Bronze, <$250): ${segments['one-time'].length}`);

      console.log(`\nBatch breakdown:`);
      console.log(`  Batch 1 (first 250): contacts 1-${Math.min(250, customers.length)}`);
      if (customers.length > 250) {
        console.log(`  Batch 2 (next 400): contacts 251-${Math.min(650, customers.length)}`);
      }
      if (customers.length > 650) {
        console.log(`  Batch 3 (remainder): contacts 651-${customers.length}`);
      }

      console.log(`\nTop 10 Major Donors:`);
      segments.major.slice(0, 10).forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.first_name} ${c.last_name} <${c.email}> — $${c.total_donated} (${c.order_count} orders)`);
      });
    } else {
      console.log(`\n📋 All ${customers.length} Recipients:`);
      customers.forEach((c, i) => {
        const seg = getSegment(c);
        const icon = seg === 'major' ? '🏆' : seg === 'regular' ? '🥈' : '🥉';
        console.log(`  ${i + 1}. ${icon} ${c.first_name} ${c.last_name} <${c.email}> — ${c.donor_tier} ($${c.total_donated})`);
      });
    }

    return;
  }

  // ---- LIVE SEND ----
  if (isSend) {
    if (!emailNum || !EMAILS[emailNum]) {
      console.error('❌ Specify which email: --email 1, --email 2, or --email 3');
      process.exit(1);
    }
    if (!batchArg) {
      console.error('❌ Specify batch: --batch 1, --batch 2, --batch 3, or --batch all');
      process.exit(1);
    }

    const config = EMAILS[emailNum];
    const customers = await fetchRecipients();

    // Determine batch slice
    let batchCustomers;
    let batchLabel;

    if (batchArg === 'all') {
      batchCustomers = customers;
      batchLabel = `ALL (${customers.length})`;
    } else {
      const batchNum = parseInt(batchArg);
      if (batchNum === 1) {
        batchCustomers = customers.slice(0, 250);
        batchLabel = `Batch 1 (1-${Math.min(250, customers.length)})`;
      } else if (batchNum === 2) {
        batchCustomers = customers.slice(250, 650);
        batchLabel = `Batch 2 (251-${Math.min(650, customers.length)})`;
      } else if (batchNum === 3) {
        batchCustomers = customers.slice(650);
        batchLabel = `Batch 3 (651-${customers.length})`;
      } else {
        console.error('❌ Invalid batch: use 1, 2, 3, or all');
        process.exit(1);
      }
    }

    if (batchCustomers.length === 0) {
      console.log('ℹ️  No contacts in this batch range.');
      process.exit(0);
    }

    console.log(`\n📧 SENDING Email ${emailNum}: "${config.subject}"`);
    console.log(`   ${batchLabel} — ${batchCustomers.length} contacts`);
    console.log(`   From: Qurbani Foundation USA <donorcare@us.qurbani.com>`);
    console.log(`\n   ⚠️  Press Ctrl+C within 5 seconds to cancel...`);

    await new Promise(r => setTimeout(r, 5000));

    let sent = 0;
    let failed = 0;
    const failedEmails = [];

    for (const customer of batchCustomers) {
      // Use major donor variant for Email 1 if applicable
      let filePath = config.file;
      if (emailNum === 1 && config.majorFile && isMajorDonor(customer)) {
        filePath = config.majorFile;
      }

      const html = readFileSync(filePath, 'utf8');

      try {
        const result = await sendEmailViaGHL(customer.ghl_contact_id, config.subject, html);

        if (result.success) {
          sent++;
          // Tag contact for tracking
          await addTagToContact(customer.ghl_contact_id, [`ramadan-2026`, `email${emailNum}-sent`]);
          process.stdout.write(`\r   ✅ ${sent}/${batchCustomers.length} sent | ❌ ${failed} failed`);
        } else {
          failed++;
          failedEmails.push({ email: customer.email, error: result.error?.substring(0, 100) });
        }
      } catch (err) {
        failed++;
        failedEmails.push({ email: customer.email, error: err.message });
      }

      // Rate limiting — 400ms between sends (~2.5/sec)
      await new Promise(r => setTimeout(r, 400));
    }

    console.log(`\n\n📊 Email ${emailNum} — ${batchLabel} Complete:`);
    console.log(`   ✅ Sent: ${sent}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📧 Total: ${batchCustomers.length}`);

    if (failedEmails.length > 0) {
      console.log(`\n   Failed recipients:`);
      failedEmails.forEach(f => console.log(`     - ${f.email}: ${f.error}`));
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
