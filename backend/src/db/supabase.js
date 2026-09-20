const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

/**
 * Server-side Supabase client using the SERVICE ROLE key.
 * This client bypasses Row Level Security and is ONLY used on the backend.
 * Never expose this key to the frontend or AI service.
 */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * A second client using only the ANON key, used solely to verify user JWT tokens.
 * supabase.auth.getUser(token) requires the anon key, not service role.
 */
const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

module.exports = { supabase, supabaseAuth };
