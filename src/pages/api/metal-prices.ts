/**
 * Metal Prices API Endpoint
 * Fetches live gold and silver prices for Zakat Nisab calculation
 */

import type { APIRoute } from 'astro';

// Cache for metal prices (1 hour cache)
let cachedPrices: { gold: number; silver: number; timestamp: number } | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

// Fallback prices (updated February 2026)
const FALLBACK_PRICES = {
  gold: 93.00,    // USD per gram (~$2,900/oz)
  silver: 2.74,   // USD per gram (~$85/oz)
};

export const GET: APIRoute = async () => {
  try {
    // Check cache first
    if (cachedPrices && Date.now() - cachedPrices.timestamp < CACHE_DURATION) {
      return new Response(JSON.stringify({
        success: true,
        gold: cachedPrices.gold,
        silver: cachedPrices.silver,
        cached: true,
        timestamp: new Date(cachedPrices.timestamp).toISOString(),
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch from gold-api.com (free, no key required)
    try {
      const [goldResponse, silverResponse] = await Promise.all([
        fetch('https://api.gold-api.com/price/XAU'),
        fetch('https://api.gold-api.com/price/XAG'),
      ]);

      if (goldResponse.ok && silverResponse.ok) {
        const goldData = await goldResponse.json();
        const silverData = await silverResponse.json();

        // API returns price per troy ounce, convert to grams
        // 1 troy ounce = 31.1035 grams
        const goldPerGram = goldData.price / 31.1035;
        const silverPerGram = silverData.price / 31.1035;

        // Update cache
        cachedPrices = {
          gold: goldPerGram,
          silver: silverPerGram,
          timestamp: Date.now(),
        };

        return new Response(JSON.stringify({
          success: true,
          gold: goldPerGram,
          silver: silverPerGram,
          cached: false,
          timestamp: new Date().toISOString(),
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (e) {
      console.log('Gold-API failed, using fallback');
    }

    // Return fallback prices
    return new Response(JSON.stringify({
      success: true,
      gold: FALLBACK_PRICES.gold,
      silver: FALLBACK_PRICES.silver,
      cached: false,
      fallback: true,
      timestamp: new Date().toISOString(),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Metal prices API error:', error);

    // Return fallback on error
    return new Response(JSON.stringify({
      success: true,
      gold: FALLBACK_PRICES.gold,
      silver: FALLBACK_PRICES.silver,
      fallback: true,
      error: 'Using fallback prices',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
