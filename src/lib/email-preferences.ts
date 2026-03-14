/**
 * Email Preferences Library
 *
 * Manages subscriber email preferences with:
 * - HMAC token generation (deterministic — no DB lookup needed to build URLs)
 * - CRUD operations against the email_preferences table
 * - GHL tag sync (email:ramadan, email:zakat, etc.)
 * - Preference-based send filtering
 */

import { supabaseAdmin } from './supabase';
import { findContactByEmail, addTagsToContact, removeTagsFromContact } from './ghl';

// ============================================
// TYPES
// ============================================

export interface EmailPreferences {
  id: string;
  email: string;
  preference_token: string;
  pref_ramadan: boolean;
  pref_zakat: boolean;
  pref_orphan: boolean;
  pref_emergency: boolean;
  pref_newsletter: boolean;
  pref_eid_greetings: boolean;
  pref_qurbani: boolean;
  pref_water: boolean;
  frequency: 'all' | 'weekly_digest' | 'important_only';
  unsubscribed_all: boolean;
  unsubscribed_at: string | null;
  unsubscribe_reason: string | null;
  ghl_contact_id: string | null;
  ghl_synced_at: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export type EmailCategory =
  | 'ramadan'
  | 'zakat'
  | 'orphan'
  | 'emergency'
  | 'newsletter'
  | 'eid'
  | 'qurbani'
  | 'water'
  | 'receipt';

/** All preference boolean fields */
export const PREF_FIELDS = [
  'pref_ramadan',
  'pref_zakat',
  'pref_orphan',
  'pref_emergency',
  'pref_newsletter',
  'pref_eid_greetings',
  'pref_qurbani',
  'pref_water',
] as const;

/** Category to preference field mapping */
const CATEGORY_TO_FIELD: Record<string, typeof PREF_FIELDS[number]> = {
  ramadan: 'pref_ramadan',
  zakat: 'pref_zakat',
  orphan: 'pref_orphan',
  emergency: 'pref_emergency',
  newsletter: 'pref_newsletter',
  eid: 'pref_eid_greetings',
  qurbani: 'pref_qurbani',
  water: 'pref_water',
};

/** Category to GHL tag mapping */
const PREF_TO_GHL_TAG: Record<string, string> = {
  pref_ramadan: 'email:ramadan',
  pref_zakat: 'email:zakat',
  pref_orphan: 'email:orphan',
  pref_emergency: 'email:emergency',
  pref_newsletter: 'email:newsletter',
  pref_eid_greetings: 'email:eid',
  pref_qurbani: 'email:qurbani',
  pref_water: 'email:water',
};

// ============================================
// TOKEN GENERATION (HMAC — deterministic)
// ============================================

/**
 * Generate a secure preference token for a given email (Web Crypto API)
 * Deterministic: same email always generates the same token
 * No DB lookup needed to build email footer URLs
 */
export async function generatePreferenceToken(email: string): Promise<string> {
  const secret = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
  }
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const data = encoder.encode(`email-pref:${email.toLowerCase().trim()}`);
  const signature = await globalThis.crypto.subtle.sign('HMAC', key, data);
  const hex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return hex.substring(0, 32);
}

/**
 * Verify that a token matches an email address
 */
export async function verifyPreferenceToken(token: string, email: string): Promise<boolean> {
  try {
    const expectedToken = await generatePreferenceToken(email);
    return token === expectedToken;
  } catch {
    return false;
  }
}

// ============================================
// URL BUILDER
// ============================================

/**
 * Build the full preferences URL for email footers
 * @param email - Subscriber email
 * @param action - Optional action ('unsubscribe' to scroll to unsubscribe section)
 */
export async function buildPreferencesUrl(email: string, action?: string, origin?: string): Promise<string> {
  const token = await generatePreferenceToken(email);
  const siteUrl = origin || 'https://www.qurbani.com';
  const base = `${siteUrl}/email-preferences?token=${token}&email=${encodeURIComponent(email.toLowerCase().trim())}`;
  if (action) {
    return `${base}&action=${action}`;
  }
  return base;
}

/**
 * Pre-compute both preferences URLs for email footers.
 * Call this in async contexts, then pass the result to sync email wrapper functions.
 */
export async function buildPreferencesUrls(email: string, origin?: string): Promise<{ manage: string; unsubscribe: string }> {
  const [manage, unsubscribe] = await Promise.all([
    buildPreferencesUrl(email, undefined, origin),
    buildPreferencesUrl(email, 'unsubscribe', origin),
  ]);
  return { manage, unsubscribe };
}

// ============================================
// CRUD OPERATIONS
// ============================================

/**
 * Get existing preferences or create new row with defaults (all ON)
 */
export async function getOrCreatePreferences(email: string): Promise<EmailPreferences> {
  const normalizedEmail = email.toLowerCase().trim();

  // Try to find existing
  const { data: existing } = await supabaseAdmin
    .from('email_preferences')
    .select('*')
    .eq('email', normalizedEmail)
    .single();

  if (existing) {
    return existing as EmailPreferences;
  }

  // Create new with all defaults ON
  const token = await generatePreferenceToken(normalizedEmail);
  const { data: created, error } = await supabaseAdmin
    .from('email_preferences')
    .insert({
      email: normalizedEmail,
      preference_token: token,
      source: 'auto',
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error creating email preferences:', error);
    // Return a default object if insert fails (e.g., race condition)
    const { data: retry } = await supabaseAdmin
      .from('email_preferences')
      .select('*')
      .eq('email', normalizedEmail)
      .single();
    if (retry) return retry as EmailPreferences;

    throw new Error(`Failed to create email preferences: ${error.message}`);
  }

  return created as EmailPreferences;
}

/**
 * Update preferences (requires valid token)
 */
export async function updatePreferences(
  email: string,
  token: string,
  updates: Partial<Pick<EmailPreferences,
    'pref_ramadan' | 'pref_zakat' | 'pref_orphan' | 'pref_emergency' |
    'pref_newsletter' | 'pref_eid_greetings' | 'pref_qurbani' | 'pref_water' |
    'frequency' | 'unsubscribed_all' | 'unsubscribe_reason'
  >>
): Promise<{ success: boolean; preferences?: EmailPreferences; error?: string }> {
  const normalizedEmail = email.toLowerCase().trim();

  // Verify token
  if (!(await verifyPreferenceToken(token, normalizedEmail))) {
    return { success: false, error: 'Invalid token' };
  }

  // Build update data
  const updateData: Record<string, unknown> = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  // If unsubscribing from all, set all prefs to false
  if (updates.unsubscribed_all === true) {
    updateData.unsubscribed_at = new Date().toISOString();
    for (const field of PREF_FIELDS) {
      updateData[field] = false;
    }
  }

  // If re-subscribing (was unsubscribed, now setting unsubscribed_all to false)
  if (updates.unsubscribed_all === false) {
    updateData.unsubscribed_at = null;
    updateData.unsubscribe_reason = null;
  }

  const { data, error } = await supabaseAdmin
    .from('email_preferences')
    .update(updateData)
    .eq('email', normalizedEmail)
    .select('*')
    .single();

  if (error) {
    console.error('Error updating email preferences:', error);
    return { success: false, error: error.message };
  }

  // Sync to GHL in the background (don't block response)
  syncPreferencesToGHL(normalizedEmail, data as EmailPreferences).catch(err => {
    console.error('GHL preference sync error:', err);
  });

  return { success: true, preferences: data as EmailPreferences };
}

// ============================================
// GHL TAG SYNC
// ============================================

/**
 * Sync email preferences to GHL as tags
 * Tags follow the prefix pattern: email:ramadan, email:zakat, etc.
 */
export async function syncPreferencesToGHL(
  email: string,
  prefs: EmailPreferences
): Promise<void> {
  try {
    const contact = await findContactByEmail(email);
    if (!contact?.id) {
      console.log(`GHL sync: No contact found for ${email}`);
      return;
    }

    const tagsToAdd: string[] = [];
    const tagsToRemove: string[] = [];

    if (prefs.unsubscribed_all) {
      // Unsubscribed from all — add unsubscribed tag, remove all category tags
      tagsToAdd.push('email:unsubscribed');
      for (const [, tag] of Object.entries(PREF_TO_GHL_TAG)) {
        tagsToRemove.push(tag);
      }
      tagsToRemove.push('email:reduced');
    } else {
      // Active subscriber — remove unsubscribed tag
      tagsToRemove.push('email:unsubscribed');

      // Sync each category preference
      for (const [field, tag] of Object.entries(PREF_TO_GHL_TAG)) {
        const prefValue = prefs[field as keyof EmailPreferences];
        if (prefValue === true) {
          tagsToAdd.push(tag);
        } else {
          tagsToRemove.push(tag);
        }
      }

      // Frequency tag
      if (prefs.frequency === 'important_only' || prefs.frequency === 'weekly_digest') {
        tagsToAdd.push('email:reduced');
      } else {
        tagsToRemove.push('email:reduced');
      }
    }

    // Apply tags
    if (tagsToAdd.length > 0) {
      await addTagsToContact(contact.id, tagsToAdd);
    }
    if (tagsToRemove.length > 0) {
      await removeTagsFromContact(contact.id, tagsToRemove);
    }

    // Update GHL contact ID and sync timestamp
    await supabaseAdmin
      .from('email_preferences')
      .update({
        ghl_contact_id: contact.id,
        ghl_synced_at: new Date().toISOString(),
      })
      .eq('email', prefs.email);

    console.log(`GHL preference sync complete for ${email}`);
  } catch (err) {
    console.error(`GHL preference sync failed for ${email}:`, err);
  }
}

// ============================================
// EMAIL SEND FILTERING
// ============================================

/**
 * Check if an email should be sent to a subscriber based on their preferences
 * Returns true if the email should be sent (default for unknown contacts)
 *
 * @param email - Subscriber email
 * @param category - Email category to check
 */
export async function shouldSendEmail(email: string, category: EmailCategory): Promise<boolean> {
  // Donation receipts are always sent (transactional)
  if (category === 'receipt') return true;

  try {
    const { data } = await supabaseAdmin
      .from('email_preferences')
      .select('unsubscribed_all, frequency, ' + PREF_FIELDS.join(', '))
      .eq('email', email.toLowerCase().trim())
      .single();

    // No preferences row = default opt-in (send everything)
    if (!data) return true;

    // Globally unsubscribed
    if (data.unsubscribed_all) return false;

    // Check frequency filter
    if (data.frequency === 'important_only') {
      // Only allow emergency and ramadan for "important only"
      if (category !== 'emergency' && category !== 'ramadan') {
        return false;
      }
    }

    // Check specific category preference
    const field = CATEGORY_TO_FIELD[category];
    if (field && data[field] === false) {
      return false;
    }

    return true;
  } catch {
    // On error, default to sending (don't block emails due to DB issues)
    return true;
  }
}
