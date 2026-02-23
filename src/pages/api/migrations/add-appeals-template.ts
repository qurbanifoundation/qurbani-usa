import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

/**
 * Run migration to add appeals page template column
 * POST /api/migrations/add-appeals-template
 */
export const POST: APIRoute = async () => {
  try {
    // Add the column to site_settings
    const { error: alterError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS default_appeals_page_template TEXT DEFAULT 'green';`
    });

    // If RPC doesn't exist, try direct approach
    if (alterError) {
      // Try updating site_settings with the new field - this will work if column exists
      // or we can check/create via a different method
      const { data: existing } = await supabaseAdmin
        .from('site_settings')
        .select('*')
        .limit(1);

      if (existing && existing.length > 0) {
        // Try to update with the new column - will fail gracefully if column doesn't exist
        const { error: updateError } = await supabaseAdmin
          .from('site_settings')
          .update({ default_appeals_page_template: 'green' })
          .eq('id', existing[0].id);

        if (updateError && updateError.message.includes('default_appeals_page_template')) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Column does not exist. Please run this SQL in Supabase Dashboard:\n\nALTER TABLE site_settings ADD COLUMN default_appeals_page_template TEXT DEFAULT \'green\';',
            manual_sql_required: true
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }

    // Try to insert template options
    const { error: insertError } = await supabaseAdmin
      .from('template_options')
      .upsert([
        { template_type: 'appeals_page', template_key: 'green', template_label: 'Green (Teal)', description: 'Teal/blue color scheme with orange accents', is_active: true, sort_order: 1 },
        { template_type: 'appeals_page', template_key: 'orange', template_label: 'Orange', description: 'Orange color scheme - warm and inviting', is_active: true, sort_order: 2 },
      ], { onConflict: 'template_type,template_key', ignoreDuplicates: true });

    return new Response(JSON.stringify({
      success: true,
      message: 'Migration completed successfully',
      template_options_error: insertError?.message || null
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
