/**
 * Metal Prices API Endpoint
 * Fetches live gold and silver prices for Zakat Nisab calculation
 * With robust caching and rate limit handling
 */

import type { APIRoute } from 'astro';

// Fallback prices (updated February 28, 2026)
// These are reasonable estimates and will be used when API is rate limited
const FALLBACK_PRICES = {
  gold: 166.00,   // USD per gram (~$5,165/oz)
  silver: 3.04,   // USD per gram (~$94.50/oz)
};

// In-memory cache with longer duration
let cachedPrices: { gold: number; silver: number; timestamp: number } | null = null;
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

// Rate limit tracking
let lastApiCallTime = 0;
let apiCallCount = 0;
const API_RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_API_CALLS_PER_HOUR = 10; // Very conservative to avoid rate limits

export const prerender = false;

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

    // Check cache first - return cached data if still valid
    if (cachedPrices && now - cachedPrices.timestamp < CACHE_DURATION) {
      return new Response(JSON.stringify({
        success: true,
        gold: cachedPrices.gold,
        silver: cachedPrices.silver,
        cached: true,
        timestamp: new Date(cachedPrices.timestamp).toISOString(),
      }), { status: 200, headers });
    }

    // Check if we've exceeded our self-imposed rate limit
    if (apiCallCount >= MAX_API_CALLS_PER_HOUR) {
      console.log('Self-imposed rate limit reached, using fallback prices');
      return new Response(JSON.stringify({
        success: true,
        gold: cachedPrices?.gold || FALLBACK_PRICES.gold,
        silver: cachedPrices?.silver || FALLBACK_PRICES.silver,
        cached: false,
        fallback: true,
        reason: 'rate_limit_protection',
        timestamp: new Date().toISOString(),
      }), { status: 200, headers });
    }

    // Try to fetch from API with timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const [goldResponse, silverResponse] = await Promise.all([
        fetch('https://api.gold-api.com/price/XAU', { signal: controller.signal }),
        fetch('https://api.gold-api.com/price/XAG', { signal: controller.signal }),
      ]);

      clearTimeout(timeoutId);

      // Track API call
      apiCallCount++;
      lastApiCallTime = now;

      // Check for rate limit response
      if (goldResponse.status === 429 || silverResponse.status === 429) {
        console.log('Gold-API rate limited, using fallback');
        return new Response(JSON.stringify({
          success: true,
          gold: cachedPrices?.gold || FALLBACK_PRICES.gold,
          silver: cachedPrices?.silver || FALLBACK_PRICES.silver,
          fallback: true,
          reason: 'api_rate_limited',
          timestamp: new Date().toISOString(),
        }), { status: 200, headers });
      }

      if (goldResponse.ok && silverResponse.ok) {
        const goldData = await goldResponse.json();
        const silverData = await silverResponse.json();

        // API returns price per troy ounce, convert to grams
        // 1 troy ounce = 31.1035 grams
        const goldPerGram = goldData.price / 31.1035;
        const silverPerGram = silverData.price / 31.1035;

        // Validate prices are reasonable
        if (goldPerGram > 50 && goldPerGram < 500 && silverPerGram > 0.5 && silverPerGram < 10) {
          // Update cache
          cachedPrices = {
            gold: goldPerGram,
            silver: silverPerGram,
            timestamp: now,
          };

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

    // Return fallback prices (or cached if available)
    return new Response(JSON.stringify({
      success: true,
      gold: cachedPrices?.gold || FALLBACK_PRICES.gold,
      silver: cachedPrices?.silver || FALLBACK_PRICES.silver,
      fallback: true,
      timestamp: new Date().toISOString(),
    }), { status: 200, headers });

  } catch (error) {
    console.error('Metal prices API error:', error);

    // Return fallback on error
    return new Response(JSON.stringify({
      success: true,
      gold: FALLBACK_PRICES.gold,
      silver: FALLBACK_PRICES.silver,
      fallback: true,
      error: 'Using fallback prices',
    }), { status: 200, headers });
  }
};
