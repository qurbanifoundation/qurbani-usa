import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { items, donor_email, donor_name, donor_phone, on_behalf_of } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'No items provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!donor_email || !donor_name) {
      return new Response(JSON.stringify({ error: 'Donor email and name are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch package details from Supabase
    const packageIds = items.map((item: any) => item.package_id);
    const { data: packages, error: pkgError } = await supabase
      .from('packages')
      .select('id, name, price, campaign_id, campaigns(name)')
      .in('id', packageIds);

    if (pkgError || !packages) {
      return new Response(JSON.stringify({ error: 'Failed to fetch packages' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build line items for Stripe
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item: any) => {
      const pkg = packages.find((p: any) => p.id === item.package_id);
      if (!pkg) throw new Error(`Package not found: ${item.package_id}`);

      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: pkg.name,
            description: item.on_behalf_of ? `On behalf of: ${item.on_behalf_of}` : undefined,
          },
          unit_amount: Math.round(pkg.price * 100), // Convert to cents
        },
        quantity: item.quantity || 1,
      };
    });

    // Calculate totals
    const subtotal = items.reduce((sum: number, item: any) => {
      const pkg = packages.find((p: any) => p.id === item.package_id);
      return sum + (pkg?.price || 0) * (item.quantity || 1);
    }, 0);

    // Create order in Supabase (pending status)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        donor_email,
        donor_name,
        donor_phone,
        subtotal,
        total_amount: subtotal,
        on_behalf_of,
        status: 'pending'
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error('Order creation error:', orderError);
      return new Response(JSON.stringify({ error: 'Failed to create order' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create order items
    const orderItems = items.map((item: any) => {
      const pkg = packages.find((p: any) => p.id === item.package_id);
      return {
        order_id: order.id,
        package_id: item.package_id,
        campaign_id: pkg?.campaign_id,
        package_name: pkg?.name || 'Unknown',
        campaign_name: (pkg as any)?.campaigns?.name,
        quantity: item.quantity || 1,
        unit_price: pkg?.price || 0,
        total_price: (pkg?.price || 0) * (item.quantity || 1),
        on_behalf_of: item.on_behalf_of
      };
    });

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Order items error:', itemsError);
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${new URL(request.url).origin}/donation/success?order_id=${order.id}`,
      cancel_url: `${new URL(request.url).origin}/donation/cancel?order_id=${order.id}`,
      customer_email: donor_email,
      metadata: {
        order_id: order.id,
        donor_name,
        donor_phone: donor_phone || '',
      },
      payment_intent_data: {
        metadata: {
          order_id: order.id,
        }
      }
    });

    // Update order with Stripe session ID
    await supabase
      .from('orders')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', order.id);

    return new Response(JSON.stringify({
      sessionId: session.id,
      url: session.url,
      order_id: order.id
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Checkout error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Checkout failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
