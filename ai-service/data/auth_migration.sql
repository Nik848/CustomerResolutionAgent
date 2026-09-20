-- ============================================================
-- Supabase Migration: Add auth_user_id to customers table
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- URL: https://supabase.com/dashboard/project/rdeebnthhgsbunvhpoxw/sql/new
-- ============================================================

-- 1. Add auth_user_id column to customers table if not already present
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE;

-- 2. Create index on auth_user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_customers_auth_user_id 
ON public.customers(auth_user_id);

-- 3. Link an authenticated user to a customer record (run after user signs up)
-- Replace <REAL_SUPABASE_AUTH_UUID> with the user's id from auth.users:
--
-- For Priya Nair (CUST001):
-- UPDATE public.customers
-- SET auth_user_id = '<REAL_SUPABASE_AUTH_UUID>'
-- WHERE customer_id = 'CUST001';
--
-- For Arvind Kulkarni (CUST002):
-- UPDATE public.customers
-- SET auth_user_id = '<REAL_SUPABASE_AUTH_UUID>'
-- WHERE customer_id = 'CUST002';
--
-- For Meher Kaur (CUST003):
-- UPDATE public.customers
-- SET auth_user_id = '<REAL_SUPABASE_AUTH_UUID>'
-- WHERE customer_id = 'CUST003';
