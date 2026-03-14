import type { APIRoute } from 'astro';
import {
  getOrCreatePreferences,
  verifyPreferenceToken,
} from '../../../lib/email-preferences';

export const prerender = false;

/**
 * POST /api/email-preferences/lookup
 *
 * Look up email preferences by email (+ optional token for authenticated access).
 * If no preferences exist yet, creates a row with all categories ON.
 *
 * Body: { email: string, token?: string }
 * Returns: { success, preferences, authenticated }
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { email, token } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Valid email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const prefs = await getOrCreatePreferences(normalizedEmail);

    // Check if request is authenticated via token
    const authenticated = token ? await verifyPreferenceToken(token, normalizedEmail) : false;

    // Return preferences (exclude internal fields)
    return new Response(
      JSON.stringify({
        success: true,
        authenticated,
        preferences: {
          email: prefs.email,
          pref_ramadan: prefs.pref_ramadan,
          pref_zakat: prefs.pref_zakat,
          pref_orphan: prefs.pref_orphan,
          pref_emergency: prefs.pref_emergency,
          pref_newsletter: prefs.pref_newsletter,
          pref_eid_greetings: prefs.pref_eid_greetings,
          pref_qurbani: prefs.pref_qurbani,
          pref_water: prefs.pref_water,
          frequency: prefs.frequency,
          unsubscribed_all: prefs.unsubscribed_all,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Email preferences lookup error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
