import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

// Use service role for admin operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export const GET: APIRoute = async () => {
  try {
    // Check if table exists by querying it
    const { data, error } = await supabaseAdmin
      .from('site_settings')
      .select('id')
      .eq('id', 'main')
      .single();

    if (error && error.code === 'PGRST116') {
      // Table doesn't exist
      return new Response(JSON.stringify({
        success: false,
        error: 'Table does not exist',
        message: 'Please create the site_settings table in your Supabase dashboard SQL Editor',
        sql: `
CREATE TABLE site_settings (
  id TEXT PRIMARY KEY DEFAULT 'main',
  site_name TEXT DEFAULT 'Qurbani Foundation USA',
  site_tagline TEXT DEFAULT 'A Muslim Charity Serving Humanity',
  site_logo TEXT DEFAULT 'https://www.staging9.qurbani.com/wp-content/uploads/2021/07/QurbaniFoundation-Logo-2.png',
  contact_phone TEXT DEFAULT '+1 (703) 596-4900',
  contact_toll_free TEXT DEFAULT '1-800-900-0027',
  contact_email TEXT DEFAULT 'info@qurbani.com',
  contact_address_street TEXT DEFAULT '145 Sherwood Ave',
  contact_address_city TEXT DEFAULT 'Teaneck',
  contact_address_state TEXT DEFAULT 'NJ',
  contact_address_zip TEXT DEFAULT '07666',
  social_facebook TEXT DEFAULT 'https://facebook.com/qurbani',
  social_youtube TEXT DEFAULT 'https://youtube.com/qurbani',
  social_instagram TEXT DEFAULT 'https://instagram.com/qurbani',
  social_twitter TEXT DEFAULT 'https://twitter.com/qurbani',
  footer_about TEXT DEFAULT 'A Muslim charity dedicated to alleviating suffering.',
  footer_zakat_policy TEXT DEFAULT '100% Zakat Policy',
  footer_ein TEXT DEFAULT '38-4109716',
  footer_copyright TEXT DEFAULT 'Qurbani Foundation USA. All rights reserved.',
  donate_button_text TEXT DEFAULT 'DONATE NOW',
  donate_button_href TEXT DEFAULT '/donate',
  donate_button_color TEXT DEFAULT '#fdc448',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO site_settings (id) VALUES ('main');

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON site_settings FOR ALL USING (true) WITH CHECK (true);
        `.trim()
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (data) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Database is ready! site_settings table exists.',
        data
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Table exists but no main row - create it
    const { data: insertData, error: insertError } = await supabaseAdmin
      .from('site_settings')
      .insert({ id: 'main' })
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({
        success: false,
        error: insertError.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Default settings created!',
      data: insertData
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
