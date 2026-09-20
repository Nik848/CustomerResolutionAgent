import os
import httpx
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:5000")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "airline-internal-secret-key-2026")

_HEADERS = {
    "X-Internal-API-Key": INTERNAL_API_KEY,
    "Content-Type": "application/json"
}

_TIMEOUT = 10.0


def get_customer(customer_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve customer details from Node backend."""
    try:
        with httpx.Client(base_url=BACKEND_API_URL, headers=_HEADERS, timeout=_TIMEOUT) as client:
            resp = client.get(f"/api/internal/customers/{customer_id}")
            if resp.status_code == 200:
                return resp.json().get("customer")
            return None
    except Exception as e:
        print(f"[backend_client] get_customer failed: {e}")
        return None


def get_bookings(customer_id: str) -> List[Dict[str, Any]]:
    """Retrieve bookings for a customer from Node backend."""
    try:
        with httpx.Client(base_url=BACKEND_API_URL, headers=_HEADERS, timeout=_TIMEOUT) as client:
            resp = client.get("/api/internal/bookings", params={"customer_id": customer_id})
            if resp.status_code == 200:
                return resp.json().get("bookings", [])
            return []
    except Exception as e:
        print(f"[backend_client] get_bookings failed: {e}")
        return []


def get_booking(booking_id: str, customer_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve a specific booking for a customer from Node backend."""
    try:
        with httpx.Client(base_url=BACKEND_API_URL, headers=_HEADERS, timeout=_TIMEOUT) as client:
            resp = client.get(f"/api/internal/bookings/{booking_id}", params={"customer_id": customer_id})
            if resp.status_code == 200:
                return resp.json().get("booking")
            return None
    except Exception as e:
        print(f"[backend_client] get_booking failed: {e}")
        return None


def get_booking_state(booking_id: str, customer_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve full booking state including entity tables from Node backend."""
    try:
        with httpx.Client(base_url=BACKEND_API_URL, headers=_HEADERS, timeout=_TIMEOUT) as client:
            resp = client.get(f"/api/internal/bookings/{booking_id}/state", params={"customer_id": customer_id})
            if resp.status_code == 200:
                return resp.json().get("booking_state")
            return None
    except Exception as e:
        print(f"[backend_client] get_booking_state failed: {e}")
        return None



def execute_action(action: str, booking_id: str, customer_id: str) -> Dict[str, Any]:
    """Request Node backend to execute an action (refund, rebook, etc.)."""
    try:
        with httpx.Client(base_url=BACKEND_API_URL, headers=_HEADERS, timeout=_TIMEOUT) as client:
            resp = client.post("/api/internal/actions", json={
                "action": action,
                "booking_id": booking_id,
                "customer_id": customer_id
            })
            if resp.status_code == 200:
                return resp.json()
            return {
                "success": False,
                "action": action,
                "message": f"Backend returned HTTP {resp.status_code}: {resp.text}"
            }
    except Exception as e:
        print(f"[backend_client] execute_action failed: {e}")
        return {
            "success": False,
            "action": action,
            "message": f"Connection to backend failed: {str(e)}"
        }


def create_approval(
    customer_id: str,
    booking_id: Optional[str],
    thread_id: str,
    req_type: str = "fare_difference_waiver",
    reason: str = "Requires supervisor approval",
    details: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Request Node backend to create an approval request record."""
    try:
        with httpx.Client(base_url=BACKEND_API_URL, headers=_HEADERS, timeout=_TIMEOUT) as client:
            resp = client.post("/api/internal/approvals", json={
                "customer_id": customer_id,
                "booking_id": booking_id,
                "thread_id": thread_id,
                "type": req_type,
                "reason": reason,
                "details": details or {}
            })
            if resp.status_code in (200, 201):
                return resp.json().get("approval", {})
            return {}
    except Exception as e:
        print(f"[backend_client] create_approval failed: {e}")
        return {}
