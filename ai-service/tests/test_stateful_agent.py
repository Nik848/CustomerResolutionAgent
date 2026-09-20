"""
Automated tests for the stateful, database-driven Customer Resolution Agent.
Validates all 10 required test scenarios from the specification:
  - TEST 1: First refund request (refund created, status = INITIATED)
  - TEST 2: Duplicate refund request (idempotent, reports existing reference without re-calling)
  - TEST 3: Completed refund (reports completed, no new request)
  - TEST 4: Failed refund (reports failure, advises retry / support)
  - TEST 5: Lounge booking (eligibility -> availability -> booking -> verification)
  - TEST 6: Duplicate lounge request (reports already granted, prevents duplicate booking)
  - TEST 7: Hotel request when not eligible (delays <= 5h not eligible, no hotel booked)
  - TEST 8: Refund + lounge multi-step (independent workflows, reports respective actual states)
  - TEST 9: Ambiguous request ("Can you take care of my flight?" -> requests clarification)
  - TEST 10: Database changed externally (system responds to new database state, proving it is state-driven)
"""

import copy
import pytest
from unittest.mock import patch, MagicMock
from app.graph.workflow import build_graph

# ---------------------------------------------------------------------------
# Test Fixtures & Base Records
# ---------------------------------------------------------------------------

PASSENGER_PRIYA = {
    "customer_id": "CUST001",
    "name": "Priya Nair",
    "email": "priya.nair@example.com",
    "loyalty_tier": "Gold"
}

PASSENGER_ARVIND = {
    "customer_id": "CUST002",
    "name": "Arvind Kulkarni",
    "email": "arvind.kulkarni@example.com",
    "loyalty_tier": "Silver"
}


def _make_booking(overrides=None):
    base = {
        "booking_id": "BOOK001",
        "customer_id": "CUST001",
        "pnr": "SK4821X",
        "flight_number": "SK-204",
        "status": "cancelled",
        "delay_hours": 0,
        "refund_status": None,
        "lounge_access_status": None,
        "hotel_status": None,
        "rebooking_status": None,
        "fare_difference_waiver_status": None
    }
    if overrides:
        base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# TEST 1: First refund request
# Initial: refund_status = NONE
# Expected: refund created, refund_status = INITIATED
# ---------------------------------------------------------------------------
def test_1_first_refund_request():
    graph = build_graph()
    booking = _make_booking({"refund_status": None})

    initiate_mock = MagicMock(return_value={
        "success": True,
        "status": "INITIATED",
        "action": "full_refund",
        "entity": "refund",
        "refund_id": "RF-BOOK001",
        "booking_id": "BOOK001",
        "customer_id": "CUST001",
        "amount": 12500,
        "message": "Full refund has been successfully initiated."
    })

    with patch("app.graph.nodes.initiate_refund", initiate_mock):
        result = graph.invoke(
            {
                "customer_id": "CUST001",
                "customer": PASSENGER_PRIYA,
                "bookings": [booking],
                "user_message": "My flight SK-204 was cancelled. I want a full refund."
            },
            {"configurable": {"thread_id": "thread-test-1"}}
        )

    assert initiate_mock.called, "initiate_refund tool must be called on first request"
    response = result.get("response", "").lower()
    assert "refund" in response
    assert "initiated" in response or "success" in response


# ---------------------------------------------------------------------------
# TEST 2: Duplicate refund request
# Initial: refund_status = INITIATED
# Expected: No second refund, agent recognizes existing refund and reports reference
# ---------------------------------------------------------------------------
def test_2_duplicate_refund_request():
    graph = build_graph()
    booking = _make_booking({"refund_status": "initiated"})

    initiate_mock = MagicMock()

    with patch("app.graph.nodes.initiate_refund", initiate_mock):
        result = graph.invoke(
            {
                "customer_id": "CUST001",
                "customer": PASSENGER_PRIYA,
                "bookings": [booking],
                "user_message": "I want a full refund for SK-204."
            },
            {"configurable": {"thread_id": "thread-test-2"}}
        )

    # In our stateful evaluate_request, already initiated refund is identified before action execution
    assert not initiate_mock.called, "initiate_refund must NOT be executed for an already initiated refund"
    response = result.get("response", "").lower()
    assert "already" in response
    assert "initiated" in response or "rf-book001" in response


# ---------------------------------------------------------------------------
# TEST 3: Completed refund
# Initial: refund_status = COMPLETED
# Expected: Agent reports refund is already completed. No new refund request.
# ---------------------------------------------------------------------------
def test_3_completed_refund_request():
    graph = build_graph()
    booking = _make_booking({"refund_status": "completed"})

    initiate_mock = MagicMock()

    with patch("app.graph.nodes.initiate_refund", initiate_mock):
        result = graph.invoke(
            {
                "customer_id": "CUST001",
                "customer": PASSENGER_PRIYA,
                "bookings": [booking],
                "user_message": "Please process my refund for SK-204."
            },
            {"configurable": {"thread_id": "thread-test-3"}}
        )

    assert not initiate_mock.called, "initiate_refund must NOT be executed for a completed refund"
    response = result.get("response", "").lower()
    assert "already" in response
    assert "completed" in response


# ---------------------------------------------------------------------------
# TEST 4: Failed refund
# Initial: refund_status = FAILED
# Expected: Agent explains failure and determines whether retry / support is needed
# ---------------------------------------------------------------------------
def test_4_failed_refund_request():
    graph = build_graph()
    booking = _make_booking({"refund_status": "failed"})

    initiate_mock = MagicMock()

    with patch("app.graph.nodes.initiate_refund", initiate_mock):
        result = graph.invoke(
            {
                "customer_id": "CUST001",
                "customer": PASSENGER_PRIYA,
                "bookings": [booking],
                "user_message": "Can I get my refund for SK-204?"
            },
            {"configurable": {"thread_id": "thread-test-4"}}
        )

    assert not initiate_mock.called
    response = result.get("response", "").lower()
    assert "failed" in response
    assert "support" in response or "retry" in response


# ---------------------------------------------------------------------------
# TEST 5: Lounge booking
# Initial: no lounge booking, 4-hour delay
# Expected: eligibility -> availability -> booking -> verification -> DB update
# ---------------------------------------------------------------------------
def test_5_lounge_booking():
    graph = build_graph()
    booking = {
        "booking_id": "BOOK003",
        "customer_id": "CUST002",
        "pnr": "TR1190B",
        "flight_number": "SK-118",
        "status": "delayed",
        "delay_hours": 4,
        "lounge_access_status": None
    }

    lounge_mock = MagicMock(return_value={
        "success": True,
        "status": "CONFIRMED",
        "action": "grant_lounge_access",
        "entity": "lounge",
        "lounge_booking_id": "LNG-BOOK003",
        "lounge_name": "Premium Plaza Lounge",
        "terminal": "T3",
        "booking_id": "BOOK003",
        "customer_id": "CUST002",
        "message": "Lounge access has been successfully granted."
    })

    with patch("app.graph.nodes.grant_lounge_access", lounge_mock):
        result = graph.invoke(
            {
                "customer_id": "CUST002",
                "customer": PASSENGER_ARVIND,
                "bookings": [booking],
                "user_message": "Book my lounge access for flight SK-118."
            },
            {"configurable": {"thread_id": "thread-test-5"}}
        )

    assert lounge_mock.called, "grant_lounge_access tool must be called"
    response = result.get("response", "").lower()
    assert "lounge" in response
    assert "granted" in response or "access" in response


# ---------------------------------------------------------------------------
# TEST 6: Duplicate lounge request
# Initial: lounge booking already exists.
# Expected: Agent does not create another booking and recognizes existing state
# ---------------------------------------------------------------------------
def test_6_duplicate_lounge_request():
    graph = build_graph()
    booking = {
        "booking_id": "BOOK003",
        "customer_id": "CUST002",
        "pnr": "TR1190B",
        "flight_number": "SK-118",
        "status": "delayed",
        "delay_hours": 4,
        "lounge_access_status": "granted"
    }

    lounge_mock = MagicMock()

    with patch("app.graph.nodes.grant_lounge_access", lounge_mock):
        result = graph.invoke(
            {
                "customer_id": "CUST002",
                "customer": PASSENGER_ARVIND,
                "bookings": [booking],
                "user_message": "Book my lounge access again."
            },
            {"configurable": {"thread_id": "thread-test-6"}}
        )

    assert not lounge_mock.called, "grant_lounge_access must NOT be called again when already granted"
    response = result.get("response", "").lower()
    assert "lounge" in response
    assert "already" in response


# ---------------------------------------------------------------------------
# TEST 7: Hotel request when not eligible
# Initial: 4-hour delay (hotel requires > 5 hours)
# Expected: Agent retrieves policy, determines not eligible, does NOT call hotel booking
# ---------------------------------------------------------------------------
def test_7_hotel_request_not_eligible():
    graph = build_graph()
    booking = {
        "booking_id": "BOOK003",
        "customer_id": "CUST002",
        "pnr": "TR1190B",
        "flight_number": "SK-118",
        "status": "delayed",
        "delay_hours": 4,
        "hotel_status": None
    }

    hotel_mock = MagicMock()

    with patch("app.graph.nodes.arrange_hotel", hotel_mock):
        result = graph.invoke(
            {
                "customer_id": "CUST002",
                "customer": PASSENGER_ARVIND,
                "bookings": [booking],
                "user_message": "My flight SK-118 is delayed by 4 hours. Can you arrange a hotel for me?"
            },
            {"configurable": {"thread_id": "thread-test-7"}}
        )

    assert not hotel_mock.called, "arrange_hotel must NOT be called for delays <= 5 hours"
    response = result.get("response", "").lower()
    assert "hotel" in response
    assert any(kw in response for kw in ("cannot", "5 hours", "not eligible", "only when the delay is more than 5"))


# ---------------------------------------------------------------------------
# TEST 8: Refund + Lounge (Multi-step request)
# User asks for both refund and lounge on cancelled flight.
# Expected: Performs both workflows independently and returns their actual states.
# ---------------------------------------------------------------------------
def test_8_refund_and_lounge_multistep():
    graph = build_graph()
    booking = _make_booking({"status": "cancelled", "refund_status": None})

    initiate_mock = MagicMock(return_value={
        "success": True,
        "status": "INITIATED",
        "action": "full_refund",
        "entity": "refund",
        "refund_id": "RF-BOOK001",
        "message": "Full refund has been successfully initiated."
    })
    lounge_mock = MagicMock()

    with (
        patch("app.graph.nodes.initiate_refund", initiate_mock),
        patch("app.graph.nodes.grant_lounge_access", lounge_mock)
    ):
        result = graph.invoke(
            {
                "customer_id": "CUST001",
                "customer": PASSENGER_PRIYA,
                "bookings": [booking],
                "user_message": "My flight was cancelled. I want my refund and lounge access."
            },
            {"configurable": {"thread_id": "thread-test-8"}}
        )

    assert initiate_mock.called, "Refund tool should execute"
    assert not lounge_mock.called, "Lounge tool should NOT execute on cancelled flight"
    response = result.get("response", "").lower()
    assert "refund" in response
    assert "lounge" in response


# ---------------------------------------------------------------------------
# TEST 9: Ambiguous request
# Example: "Can you take care of my flight?"
# Expected: Agent asks an appropriate clarification instead of inventing an action
# ---------------------------------------------------------------------------
def test_9_ambiguous_request():
    graph = build_graph()
    booking = _make_booking()

    initiate_mock = MagicMock()
    hotel_mock = MagicMock()
    lounge_mock = MagicMock()

    with (
        patch("app.graph.nodes.initiate_refund", initiate_mock),
        patch("app.graph.nodes.arrange_hotel", hotel_mock),
        patch("app.graph.nodes.grant_lounge_access", lounge_mock)
    ):
        result = graph.invoke(
            {
                "customer_id": "CUST001",
                "customer": PASSENGER_PRIYA,
                "bookings": [booking],
                "user_message": "Can you take care of my flight?"
            },
            {"configurable": {"thread_id": "thread-test-9"}}
        )

    assert not initiate_mock.called
    assert not hotel_mock.called
    assert not lounge_mock.called
    assert result.get("selected_booking") is None
    response = result.get("response", "").lower()
    assert any(kw in response for kw in ("clarify", "how", "assist", "refund", "rebook"))


# ---------------------------------------------------------------------------
# TEST 10: Database changed externally
# After the first conversation, change the database state externally.
# Then send the same request again.
# Expected: Agent responds according to the NEW database state, not the old conversation.
# ---------------------------------------------------------------------------
def test_10_database_changed_externally():
    graph = build_graph()

    # Step 1: Initial state in DB is refund_status = None
    booking_v1 = _make_booking({"refund_status": None})
    initiate_mock = MagicMock(return_value={
        "success": True,
        "status": "INITIATED",
        "action": "full_refund",
        "refund_id": "RF-BOOK001",
        "message": "Initiated"
    })

    with patch("app.graph.nodes.initiate_refund", initiate_mock):
        result_1 = graph.invoke(
            {
                "customer_id": "CUST001",
                "customer": PASSENGER_PRIYA,
                "bookings": [booking_v1],
                "user_message": "What is the status of my refund for SK-204?"
            },
            {"configurable": {"thread_id": "thread-test-10"}}
        )

    # Step 2: An external administrator or payment system changes DB to COMPLETED
    booking_v2 = _make_booking({"refund_status": "completed"})

    initiate_mock_2 = MagicMock()
    with patch("app.graph.nodes.initiate_refund", initiate_mock_2):
        result_2 = graph.invoke(
            {
                "customer_id": "CUST001",
                "customer": PASSENGER_PRIYA,
                "bookings": [booking_v2],
                "user_message": "What is the status of my refund for SK-204?"
            },
            {"configurable": {"thread_id": "thread-test-10"}}
        )

    assert not initiate_mock_2.called
    response_2 = result_2.get("response", "").lower()
    assert "already" in response_2
    assert "completed" in response_2


# ---------------------------------------------------------------------------
# TEST 11: Waiver requested with NO fare difference on record (Arvind scenario)
# Expected: Agent does NOT trigger human approval or invent ₹2000. Explains no fare difference on record.
# ---------------------------------------------------------------------------
def test_11_waiver_with_no_fare_difference_on_record():
    graph = build_graph()
    booking = {
        "booking_id": "BOOK003",
        "customer_id": "CUST002",
        "pnr": "TR1190B",
        "flight_number": "SK-118",
        "status": "delayed",
        "delay_hours": 4,
        "fare_difference": None
    }

    result = graph.invoke(
        {
            "customer_id": "CUST002",
            "customer": PASSENGER_ARVIND,
            "bookings": [booking],
            "user_message": "Please waive the fare difference for my new booking"
        },
        {"configurable": {"thread_id": "thread-test-11"}}
    )

    # Must NOT require human approval
    assert "__interrupt__" not in result, "Should not interrupt for human approval when no fare difference exists"
    assert result.get("decision", {}).get("status") == "no_fare_difference_on_record"
    response = result.get("response", "").lower()
    assert "no recorded fare difference" in response or "no pending fare difference" in response
    assert "2,000" not in response and "2000" not in response

