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


def evaluate_fare_difference(
    fare_difference: float
):

    if fare_difference is None:
        fare_difference = 0.0

    if fare_difference > 1500:


        return {
            "rebooking_allowed": True,
            "fare_difference": fare_difference,
            "customer_must_pay": True,
            "waiver_requires_human": True,
            "reason": (
                "Customer may proceed by paying the fare difference. "
                "Waiving an amount above the agent authority threshold "
                "requires supervisor approval."
            ),
            "threshold": 1500
        }

    return {
        "rebooking_allowed": True,
        "fare_difference": fare_difference,
        "customer_must_pay": True,
        "waiver_requires_human": False,
        "reason": (
            "Customer may proceed by paying the applicable "
            "fare difference."
        ),
        "threshold": 1500
    }