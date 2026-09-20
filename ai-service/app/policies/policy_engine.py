def evaluate_delay(delay_hours: float):
    actions = []

    if delay_hours > 5:
        actions = [
            "meal_voucher",
            "lounge_access",
            "hotel_delayed_hours"
        ]

    elif delay_hours > 3:
        actions = [
            "meal_voucher",
            "lounge_access"
        ]

    elif delay_hours > 0:
        actions = [
            "meal_voucher"
        ]

    return {
        "allowed": True,
        "actions": actions
    }


def evaluate_cancellation():
    return {
        "allowed": True,
        "actions": [
            "rebook_within_24_hours",
            "full_refund"
        ]
    }


def evaluate_fare_difference(fare_difference: float):
    if fare_difference > 1500:
        return {
            "allowed": False,
            "requires_human": True,
            "reason": "Fare difference exceeds agent authority.",
            "fare_difference": fare_difference,
            "threshold": 1500
        }

    return {
        "allowed": True,
        "requires_human": False,
        "reason": "Fare difference is within agent authority.",
        "fare_difference": fare_difference
    }