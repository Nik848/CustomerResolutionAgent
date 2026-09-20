"""
Unit tests for customer_tools and booking_tools.
These tests mock the backend_client HTTP layer so no live backend is required.
"""
from unittest.mock import patch


PRIYA = {
    "customer_id": "CUST001",
    "name": "Priya Nair",
    "email": "priya.nair@example.com",
    "loyalty_tier": "Gold",
    "phone": "+91-98xxxxxxx1"
}

PRIYA_BOOKINGS = [
    {"booking_id": "BOOK001", "flight_number": "SK-204", "status": "cancelled", "customer_id": "CUST001"},
    {"booking_id": "BOOK002", "flight_number": "RETURN", "status": "unaffected", "customer_id": "CUST001"}
]

ARVIND = {
    "customer_id": "CUST002",
    "name": "Arvind Kulkarni",
    "email": "arvind.kulkarni@example.com",
    "loyalty_tier": "Silver"
}

ARVIND_BOOKINGS = [
    {"booking_id": "BOOK003", "flight_number": "SK-118", "status": "delayed", "delay_hours": 4, "customer_id": "CUST002"}
]

MEHER = {
    "customer_id": "CUST003",
    "name": "Meher Kaur",
    "email": "meher.kaur@example.com",
    "loyalty_tier": "Gold"
}

MEHER_BOOKINGS = [
    {"booking_id": "BOOK004", "flight_number": "SK-305", "status": "delayed", "delay_hours": 6,
     "fare_difference": 2000, "customer_id": "CUST003"}
]


def test_get_priya():
    with patch("app.tools.customer_tools.fetch_from_backend", return_value=PRIYA):
        from app.tools.customer_tools import get_customer_by_id
        customer = get_customer_by_id("CUST001")
    assert customer is not None
    assert customer["name"] == "Priya Nair"
    assert customer["customer_id"] == "CUST001"


def test_get_priya_bookings():
    with patch("app.tools.booking_tools.fetch_from_backend", return_value=PRIYA_BOOKINGS):
        from app.tools.booking_tools import get_bookings_by_customer_id
        bookings = get_bookings_by_customer_id("CUST001")
    assert len(bookings) == 2
    flight_numbers = [b["flight_number"] for b in bookings]
    assert "SK-204" in flight_numbers
    assert "RETURN" in flight_numbers


def test_get_arvind():
    with patch("app.tools.customer_tools.fetch_from_backend", return_value=ARVIND):
        from app.tools.customer_tools import get_customer_by_id
        customer = get_customer_by_id("CUST002")
    assert customer["name"] == "Arvind Kulkarni"

    with patch("app.tools.booking_tools.fetch_from_backend", return_value=ARVIND_BOOKINGS):
        from app.tools.booking_tools import get_bookings_by_customer_id
        bookings = get_bookings_by_customer_id("CUST002")
    assert len(bookings) == 1
    assert bookings[0]["flight_number"] == "SK-118"


def test_get_meher():
    with patch("app.tools.customer_tools.fetch_from_backend", return_value=MEHER):
        from app.tools.customer_tools import get_customer_by_id
        customer = get_customer_by_id("CUST003")
    assert customer["name"] == "Meher Kaur"

    with patch("app.tools.booking_tools.fetch_from_backend", return_value=MEHER_BOOKINGS):
        from app.tools.booking_tools import get_bookings_by_customer_id
        bookings = get_bookings_by_customer_id("CUST003")
    assert len(bookings) == 1
    assert bookings[0]["flight_number"] == "SK-305"