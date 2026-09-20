"""
End-to-end tests for the Customer Resolution Agent LangGraph flow.

These tests cover every scenario listed in the assignment brief:
  - CUST001: Cancelled flight → full refund
  - CUST001: Cancelled flight → rebook within 24 hours
  - CUST002: 4-hour delay → meal voucher + lounge (no hotel)
  - CUST003: 6-hour delay → meal voucher + lounge + hotel
  - CUST003: Fare difference waiver → HITL approve
  - CUST003: Fare difference waiver → HITL reject
  - Audit log is written after every action

We patch `understand_request` at the node level so we don't burn Groq
API quota on tests — the LLM is already tested in isolation elsewhere.
"""

import json
import copy
import shutil
from pathlib import Path
from unittest.mock import patch

import pytest
from langgraph.types import Command

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

DATA_DIR = (
    Path(__file__).resolve().parents[1] / "data"
)

BOOKINGS_FILE = DATA_DIR / "bookings" / "bookings.json"
AUDIT_FILE    = DATA_DIR / "audit" / "audit_log.json"


# Original clean booking records — restored before each test so action
# guards ("already initiated", "already issued", etc.) don't trip.
_CLEAN_BOOKINGS = [
    {
        "booking_id": "BOOK001",
        "customer_id": "CUST001",
        "pnr": "SK4821X",
        "flight_number": "SK-204",
        "origin": "Delhi",
        "destination": "Goa",
        "date": "2026-09-23",
        "scheduled_departure": "18:40",
        "status": "cancelled",
        "delay_hours": 0,
        "disruption_reason": "operational",
    },
    {
        "booking_id": "BOOK002",
        "customer_id": "CUST001",
        "pnr": "SK4821X",
        "flight_number": "RETURN",
        "origin": "Goa",
        "destination": "Delhi",
        "date": "2026-09-25",
        "scheduled_departure": "16:20",
        "status": "unaffected",
        "delay_hours": 0,
        "disruption_reason": None,
    },
    {
        "booking_id": "BOOK003",
        "customer_id": "CUST002",
        "pnr": "TR1190B",
        "flight_number": "SK-118",
        "origin": "Mumbai",
        "destination": "Bengaluru",
        "date": "2026-09-23",
        "scheduled_departure": "07:10",
        "status": "delayed",
        "delay_hours": 4,
        "new_departure": "11:10",
        "disruption_reason": None,
    },
    {
        "booking_id": "BOOK004",
        "customer_id": "CUST003",
        "pnr": "WL7742",
        "flight_number": "SK-305",
        "origin": "Delhi",
        "destination": "Hyderabad",
        "date": "2026-09-23",
        "scheduled_departure": "14:00",
        "status": "delayed",
        "delay_hours": 6,
        "new_departure": "20:00",
        "disruption_reason": None,
        "fare_difference": 2000,
    },
]


def _reset_bookings():
    """Write clean seed data back to disk before each test."""
    BOOKINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    BOOKINGS_FILE.write_text(
        json.dumps(copy.deepcopy(_CLEAN_BOOKINGS), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def _reset_audit():
    """Start each test with an empty audit log."""
    AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
    AUDIT_FILE.write_text("[]", encoding="utf-8")


def _read_audit():
    """Load the current audit log from disk."""
    if not AUDIT_FILE.exists():
        return []
    return json.loads(AUDIT_FILE.read_text(encoding="utf-8"))


def _read_bookings():
    """Load the current bookings from disk."""
    return json.loads(BOOKINGS_FILE.read_text(encoding="utf-8"))


@pytest.fixture(autouse=True)
def clean_state():
    """Runs before every test — gives each one a clean slate."""
    _reset_bookings()
    _reset_audit()
    yield


def _build_graph():
    """Import and compile the graph fresh for each test run."""
    from app.graph.workflow import build_graph
    return build_graph()


# ─────────────────────────────────────────────────────────────────────────────
# CUST001 — Cancelled flight scenarios
# ─────────────────────────────────────────────────────────────────────────────

class TestCUST001Cancellation:

    def test_full_refund(self):
        """
        Priya's flight SK-204 was cancelled.
        She asks for a refund — action executes, audit log is written.
        """
        graph = _build_graph()

        with patch(
            "app.graph.nodes.agent.understand_request",
            return_value={"intent": "cancellation", "requested_action": "refund"},
        ):
            result = graph.invoke(
                {
                    "customer_id": "CUST001",
                    "user_message": "My flight SK-204 was cancelled. I want a refund.",
                },
                {"configurable": {"thread_id": "test-cust001-refund"}},
            )

        # No interrupt should have fired
        assert "__interrupt__" not in result

        response = result.get("response", "")
        assert response, "Expected a non-empty response"

        # The booking should now be marked as refund initiated
        bookings = _read_bookings()
        book001 = next(b for b in bookings if b["booking_id"] == "BOOK001")
        assert book001.get("refund_status") == "initiated", (
            "Refund should be marked initiated in the data store"
        )

        # At least one audit event should have been recorded
        audit = _read_audit()
        assert len(audit) >= 1

        action_events = [e for e in audit if e["event_type"] == "action_executed"]
        assert action_events, "Expected at least one action_executed audit event"

        event = action_events[0]
        assert event["customer_id"] == "CUST001"
        assert event["booking_id"] == "BOOK001"

        # Response should mention refund or the flight
        lower = response.lower()
        assert any(kw in lower for kw in ("refund", "initiated", "sk-204")), (
            f"Response didn't mention refund: {response}"
        )

    def test_rebook_within_24_hours(self):
        """
        Priya's flight SK-204 was cancelled.
        She prefers rebooking — action executes, audit log is written.
        """
        graph = _build_graph()

        with patch(
            "app.graph.nodes.agent.understand_request",
            return_value={"intent": "rebooking", "requested_action": "rebook"},
        ):
            result = graph.invoke(
                {
                    "customer_id": "CUST001",
                    "user_message": (
                        "My flight SK-204 was cancelled. "
                        "Please rebook me on another flight."
                    ),
                },
                {"configurable": {"thread_id": "test-cust001-rebook"}},
            )

        assert "__interrupt__" not in result

        bookings = _read_bookings()
        book001 = next(b for b in bookings if b["booking_id"] == "BOOK001")
        assert book001.get("rebooking_status") == "confirmed", (
            "Rebooking should be confirmed in the data store"
        )

        audit = _read_audit()
        action_events = [e for e in audit if e["event_type"] == "action_executed"]
        assert action_events, "Expected action_executed in the audit log"

        response = result.get("response", "").lower()
        assert any(kw in response for kw in ("rebook", "alternative", "flight", "next")), (
            f"Response didn't mention rebooking: {response}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# CUST002 — 4-hour delay (meal voucher + lounge, no hotel)
# ─────────────────────────────────────────────────────────────────────────────

class TestCUST002FourHourDelay:

    def test_meal_and_lounge_no_hotel(self):
        """
        Arvind's flight SK-118 is delayed 4 hours.
        Policy: meal voucher + lounge access. Hotel must NOT be arranged.
        """
        graph = _build_graph()

        with patch(
            "app.graph.nodes.agent.understand_request",
            return_value={"intent": "delay", "requested_action": None},
        ):
            result = graph.invoke(
                {
                    "customer_id": "CUST002",
                    "user_message": "My flight SK-118 is delayed. What can I get?",
                },
                {"configurable": {"thread_id": "test-cust002-delay"}},
            )

        assert "__interrupt__" not in result

        bookings = _read_bookings()
        book003 = next(b for b in bookings if b["booking_id"] == "BOOK003")

        # Meal voucher and lounge should have been issued
        assert book003.get("meal_voucher_status") == "issued", (
            "Meal voucher should be issued for a 4-hour delay"
        )
        assert book003.get("lounge_access_status") == "granted", (
            "Lounge access should be granted for a 4-hour delay"
        )

        # Hotel must NOT have been arranged — policy only kicks in above 5 h
        assert book003.get("hotel_status") != "arranged", (
            "Hotel must not be arranged for a 4-hour delay"
        )

        audit = _read_audit()
        action_events = [e for e in audit if e["event_type"] == "action_executed"]
        assert action_events

        # Both actions should appear in the first audit entry
        first_event = action_events[0]
        actions_taken = first_event.get("details", {}).get("actions", [])
        assert "meal_voucher" in actions_taken
        assert "lounge_access" in actions_taken
        assert "hotel_delayed_hours" not in actions_taken

        response = result.get("response", "").lower()
        assert "meal" in response or "voucher" in response, (
            f"Response should mention meal voucher: {response}"
        )
        assert "lounge" in response, (
            f"Response should mention lounge: {response}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# CUST003 — 6-hour delay (meal + lounge + hotel)
# ─────────────────────────────────────────────────────────────────────────────

class TestCUST003SixHourDelay:

    def test_meal_lounge_and_hotel(self):
        """
        Meher's flight SK-305 is delayed 6 hours.
        Policy: meal voucher + lounge + hotel for the delayed hours.
        """
        graph = _build_graph()

        with patch(
            "app.graph.nodes.agent.understand_request",
            return_value={"intent": "delay", "requested_action": None},
        ):
            result = graph.invoke(
                {
                    "customer_id": "CUST003",
                    "user_message": "My flight SK-305 is delayed by 6 hours. Help please.",
                },
                {"configurable": {"thread_id": "test-cust003-delay"}},
            )

        assert "__interrupt__" not in result

        bookings = _read_bookings()
        book004 = next(b for b in bookings if b["booking_id"] == "BOOK004")

        assert book004.get("meal_voucher_status") == "issued"
        assert book004.get("lounge_access_status") == "granted"
        assert book004.get("hotel_status") == "arranged", (
            "Hotel must be arranged for a 6-hour delay"
        )

        audit = _read_audit()
        action_events = [e for e in audit if e["event_type"] == "action_executed"]
        assert action_events

        first_event = action_events[0]
        actions_taken = first_event.get("details", {}).get("actions", [])
        assert "meal_voucher" in actions_taken
        assert "lounge_access" in actions_taken
        assert "hotel_delayed_hours" in actions_taken

        response = result.get("response", "").lower()
        assert "hotel" in response, (
            f"Response should mention hotel accommodation: {response}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# CUST003 — Fare difference waiver with HITL
# ─────────────────────────────────────────────────────────────────────────────

class TestCUST003FareDifferenceHITL:

    def _invoke_waiver_request(self, graph, thread_id):
        """
        Helper: sends Meher's waiver request and returns the result dict.
        Expects the graph to pause (interrupt) for supervisor input.
        """
        with patch(
            "app.graph.nodes.agent.understand_request",
            return_value={
                "intent": "fare_difference",
                "requested_action": "waive_fare_difference",
            },
        ):
            return graph.invoke(
                {
                    "customer_id": "CUST003",
                    "user_message": (
                        "I want to switch to the earlier SK-305 departure "
                        "but I don't want to pay the ₹2,000 fare difference. "
                        "Can you waive it?"
                    ),
                },
                {"configurable": {"thread_id": thread_id}},
            )

    def test_supervisor_approves_waiver(self):
        """
        Meher requests a waiver for a ₹2,000 fare difference.
        The graph should pause and ask for supervisor input.
        Supervisor approves → graph resumes → response confirms waiver.
        Audit log must have both human_approval_requested and
        human_approval_received events.
        """
        graph  = _build_graph()
        tid    = "test-cust003-hitl-approve"
        result = self._invoke_waiver_request(graph, tid)

        # Graph must have paused here — the interrupt key signals that
        assert "__interrupt__" in result, (
            "Expected the graph to pause for supervisor approval"
        )

        # Audit must record that approval was requested before the pause
        audit = _read_audit()
        req_events = [e for e in audit if e["event_type"] == "human_approval_requested"]
        assert req_events, "human_approval_requested must be in the audit log before pause"
        assert req_events[0]["customer_id"] == "CUST003"
        assert req_events[0]["booking_id"] == "BOOK004"

        # Now the supervisor approves
        result = graph.invoke(
            Command(resume={"status": "approve"}),
            {"configurable": {"thread_id": tid}},
        )

        assert "__interrupt__" not in result, (
            "Graph should have finished after supervisor decision"
        )

        response = result.get("response", "").lower()
        assert any(kw in response for kw in ("approved", "waiver", "waived", "not be charged")), (
            f"Response should confirm approval: {response}"
        )

        # Audit must now also have the received event
        audit = _read_audit()
        recv_events = [e for e in audit if e["event_type"] == "human_approval_received"]
        assert recv_events, "human_approval_received must be in the audit log after resume"

        exec_events = [e for e in audit if e["event_type"] == "action_executed"]
        assert exec_events, "action_executed must be logged after supervisor approves"

        # The logged outcome should reflect approval
        assert exec_events[0]["details"].get("status") == "approved"

    def test_supervisor_rejects_waiver(self):
        """
        Meher requests a waiver. Supervisor rejects it.
        Graph resumes → response tells Meher she must pay the difference.
        Audit records the rejection.
        """
        graph  = _build_graph()
        tid    = "test-cust003-hitl-reject"
        result = self._invoke_waiver_request(graph, tid)

        assert "__interrupt__" in result, (
            "Expected graph to pause for supervisor approval"
        )

        # Supervisor rejects
        result = graph.invoke(
            Command(resume={"status": "reject"}),
            {"configurable": {"thread_id": tid}},
        )

        assert "__interrupt__" not in result

        response = result.get("response", "").lower()
        assert any(kw in response for kw in ("not approved", "rejected", "must pay", "paying", "difference")), (
            f"Response should communicate rejection: {response}"
        )

        audit = _read_audit()
        exec_events = [e for e in audit if e["event_type"] == "action_executed"]
        assert exec_events, "action_executed must be logged after supervisor rejects"

        assert exec_events[0]["details"].get("status") == "rejected"


# ─────────────────────────────────────────────────────────────────────────────
# Audit log integrity
# ─────────────────────────────────────────────────────────────────────────────

class TestAuditLog:

    def test_audit_log_schema(self):
        """
        After a refund action, every entry in the audit log must have
        the required fields: timestamp, event_type, customer_id,
        booking_id, details.
        """
        graph = _build_graph()

        with patch(
            "app.graph.nodes.agent.understand_request",
            return_value={"intent": "cancellation", "requested_action": "refund"},
        ):
            graph.invoke(
                {
                    "customer_id": "CUST001",
                    "user_message": "Flight SK-204 cancelled, I want a refund.",
                },
                {"configurable": {"thread_id": "test-audit-schema"}},
            )

        audit = _read_audit()
        assert len(audit) >= 1, "At least one audit event should exist"

        required_fields = {"timestamp", "event_type", "customer_id", "booking_id", "details"}
        for entry in audit:
            missing = required_fields - set(entry.keys())
            assert not missing, f"Audit entry missing fields: {missing}\n{entry}"

    def test_audit_contains_correct_customer(self):
        """
        Actions for CUST002 must only appear under CUST002 in the audit log.
        """
        graph = _build_graph()

        with patch(
            "app.graph.nodes.agent.understand_request",
            return_value={"intent": "delay", "requested_action": None},
        ):
            graph.invoke(
                {
                    "customer_id": "CUST002",
                    "user_message": "SK-118 is delayed, what am I entitled to?",
                },
                {"configurable": {"thread_id": "test-audit-customer"}},
            )

        audit = _read_audit()
        for entry in audit:
            assert entry["customer_id"] == "CUST002", (
                f"Audit entry has wrong customer_id: {entry}"
            )
            assert entry["booking_id"] == "BOOK003", (
                f"Audit entry has wrong booking_id: {entry}"
            )
