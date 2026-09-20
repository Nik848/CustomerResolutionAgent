-- Migration: add fare_difference_waiver_status column to bookings
-- Run this in Supabase SQL editor

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS fare_difference_waiver_status text,
  ADD COLUMN IF NOT EXISTS fare_difference_waived_at text;
