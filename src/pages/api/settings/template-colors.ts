import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { clearSettingsCache } from '../../../lib/settings';

export const prerender = false;

// Get colors for a specific template or all templates
export const GET: APIRoute = async ({ url }) => {
  try {
    const templateName = url.searchParams.get('template');

    if (templateName) {
      // Get specific template colors
      const { data, error } = await supabaseAdmin
        .from('template_colors')
        .select('*')
        .eq('template_name', templateName)
        .single();

      // Get defaults for this template
      const defaults = getDefaultColors(templateName);

      if (error || !data) {
        // Return defaults if not found
        return new Response(JSON.stringify(defaults), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Merge database data with defaults (db values override defaults, but use defaults for nulls)
      const merged = { ...defaults };
      Object.keys(data).forEach(key => {
        if (data[key] !== null && data[key] !== undefined) {
          merged[key] = data[key];
        }
      });

      return new Response(JSON.stringify(merged), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      // Get all template colors
      const { data, error } = await supabaseAdmin
        .from('template_colors')
        .select('*');

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(data || []), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// Update template colors
export const PUT: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { template_name, ...colors } = data;

    if (!template_name) {
      return new Response(JSON.stringify({ error: 'template_name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Upsert the template colors
    const { error } = await supabaseAdmin
      .from('template_colors')
      .upsert({
        template_name,
        ...colors,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'template_name'
      });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Clear settings cache so color changes appear immediately
    clearSettingsCache();

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

// Delete a template
export const DELETE: APIRoute = async ({ url }) => {
  try {
    const templateName = url.searchParams.get('template');

    if (!templateName) {
      return new Response(JSON.stringify({ error: 'template parameter is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Prevent deletion of built-in templates
    const builtInTemplates = ['teal-yellow', 'dark-teal', 'white', 'compact', 'list-style', 'urgent-appeal'];
    if (builtInTemplates.includes(templateName)) {
      return new Response(JSON.stringify({ error: 'Cannot delete built-in templates' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { error } = await supabaseAdmin
      .from('template_colors')
      .delete()
      .eq('template_name', templateName);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Clear settings cache so deletion is reflected immediately
    clearSettingsCache();

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

// Default settings for each template (colors, text, sizes)
// Note: {campaign} placeholder in title_text will be replaced with the actual campaign name on the frontend
function getDefaultColors(templateName: string) {
  // Common text and size defaults
  const textDefaults = {
    title_text: '{campaign}',
    subtitle_text: '100% reaches those in need',
    button_text: 'Donate Now',
    single_text: 'Single',
    monthly_text: 'Monthly',
    custom_amount_placeholder: 'Any Amount',
    subtitle_size: 'text-sm',
    title_size: 'text-xl',
    button_size: 'text-lg',
    amount_size: 'text-sm',
    trust_message_text: 'Donating through Qurbani Foundation is safe, secure, and easy with many payment options to choose from.',
    trust_link_text: 'View other ways to donate',
    trust_link_url: '/donate',
    default_amounts: [
      { amount: 30, label: 'support for local, vetted nonprofit organizations worldwide' },
      { amount: 50, label: 'support for local, vetted nonprofit organizations worldwide' },
      { amount: 80, label: 'support for local, vetted nonprofit organizations worldwide' },
      { amount: 100, label: 'support for local, vetted nonprofit organizations worldwide' },
      { amount: 250, label: 'support for local, vetted nonprofit organizations worldwide' },
      { amount: 1000, label: 'support for local, vetted nonprofit organizations worldwide' },
    ],
  };

  const defaults: Record<string, any> = {
    'teal-yellow': {
      template_name: 'teal-yellow',
      bg_color: '#255764',
      text_color: '#ffffff',
      text_muted_color: 'rgba(255,255,255,0.7)',
      accent_color: '#fdc448',
      accent_text_color: '#61470e',
      border_color: 'rgba(255,255,255,0.3)',
      active_bg_color: 'rgba(253,196,72,0.2)',
      active_text_color: '#ffffff',
      inactive_btn_bg: 'transparent',
      toggle_active_color: 'rgba(255,255,255,0.2)',
      ...textDefaults,
    },
    'dark-teal': {
      template_name: 'dark-teal',
      bg_color: '#004139',
      text_color: '#ffffff',
      text_muted_color: '#d4c4a8',
      accent_color: '#c41e3a',
      accent_text_color: '#ffffff',
      border_color: '#108D70',
      active_bg_color: '#ECF0EE',
      active_text_color: '#004139',
      inactive_btn_bg: '#005A4C',
      toggle_active_color: '#108D70',
      ...textDefaults,
    },
    'white': {
      template_name: 'white',
      bg_color: '#ffffff',
      text_color: '#1f2937',
      text_muted_color: '#6b7280',
      accent_color: '#01534d',
      accent_text_color: '#ffffff',
      border_color: '#01534d',
      active_bg_color: '#01534d',
      active_text_color: '#ffffff',
      inactive_btn_bg: 'transparent',
      toggle_active_color: '#01534d',
      ...textDefaults,
    },
    'compact': {
      template_name: 'compact',
      bg_color: '#1a4a55',
      text_color: '#ffffff',
      text_muted_color: 'rgba(255,255,255,0.7)',
      accent_color: '#fdc448',
      accent_text_color: '#61470e',
      border_color: 'rgba(255,255,255,0.3)',
      active_bg_color: 'rgba(253,196,72,0.2)',
      active_text_color: '#ffffff',
      inactive_btn_bg: 'transparent',
      toggle_active_color: 'rgba(255,255,255,0.2)',
      ...textDefaults,
    },
    'list-style': {
      template_name: 'list-style',
      bg_color: '#f5f5f5',
      text_color: '#374151',
      text_muted_color: '#6b7280',
      accent_color: '#D97706',
      accent_text_color: '#ffffff',
      border_color: '#e5e7eb',
      active_bg_color: '#D97706',
      active_text_color: '#ffffff',
      inactive_btn_bg: '#ffffff',
      toggle_active_color: '#D97706',
      ...textDefaults,
      button_text: 'DONATE NOW',
      single_text: 'Donate once',
      monthly_text: 'Donate monthly',
    },
    'urgent-appeal': {
      template_name: 'urgent-appeal',
      bg_color: '#ffffff',
      header_bg_color: '#c41e3a',
      text_color: '#1f2937',
      text_muted_color: '#6b7280',
      accent_color: '#c41e3a',
      accent_text_color: '#ffffff',
      border_color: '#e5e7eb',
      active_bg_color: 'rgba(196,30,58,0.1)',
      active_text_color: '#1f2937',
      inactive_btn_bg: '#ffffff',
      toggle_active_color: '#c41e3a',
      ...textDefaults,
      subtitle_text: 'Your donation saves lives',
      button_text: 'Donate Now',
      single_text: 'One-Time',
      monthly_text: 'Monthly',
    },
  };

  return defaults[templateName] || defaults['teal-yellow'];
}
