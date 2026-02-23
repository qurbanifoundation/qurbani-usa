/**
 * Track Zakat Calculator Results
 *
 * This is a HIGH-INTENT lead capture endpoint.
 * When someone calculates their Zakat and provides their email,
 * they're showing strong intent to fulfill their obligation.
 *
 * Captures:
 * - Calculated Zakat amount (for follow-up at the right time)
 * - Total assets (for donor potential scoring)
 * - Lead score based on Zakat amount
 * - Nisab alert preference for future notifications
 */
import type { APIRoute } from 'astro';
import { trackZakatCalculation } from '../../../lib/ghl-advanced';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      email,
      firstName,
      lastName,
      phone,
      zakatAmount,
      totalAssets,
      wantsReminder
    } = body;

    // Validate required fields
    if (!email) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Email is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (typeof zakatAmount !== 'number' || zakatAmount < 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Valid Zakat amount is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Track the Zakat calculation
    const result = await trackZakatCalculation({
      email,
      firstName,
      lastName,
      phone,
      zakatAmount,
      totalAssets: totalAssets || 0,
      wantsReminder: wantsReminder || false,
    });

    if (!result.success) {
      console.error('Track Zakat failed:', result.error);
    }

    return new Response(JSON.stringify({
      success: result.success,
      leadScore: result.leadScore,
      error: result.error,
      message: result.success
        ? 'Your Zakat calculation has been saved to your profile.'
        : `Failed to save: ${result.error || 'Unknown error'}`
    }), {
      status: result.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Track Zakat error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
