import 'dotenv/config';

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
const headers = {
  'Authorization': `Bearer ${GHL_API_KEY}`,
  'Version': '2021-07-28',
  'Content-Type': 'application/json'
};

const BASE = 'https://services.leadconnectorhq.com';

const attempts = [
  { label: 'GET /emails/builder', url: '/emails/builder', method: 'GET' },
  { label: 'GET /emails/templates', url: `/emails/templates?locationId=${GHL_LOCATION_ID}`, method: 'GET' },
  { label: 'GET /marketing/templates', url: `/marketing/templates?locationId=${GHL_LOCATION_ID}`, method: 'GET' },
  { label: 'POST /emails/', url: '/emails/', method: 'POST', body: { locationId: GHL_LOCATION_ID, name: 'test', type: 'email' } },
  { label: 'POST /contacts/bulk/email', url: '/contacts/bulk/email', method: 'POST', body: { locationId: GHL_LOCATION_ID } },
  { label: 'POST /emails/schedule', url: '/emails/schedule', method: 'POST', body: { locationId: GHL_LOCATION_ID } },
  { label: 'GET /conversations/search', url: `/conversations/search?locationId=${GHL_LOCATION_ID}&limit=1`, method: 'GET' },
  // Workflow trigger approach
  { label: 'POST /contacts/workflow (trigger)', url: '/contacts/workflow', method: 'POST', body: { locationId: GHL_LOCATION_ID } },
  // Newer v2 endpoint paths
  { label: 'GET /email/templates', url: `/email/templates?locationId=${GHL_LOCATION_ID}`, method: 'GET' },
  { label: 'GET /emails/campaigns', url: `/emails/campaigns?locationId=${GHL_LOCATION_ID}`, method: 'GET' },
];

for (const a of attempts) {
  try {
    const opts = { method: a.method, headers };
    if (a.body) opts.body = JSON.stringify(a.body);

    const r = await fetch(BASE + a.url, opts);
    const body = await r.text();

    console.log(`${a.label} => ${r.status}`);
    if (r.status !== 404) {
      console.log(`  ${body.substring(0, 300)}`);
    }
    console.log('');
  } catch (e) {
    console.log(`${a.label} => ERROR: ${e.message}\n`);
  }
}

// Also check: can we add contacts to a workflow?
console.log('=== WORKFLOW ENROLLMENT TEST ===');
const workflowId = 'a1dacbfb-5118-453e-9ad9-72399849302a'; // Zakat Calculator workflow
try {
  const r = await fetch(`${BASE}/contacts/workflow/${workflowId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      // Don't actually enroll, just test the endpoint
      locationId: GHL_LOCATION_ID,
    })
  });
  console.log(`POST /contacts/workflow/${workflowId} => ${r.status}`);
  const body = await r.text();
  console.log(`  ${body.substring(0, 300)}`);
} catch (e) {
  console.log(`Error: ${e.message}`);
}
