import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

/**
 * Debug endpoint to check template settings
 * GET /api/debug/templates
 */
export const GET: APIRoute = async () => {
  try {
    // Get site settings
    const { data: siteSettings, error: settingsError } = await supabaseAdmin
      .from('site_settings')
      .select('*')
      .limit(1);

    // Get first 5 campaigns with their templates
    const { data: campaigns, error: campaignsError } = await supabaseAdmin
      .from('campaigns')
      .select('id, slug, title, name, page_template, donation_box_template')
      .limit(5);

    return new Response(JSON.stringify({
      site_settings: siteSettings?.[0] || null,
      settings_error: settingsError?.message || null,
      sample_campaigns: campaigns || [],
      campaigns_error: campaignsError?.message || null,
      analysis: {
        has_site_settings: !!(siteSettings && siteSettings.length > 0),
        default_page_template: siteSettings?.[0]?.default_campaign_page_template || 'NOT SET',
        default_donation_template: siteSettings?.[0]?.default_donation_box_template || 'NOT SET',
        campaigns_with_override: campaigns?.filter(c => c.page_template || c.donation_box_template).length || 0,
        campaigns_using_default: campaigns?.filter(c => !c.page_template && !c.donation_box_template).length || 0,
      }
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
