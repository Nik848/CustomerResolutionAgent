-- ============================================================
-- Fix RLS Policies for Supabase Anon Key Access
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable RLS on customers table
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anon key to SELECT all rows
CREATE POLICY "Allow anon key to select customers"
ON public.customers
FOR SELECT
TO anon
USING (true);

-- Create policy to allow anon key to INSERT
CREATE POLICY "Allow anon key to insert customers"
ON public.customers
FOR INSERT
TO anon
WITH CHECK (true);

-- Create policy to allow anon key to UPDATE
CREATE POLICY "Allow anon key to update customers"
ON public.customers
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Create policy to allow anon key to DELETE
CREATE POLICY "Allow anon key to delete customers"
ON public.customers
FOR DELETE
TO anon
USING (true);


-- Enable RLS on bookings table
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anon key to SELECT all rows
CREATE POLICY "Allow anon key to select bookings"
ON public.bookings
FOR SELECT
TO anon
USING (true);

-- Create policy to allow anon key to INSERT
CREATE POLICY "Allow anon key to insert bookings"
ON public.bookings
FOR INSERT
TO anon
WITH CHECK (true);

-- Create policy to allow anon key to UPDATE
CREATE POLICY "Allow anon key to update bookings"
ON public.bookings
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Create policy to allow anon key to DELETE
CREATE POLICY "Allow anon key to delete bookings"
ON public.bookings
FOR DELETE
TO anon
USING (true);


-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon key to select profiles"
ON public.profiles FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon key to insert profiles"
ON public.profiles FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon key to update profiles"
ON public.profiles FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon key to delete profiles"
ON public.profiles FOR DELETE TO anon USING (true);


-- Enable RLS on audit_events table
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon key to select audit_events"
ON public.audit_events FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon key to insert audit_events"
ON public.audit_events FOR INSERT TO anon WITH CHECK (true);

