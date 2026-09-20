import json
from pathlib import Path


DATA_PATH = Path(__file__).resolve().parents[2] / "data"


def load_policies():
    file_path = DATA_PATH / "policies" / "policies.json"

    with open(file_path, "r", encoding="utf-8") as file:
        return json.load(file)


def retrieve_policies(category: str):
    policies = load_policies()

    return [
        policy
        for policy in policies
        if policy["category"] == category
    ]