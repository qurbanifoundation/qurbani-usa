/**
 * Newsletter Signup API Endpoint
 * POST /api/newsletter
 *
 * Handles newsletter signups:
 * 1. Validates email
 * 2. Saves lead to Supabase
 * 3. Syncs to GoHighLevel with newsletter tag
 */
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase';
import { syncNewsletterSignupToGHL } from '../../lib/ghl';

export const prerender = false;

interface NewsletterData {
  email: string;
  firstName?: string;
  lastName?: string;
  pageUrl?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body: NewsletterData = await request.json();
    const { email } = body;

    // Validate email
    if (!email?.trim() || !isValidEmail(email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Valid email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if already subscribed
    const { data: existing } = await supabaseAdmin
      .from('leads')
      .select('id')
      .eq('email', normalizedEmail)
      .eq('source', 'newsletter')
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "You're already subscribed to our newsletter!",
          alreadySubscribed: true,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. Save to Supabase
    const { data: lead, error: insertError } = await supabaseAdmin
      .from('leads')
      .insert({
        email: normalizedEmail,
        first_name: body.firstName?.trim() || null,
        last_name: body.lastName?.trim() || null,
        source: 'newsletter',
        page_url: body.pageUrl || null,
        utm_source: body.utmSource || null,
        utm_medium: body.utmMedium || null,
        utm_campaign: body.utmCampaign || null,
        status: 'new',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Newsletter insert error:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to subscribe' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Sync to GoHighLevel
    let ghlContactId: string | undefined;

    try {
      const ghlResult = await syncNewsletterSignupToGHL({
        email: normalizedEmail,
        firstName: body.firstName?.trim(),
        lastName: body.lastName?.trim(),
      });

      if (ghlResult.success) {
        ghlContactId = ghlResult.contactId;

        // Update lead with GHL ID
        await supabaseAdmin
          .from('leads')
          .update({
            ghl_contact_id: ghlContactId,
            ghl_synced_at: new Date().toISOString(),
          })
          .eq('id', lead.id);
      }
    } catch (err) {
      console.error('Newsletter GHL sync error:', err);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Successfully subscribed to our newsletter!',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Newsletter error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'An unexpected error occurred' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
