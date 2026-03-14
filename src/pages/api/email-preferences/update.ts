import type { APIRoute } from 'astro';
import {
  updatePreferences,
  verifyPreferenceToken,
} from '../../../lib/email-preferences';

export const prerender = false;

/**
 * POST /api/email-preferences/update
 *
 * Update email preferences. Requires valid token (from email link).
 *
 * Body: {
 *   email: string,
 *   token: string,
 *   preferences: {
 *     pref_ramadan?: boolean,
 *     pref_zakat?: boolean,
 *     pref_orphan?: boolean,
 *     pref_emergency?: boolean,
 *     pref_newsletter?: boolean,
 *     pref_eid_greetings?: boolean,
 *     pref_qurbani?: boolean,
 *     pref_water?: boolean,
 *     frequency?: 'all' | 'weekly_digest' | 'important_only',
 *   },
 *   unsubscribe_all?: boolean,
 *   unsubscribe_reason?: string,
 * }
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { email, token, preferences, unsubscribe_all, unsubscribe_reason } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Valid email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!token || typeof token !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication token is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verify token
    if (!(await verifyPreferenceToken(token, normalizedEmail))) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build updates object
    const updates: Record<string, unknown> = {};

    if (unsubscribe_all === true) {
      updates.unsubscribed_all = true;
      if (unsubscribe_reason) {
        updates.unsubscribe_reason = String(unsubscribe_reason).substring(0, 500);
      }
    } else if (unsubscribe_all === false) {
      updates.unsubscribed_all = false;
    }

    // Apply individual preference toggles
    if (preferences && typeof preferences === 'object') {
      const allowedBooleans = [
        'pref_ramadan', 'pref_zakat', 'pref_orphan', 'pref_emergency',
        'pref_newsletter', 'pref_eid_greetings', 'pref_qurbani', 'pref_water',
      ];
      for (const field of allowedBooleans) {
        if (typeof preferences[field] === 'boolean') {
          updates[field] = preferences[field];
        }
      }

      // Frequency
      if (preferences.frequency && ['all', 'weekly_digest', 'important_only'].includes(preferences.frequency)) {
        updates.frequency = preferences.frequency;
      }
    }

    const result = await updatePreferences(normalizedEmail, token, updates as any);

    if (!result.success) {
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: unsubscribe_all ? 'You have been unsubscribed' : 'Preferences updated successfully',
        preferences: result.preferences ? {
          email: result.preferences.email,
          pref_ramadan: result.preferences.pref_ramadan,
          pref_zakat: result.preferences.pref_zakat,
          pref_orphan: result.preferences.pref_orphan,
          pref_emergency: result.preferences.pref_emergency,
          pref_newsletter: result.preferences.pref_newsletter,
          pref_eid_greetings: result.preferences.pref_eid_greetings,
          pref_qurbani: result.preferences.pref_qurbani,
          pref_water: result.preferences.pref_water,
          frequency: result.preferences.frequency,
          unsubscribed_all: result.preferences.unsubscribed_all,
        } : null,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Email preferences update error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
