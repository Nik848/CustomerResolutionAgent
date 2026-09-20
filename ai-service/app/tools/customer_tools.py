import json
from pathlib import Path


DATA_PATH = Path(__file__).resolve().parents[2] / "data"


def load_customers():
    file_path = DATA_PATH / "customers" / "customers.json"

    with open(file_path, "r", encoding="utf-8") as file:
        return json.load(file)


def get_customer_by_pnr(pnr: str):
    customers = load_customers()

    for customer in customers:
        if customer["pnr"].upper() == pnr.upper():
            return customer

    return None