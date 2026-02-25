import type { APIRoute } from 'astro';
import { clearNavbarCache } from '../../../lib/menus';

export const prerender = false;

export const POST: APIRoute = async () => {
  try {
    clearNavbarCache();

    return new Response(JSON.stringify({
      success: true,
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const GET: APIRoute = async () => {
  // Allow GET for easy testing
  try {
    clearNavbarCache();

    return new Response(JSON.stringify({
      success: true,
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
