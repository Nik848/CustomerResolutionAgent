-- ============================================================
-- Airline Customer Resolution Agent — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- customers
-- ─────────────────────────────────────────────────────────────

create table if not exists public.customers (
    customer_id    text primary key,
    name           text not null,
    loyalty_tier   text,            -- Gold, Silver, Platinum, etc.
    email          text,
    phone          text,
    travel_history jsonb,           -- flexible field for history metadata
    auth_user_id   uuid unique,     -- links to auth.users(id)
    password       text             -- hashed password
);


-- ─────────────────────────────────────────────────────────────
-- profiles (role mapping for customer vs admin)
-- ─────────────────────────────────────────────────────────────

create table if not exists public.profiles (
    id             uuid primary key default gen_random_uuid(),
    auth_user_id   uuid unique not null,
    role           text not null default 'customer',  -- 'customer' | 'admin'
    email          text,
    name           text,
    created_at     timestamptz default now()
);

create index if not exists idx_profiles_auth_user_id on public.profiles(auth_user_id);


-- ─────────────────────────────────────────────────────────────
-- approval_requests (HITL requests for supervisor approval)
-- ─────────────────────────────────────────────────────────────

create table if not exists public.approval_requests (
    id              uuid primary key default gen_random_uuid(),
    customer_id     text not null references public.customers(customer_id),
    booking_id      text,
    thread_id       text not null,
    type            text not null,
    reason          text,
    details         jsonb,
    status          text not null default 'pending',  -- 'pending' | 'approved' | 'rejected'
    created_at      timestamptz default now(),
    resolved_at     timestamptz,
    resolved_by     uuid,
    resolution_note text
);

create index if not exists idx_approval_requests_status on public.approval_requests(status);
create index if not exists idx_approval_requests_customer_id on public.approval_requests(customer_id);
create index if not exists idx_approval_requests_thread_id on public.approval_requests(thread_id);



-- ─────────────────────────────────────────────────────────────
-- bookings
-- ─────────────────────────────────────────────────────────────

create table if not exists public.bookings (
    booking_id              text primary key,
    customer_id             text not null references public.customers(customer_id),
    pnr                     text,
    flight_number           text,
    origin                  text,
    destination             text,
    date                    text,
    scheduled_departure     text,
    status                  text,   -- cancelled | delayed | unaffected
    delay_hours             numeric default 0,
    new_departure           text,
    disruption_reason       text,
    fare_difference         numeric,

    -- set by action_tools when actions are executed
    refund_status           text,
    refund_initiated_at     text,
    rebooking_status        text,
    rebooked_at             text,
    meal_voucher_status     text,
    meal_voucher_issued_at  text,
    lounge_access_status    text,
    lounge_access_granted_at text,
    hotel_status            text,
    hotel_arranged_at       text
);


-- ─────────────────────────────────────────────────────────────
-- Seed — customers
-- ─────────────────────────────────────────────────────────────

insert into public.customers
    (customer_id, name, loyalty_tier, email, phone, travel_history)
values
    (
        'CUST001', 'Priya Nair', 'Gold',
        'priya.nair@example.com', '+91-98xxxxxxx1',
        '{"flights_last_12_months": 6, "prior_complaints": 1, "complaint_details": "Delayed baggage, resolved with voucher"}'
    ),
    (
        'CUST002', 'Arvind Kulkarni', 'Silver',
        'arvind.kulkarni@example.com', '+91-98xxxxxxx2',
        '{"flights_last_12_months": 3, "prior_complaints": 0, "complaint_details": null}'
    ),
    (
        'CUST003', 'Meher Kaur', 'Platinum',
        'meher.kaur@example.com', '+91-98xxxxxxx3',
        '{"flights_last_12_months": 10, "prior_complaints": 1, "complaint_details": "Overbooking, resolved with a tier-status upgrade"}'
    )
on conflict (customer_id) do nothing;


-- ─────────────────────────────────────────────────────────────
-- Seed — bookings
-- ─────────────────────────────────────────────────────────────

insert into public.bookings
    (booking_id, customer_id, pnr, flight_number, origin, destination,
     date, scheduled_departure, status, delay_hours, new_departure,
     disruption_reason, fare_difference)
values
    -- Priya — cancelled outbound
    ('BOOK001', 'CUST001', 'SK4821X', 'SK-204',
     'Delhi', 'Goa', '2026-09-23', '18:40',
     'cancelled', 0, null, 'operational', null),

    -- Priya — unaffected return
    ('BOOK002', 'CUST001', 'SK4821X', 'RETURN',
     'Goa', 'Delhi', '2026-09-25', '16:20',
     'unaffected', 0, null, null, null),

    -- Arvind — 4-hour delay
    ('BOOK003', 'CUST002', 'TR1190B', 'SK-118',
     'Mumbai', 'Bengaluru', '2026-09-23', '07:10',
     'delayed', 4, '11:10', null, null),

    -- Meher — 6-hour delay, ₹2,000 fare difference scenario
    ('BOOK004', 'CUST003', 'WL7742', 'SK-305',
     'Delhi', 'Hyderabad', '2026-09-23', '14:00',
     'delayed', 6, '20:00', null, 2000)

on conflict (booking_id) do nothing;
