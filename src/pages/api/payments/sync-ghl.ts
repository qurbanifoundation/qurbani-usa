/**
 * Sync Payment to GoHighLevel
 * POST /api/payments/sync-ghl
 *
 * Called after successful payment to sync donor to GHL
 */
import type { APIRoute } from 'astro';
import { syncDonationToGHL } from '../../../lib/ghl';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      donorEmail,
      donorName,
      donorPhone,
      amount,
      campaignName,
      donationType,
      items,
      pipelineId,
      stageId,
    } = body;

    // Validate required fields
    if (!donorEmail || !donorName || !amount) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: donorEmail, donorName, amount' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Sync to GHL
    const result = await syncDonationToGHL({
      donorEmail,
      donorName,
      donorPhone,
      amount: parseFloat(amount),
      campaignName,
      donationType: donationType || 'single',
      items,
      pipelineId,
      stageId,
    });

    if (result.success) {
      return new Response(
        JSON.stringify({
          success: true,
          contactId: result.contactId,
          message: 'Donation synced to GoHighLevel',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: result.error || 'Failed to sync to GHL' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: any) {
    console.error('GHL sync error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
