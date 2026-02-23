/**
 * Update Site Settings - Fix email and URLs
 */

import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Client } = pg;

async function updateSettings() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Update settings
    const updateQuery = `
      UPDATE site_settings
      SET
        contact_email = 'info@qurbani.com',
        social_facebook = 'https://facebook.com/qurbani',
        social_youtube = 'https://youtube.com/qurbani',
        social_instagram = 'https://instagram.com/qurbani',
        social_twitter = 'https://twitter.com/qurbani',
        footer_copyright = 'Qurbani Foundation USA. All rights reserved.'
      WHERE id = 'main';
    `;

    const result = await client.query(updateQuery);
    console.log('✅ Settings updated successfully!');
    console.log(`   Rows affected: ${result.rowCount}`);

    // Verify the update
    const verifyQuery = `SELECT contact_email, footer_copyright FROM site_settings WHERE id = 'main';`;
    const verifyResult = await client.query(verifyQuery);

    if (verifyResult.rows.length > 0) {
      console.log('\n📧 Current email:', verifyResult.rows[0].contact_email);
      console.log('📝 Current copyright:', verifyResult.rows[0].footer_copyright);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

updateSettings();
