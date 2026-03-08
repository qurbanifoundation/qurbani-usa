/**
 * Metal Prices API Endpoint
 * Fetches live gold and silver prices for Zakat Nisab calculation
 *
 * Resilience strategy (3 layers):
 *   1. In-memory cache (6 hours) — fastest, survives within a Worker instance
 *   2. Supabase "last known good" — survives Worker cold starts & API outages
 *   3. Hardcoded fallback — absolute last resort if everything is down
 *
 * On every successful live fetch, prices are saved to Supabase so the next
 * cold start (or API outage) always has recent prices, not stale hardcoded ones.
 */

import type { APIRoute } from 'astro';
import { supabase, supabaseAdmin } from '../../lib/supabase';

// Layer 3: Hardcoded fallback (absolute last resort)
const HARDCODED_FALLBACK = {
  gold: 166.00,   // USD per gram (~$5,165/oz) — Feb 28, 2026
  silver: 3.04,   // USD per gram (~$94.50/oz) — Feb 28, 2026
};

// Layer 1: In-memory cache (lost on Worker cold start)
let cachedPrices: { gold: number; silver: number; timestamp: number } | null = null;
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

// Rate limit tracking
let lastApiCallTime = 0;
let apiCallCount = 0;
const API_RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_API_CALLS_PER_HOUR = 10;

export const prerender = false;

/**
 * Layer 2: Read last known good prices from Supabase
 * Returns null if nothing stored yet
 */
async function getStoredPrices(): Promise<{ gold: number; silver: number; timestamp: string } | null> {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('metal_prices')
      .eq('id', 'main')
      .single();

    if (error || !data?.metal_prices) return null;

    const prices = data.metal_prices;
    // Validate the stored data has required fields
    if (prices.gold && prices.silver && prices.updated_at) {
      return {
        gold: prices.gold,
        silver: prices.silver,
        timestamp: prices.updated_at,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Save prices to Supabase for persistence across Worker restarts
 * Uses supabaseAdmin (service role) for write access
 * Non-blocking — fire and forget, don't slow down the response
 */
function savePricesToSupabase(gold: number, silver: number): void {
  supabaseAdmin
    .from('site_settings')
    .update({
      metal_prices: {
        gold,
        silver,
        updated_at: new Date().toISOString(),
      },
    })
    .eq('id', 'main')
    .then(({ error }) => {
      if (error) console.log('Failed to persist metal prices:', error.message);
    })
    .catch(() => {
      // Silent fail — persistence is best-effort
    });
}

/**
 * Get the best available fallback prices (Supabase → hardcoded)
 */
async function getBestFallback(): Promise<{ gold: number; silver: number; timestamp: string; source: string }> {
  // Try Supabase first (last known good prices)
  const stored = await getStoredPrices();
  if (stored) {
    return {
      gold: stored.gold,
      silver: stored.silver,
      timestamp: stored.timestamp,
      source: 'last_known_good',
    };
  }

  // Absolute last resort: hardcoded values
  return {
    gold: HARDCODED_FALLBACK.gold,
    silver: HARDCODED_FALLBACK.silver,
    timestamp: new Date().toISOString(),
    source: 'hardcoded_fallback',
  };
}

export const GET: APIRoute = async ({ request }) => {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=21600', // 6 hour browser cache
  };

  try {
    const now = Date.now();

    // Reset rate limit counter if window has passed
    if (now - lastApiCallTime > API_RATE_LIMIT_WINDOW) {
      apiCallCount = 0;
    }

    // === LAYER 1: In-memory cache ===
    if (cachedPrices && now - cachedPrices.timestamp < CACHE_DURATION) {
      return new Response(JSON.stringify({
        success: true,
        gold: cachedPrices.gold,
        silver: cachedPrices.silver,
        cached: true,
        timestamp: new Date(cachedPrices.timestamp).toISOString(),
      }), { status: 200, headers });
    }

    // Check self-imposed rate limit
    if (apiCallCount >= MAX_API_CALLS_PER_HOUR) {
      console.log('Self-imposed rate limit reached, using fallback');
      const fallback = await getBestFallback();
      return new Response(JSON.stringify({
        success: true,
        gold: fallback.gold,
        silver: fallback.silver,
        fallback: true,
        source: fallback.source,
        reason: 'rate_limit_protection',
        timestamp: fallback.timestamp,
      }), { status: 200, headers });
    }

    // === TRY LIVE API ===
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const [goldResponse, silverResponse] = await Promise.all([
        fetch('https://api.gold-api.com/price/XAU', { signal: controller.signal }),
        fetch('https://api.gold-api.com/price/XAG', { signal: controller.signal }),
      ]);

      clearTimeout(timeoutId);

      // Track API call
      apiCallCount++;
      lastApiCallTime = now;

      // Check for rate limit from gold-api.com
      if (goldResponse.status === 429 || silverResponse.status === 429) {
        console.log('Gold-API rate limited, using fallback');
        const fallback = await getBestFallback();
        return new Response(JSON.stringify({
          success: true,
          gold: fallback.gold,
          silver: fallback.silver,
          fallback: true,
          source: fallback.source,
          reason: 'api_rate_limited',
          timestamp: fallback.timestamp,
        }), { status: 200, headers });
      }

      if (goldResponse.ok && silverResponse.ok) {
        const goldData = await goldResponse.json();
        const silverData = await silverResponse.json();

        // Convert troy ounce → grams (1 troy oz = 31.1035g)
        const goldPerGram = goldData.price / 31.1035;
        const silverPerGram = silverData.price / 31.1035;

        // Validate prices are reasonable
        if (goldPerGram > 50 && goldPerGram < 500 && silverPerGram > 0.5 && silverPerGram < 10) {
          // Update Layer 1: in-memory cache
          cachedPrices = { gold: goldPerGram, silver: silverPerGram, timestamp: now };

          // Update Layer 2: persist to Supabase (non-blocking)
          savePricesToSupabase(goldPerGram, silverPerGram);

          return new Response(JSON.stringify({
            success: true,
            gold: goldPerGram,
            silver: silverPerGram,
            cached: false,
            timestamp: new Date().toISOString(),
          }), { status: 200, headers });
        }
      }
    } catch (e) {
      console.log('Gold-API request failed:', e);
    }

    // === LIVE API FAILED — use best available fallback ===
    const fallback = await getBestFallback();
    return new Response(JSON.stringify({
      success: true,
      gold: fallback.gold,
      silver: fallback.silver,
      fallback: true,
      source: fallback.source,
      timestamp: fallback.timestamp,
    }), { status: 200, headers });

  } catch (error) {
    console.error('Metal prices API error:', error);

    // Even the fallback logic failed — use hardcoded as absolute last resort
    return new Response(JSON.stringify({
      success: true,
      gold: HARDCODED_FALLBACK.gold,
      silver: HARDCODED_FALLBACK.silver,
      fallback: true,
      source: 'hardcoded_fallback',
      error: 'Using hardcoded fallback prices',
    }), { status: 200, headers });
  }
};
