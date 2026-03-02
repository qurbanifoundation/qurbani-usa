/**
 * Deploy fulfillment cron worker to Cloudflare via API
 */
import dotenv from 'dotenv';
dotenv.config({ path: '/Users/macbookpro/Developer/qurbani-usa/.env' });

const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const CRON_API_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 32);

const workerScript = `
export default {
  async scheduled(event, env, ctx) {
    console.log('Fulfillment cron triggered at ' + new Date().toISOString());
    try {
      const response = await fetch(env.FULFILLMENT_URL, {
        method: 'POST',
        headers: { 'x-api-key': env.CRON_API_KEY, 'Content-Type': 'application/json' },
      });
      const result = await response.json();
      console.log('Fulfillment result:', JSON.stringify(result));
    } catch (error) {
      console.error('Fulfillment cron error:', error);
    }
  },
  async fetch(request, env) {
    if (request.method === 'POST') {
      try {
        const response = await fetch(env.FULFILLMENT_URL, {
          method: 'POST',
          headers: { 'x-api-key': env.CRON_API_KEY, 'Content-Type': 'application/json' },
        });
        const result = await response.json();
        return new Response(JSON.stringify({ triggered: true, result }), { headers: { 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }
    return new Response(JSON.stringify({ name: 'Qurbani Fulfillment Cron', schedule: 'Every 15 min', status: 'active' }), { headers: { 'Content-Type': 'application/json' } });
  }
};
`;

async function deploy() {
  console.log('Deploying fulfillment cron worker...');
  console.log('Account:', CF_ACCOUNT);

  // Create worker
  const formData = new FormData();

  const metadata = {
    main_module: 'worker.js',
    bindings: [
      { type: 'plain_text', name: 'FULFILLMENT_URL', text: 'https://www.qurbani.com/api/fulfillment/process' },
      { type: 'secret_text', name: 'CRON_API_KEY', text: CRON_API_KEY },
    ],
    compatibility_date: '2024-01-01',
  };

  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('worker.js', new Blob([workerScript], { type: 'application/javascript+module' }), 'worker.js');

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/workers/scripts/qurbani-fulfillment-cron`,
    {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${CF_TOKEN}` },
      body: formData,
    }
  );

  const data = await res.json();

  if (!data.success) {
    console.error('Worker deploy failed:', JSON.stringify(data.errors, null, 2));
    return;
  }

  console.log('✅ Worker deployed successfully');

  // Set cron trigger
  const cronRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/workers/scripts/qurbani-fulfillment-cron/schedules`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${CF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ cron: '*/15 * * * *' }]),
    }
  );

  const cronData = await cronRes.json();

  if (!cronData.success) {
    console.error('Cron trigger failed:', JSON.stringify(cronData.errors, null, 2));
    return;
  }

  console.log('✅ Cron trigger set: every 15 minutes');
  console.log('Schedules:', JSON.stringify(cronData.result?.schedules || cronData.result, null, 2));
}

deploy().catch(console.error);
