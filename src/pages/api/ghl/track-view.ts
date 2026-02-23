/**
 * Track Campaign Page Views
 *
 * Call this when a user views a campaign page to capture their interest.
 * This helps build a profile of what campaigns they're interested in
 * BEFORE they even add to cart or donate.
 */
import type { APIRoute } from 'astro';
import { trackCampaignView } from '../../../lib/ghl-advanced';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { email, campaignSlug, campaignName, visitorId } = body;

    // Require at least campaign info
    if (!campaignSlug || !campaignName) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Campaign slug and name are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Track the view (works with or without email)
    const result = await trackCampaignView({
      email,
      visitorId,
      campaignSlug,
      campaignName,
    });

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Track view error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
