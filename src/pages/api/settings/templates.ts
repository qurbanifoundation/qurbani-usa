import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { clearSettingsCache } from '../../../lib/settings';
import { clearNavbarCache } from '../../../lib/menus';

export const prerender = false;

export const PUT: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();

    // Build update object - only include fields that are provided
    const updateData: Record<string, any> = {};
    if (data.default_donation_box_template !== undefined) {
      updateData.default_donation_box_template = data.default_donation_box_template;
    }
    if (data.default_campaign_page_template !== undefined) {
      updateData.default_campaign_page_template = data.default_campaign_page_template;
    }
    if (data.default_appeals_page_template !== undefined) {
      updateData.default_appeals_page_template = data.default_appeals_page_template;
    }
    if (data.orphan_sponsorship_template !== undefined) {
      updateData.orphan_sponsorship_template = data.orphan_sponsorship_template;
    }
    if (data.homepage_template !== undefined) {
      updateData.homepage_template = data.homepage_template;
    }
    if (data.ramadan_page_template !== undefined) {
      updateData.ramadan_page_template = data.ramadan_page_template;
    }
    if (data.checkout_template !== undefined) {
      updateData.checkout_template = data.checkout_template;
    }

    // Get existing row first
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('site_settings')
      .select('*')
      .limit(1);

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (existing && existing.length > 0) {
      // Update existing row - use the first row's id
      const rowId = existing[0].id;
      const { error } = await supabaseAdmin
        .from('site_settings')
        .update(updateData)
        .eq('id', rowId);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else {
      // No row exists - create one
      const { error } = await supabaseAdmin
        .from('site_settings')
        .insert({
          default_donation_box_template: data.default_donation_box_template || 'teal-yellow',
          default_campaign_page_template: data.default_campaign_page_template || 'green-with-yellow',
          default_appeals_page_template: data.default_appeals_page_template || 'green',
          orphan_sponsorship_template: data.orphan_sponsorship_template || 'orphan-sponsorship',
          homepage_template: data.homepage_template || 'pennybill',
          ramadan_page_template: data.ramadan_page_template || 'pennyappeal',
          checkout_template: data.checkout_template || 'three-step',
        });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Clear caches so template changes appear immediately
    clearSettingsCache();
    clearNavbarCache();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const GET: APIRoute = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('site_settings')
      .select('default_donation_box_template, default_campaign_page_template, default_appeals_page_template, orphan_sponsorship_template, homepage_template, ramadan_page_template, checkout_template')
      .limit(1)
      .single();

    // If no row exists, return defaults
    if (error || !data) {
      return new Response(JSON.stringify({
        default_donation_box_template: 'teal-yellow',
        default_campaign_page_template: 'green-with-yellow',
        default_appeals_page_template: 'green',
        orphan_sponsorship_template: 'orphan-sponsorship',
        homepage_template: 'pennybill',
        ramadan_page_template: 'pennyappeal',
        checkout_template: 'three-step',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      default_donation_box_template: data.default_donation_box_template || 'teal-yellow',
      default_campaign_page_template: data.default_campaign_page_template || 'green-with-yellow',
      default_appeals_page_template: data.default_appeals_page_template || 'green',
      orphan_sponsorship_template: data.orphan_sponsorship_template || 'orphan-sponsorship',
      homepage_template: data.homepage_template || 'pennybill',
      ramadan_page_template: data.ramadan_page_template || 'pennyappeal',
      checkout_template: data.checkout_template || 'three-step',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    // Return defaults on error
    return new Response(JSON.stringify({
      default_donation_box_template: 'teal-yellow',
      default_campaign_page_template: 'green-with-yellow',
      default_appeals_page_template: 'green',
      orphan_sponsorship_template: 'orphan-sponsorship',
      homepage_template: 'pennybill',
      ramadan_page_template: 'pennyappeal',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
