/**
 * GoHighLevel Webhook Listener
 * POST /api/webhooks/ghl
 *
 * Receives webhooks from GHL when:
 * - Contact status changes (Lead → Client)
 * - Contact is updated
 * - Opportunity status changes
 *
 * Updates the corresponding lead in Supabase.
 */
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import type { GHLWebhookPayload } from '../../../lib/ghl';

export const prerender = false;

// Webhook event types we handle
const HANDLED_EVENTS = [
  'ContactCreate',
  'ContactUpdate',
  'ContactDelete',
  'ContactTagUpdate',
  'OpportunityCreate',
  'OpportunityUpdate',
  'OpportunityStatusUpdate',
];

export const POST: APIRoute = async ({ request }) => {
  try {
    // Parse webhook payload
    const payload: GHLWebhookPayload = await request.json();

    // Log webhook for debugging
    console.log('GHL Webhook received:', {
      type: payload.type,
      locationId: payload.locationId,
      contactId: payload.contact?.id || payload.id,
    });

    // Verify location ID matches our account
    const expectedLocationId = import.meta.env.GHL_LOCATION_ID;
    if (payload.locationId && payload.locationId !== expectedLocationId) {
      console.warn('Webhook from unexpected location:', payload.locationId);
      return new Response(
        JSON.stringify({ error: 'Invalid location' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Log webhook to database for auditing
    const { data: logEntry } = await supabaseAdmin
      .from('ghl_webhook_logs')
      .insert({
        event_type: payload.type,
        contact_id: payload.contact?.id || payload.id,
        payload: payload,
        processed: false,
      })
      .select('id')
      .single();

    // Process based on event type
    let processed = false;
    let error: string | undefined;

    try {
      switch (payload.type) {
        case 'ContactCreate':
        case 'ContactUpdate':
          processed = await handleContactUpdate(payload);
          break;

        case 'ContactTagUpdate':
          processed = await handleTagUpdate(payload);
          break;

        case 'ContactDelete':
          processed = await handleContactDelete(payload);
          break;

        case 'OpportunityCreate':
        case 'OpportunityUpdate':
        case 'OpportunityStatusUpdate':
          processed = await handleOpportunityUpdate(payload);
          break;

        default:
          // Log unhandled event types but don't error
          console.log('Unhandled webhook type:', payload.type);
          processed = true;
      }
    } catch (err: any) {
      error = err.message;
      console.error('Webhook processing error:', err);
    }

    // Update log entry with processing result
    if (logEntry?.id) {
      await supabaseAdmin
        .from('ghl_webhook_logs')
        .update({
          processed,
          processed_at: new Date().toISOString(),
          error,
        })
        .eq('id', logEntry.id);
    }

    return new Response(
      JSON.stringify({ success: true, processed }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * Handle contact create/update webhook
 * Updates the lead status in Supabase based on GHL contact data
 */
async function handleContactUpdate(payload: GHLWebhookPayload): Promise<boolean> {
  const contact = payload.contact;
  if (!contact?.id) return false;

  // Find the lead by GHL contact ID
  const { data: lead } = await supabaseAdmin
    .from('leads')
    .select('id, status')
    .eq('ghl_contact_id', contact.id)
    .single();

  if (!lead) {
    // Try to find by email
    if (contact.email) {
      const { data: leadByEmail } = await supabaseAdmin
        .from('leads')
        .select('id')
        .eq('email', contact.email.toLowerCase())
        .single();

      if (leadByEmail) {
        // Link the lead to this GHL contact
        await supabaseAdmin
          .from('leads')
          .update({
            ghl_contact_id: contact.id,
            ghl_synced_at: new Date().toISOString(),
          })
          .eq('id', leadByEmail.id);
      }
    }
    return true;
  }

  // Update lead with any new info from GHL
  const updates: Record<string, any> = {
    ghl_synced_at: new Date().toISOString(),
  };

  // Check if contact has specific tags that indicate status change
  if (contact.tags) {
    if (contact.tags.includes('client') || contact.tags.includes('donor')) {
      updates.status = 'converted';
    } else if (contact.tags.includes('qualified')) {
      updates.status = 'qualified';
    } else if (contact.tags.includes('contacted')) {
      updates.status = 'contacted';
    }
  }

  await supabaseAdmin
    .from('leads')
    .update(updates)
    .eq('id', lead.id);

  return true;
}

/**
 * Handle tag update webhook
 */
async function handleTagUpdate(payload: GHLWebhookPayload): Promise<boolean> {
  const contactId = payload.contact?.id || payload.id;
  if (!contactId) return false;

  const tags = payload.tags || payload.contact?.tags || [];

  // Find lead by GHL contact ID
  const { data: lead } = await supabaseAdmin
    .from('leads')
    .select('id, status')
    .eq('ghl_contact_id', contactId)
    .single();

  if (!lead) return true;

  // Update status based on tags
  let newStatus = lead.status;

  if (tags.includes('client') || tags.includes('donor') || tags.includes('converted')) {
    newStatus = 'converted';
  } else if (tags.includes('qualified') || tags.includes('hot-lead')) {
    newStatus = 'qualified';
  } else if (tags.includes('contacted') || tags.includes('follow-up')) {
    newStatus = 'contacted';
  } else if (tags.includes('closed') || tags.includes('unsubscribed')) {
    newStatus = 'closed';
  }

  if (newStatus !== lead.status) {
    await supabaseAdmin
      .from('leads')
      .update({ status: newStatus })
      .eq('id', lead.id);
  }

  return true;
}

/**
 * Handle contact delete webhook
 */
async function handleContactDelete(payload: GHLWebhookPayload): Promise<boolean> {
  const contactId = payload.contact?.id || payload.id;
  if (!contactId) return false;

  // Mark lead as closed (don't delete - keep for records)
  await supabaseAdmin
    .from('leads')
    .update({
      status: 'closed',
      ghl_sync_error: 'Contact deleted in GHL',
    })
    .eq('ghl_contact_id', contactId);

  return true;
}

/**
 * Handle opportunity updates (donations/purchases)
 */
async function handleOpportunityUpdate(payload: GHLWebhookPayload): Promise<boolean> {
  const opportunity = payload.opportunity || payload;
  const contactId = opportunity.contactId;

  if (!contactId) return false;

  // Find lead
  const { data: lead } = await supabaseAdmin
    .from('leads')
    .select('id')
    .eq('ghl_contact_id', contactId)
    .single();

  if (!lead) return true;

  // If opportunity is won, mark as converted
  if (opportunity.status === 'won') {
    await supabaseAdmin
      .from('leads')
      .update({ status: 'converted' })
      .eq('id', lead.id);
  }

  return true;
}
