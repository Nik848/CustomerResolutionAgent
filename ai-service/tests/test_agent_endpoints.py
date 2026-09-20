import os
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

VALID_KEY = os.getenv("INTERNAL_API_KEY", "airline-internal-secret-key-2026")
VALID_HEADERS = {"X-Internal-API-Key": VALID_KEY}


# ─────────────────────────────────────────────────────────────────────────────
# Security tests for X-Internal-API-Key
# ─────────────────────────────────────────────────────────────────────────────

def test_missing_internal_api_key_returns_401():
    res = client.post("/api/agent/process", json={
        "message": "hello",
        "thread_id": "t1"
    })
    assert res.status_code == 401
    assert "Missing internal API key" in res.json()["detail"]


def test_invalid_internal_api_key_returns_403():
    res = client.post("/api/agent/process", json={
        "message": "hello",
        "thread_id": "t1"
    }, headers={"X-Internal-API-Key": "wrong-secret-key"})
    assert res.status_code == 403
    assert "Invalid internal API key" in res.json()["detail"]


def test_resume_missing_internal_api_key_returns_401():
    res = client.post("/api/agent/resume", json={
        "thread_id": "t1",
        "decision": "approve"
    })
    assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# Agent functionality with valid API key
# ─────────────────────────────────────────────────────────────────────────────

def test_agent_process_completed():
    mock_result = {
        "response": "I have processed your refund.",
        "decision": {"status": "eligible_for_refund", "actions": ["full_refund"]},
        "action_result": {"success": True, "action": "full_refund"},
        "selected_booking": {"booking_id": "BOOK001"}
    }

    with patch("app.api.routes.graph.invoke", return_value=mock_result):
        res = client.post("/api/agent/process", json={
            "customer": {"customer_id": "CUST001", "name": "Priya Nair"},
            "bookings": [{"booking_id": "BOOK001", "flight_number": "SK-204"}],
            "message": "Can I get a refund?",
            "thread_id": "test-thread-001"
        }, headers=VALID_HEADERS)

        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "completed"
        assert "refund" in data["response"]
        assert data["booking_id"] == "BOOK001"
        assert "full_refund" in data["actions"]


def test_agent_process_interrupted():
    mock_result = {
        "__interrupt__": [
            MagicMock(value={
                "type": "fare_difference_waiver",
                "approval_request": {
                    "booking_id": "BOOK003",
                    "reason": "Fare difference waiver requires supervisor approval."
                }
            })
        ],
        "decision": {"status": "requires_human_approval"},
        "selected_booking": {"booking_id": "BOOK003"}
    }

    with patch("app.api.routes.graph.invoke", return_value=mock_result):
        res = client.post("/api/agent/process", json={
            "customer": {"customer_id": "CUST003", "name": "Meher Kaur"},
            "bookings": [{"booking_id": "BOOK003"}],
            "message": "Please waive the fare difference.",
            "thread_id": "test-thread-hitl"
        }, headers=VALID_HEADERS)

        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "human_approval_required"
        assert data["requires_human_approval"] is True
        assert data["booking_id"] == "BOOK003"


def test_agent_resume_invalid_decision():
    res = client.post("/api/agent/resume", json={
        "thread_id": "test-thread",
        "decision": "maybe"
    }, headers=VALID_HEADERS)
    assert res.status_code == 400
    assert "must be 'approve' or 'reject'" in res.json()["detail"]


def test_agent_resume_approved():
    mock_result = {
        "response": "Supervisor approved the request.",
        "decision": {"status": "approved"},
        "action_result": {"success": True, "action": "fare_difference_waiver"},
        "human_approval": {"decision": {"status": "approve"}},
        "selected_booking": {"booking_id": "BOOK003"}
    }

    with patch("app.api.routes.graph.invoke", return_value=mock_result):
        res = client.post("/api/agent/resume", json={
            "thread_id": "test-thread",
            "decision": "approve"
        }, headers=VALID_HEADERS)

        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "completed"
        assert data["human_approval"]["decision"]["status"] == "approve"
