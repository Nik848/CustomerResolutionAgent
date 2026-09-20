import json
from pathlib import Path
from datetime import datetime


DATA_PATH = Path(__file__).resolve().parents[2] / "data"


def load_bookings():
    file_path = DATA_PATH / "bookings" / "bookings.json"

    with open(file_path, "r", encoding="utf-8") as file:
        return json.load(file)


def save_bookings(bookings):
    file_path = DATA_PATH / "bookings" / "bookings.json"

    with open(file_path, "w", encoding="utf-8") as file:
        json.dump(
            bookings,
            file,
            indent=2
        )


def initiate_refund(
    booking_id: str,
    customer_id: str
):
    """
    Initiates a refund for a customer's cancelled booking.

    This is a simulated airline action for the prototype.
    """

    bookings = load_bookings()

    for booking in bookings:

        if (
            booking.get("booking_id") == booking_id
            and booking.get("customer_id") == customer_id
        ):

            if booking.get("status") != "cancelled":

                return {
                    "success": False,
                    "action": "initiate_refund",
                    "message": (
                        "Refund can only be initiated "
                        "for a cancelled booking."
                    )
                }

            # Prevent duplicate refund actions
            if booking.get("refund_status") == "initiated":

                return {
                    "success": False,
                    "action": "initiate_refund",
                    "message": "Refund has already been initiated."
                }

            booking["refund_status"] = "initiated"

            booking["refund_initiated_at"] = (
                datetime.utcnow().isoformat()
            )

            save_bookings(bookings)

            return {
                "success": True,
                "action": "initiate_refund",
                "booking_id": booking_id,
                "customer_id": customer_id,
                "message": (
                    "Refund has been successfully initiated."
                )
            }

    return {
        "success": False,
        "action": "initiate_refund",
        "message": "Booking could not be found."
    }

def rebook_flight(booking_id: str, customer_id: str):
    """
    Simulates rebooking a disrupted flight within the allowed window.
    """

    bookings = load_bookings()

    for booking in bookings:
        if (
            booking.get("booking_id") == booking_id
            and booking.get("customer_id") == customer_id
        ):

            if booking.get("status") not in {"cancelled", "delayed"}:
                return {
                    "success": False,
                    "action": "rebook_flight",
                    "message": "This booking is not currently eligible for rebooking."
                }

            if booking.get("rebooking_status") == "confirmed":
                return {
                    "success": False,
                    "action": "rebook_flight",
                    "message": "This booking has already been rebooked."
                }

            booking["rebooking_status"] = "confirmed"
            booking["rebooked_at"] = datetime.utcnow().isoformat()

            save_bookings(bookings)

            return {
                "success": True,
                "action": "rebook_flight",
                "booking_id": booking_id,
                "customer_id": customer_id,
                "message": "Flight has been successfully rebooked."
            }

    return {
        "success": False,
        "action": "rebook_flight",
        "message": "Booking could not be found."
    }


def issue_meal_voucher(booking_id: str, customer_id: str):
    """
    Simulates issuing a meal voucher for an eligible disrupted flight.
    """

    bookings = load_bookings()

    for booking in bookings:
        if (
            booking.get("booking_id") == booking_id
            and booking.get("customer_id") == customer_id
        ):

            if booking.get("status") != "delayed":
                return {
                    "success": False,
                    "action": "issue_meal_voucher",
                    "message": "Meal voucher is only available for delayed flights."
                }

            if booking.get("meal_voucher_status") == "issued":
                return {
                    "success": False,
                    "action": "issue_meal_voucher",
                    "message": "Meal voucher has already been issued."
                }

            booking["meal_voucher_status"] = "issued"
            booking["meal_voucher_issued_at"] = datetime.utcnow().isoformat()

            save_bookings(bookings)

            return {
                "success": True,
                "action": "issue_meal_voucher",
                "booking_id": booking_id,
                "customer_id": customer_id,
                "message": "Meal voucher has been successfully issued."
            }

    return {
        "success": False,
        "action": "issue_meal_voucher",
        "message": "Booking could not be found."
    }


def grant_lounge_access(booking_id: str, customer_id: str):
    """
    Simulates granting lounge access for an eligible delayed flight.
    """

    bookings = load_bookings()

    for booking in bookings:
        if (
            booking.get("booking_id") == booking_id
            and booking.get("customer_id") == customer_id
        ):

            if booking.get("status") != "delayed":
                return {
                    "success": False,
                    "action": "grant_lounge_access",
                    "message": "Lounge access is only available for delayed flights."
                }

            if booking.get("lounge_access_status") == "granted":
                return {
                    "success": False,
                    "action": "grant_lounge_access",
                    "message": "Lounge access has already been granted."
                }

            booking["lounge_access_status"] = "granted"
            booking["lounge_access_granted_at"] = datetime.utcnow().isoformat()

            save_bookings(bookings)

            return {
                "success": True,
                "action": "grant_lounge_access",
                "booking_id": booking_id,
                "customer_id": customer_id,
                "message": "Lounge access has been successfully granted."
            }

    return {
        "success": False,
        "action": "grant_lounge_access",
        "message": "Booking could not be found."
    }


def arrange_hotel(booking_id: str, customer_id: str):
    """
    Simulates arranging hotel accommodation for the qualifying
    delayed hours of a disrupted flight.
    """

    bookings = load_bookings()

    for booking in bookings:
        if (
            booking.get("booking_id") == booking_id
            and booking.get("customer_id") == customer_id
        ):

            if booking.get("status") != "delayed":
                return {
                    "success": False,
                    "action": "arrange_hotel",
                    "message": "Hotel accommodation is only available for eligible delayed flights."
                }

            if booking.get("delay_hours", 0) <= 5:
                return {
                    "success": False,
                    "action": "arrange_hotel",
                    "message": "This delay does not qualify for hotel accommodation."
                }

            if booking.get("hotel_status") == "arranged":
                return {
                    "success": False,
                    "action": "arrange_hotel",
                    "message": "Hotel accommodation has already been arranged."
                }

            booking["hotel_status"] = "arranged"
            booking["hotel_arranged_at"] = datetime.utcnow().isoformat()

            save_bookings(bookings)

            return {
                "success": True,
                "action": "arrange_hotel",
                "booking_id": booking_id,
                "customer_id": customer_id,
                "message": "Hotel accommodation has been successfully arranged for the qualifying delayed hours."
            }

    return {
        "success": False,
        "action": "arrange_hotel",
        "message": "Booking could not be found."
    }