-- ============================================================
-- Stateful Entities Migration: Refunds, Lounge, Hotel, Upgrades
-- ============================================================

-- 1. refunds table
create table if not exists public.refunds (
    refund_id       text primary key,
    booking_id      text not null references public.bookings(booking_id),
    customer_id     text not null references public.customers(customer_id),
    amount          numeric default 0,
    status          text not null default 'INITIATED', -- PENDING, INITIATED, PROCESSING, COMPLETED, FAILED
    failure_reason  text,
    requested_at    timestamptz default now(),
    processed_at    timestamptz
);

create index if not exists idx_refunds_booking_id on public.refunds(booking_id);
create index if not exists idx_refunds_customer_id on public.refunds(customer_id);

-- 2. lounge_bookings table
create table if not exists public.lounge_bookings (
    lounge_booking_id text primary key,
    booking_id        text not null references public.bookings(booking_id),
    customer_id       text not null references public.customers(customer_id),
    flight_number     text,
    status            text not null default 'CONFIRMED', -- CONFIRMED, CANCELLED
    lounge_name       text default 'Premium Plaza Lounge',
    terminal          text default 'T3',
    booked_at         timestamptz default now(),
    access_time       timestamptz
);

create index if not exists idx_lounge_bookings_booking_id on public.lounge_bookings(booking_id);
create index if not exists idx_lounge_bookings_customer_id on public.lounge_bookings(customer_id);

-- 3. hotel_bookings table
create table if not exists public.hotel_bookings (
    hotel_booking_id  text primary key,
    booking_id        text not null references public.bookings(booking_id),
    customer_id       text not null references public.customers(customer_id),
    flight_number     text,
    status            text not null default 'CONFIRMED', -- CONFIRMED, CANCELLED
    hotel_name        text default 'Airport Transit Hotel',
    booking_reference text,
    check_in          text,
    check_out         text,
    booked_at         timestamptz default now()
);

create index if not exists idx_hotel_bookings_booking_id on public.hotel_bookings(booking_id);
create index if not exists idx_hotel_bookings_customer_id on public.hotel_bookings(customer_id);

-- 4. upgrade_requests table
create table if not exists public.upgrade_requests (
    upgrade_request_id text primary key,
    booking_id         text not null references public.bookings(booking_id),
    customer_id        text not null references public.customers(customer_id),
    requested_cabin    text default 'Business',
    status             text not null default 'NOT_ELIGIBLE', -- PENDING, APPROVED, REJECTED, NOT_ELIGIBLE
    eligibility_reason text,
    requested_at       timestamptz default now()
);

create index if not exists idx_upgrade_requests_booking_id on public.upgrade_requests(booking_id);
create index if not exists idx_upgrade_requests_customer_id on public.upgrade_requests(customer_id);
