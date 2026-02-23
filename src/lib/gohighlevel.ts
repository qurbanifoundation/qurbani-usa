/**
 * GoHighLevel Integration - Re-export
 *
 * This file re-exports from ghl.ts for backwards compatibility.
 * All new code should import directly from './ghl'
 */

export {
  // Types
  type GHLContact,
  type GHLOpportunity,
  type GHLContactResponse,
  type GHLWebhookPayload,

  // Core functions
  getLocationId,
  findContactByEmail,
  upsertContact,
  addTagsToContact,
  removeTagsFromContact,
  addNoteToContact,
  updateContactStatus,
  createOpportunity,

  // High-level sync functions
  syncContactFormToGHL,
  syncNewsletterSignupToGHL,
  syncDonationToGHL,
  syncZakatCalculationToGHL,
} from './ghl';

// Legacy exports for backwards compatibility
export { syncDonationToGHL as syncOrderToGHL } from './ghl';
export { syncNewsletterSignupToGHL as syncSignupToGHL } from './ghl';
