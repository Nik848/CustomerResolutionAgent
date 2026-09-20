from app.tools.customer_tools import get_customer_by_id
from app.tools.booking_tools import get_bookings_by_customer_id


def test_get_priya():

    customer = get_customer_by_id("CUST001")

    assert customer is not None
    assert customer["name"] == "Priya Nair"
    assert customer["customer_id"] == "CUST001"


def test_get_priya_bookings():

    bookings = get_bookings_by_customer_id("CUST001")

    assert len(bookings) == 2

    flight_numbers = [
        booking["flight_number"]
        for booking in bookings
    ]

    assert "SK-204" in flight_numbers
    assert "RETURN" in flight_numbers


def test_get_arvind():

    customer = get_customer_by_id("CUST002")

    assert customer["name"] == "Arvind Kulkarni"

    bookings = get_bookings_by_customer_id("CUST002")

    assert len(bookings) == 1
    assert bookings[0]["flight_number"] == "SK-118"


def test_get_meher():

    customer = get_customer_by_id("CUST003")

    assert customer["name"] == "Meher Kaur"

    bookings = get_bookings_by_customer_id("CUST003")

    assert len(bookings) == 1
    assert bookings[0]["flight_number"] == "SK-305"