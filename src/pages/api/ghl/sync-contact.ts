import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { syncSignupToGHL } from '../../../lib/gohighlevel';

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

const ghlApiKey = import.meta.env.GHL_API_KEY;
const ghlLocationId = import.meta.env.GHL_LOCATION_ID;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { email, fullName, phone, userId } = body;

    if (!email || !fullName) {
      return new Response(JSON.stringify({ error: 'Email and name are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!ghlApiKey || !ghlLocationId) {
      return new Response(JSON.stringify({ error: 'GoHighLevel not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Sync to GoHighLevel
    const result = await syncSignupToGHL(
      { email, fullName, phone },
      ghlApiKey,
      ghlLocationId
    );

    if (result.success && result.contactId) {
      // Update profile with GHL contact ID if userId provided
      if (userId) {
        await supabase
          .from('profiles')
          .update({ ghl_contact_id: result.contactId })
          .eq('id', userId);
      }

      return new Response(JSON.stringify({
        success: true,
        contactId: result.contactId
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: result.error
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error: any) {
    console.error('GHL sync error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
