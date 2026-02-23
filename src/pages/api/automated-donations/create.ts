/**
 * API: Create Automated Donation
 * POST /api/automated-donations/create
 *
 * Creates a new 30 Days of Ramadan automated giving plan
 */

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

export const POST: APIRoute = async ({ request }) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await request.json();

    const {
      donor_name,
      donor_email,
      donor_phone,
      total_amount,
      ramadan_start_date,
      timezone,
      schedule_type,
      odd_multiplier,
      night27_multiplier,
      causes,
      stripe_payment_intent_id,
      stripe_customer_id,
    } = body;

    // Validate required fields
    if (!donor_name || !donor_email || !total_amount || !ramadan_start_date || !causes) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create the automated donation record
    const { data: donation, error: donationError } = await supabase
      .from('automated_donations')
      .insert({
        donor_name,
        donor_email,
        donor_phone,
        total_amount,
        ramadan_start_date,
        timezone: timezone || 'America/New_York',
        schedule_type: schedule_type || 'all-30',
        odd_multiplier: odd_multiplier || 2,
        night27_multiplier: night27_multiplier || 5,
        causes,
        stripe_payment_intent_id,
        stripe_customer_id,
        status: stripe_payment_intent_id ? 'active' : 'pending',
        paid_at: stripe_payment_intent_id ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (donationError) {
      console.error('Error creating donation:', donationError);
      return new Response(JSON.stringify({ error: 'Failed to create donation' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate nightly donation records
    const nights = generateNightlyDonations(
      donation.id,
      ramadan_start_date,
      schedule_type || 'all-30',
      causes,
      odd_multiplier || 2,
      night27_multiplier || 5
    );

    // Insert all nightly records
    const { error: nightsError } = await supabase
      .from('automated_donation_nights')
      .insert(nights);

    if (nightsError) {
      console.error('Error creating nightly donations:', nightsError);
      // Don't fail the whole request, but log it
    }

    return new Response(JSON.stringify({
      success: true,
      donation: {
        id: donation.id,
        access_token: donation.access_token,
        total_amount: donation.total_amount,
        status: donation.status,
      },
      management_url: `/manage-donation/${donation.access_token}`,
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

function generateNightlyDonations(
  donationId: string,
  ramadanStartDate: string,
  scheduleType: string,
  causes: Array<{ cause: string; daily: number }>,
  oddMultiplier: number,
  night27Multiplier: number
) {
  const nights = [];
  const startDate = new Date(ramadanStartDate);
  const oddNights = [21, 23, 25, 27, 29];

  // Calculate daily total from causes
  const dailyTotal = causes.reduce((sum, c) => sum + (c.daily || 0), 0);

  for (let night = 1; night <= 30; night++) {
    const nightDate = new Date(startDate);
    nightDate.setDate(nightDate.getDate() + night - 1);

    // Determine if this night is active based on schedule
    let isActive = true;
    if (scheduleType === 'last-10' && night < 21) isActive = false;
    if (scheduleType === 'odd-nights' && !oddNights.includes(night)) isActive = false;

    if (!isActive) continue;

    // Calculate amount for this night
    let multiplier = 1;
    const isOdd = oddNights.includes(night);
    const is27th = night === 27;
    const isLast10 = night >= 21;

    if (is27th) {
      multiplier = night27Multiplier;
    } else if (isOdd && isLast10) {
      multiplier = oddMultiplier;
    }

    const nightAmount = dailyTotal * multiplier;

    // Generate cause breakdown for this night
    const causesBreakdown = causes.map(c => ({
      cause: c.cause,
      amount: (c.daily || 0) * multiplier
    }));

    nights.push({
      automated_donation_id: donationId,
      night_number: night,
      scheduled_date: nightDate.toISOString().split('T')[0],
      amount: nightAmount,
      causes_breakdown: causesBreakdown,
      status: 'pending'
    });
  }

  return nights;
}
