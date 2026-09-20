from app.policies.policy_engine import (
    evaluate_delay,
    evaluate_cancellation,
    evaluate_fare_difference
)


def test_four_hour_delay():
    result = evaluate_delay(4)

    assert "meal_voucher" in result["actions"]
    assert "lounge_access" in result["actions"]
    assert "hotel_delayed_hours" not in result["actions"]


def test_six_hour_delay():
    result = evaluate_delay(6)

    assert "meal_voucher" in result["actions"]
    assert "lounge_access" in result["actions"]
    assert "hotel_delayed_hours" in result["actions"]


def test_cancellation():
    result = evaluate_cancellation()

    assert "full_refund" in result["actions"]
    assert "rebook_within_24_hours" in result["actions"]


def test_large_fare_difference():
    result = evaluate_fare_difference(2000)

    assert result["rebooking_allowed"] is True
    assert result["customer_must_pay"] is True
    assert result["waiver_requires_human"] is True
    assert result["fare_difference"] == 2000