-- ============================================================
-- Check if seed data exists and re-insert if missing
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Check current data
SELECT 'CUSTOMERS' as table_name, COUNT(*) as row_count FROM public.customers
UNION ALL
SELECT 'BOOKINGS', COUNT(*) FROM public.bookings;

-- Delete existing data (if any) to start fresh
DELETE FROM public.bookings;
DELETE FROM public.customers;

-- Re-insert seed customers
INSERT INTO public.customers
    (customer_id, name, loyalty_tier, email, phone, travel_history)
VALUES
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
    );

-- Re-insert seed bookings
INSERT INTO public.bookings
    (booking_id, customer_id, pnr, flight_number, origin, destination,
     date, scheduled_departure, status, delay_hours, new_departure,
     disruption_reason, fare_difference)
VALUES
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
     'delayed', 6, '20:00', null, 2000);

-- Verify data was inserted
SELECT 'CUSTOMERS AFTER INSERT' as status, COUNT(*) as count FROM public.customers
UNION ALL
SELECT 'BOOKINGS AFTER INSERT', COUNT(*) FROM public.bookings;

-- Show the data
SELECT '[CUSTOMERS]' as section;
SELECT * FROM public.customers;

SELECT '[BOOKINGS]' as section;
SELECT * FROM public.bookings;
