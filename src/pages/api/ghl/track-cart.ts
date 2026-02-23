/**
 * Track Cart Abandonment
 *
 * Call this when a user adds items to cart but doesn't complete checkout.
 * This creates a HOT LEAD that should be followed up within 2 hours.
 *
 * Triggers:
 * - User leaves checkout page
 * - User is inactive for 30+ minutes with items in cart
 * - User closes tab (via beforeunload event)
 */
import type { APIRoute } from 'astro';
import { trackCartAbandonment } from '../../../lib/ghl-advanced';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    // Handle both JSON (fetch) and text (sendBeacon) requests
    const contentType = request.headers.get('content-type') || '';
    let body: any;

    if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      // sendBeacon sends as text/plain or application/x-www-form-urlencoded
      const text = await request.text();
      try {
        body = JSON.parse(text);
      } catch {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid request format'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const { email, cartItems, cartTotal } = body;

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

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Cart items are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Format cart items
    const formattedItems = cartItems.map(item => ({
      name: item.name || 'Donation',
      amount: typeof item.amount === 'string' ? parseFloat(item.amount) : item.amount,
      campaignSlug: item.campaignSlug || item.slug || item.name?.toLowerCase().replace(/\s+/g, '-') || 'general',
    }));

    // Calculate cart total if not provided
    const total = cartTotal || formattedItems.reduce((sum, item) => sum + item.amount, 0);

    // Track the abandonment
    const result = await trackCartAbandonment({
      email,
      cartItems: formattedItems,
      cartTotal: total,
    });

    return new Response(JSON.stringify({
      success: result.success,
      message: result.success
        ? 'Cart abandonment tracked'
        : result.error || 'Failed to track abandonment'
    }), {
      status: result.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Track cart error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
