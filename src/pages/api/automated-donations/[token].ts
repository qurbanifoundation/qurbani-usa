/**
 * API: Get Automated Donation by Token
 * GET /api/automated-donations/[token]
 *
 * Retrieves donation details using the access token (no auth required)
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

export const GET: APIRoute = async ({ params }) => {
  try {
    const { token } = params;

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the donation by access token
    const { data: donation, error: donationError } = await supabase
      .from('automated_donations')
      .select('*')
      .eq('access_token', token)
      .single();

    if (donationError || !donation) {
      return new Response(JSON.stringify({ error: 'Donation not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get the nightly donations
    const { data: nights, error: nightsError } = await supabase
      .from('automated_donation_nights')
      .select('*')
      .eq('automated_donation_id', donation.id)
      .order('night_number', { ascending: true });

    if (nightsError) {
      console.error('Error fetching nights:', nightsError);
    }

    // Calculate progress
    const totalNights = nights?.length || 0;
    const completedNights = nights?.filter(n => n.status === 'completed').length || 0;
    const progressPercent = totalNights > 0 ? Math.round((completedNights / totalNights) * 100) : 0;

    // Find next donation date
    const pendingNights = nights?.filter(n => n.status === 'pending') || [];
    const nextDonation = pendingNights.length > 0 ? pendingNights[0] : null;

    return new Response(JSON.stringify({
      success: true,
      donation: {
        id: donation.id,
        donor_name: donation.donor_name,
        donor_email: donation.donor_email,
        status: donation.status,
        total_amount: donation.total_amount,
        currency: donation.currency,
        ramadan_start_date: donation.ramadan_start_date,
        timezone: donation.timezone,
        schedule_type: donation.schedule_type,
        odd_multiplier: donation.odd_multiplier,
        night27_multiplier: donation.night27_multiplier,
        causes: donation.causes,
        created_at: donation.created_at,
        paid_at: donation.paid_at,
      },
      nights: nights || [],
      progress: {
        total: totalNights,
        completed: completedNights,
        percent: progressPercent,
      },
      next_donation: nextDonation ? {
        date: nextDonation.scheduled_date,
        amount: nextDonation.amount,
        night_number: nextDonation.night_number,
      } : null,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// PUT - Update donation (cancel, etc.)
export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const { token } = params;
    const body = await request.json();
    const { action } = body;

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the donation first
    const { data: donation, error: findError } = await supabase
      .from('automated_donations')
      .select('id, status')
      .eq('access_token', token)
      .single();

    if (findError || !donation) {
      return new Response(JSON.stringify({ error: 'Donation not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (action === 'cancel') {
      // Only allow cancellation if not already completed
      if (donation.status === 'completed') {
        return new Response(JSON.stringify({ error: 'Cannot cancel completed donation' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const { error: updateError } = await supabase
        .from('automated_donations')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', donation.id);

      if (updateError) {
        return new Response(JSON.stringify({ error: 'Failed to cancel donation' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, message: 'Donation cancelled' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
