import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const s = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const {data} = await s.from('campaigns').select('id, template_config').or('slug.eq.zakat,url_path.eq./zakat').eq('is_active', true);

if (!data || !data[0]) { console.log('No campaign found'); process.exit(1); }

const tc = data[0].template_config || {};
const cw = tc.cwDonation || {};

cw.frequencies[0].amounts = [100, 250, 500, 1000];
cw.frequencies[0].impactTexts = {
  '100': 'can provide emergency food packages for a family',
  '250': 'can provide livelihood support to orphans and widows',
  '500': 'can provide clean water access for an entire community',
  '1000': 'can provide financial support to families facing extreme hardship'
};

tc.cwDonation = cw;
const {error} = await s.from('campaigns').update({ template_config: tc }).eq('id', data[0].id);

if (error) console.log('Error:', error.message);
else console.log('✅ Updated donation box amounts to [100, 250, 500, 1000]');
