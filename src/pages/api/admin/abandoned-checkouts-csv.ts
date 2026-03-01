import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status') || 'all';
    const dateRange = url.searchParams.get('range') || '30d';

    let dateThreshold: Date | null = null;
    if (dateRange === '7d') dateThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    else if (dateRange === '30d') dateThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    else if (dateRange === '90d') dateThreshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    let query = supabaseAdmin
      .from('abandoned_checkouts')
      .select('*')
      .order('checkout_started_at', { ascending: false })
      .limit(5000);

    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (dateThreshold) query = query.gte('checkout_started_at', dateThreshold.toISOString());

    const { data, error } = await query;

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const headers = [
      'Email', 'First Name', 'Last Name', 'Status', 'Amount',
      'Campaign Type', 'Campaign Slug', 'Recovery Step',
      'Started At', 'Abandoned At', 'Recovered At',
      'UTM Source', 'UTM Medium', 'UTM Campaign',
    ];

    const rows = (data || []).map((r: Record<string, unknown>) => [
      r.email, r.first_name || '', r.last_name || '', r.status,
      r.amount || '', r.campaign_type || '', r.campaign_slug || '',
      r.recovery_step_last_sent || 0,
      r.checkout_started_at || '', r.abandoned_at || '', r.recovered_at || '',
      r.utm_source || '', r.utm_medium || '', r.utm_campaign || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row =>
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="abandoned-checkouts-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: 'Export failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
