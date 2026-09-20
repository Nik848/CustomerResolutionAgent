"""
End-to-end tests for the Customer Resolution Agent LangGraph flow.

Covers every scenario from the assignment brief:
  - CUST001: Cancelled flight → full refund
  - CUST001: Cancelled flight → rebook within 24 hours
  - CUST002: 4-hour delay → meal voucher + lounge (no hotel)
  - CUST003: 6-hour delay → meal voucher + lounge + hotel
  - CUST003: Fare difference waiver → HITL approve
  - CUST003: Fare difference waiver → HITL reject
  - Audit log written correctly for every scenario

The LLM is patched so tests are fast and deterministic.
Action tools are also patched so tests don't need a live Supabase connection
— correctness is verified via graph responses and audit log entries.
"""

import json
import copy
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest
from langgraph.types import Command

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

DATA_DIR   = Path(__file__).resolve().parents[1] / "data"
AUDIT_FILE = DATA_DIR / "audit" / "audit_log.json"


def _reset_audit():
    AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
    AUDIT_FILE.write_text("[]", encoding="utf-8")


def _read_audit():
    if not AUDIT_FILE.exists():
        return []
    return json.loads(AUDIT_FILE.read_text(encoding="utf-8"))


@pytest.fixture(autouse=True)
def clean_audit():
    """Every test starts with an empty audit log."""
    _reset_audit()
    yield


def _build_graph():
    from app.graph.workflow import build_graph
    return build_graph()


# Reusable action mock responses — simulate successful Supabase writes
def _ok(action):
    return {"success": True, "action": action, "booking_id": "MOCK", "customer_id": "MOCK", "message": "OK"}


# ─────────────────────────────────────────────────────────────────────────────
# CUST001 — Cancelled flight scenarios
# ─────────────────────────────────────────────────────────────────────────────

class TestCUST001Cancellation:

    def test_full_refund(self):
        """
        Priya's flight was cancelled. She asks for a refund.
        The graph should execute initiate_refund and write an audit event.
        """
        graph = _build_graph()

        with (
            patch("app.graph.nodes.agent.understand_request",
                  return_value={"intent": "cancellation", "requested_action": "refund"}),
            patch("app.graph.nodes.initiate_refund", return_value=_ok("initiate_refund")),
        ):
            result = graph.invoke(
                {"customer_id": "CUST001", "user_message": "SK-204 cancelled, I want a refund."},
                {"configurable": {"thread_id": "test-cust001-refund"}},
            )

        assert "__interrupt__" not in result

        response = result.get("response", "").lower()
        assert any(kw in response for kw in ("refund", "initiated", "sk-204")), (
            f"Response should mention refund: {result.get('response')}"
        )

        audit = _read_audit()
        action_events = [e for e in audit if e["event_type"] == "action_executed"]
        assert action_events, "Expected action_executed in audit log"
        assert action_events[0]["customer_id"] == "CUST001"
        assert action_events[0]["booking_id"] == "BOOK001"

    def test_rebook_within_24_hours(self):
        """
        Priya prefers rebooking over a refund.
        rebook_flight should be called and audit log updated.
        """
        graph = _build_graph()

        with (
            patch("app.graph.nodes.agent.understand_request",
                  return_value={"intent": "rebooking", "requested_action": "rebook"}),
            patch("app.graph.nodes.rebook_flight", return_value=_ok("rebook_flight")),
        ):
            result = graph.invoke(
                {"customer_id": "CUST001", "user_message": "Please rebook me on SK-204."},
                {"configurable": {"thread_id": "test-cust001-rebook"}},
            )

        assert "__interrupt__" not in result

        response = result.get("response", "").lower()
        assert any(kw in response for kw in ("rebook", "alternative", "flight", "next")), (
            f"Response should mention rebooking: {result.get('response')}"
        )

        audit = _read_audit()
        assert any(e["event_type"] == "action_executed" for e in audit)

    def test_rebook_implicit_cancelled_booking(self):
        """
        Priya sends 'Can you rebook me?' without specifying flight number.
        The graph should infer BOOK001 (cancelled) over BOOK002 (unaffected)
        and execute rebook_flight without asking for clarification.
        """
        graph = _build_graph()

        with (
            patch("app.graph.nodes.agent.understand_request",
                  return_value={"intent": "rebooking", "requested_action": "rebook"}),
            patch("app.graph.nodes.rebook_flight", return_value=_ok("rebook_flight")),
        ):
            result = graph.invoke(
                {"customer_id": "CUST001", "user_message": "Can you rebook me?"},
                {"configurable": {"thread_id": "test-cust001-rebook-implicit"}},
            )

        assert "__interrupt__" not in result
        assert result.get("selected_booking", {}).get("booking_id") == "BOOK001"
        assert result.get("next_step") == "resolve"

        response = result.get("response", "").lower()
        assert any(kw in response for kw in ("rebook", "alternative", "flight", "next")), (
            f"Response should mention rebooking: {result.get('response')}"
        )

        audit = _read_audit()
        action_events = [e for e in audit if e["event_type"] == "action_executed"]
        assert action_events, "Expected action_executed in audit log"
        assert action_events[0]["customer_id"] == "CUST001"
        assert action_events[0]["booking_id"] == "BOOK001"



# ─────────────────────────────────────────────────────────────────────────────
# CUST002 — 4-hour delay (meal + lounge, no hotel)
# ─────────────────────────────────────────────────────────────────────────────

class TestCUST002FourHourDelay:

    def test_meal_and_lounge_no_hotel(self):
        """
        Arvind's flight SK-118 is delayed 4 hours.
        Policy: meal voucher + lounge. Hotel must NOT be in the action list.
        """
        graph = _build_graph()

        with (
            patch("app.graph.nodes.agent.understand_request",
                  return_value={"intent": "delay", "requested_action": None}),
            patch("app.graph.nodes.issue_meal_voucher",   return_value=_ok("issue_meal_voucher")),
            patch("app.graph.nodes.grant_lounge_access",  return_value=_ok("grant_lounge_access")),
        ):
            result = graph.invoke(
                {"customer_id": "CUST002", "user_message": "SK-118 is delayed, what am I entitled to?"},
                {"configurable": {"thread_id": "test-cust002-delay"}},
            )

        assert "__interrupt__" not in result

        response = result.get("response", "").lower()
        assert "meal" in response or "voucher" in response, f"Expected meal voucher: {result.get('response')}"
        assert "lounge" in response, f"Expected lounge mention: {result.get('response')}"

        audit = _read_audit()
        action_events = [e for e in audit if e["event_type"] == "action_executed"]
        assert action_events

        actions_taken = action_events[0].get("details", {}).get("actions", [])
        assert "meal_voucher" in actions_taken
        assert "lounge_access" in actions_taken
        assert "hotel_delayed_hours" not in actions_taken, "Hotel must not apply for 4h delay"


# ─────────────────────────────────────────────────────────────────────────────
# CUST003 — 6-hour delay (meal + lounge + hotel)
# ─────────────────────────────────────────────────────────────────────────────

class TestCUST003SixHourDelay:

    def test_meal_lounge_and_hotel(self):
        """
        Meher's flight SK-305 is delayed 6 hours.
        All three benefits should be granted.
        """
        graph = _build_graph()

        with (
            patch("app.graph.nodes.agent.understand_request",
                  return_value={"intent": "delay", "requested_action": None}),
            patch("app.graph.nodes.issue_meal_voucher",  return_value=_ok("issue_meal_voucher")),
            patch("app.graph.nodes.grant_lounge_access", return_value=_ok("grant_lounge_access")),
            patch("app.graph.nodes.arrange_hotel",       return_value=_ok("arrange_hotel")),
        ):
            result = graph.invoke(
                {"customer_id": "CUST003", "user_message": "SK-305 delayed 6 hours, what can I get?"},
                {"configurable": {"thread_id": "test-cust003-delay"}},
            )

        assert "__interrupt__" not in result

        response = result.get("response", "").lower()
        assert "hotel" in response, f"Response should mention hotel: {result.get('response')}"

        audit = _read_audit()
        action_events = [e for e in audit if e["event_type"] == "action_executed"]
        assert action_events

        actions_taken = action_events[0].get("details", {}).get("actions", [])
        assert "meal_voucher" in actions_taken
        assert "lounge_access" in actions_taken
        assert "hotel_delayed_hours" in actions_taken


# ─────────────────────────────────────────────────────────────────────────────
# CUST003 — Fare difference waiver with HITL
# ─────────────────────────────────────────────────────────────────────────────

class TestCUST003FareDifferenceHITL:

    def _send_waiver_request(self, graph, thread_id):
        with patch(
            "app.graph.nodes.agent.understand_request",
            return_value={"intent": "fare_difference", "requested_action": "waive_fare_difference"},
        ):
            return graph.invoke(
                {
                    "customer_id": "CUST003",
                    "user_message": "I want to switch to SK-305 but don't want to pay the ₹2,000 fare difference. Can you waive it?",
                },
                {"configurable": {"thread_id": thread_id}},
            )

    def test_supervisor_approves_waiver(self):
        """
        Meher requests a waiver. Graph pauses. Supervisor approves.
        Audit must have all three HITL events.
        """
        graph  = _build_graph()
        tid    = "test-cust003-hitl-approve"
        result = self._send_waiver_request(graph, tid)

        assert "__interrupt__" in result, "Graph must pause for supervisor"

        audit = _read_audit()
        assert any(e["event_type"] == "human_approval_requested" for e in audit), (
            "human_approval_requested must be logged before the pause"
        )

        # Supervisor approves
        result = graph.invoke(Command(resume={"status": "approve"}), {"configurable": {"thread_id": tid}})

        assert "__interrupt__" not in result

        response = result.get("response", "").lower()
        assert any(kw in response for kw in ("approved", "waiver", "not be charged", "waived")), (
            f"Response should confirm approval: {result.get('response')}"
        )

        audit = _read_audit()
        assert any(e["event_type"] == "human_approval_received" for e in audit)
        exec_events = [e for e in audit if e["event_type"] == "action_executed"]
        assert exec_events
        assert exec_events[0]["details"].get("status") == "approved"

    def test_supervisor_rejects_waiver(self):
        """
        Meher requests a waiver. Supervisor rejects it.
        Response must tell her she needs to pay. Audit records rejection.
        """
        graph  = _build_graph()
        tid    = "test-cust003-hitl-reject"
        result = self._send_waiver_request(graph, tid)

        assert "__interrupt__" in result

        result = graph.invoke(Command(resume={"status": "reject"}), {"configurable": {"thread_id": tid}})

        assert "__interrupt__" not in result

        response = result.get("response", "").lower()
        assert any(kw in response for kw in ("not approved", "rejected", "must pay", "paying", "difference")), (
            f"Response should communicate rejection: {result.get('response')}"
        )

        audit = _read_audit()
        exec_events = [e for e in audit if e["event_type"] == "action_executed"]
        assert exec_events
        assert exec_events[0]["details"].get("status") == "rejected"


# ─────────────────────────────────────────────────────────────────────────────
# Audit log integrity
# ─────────────────────────────────────────────────────────────────────────────

class TestAuditLog:

    def test_audit_log_schema(self):
        """Every audit entry must have the required fields."""
        graph = _build_graph()

        with (
            patch("app.graph.nodes.agent.understand_request",
                  return_value={"intent": "cancellation", "requested_action": "refund"}),
            patch("app.graph.nodes.initiate_refund", return_value=_ok("initiate_refund")),
        ):
            graph.invoke(
                {"customer_id": "CUST001", "user_message": "SK-204 cancelled, refund please."},
                {"configurable": {"thread_id": "test-audit-schema"}},
            )

        audit = _read_audit()
        assert len(audit) >= 1

        required = {"timestamp", "event_type", "customer_id", "booking_id", "details"}
        for entry in audit:
            missing = required - set(entry.keys())
            assert not missing, f"Audit entry missing fields {missing}: {entry}"

    def test_audit_contains_correct_customer(self):
        """Actions for CUST002 must only appear under CUST002 in the log."""
        graph = _build_graph()

        with (
            patch("app.graph.nodes.agent.understand_request",
                  return_value={"intent": "delay", "requested_action": None}),
            patch("app.graph.nodes.issue_meal_voucher",  return_value=_ok("issue_meal_voucher")),
            patch("app.graph.nodes.grant_lounge_access", return_value=_ok("grant_lounge_access")),
        ):
            graph.invoke(
                {"customer_id": "CUST002", "user_message": "SK-118 delayed, what do I get?"},
                {"configurable": {"thread_id": "test-audit-customer"}},
            )

        audit = _read_audit()
        for entry in audit:
            assert entry["customer_id"] == "CUST002", f"Wrong customer in audit: {entry}"
            assert entry["booking_id"] == "BOOK003", f"Wrong booking in audit: {entry}"
