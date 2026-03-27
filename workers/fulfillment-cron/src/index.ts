/**
 * Qurbani Fulfillment Cron Worker
 *
 * Handles two cron schedules:
 *   "*/15 * * * *"  — Runs every 15 minutes: fulfills donations + sends fulfillment emails
 *   "0 15 * * *"    — Runs daily at 15:00 UTC (10:00 AM ET): sends Aqiqah certificates
 */

export interface Env {
  FULFILLMENT_URL: string;
  AQIQAH_CERT_URL: string;
  CRON_API_KEY: string;
}

async function callEndpoint(url: string, apiKey: string): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
  });

  const result = await response.json() as Record<string, unknown>;

  if (!response.ok) {
    console.error(`${url} returned ${response.status}:`, JSON.stringify(result));
  }

  return result;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`Cron triggered: "${event.cron}" at ${new Date(event.scheduledTime).toISOString()}`);

    if (event.cron === '0 15 * * *') {
      // Daily 10 AM ET — send Aqiqah certificates
      console.log('Running: Aqiqah certificate processor');
      try {
        const result = await callEndpoint(env.AQIQAH_CERT_URL, env.CRON_API_KEY);
        console.log('Aqiqah cert result:', JSON.stringify(result));
      } catch (error) {
        console.error('Aqiqah cert cron error:', error);
      }
    } else {
      // Every 15 min — fulfillment processor
      try {
        const result = await callEndpoint(env.FULFILLMENT_URL, env.CRON_API_KEY);
        console.log('Fulfillment result:', JSON.stringify(result));
      } catch (error) {
        console.error('Fulfillment cron error:', error);
      }
    }
  },

  // HTTP handler (for manual testing)
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'POST') {
      const url = new URL(request.url);
      const target = url.searchParams.get('target') || 'fulfillment';

      try {
        const endpoint = target === 'aqiqah' ? env.AQIQAH_CERT_URL : env.FULFILLMENT_URL;
        const result = await callEndpoint(endpoint, env.CRON_API_KEY);
        return new Response(JSON.stringify({ triggered: true, target, result }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({
      name: 'Qurbani Fulfillment Cron',
      schedules: [
        { cron: '*/15 * * * *', description: 'Donation fulfillment processor', endpoint: env.FULFILLMENT_URL },
        { cron: '0 15 * * *',   description: 'Aqiqah certificate sender (10 AM ET)', endpoint: env.AQIQAH_CERT_URL },
      ],
      status: 'active',
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
