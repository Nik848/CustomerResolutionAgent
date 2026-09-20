-- ============================================================
-- Admin Setup Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Ensure password column exists on customers
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS password TEXT;

-- 2. Update customers with hashed password for Pass_123
--    bcrypt hash of "Pass_123" with cost 12
UPDATE public.customers
SET password = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGzGLHIJcuFfZxBk.3XalLzF5GK'
WHERE customer_id IN ('CUST001', 'CUST002', 'CUST003')
  AND (password IS NULL OR password = '');

-- 3. Ensure profiles table exists
CREATE TABLE IF NOT EXISTS public.profiles (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE NOT NULL,
    role         TEXT NOT NULL DEFAULT 'customer',  -- 'customer' | 'admin'
    email        TEXT,
    name         TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id
ON public.profiles(auth_user_id);

-- ============================================================
-- IMPORTANT: To create an admin user:
-- 1. Sign up via the application with any email (e.g., admin@airline.com)
-- 2. Get the UUID from auth.users for that email
-- 3. Run this INSERT with the real UUID:
-- 
-- INSERT INTO public.profiles (auth_user_id, role, email, name)
-- VALUES ('<real-uuid-from-auth.users>', 'admin', 'admin@airline.com', 'Airline Supervisor')
-- ON CONFLICT (auth_user_id) DO UPDATE SET role = 'admin';
-- ============================================================
