import json
from pathlib import Path


DATA_PATH = Path(__file__).resolve().parents[2] / "data"


def load_bookings():
    file_path = DATA_PATH / "bookings" / "bookings.json"

    with open(file_path, "r", encoding="utf-8") as file:
        return json.load(file)


def get_bookings_by_customer_id(customer_id: str):
    bookings = load_bookings()

    return [
        booking
        for booking in bookings
        if booking["customer_id"].upper() == customer_id.upper()
    ]