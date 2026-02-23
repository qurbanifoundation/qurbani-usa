/**
 * Contact Form API Endpoint
 * POST /api/contact
 *
 * Handles contact form submissions:
 * 1. Validates form data
 * 2. Saves lead to Supabase
 * 3. Syncs contact to GoHighLevel
 * 4. Updates lead with GHL contact ID
 */
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase';
import { syncContactFormToGHL } from '../../lib/ghl';

export const prerender = false;

interface ContactFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  newsletter?: boolean;
  pageUrl?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body: ContactFormData = await request.json();

    // Validate required fields
    const { firstName, lastName, email, subject, message } = body;

    if (!firstName?.trim()) {
      return errorResponse('First name is required', 400);
    }
    if (!lastName?.trim()) {
      return errorResponse('Last name is required', 400);
    }
    if (!email?.trim() || !isValidEmail(email)) {
      return errorResponse('Valid email is required', 400);
    }
    if (!subject?.trim()) {
      return errorResponse('Subject is required', 400);
    }
    if (!message?.trim()) {
      return errorResponse('Message is required', 400);
    }

    // 1. Save lead to Supabase
    const { data: lead, error: insertError } = await supabaseAdmin
      .from('leads')
      .insert({
        email: email.trim().toLowerCase(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: body.phone?.trim() || null,
        source: 'contact_form',
        subject: subject.trim(),
        message: message.trim(),
        form_data: {
          newsletter: body.newsletter || false,
        },
        page_url: body.pageUrl || null,
        utm_source: body.utmSource || null,
        utm_medium: body.utmMedium || null,
        utm_campaign: body.utmCampaign || null,
        status: 'new',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      return errorResponse('Failed to save contact information', 500);
    }

    // 2. Sync to GoHighLevel
    let ghlContactId: string | undefined;
    let ghlError: string | undefined;

    try {
      const ghlResult = await syncContactFormToGHL({
        email: email.trim().toLowerCase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: body.phone?.trim(),
        subject: subject.trim(),
        message: message.trim(),
        newsletter: body.newsletter,
      });

      if (ghlResult.success) {
        ghlContactId = ghlResult.contactId;
      } else {
        ghlError = ghlResult.error;
        console.error('GHL sync failed:', ghlError);
      }
    } catch (err: any) {
      ghlError = err.message;
      console.error('GHL sync error:', err);
    }

    // 3. Update lead with GHL contact ID
    if (lead?.id) {
      await supabaseAdmin
        .from('leads')
        .update({
          ghl_contact_id: ghlContactId || null,
          ghl_synced_at: ghlContactId ? new Date().toISOString() : null,
          ghl_sync_error: ghlError || null,
        })
        .eq('id', lead.id);
    }

    // Return success (even if GHL sync failed - lead is saved)
    return new Response(
      JSON.stringify({
        success: true,
        leadId: lead?.id,
        ghlSynced: !!ghlContactId,
        message: 'Thank you for contacting us! We will get back to you within 24 hours.',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Contact form error:', error);
    return errorResponse(error.message || 'An unexpected error occurred', 500);
  }
};

// Helper functions
function errorResponse(message: string, status: number): Response {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
