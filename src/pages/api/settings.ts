import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase';
import { clearSettingsCache } from '../../lib/settings';

// Required for Cloudflare adapter
export const prerender = false;

// Fields that should NEVER be returned in API responses
const SENSITIVE_FIELDS = [
  'stripe_secret_key',
  'stripe_webhook_secret',
];

// GET - Read settings from Supabase (strips sensitive fields)
export const GET: APIRoute = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('site_settings')
      .select('*')
      .eq('id', 'main')
      .single();

    if (error) {
      console.error('Supabase GET error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Strip sensitive fields before returning
    if (data) {
      for (const field of SENSITIVE_FIELDS) {
        if (field in data) {
          (data as Record<string, unknown>)[field] = data[field as keyof typeof data] ? '***configured***' : null;
        }
      }
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('GET error:', error);
    return new Response(JSON.stringify({ error: 'Failed to read settings' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// POST - Update settings in Supabase
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    // Map form fields to database columns
    const updateData: Record<string, any> = {};

    if (body.siteName) updateData.site_name = body.siteName;
    if (body.tagline) updateData.site_tagline = body.tagline;
    if (body.logo) updateData.site_logo = body.logo;
    if ('footerLogo' in body) updateData.footer_logo = body.footerLogo || '';
    if (body.favicon) updateData.site_favicon = body.favicon;

    if (body.phone) updateData.contact_phone = body.phone;
    if (body.tollFree) updateData.contact_toll_free = body.tollFree;
    if (body.email) updateData.contact_email = body.email;

    if (body.street) updateData.contact_address_street = body.street;
    if (body.city) updateData.contact_address_city = body.city;
    if (body.state) updateData.contact_address_state = body.state;
    if (body.zip) updateData.contact_address_zip = body.zip;

    if (body.facebook) updateData.social_facebook = body.facebook;
    if (body.youtube) updateData.social_youtube = body.youtube;
    if (body.instagram) updateData.social_instagram = body.instagram;
    if (body.twitter) updateData.social_twitter = body.twitter;

    if (body.footerAbout) updateData.footer_about = body.footerAbout;
    if (body.ein) updateData.footer_ein = body.ein;
    if (body.copyright) updateData.footer_copyright = body.copyright;

    if (body.donateButtonText) updateData.donate_button_text = body.donateButtonText;
    if (body.donateButtonHref) updateData.donate_button_href = body.donateButtonHref;
    if (body.donateButtonColor) updateData.donate_button_color = body.donateButtonColor;

    // Header display settings (boolean)
    if ('showTopBar' in body) updateData.show_top_bar = body.showTopBar === true || body.showTopBar === 'on';
    if ('headerTransparent' in body) updateData.header_transparent = body.headerTransparent === true || body.headerTransparent === 'on';

    // Popup settings (boolean)
    if ('showRamadanPopup' in body) updateData.show_ramadan_popup = body.showRamadanPopup === true || body.showRamadanPopup === 'on';
    if ('showCartReminder' in body) updateData.show_cart_reminder = body.showCartReminder === true || body.showCartReminder === 'on';

    // Homepage donation box heading
    if ('donationBoxHeading' in body) updateData.donation_box_heading = body.donationBoxHeading || '';

    const { data, error } = await supabaseAdmin
      .from('site_settings')
      .update(updateData)
      .eq('id', 'main')
      .select()
      .single();

    if (error) {
      console.error('Supabase POST error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Clear settings cache so changes appear immediately
    clearSettingsCache();

    return new Response(JSON.stringify({ success: true, settings: data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('POST error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to save settings' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
