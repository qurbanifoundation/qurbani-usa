import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: p } = await s.from('pages').select('template_config').eq('slug', '/home').eq('status', 'published').maybeSingle();
const sl = p.template_config.heroSlides;
console.log('Slide0 useCampaignDonation:', sl[0].useCampaignDonation);
console.log('Slide0 campaignSlug:', sl[0].campaignSlug);
console.log('Slide0 has donation:', Boolean(sl[0].donation));

const needsCampaign = sl.filter(s => s.useCampaignDonation || (s.campaignSlug && !s.donation));
console.log('Slides needing campaign:', needsCampaign.length);
const slugs = needsCampaign.map(s => s.campaignSlug).filter(Boolean);
console.log('Slugs:', slugs);

if (slugs.length > 0) {
  const { data: camps } = await s.from('campaigns').select('slug, title, template_config').in('slug', slugs);
  console.log('Found campaigns:', camps.map(c => c.slug));
  camps.forEach(c => {
    const cw = c.template_config?.cwDonation;
    console.log(c.slug, '- has cwDonation:', Boolean(cw), '- frequencies:', cw?.frequencies?.length);
  });
}
