import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { campaigns } = await request.json();

    if (!campaigns || !Array.isArray(campaigns) || campaigns.length === 0) {
      return new Response(JSON.stringify({ error: 'Campaigns array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const results: { slug: string; success: boolean; error?: string }[] = [];

    for (const campaign of campaigns) {
      // Remove sourceUrl before saving
      const { sourceUrl, ...campaignData } = campaign;

      // Ensure required fields
      if (!campaignData.name || !campaignData.slug) {
        results.push({ slug: campaign.slug || 'unknown', success: false, error: 'Missing name or slug' });
        continue;
      }

      try {
        // Check if campaign exists
        const { data: existing } = await supabaseAdmin
          .from('campaigns')
          .select('id')
          .eq('slug', campaignData.slug)
          .single();

        if (existing) {
          // Update existing
          const { error } = await supabaseAdmin
            .from('campaigns')
            .update({
              ...campaignData,
              updated_at: new Date().toISOString()
            })
            .eq('slug', campaignData.slug);

          if (error) throw error;
          results.push({ slug: campaignData.slug, success: true });
        } else {
          // Insert new
          const { error } = await supabaseAdmin
            .from('campaigns')
            .insert({
              ...campaignData,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (error) throw error;
          results.push({ slug: campaignData.slug, success: true });
        }
      } catch (err: any) {
        results.push({ slug: campaignData.slug, success: false, error: err.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return new Response(JSON.stringify({
      success: true,
      message: `Saved ${successCount} campaigns${failCount > 0 ? `, ${failCount} failed` : ''}`,
      results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Save error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to save campaigns' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
