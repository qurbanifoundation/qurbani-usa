import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { clearNavbarCache } from '../../../lib/menus';
import { clearSettingsCache } from '../../../lib/settings';

export const prerender = false;

/**
 * Clear all campaign-specific templates so they use site defaults
 * POST /api/campaigns/clear-templates
 */
export const POST: APIRoute = async () => {
  try {
    // First get all campaign IDs
    const { data: campaigns, error: fetchError } = await supabaseAdmin
      .from('campaigns')
      .select('id');

    if (fetchError) throw fetchError;

    if (!campaigns || campaigns.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No campaigns found'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const ids = campaigns.map(c => c.id);

    // Update all campaigns to use null (site defaults)
    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .update({
        page_template: null,
        donation_box_template: null,
        updated_at: new Date().toISOString()
      })
      .in('id', ids)
      .select('id');

    if (error) throw error;

    // Clear caches so template changes appear immediately
    clearNavbarCache();
    clearSettingsCache();

    return new Response(JSON.stringify({
      success: true,
      message: `Cleared templates for ${data?.length || 0} campaigns`,
      count: data?.length || 0
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Clear templates error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
