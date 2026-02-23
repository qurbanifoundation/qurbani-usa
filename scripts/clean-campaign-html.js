/**
 * Clean HTML from campaign data
 * Converts HTML-formatted content to plain text
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper to strip HTML tags and convert to plain text
function stripHtml(html) {
  if (!html) return html;

  // Replace <br> and </p> with newlines
  let text = html.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/li>/gi, '\n');

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]*>/g, '');

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");

  // Clean up extra whitespace
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

  return text;
}

async function cleanCampaign(slug) {
  console.log(`\nCleaning campaign: ${slug}`);

  // Fetch the campaign
  const { data: campaign, error: fetchError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('slug', slug)
    .single();

  if (fetchError) {
    console.error('Error fetching campaign:', fetchError);
    return;
  }

  console.log('Original subtitle:', campaign.subtitle || campaign.description);
  console.log('Original long_description:', campaign.long_description?.substring(0, 100));

  // Clean the text fields
  const updates = {};

  if (campaign.subtitle) {
    updates.subtitle = stripHtml(campaign.subtitle);
  }
  if (campaign.description) {
    updates.description = stripHtml(campaign.description);
  }
  if (campaign.long_description) {
    updates.long_description = stripHtml(campaign.long_description);
  }

  // Clean content_sections if they exist
  if (campaign.content_sections && Array.isArray(campaign.content_sections)) {
    updates.content_sections = campaign.content_sections.map(section => ({
      ...section,
      content: section.content ? stripHtml(section.content) : section.content
    }));
  }

  console.log('\nCleaned subtitle:', updates.subtitle || updates.description);
  console.log('Cleaned content_sections:', updates.content_sections?.length, 'sections');

  // Update the campaign
  const { error: updateError } = await supabase
    .from('campaigns')
    .update(updates)
    .eq('slug', slug);

  if (updateError) {
    console.error('Error updating campaign:', updateError);
  } else {
    console.log('✓ Campaign cleaned successfully!');
  }
}

// Clean the thirst-relief campaign
cleanCampaign('thirst-relief');
