/**
 * Qurbani Fulfillment Cron Worker
 *
 * Runs every 15 minutes via Cloudflare Cron Trigger.
 * Calls the fulfillment processor endpoint to:
 *   1. Fulfill donations that are due (scheduled_fulfillment_at <= now)
 *   2. Send fulfillment emails that are due (1:30 PM donor's local time)
 */

export interface Env {
  FULFILLMENT_URL: string;
  CRON_API_KEY: string;
}

export default {
  // Cron trigger handler
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`Fulfillment cron triggered at ${new Date().toISOString()}`);

    try {
      const response = await fetch(env.FULFILLMENT_URL, {
        method: 'POST',
        headers: {
          'x-api-key': env.CRON_API_KEY,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json() as Record<string, unknown>;
      console.log('Fulfillment result:', JSON.stringify(result));

      if (!response.ok) {
        console.error(`Fulfillment processor returned ${response.status}:`, result);
      }
    } catch (error) {
      console.error('Fulfillment cron error:', error);
    }
  },

  // HTTP handler (for manual testing)
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'POST') {
      try {
        const response = await fetch(env.FULFILLMENT_URL, {
          method: 'POST',
          headers: {
            'x-api-key': env.CRON_API_KEY,
            'Content-Type': 'application/json',
          },
        });

        const result = await response.json();
        return new Response(JSON.stringify({
          triggered: true,
          fulfillment_result: result,
        }), {
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
      schedule: 'Every 15 minutes',
      endpoint: env.FULFILLMENT_URL,
      status: 'active',
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
