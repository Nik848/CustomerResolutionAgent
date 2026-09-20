from datetime import datetime
from pathlib import Path
import json


AUDIT_PATH = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "audit"
    / "audit_log.json"
)


def log_event(
    event_type: str,
    customer_id: str | None = None,
    booking_id: str | None = None,
    details: dict | None = None
):
    AUDIT_PATH.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    if AUDIT_PATH.exists():

        with open(
            AUDIT_PATH,
            "r",
            encoding="utf-8"
        ) as file:

            events = json.load(file)

    else:

        events = []

    event = {
        "timestamp": datetime.utcnow().isoformat(),
        "event_type": event_type,
        "customer_id": customer_id,
        "booking_id": booking_id,
        "details": details or {}
    }

    events.append(event)

    with open(
        AUDIT_PATH,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            events,
            file,
            indent=2
        )

    return event