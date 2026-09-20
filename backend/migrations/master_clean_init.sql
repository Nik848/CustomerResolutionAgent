-- ============================================================
-- MASTER CLEAN INITIAL STATE MIGRATION
-- Run this in: Supabase Dashboard → SQL Editor → New Query
--
-- This script:
-- 1. Drops old tables/policies safely and rebuilds the complete schema
-- 2. Seeds standard customers & bookings demo data
-- 3. Enables Row Level Security (RLS) with full permissions for backend & users
-- 4. Creates an automatic trigger on auth.users so that anytime admin or
--    customers sign up or log in, their UUID is instantly synced and linked!
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. CLEAN RESET (Optional: cascade drops all existing tables)
-- ─────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.upgrade_requests CASCADE;
DROP TABLE IF EXISTS public.hotel_bookings CASCADE;
DROP TABLE IF EXISTS public.lounge_bookings CASCADE;
DROP TABLE IF EXISTS public.refunds CASCADE;
DROP TABLE IF EXISTS public.audit_events CASCADE;
DROP TABLE IF EXISTS public.approval_requests CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ─────────────────────────────────────────────────────────────
-- 2. TABLE DEFINITIONS
-- ─────────────────────────────────────────────────────────────

-- Customers
CREATE TABLE public.customers (
    customer_id    TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    loyalty_tier   TEXT,                     -- Gold, Silver, Platinum
    email          TEXT UNIQUE,
    phone          TEXT,
    travel_history JSONB,                    -- Flexible metadata
    auth_user_id   UUID UNIQUE,              -- Links to auth.users(id)
    password       TEXT                      -- Optional demo password hash
);
CREATE INDEX idx_customers_auth_user_id ON public.customers(auth_user_id);
CREATE INDEX idx_customers_email ON public.customers(email);

-- User Profiles (Customer vs Supervisor/Admin role)
CREATE TABLE public.profiles (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id   UUID UNIQUE NOT NULL,
    role           TEXT NOT NULL DEFAULT 'customer',  -- 'customer' | 'admin'
    email          TEXT,
    name           TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_profiles_auth_user_id ON public.profiles(auth_user_id);
CREATE INDEX idx_profiles_email ON public.profiles(email);

-- Bookings
CREATE TABLE public.bookings (
    booking_id                  TEXT PRIMARY KEY,
    customer_id                 TEXT NOT NULL REFERENCES public.customers(customer_id) ON DELETE CASCADE,
    pnr                         TEXT,
    flight_number               TEXT,
    origin                      TEXT,
    destination                 TEXT,
    date                        TEXT,
    scheduled_departure         TEXT,
    status                      TEXT,        -- cancelled | delayed | unaffected
    delay_hours                 NUMERIC DEFAULT 0,
    new_departure               TEXT,
    disruption_reason           TEXT,
    fare_difference             NUMERIC,
    fare_difference_waiver_status TEXT,
    fare_difference_waived_at   TEXT,

    -- Disruption resolution statuses
    refund_status               TEXT,
    refund_initiated_at         TEXT,
    rebooking_status            TEXT,
    rebooked_at                 TEXT,
    meal_voucher_status         TEXT,
    meal_voucher_issued_at      TEXT,
    lounge_access_status        TEXT,
    lounge_access_granted_at    TEXT,
    hotel_status                TEXT,
    hotel_arranged_at           TEXT
);
CREATE INDEX idx_bookings_customer_id ON public.bookings(customer_id);

-- Approval Requests (HITL for supervisor approval)
CREATE TABLE public.approval_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     TEXT NOT NULL REFERENCES public.customers(customer_id) ON DELETE CASCADE,
    booking_id      TEXT,
    thread_id       TEXT NOT NULL,
    type            TEXT NOT NULL,
    reason          TEXT,
    details         JSONB,
    status          TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ,
    resolved_by     UUID,
    resolution_note TEXT
);
CREATE INDEX idx_approval_requests_status ON public.approval_requests(status);
CREATE INDEX idx_approval_requests_customer_id ON public.approval_requests(customer_id);
CREATE INDEX idx_approval_requests_thread_id ON public.approval_requests(thread_id);

-- Audit Events
CREATE TABLE public.audit_events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type   TEXT NOT NULL,
    customer_id  TEXT REFERENCES public.customers(customer_id) ON DELETE SET NULL,
    booking_id   TEXT REFERENCES public.bookings(booking_id) ON DELETE SET NULL,
    details      JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_audit_events_customer_time ON public.audit_events(customer_id, timestamp DESC);
CREATE INDEX idx_audit_events_event_type ON public.audit_events(event_type, timestamp DESC);

-- Stateful Entity: Refunds
CREATE TABLE public.refunds (
    refund_id       TEXT PRIMARY KEY,
    booking_id      TEXT NOT NULL REFERENCES public.bookings(booking_id) ON DELETE CASCADE,
    customer_id     TEXT NOT NULL REFERENCES public.customers(customer_id) ON DELETE CASCADE,
    amount          NUMERIC DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'INITIATED',
    failure_reason  TEXT,
    requested_at    TIMESTAMPTZ DEFAULT NOW(),
    processed_at    TIMESTAMPTZ
);

-- Stateful Entity: Lounge Bookings
CREATE TABLE public.lounge_bookings (
    lounge_booking_id TEXT PRIMARY KEY,
    booking_id        TEXT NOT NULL REFERENCES public.bookings(booking_id) ON DELETE CASCADE,
    customer_id       TEXT NOT NULL REFERENCES public.customers(customer_id) ON DELETE CASCADE,
    flight_number     TEXT,
    status            TEXT NOT NULL DEFAULT 'CONFIRMED',
    lounge_name       TEXT DEFAULT 'Premium Plaza Lounge',
    terminal          TEXT DEFAULT 'T3',
    booked_at         TIMESTAMPTZ DEFAULT NOW(),
    access_time       TIMESTAMPTZ
);

-- Stateful Entity: Hotel Bookings
CREATE TABLE public.hotel_bookings (
    hotel_booking_id  TEXT PRIMARY KEY,
    booking_id        TEXT NOT NULL REFERENCES public.bookings(booking_id) ON DELETE CASCADE,
    customer_id       TEXT NOT NULL REFERENCES public.customers(customer_id) ON DELETE CASCADE,
    flight_number     TEXT,
    status            TEXT NOT NULL DEFAULT 'CONFIRMED',
    hotel_name        TEXT DEFAULT 'Airport Transit Hotel',
    booking_reference TEXT,
    check_in          TEXT,
    check_out         TEXT,
    booked_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Stateful Entity: Upgrade Requests
CREATE TABLE public.upgrade_requests (
    upgrade_request_id TEXT PRIMARY KEY,
    booking_id         TEXT NOT NULL REFERENCES public.bookings(booking_id) ON DELETE CASCADE,
    customer_id        TEXT NOT NULL REFERENCES public.customers(customer_id) ON DELETE CASCADE,
    requested_cabin    TEXT DEFAULT 'Business',
    status             TEXT NOT NULL DEFAULT 'NOT_ELIGIBLE',
    eligibility_reason TEXT,
    requested_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- Ensures backend (using anon key) & authenticated users never hit 403
-- ─────────────────────────────────────────────────────────────

-- Customers table RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon and auth on customers" ON public.customers
    FOR ALL TO public USING (true) WITH CHECK (true);

-- Bookings table RLS
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon and auth on bookings" ON public.bookings
    FOR ALL TO public USING (true) WITH CHECK (true);

-- Profiles table RLS (CRITICAL: Prevents unlinked admin error)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon and auth on profiles" ON public.profiles
    FOR ALL TO public USING (true) WITH CHECK (true);

-- Approval Requests table RLS
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon and auth on approval_requests" ON public.approval_requests
    FOR ALL TO public USING (true) WITH CHECK (true);

-- Audit Events table RLS
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon and auth on audit_events" ON public.audit_events
    FOR ALL TO public USING (true) WITH CHECK (true);

-- Stateful tables RLS
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on refunds" ON public.refunds FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.lounge_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on lounge_bookings" ON public.lounge_bookings FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.hotel_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on hotel_bookings" ON public.hotel_bookings FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.upgrade_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on upgrade_requests" ON public.upgrade_requests FOR ALL TO public USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- 4. SEED DATA
-- ─────────────────────────────────────────────────────────────

-- Seed customers
INSERT INTO public.customers
    (customer_id, name, loyalty_tier, email, phone, travel_history, password)
VALUES
    (
        'CUST001', 'Priya Nair', 'Gold',
        'priya.nair@example.com', '+91-98xxxxxxx1',
        '{"flights_last_12_months": 6, "prior_complaints": 1, "complaint_details": "Delayed baggage, resolved with voucher"}',
        '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGzGLHIJcuFfZxBk.3XalLzF5GK'
    ),
    (
        'CUST002', 'Arvind Kulkarni', 'Silver',
        'arvind.kulkarni@example.com', '+91-98xxxxxxx2',
        '{"flights_last_12_months": 3, "prior_complaints": 0, "complaint_details": null}',
        '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGzGLHIJcuFfZxBk.3XalLzF5GK'
    ),
    (
        'CUST003', 'Meher Kaur', 'Platinum',
        'meher.kaur@example.com', '+91-98xxxxxxx3',
        '{"flights_last_12_months": 10, "prior_complaints": 1, "complaint_details": "Overbooking, resolved with a tier-status upgrade"}',
        '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGzGLHIJcuFfZxBk.3XalLzF5GK'
    )
ON CONFLICT (customer_id) DO NOTHING;

-- Seed bookings
INSERT INTO public.bookings
    (booking_id, customer_id, pnr, flight_number, origin, destination,
     date, scheduled_departure, status, delay_hours, new_departure,
     disruption_reason, fare_difference)
VALUES
    ('BOOK001', 'CUST001', 'SK4821X', 'SK-204',
     'Delhi', 'Goa', '2026-09-23', '18:40',
     'cancelled', 0, null, 'operational', null),

    ('BOOK002', 'CUST001', 'SK4821X', 'RETURN',
     'Goa', 'Delhi', '2026-09-25', '16:20',
     'unaffected', 0, null, null, null),

    ('BOOK003', 'CUST002', 'TR1190B', 'SK-118',
     'Mumbai', 'Bengaluru', '2026-09-23', '07:10',
     'delayed', 4, '11:10', null, null),

    ('BOOK004', 'CUST003', 'WL7742', 'SK-305',
     'Delhi', 'Hyderabad', '2026-09-23', '14:00',
     'delayed', 6, '20:00', null, 2000)
ON CONFLICT (booking_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 5. AUTOMATIC AUTH SYNC TRIGGER
-- Automatically links auth.users to profiles and customers by email
-- No manual SQL updates needed when users sign up or log in!
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    user_role TEXT := 'customer';
    user_name TEXT := '';
BEGIN
    -- Check if admin email
    IF LOWER(NEW.email) = 'admin@airline.com' THEN
        user_role := 'admin';
        user_name := 'Airline Supervisor';
    ELSE
        -- Pick up name from raw_user_meta_data if present
        user_name := COALESCE(NEW.raw_user_meta_data->>'name', '');
    END IF;

    -- Upsert profile
    INSERT INTO public.profiles (auth_user_id, role, email, name)
    VALUES (NEW.id, user_role, LOWER(NEW.email), user_name)
    ON CONFLICT (auth_user_id) DO UPDATE
    SET role = EXCLUDED.role,
        email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.profiles.name);

    -- If email matches a customer, auto-link auth_user_id
    UPDATE public.customers
    SET auth_user_id = NEW.id
    WHERE LOWER(email) = LOWER(NEW.email);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_auth_user();

-- ─────────────────────────────────────────────────────────────
-- 6. SYNC EXISTING AUTH USERS (If any already exist in auth.users)
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
    u RECORD;
BEGIN
    FOR u IN SELECT id, email, raw_user_meta_data FROM auth.users LOOP
        -- Profile sync
        INSERT INTO public.profiles (auth_user_id, role, email, name)
        VALUES (
            u.id,
            CASE WHEN LOWER(u.email) = 'admin@airline.com' THEN 'admin' ELSE 'customer' END,
            LOWER(u.email),
            CASE WHEN LOWER(u.email) = 'admin@airline.com' THEN 'Airline Supervisor'
                 ELSE COALESCE(u.raw_user_meta_data->>'name', '') END
        )
        ON CONFLICT (auth_user_id) DO UPDATE
        SET role = EXCLUDED.role, email = EXCLUDED.email;

        -- Customer link
        UPDATE public.customers
        SET auth_user_id = u.id
        WHERE LOWER(email) = LOWER(u.email);
    END LOOP;
END;
$$;
