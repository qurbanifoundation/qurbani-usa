import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

// Public client for read operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for write operations (server-side only)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
