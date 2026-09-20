from decimal import Decimal
from datetime import datetime

from app.db.postgres_client import get_db_cursor
from app.db.supabase_client import get_supabase


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _clean_dict(data: dict) -> dict:
    clean = {}
    for k, v in data.items():
        if isinstance(v, Decimal):
            clean[k] = int(v) if v % 1 == 0 else float(v)
        else:
            clean[k] = v
    return clean


def _get_booking(booking_id: str, customer_id: str) -> dict | None:
    """Fetch a single booking row using direct PostgreSQL connection, with fallback."""
    try:
        with get_db_cursor() as cur:
            cur.execute(
                "SELECT * FROM bookings WHERE UPPER(booking_id) = %s AND UPPER(customer_id) = %s LIMIT 1;",
                (booking_id.upper(), customer_id.upper())
            )
            row = cur.fetchone()
            if row:
                return _clean_dict(dict(row))
    except Exception as e:
        print(f"[action_tools] Direct postgres lookup failed, trying fallback: {e}")

    try:
        sb = get_supabase()
        response = (
            sb.table("bookings")
            .select("*")
            .eq("booking_id", booking_id)
            .eq("customer_id", customer_id.upper())
            .limit(1)
            .execute()
        )
        rows = response.data
        return rows[0] if rows else None
    except Exception as e:
        print(f"[action_tools] Supabase fallback failed: {e}")
        return None


def _patch_booking(booking_id: str, fields: dict) -> None:
    """Apply a partial update to a booking row using direct PostgreSQL, with fallback."""
    try:
        if not fields:
            return
        set_clauses = [f"{col} = %s" for col in fields.keys()]
        values = list(fields.values()) + [booking_id.upper()]
        query = f"UPDATE bookings SET {', '.join(set_clauses)} WHERE UPPER(booking_id) = %s;"
        with get_db_cursor() as cur:
            cur.execute(query, tuple(values))
        return
    except Exception as e:
        print(f"[action_tools] Direct postgres patch failed, trying fallback: {e}")

    try:
        sb = get_supabase()
        sb.table("bookings").update(fields).eq("booking_id", booking_id).execute()
    except Exception as e:
        print(f"[action_tools] Supabase fallback patch failed: {e}")


from app.services.backend_client import execute_action as backend_execute_action


# ─────────────────────────────────────────────────────────────────────────────
# Actions
# ─────────────────────────────────────────────────────────────────────────────

def initiate_refund(booking_id: str, customer_id: str) -> dict:
    """
    Marks a cancelled booking as refund-initiated in Supabase.
    Delegates to Node.js backend if available; falls back to direct DB.
    """
    try:
        backend_res = backend_execute_action("full_refund", booking_id, customer_id)
        if backend_res and backend_res.get("success") is True:
            return backend_res
    except Exception:
        pass

    booking = _get_booking(booking_id, customer_id)

    if not booking:
        return {
            "success": False,
            "action": "initiate_refund",
            "message": "Booking could not be found."
        }

    if booking.get("status") != "cancelled":
        return {
            "success": False,
            "action": "initiate_refund",
            "message": "Refund can only be initiated for a cancelled booking."
        }

    if booking.get("refund_status") == "initiated":
        return {
            "success": False,
            "action": "initiate_refund",
            "message": "Refund has already been initiated."
        }

    _patch_booking(booking_id, {
        "refund_status": "initiated",
        "refund_initiated_at": datetime.utcnow().isoformat()
    })

    return {
        "success": True,
        "action": "initiate_refund",
        "booking_id": booking_id,
        "customer_id": customer_id,
        "message": "Refund has been successfully initiated."
    }


def rebook_flight(booking_id: str, customer_id: str) -> dict:
    """
    Confirms a rebooking for a disrupted flight (cancelled or delayed).
    Delegates to Node.js backend if available; falls back to direct DB.
    """
    try:
        backend_res = backend_execute_action("rebook_within_24_hours", booking_id, customer_id)
        if backend_res and backend_res.get("success") is True:
            return backend_res
    except Exception:
        pass

    booking = _get_booking(booking_id, customer_id)

    if not booking:
        return {
            "success": False,
            "action": "rebook_flight",
            "message": "Booking could not be found."
        }

    if booking.get("status") not in {"cancelled", "delayed"}:
        return {
            "success": False,
            "action": "rebook_flight",
            "message": "This booking is not currently eligible for rebooking."
        }

    if booking.get("rebooking_status") == "confirmed":
        return {
            "success": False,
            "action": "rebook_flight",
            "message": "This booking has already been rebooked."
        }

    _patch_booking(booking_id, {
        "rebooking_status": "confirmed",
        "rebooked_at": datetime.utcnow().isoformat()
    })

    return {
        "success": True,
        "action": "rebook_flight",
        "booking_id": booking_id,
        "customer_id": customer_id,
        "message": "Flight has been successfully rebooked."
    }


def issue_meal_voucher(booking_id: str, customer_id: str) -> dict:
    """
    Issues a meal voucher for a delayed flight.
    Delegates to Node.js backend if available; falls back to direct DB.
    """
    try:
        backend_res = backend_execute_action("meal_voucher", booking_id, customer_id)
        if backend_res and backend_res.get("success") is True:
            return backend_res
    except Exception:
        pass

    booking = _get_booking(booking_id, customer_id)

    if not booking:
        return {
            "success": False,
            "action": "issue_meal_voucher",
            "message": "Booking could not be found."
        }

    if booking.get("status") != "delayed":
        return {
            "success": False,
            "action": "issue_meal_voucher",
            "message": "Meal voucher is only available for delayed flights."
        }

    if booking.get("meal_voucher_status") == "issued":
        return {
            "success": False,
            "action": "issue_meal_voucher",
            "message": "Meal voucher has already been issued."
        }

    _patch_booking(booking_id, {
        "meal_voucher_status": "issued",
        "meal_voucher_issued_at": datetime.utcnow().isoformat()
    })

    return {
        "success": True,
        "action": "issue_meal_voucher",
        "booking_id": booking_id,
        "customer_id": customer_id,
        "message": "Meal voucher has been successfully issued."
    }


def grant_lounge_access(booking_id: str, customer_id: str) -> dict:
    """
    Grants lounge access for a delayed flight (policy: delay > 3 hours).
    Delegates to Node.js backend if available; falls back to direct DB.
    """
    try:
        backend_res = backend_execute_action("lounge_access", booking_id, customer_id)
        if backend_res and backend_res.get("success") is True:
            return backend_res
    except Exception:
        pass

    booking = _get_booking(booking_id, customer_id)

    if not booking:
        return {
            "success": False,
            "action": "grant_lounge_access",
            "message": "Booking could not be found."
        }

    if booking.get("status") != "delayed":
        return {
            "success": False,
            "action": "grant_lounge_access",
            "message": "Lounge access is only available for delayed flights."
        }

    if booking.get("lounge_access_status") == "granted":
        return {
            "success": False,
            "action": "grant_lounge_access",
            "message": "Lounge access has already been granted."
        }

    _patch_booking(booking_id, {
        "lounge_access_status": "granted",
        "lounge_access_granted_at": datetime.utcnow().isoformat()
    })

    return {
        "success": True,
        "action": "grant_lounge_access",
        "booking_id": booking_id,
        "customer_id": customer_id,
        "message": "Lounge access has been successfully granted."
    }


def arrange_hotel(booking_id: str, customer_id: str) -> dict:
    """
    Arranges hotel accommodation for delays exceeding 5 hours.
    Delegates to Node.js backend if available; falls back to direct DB.
    """
    try:
        backend_res = backend_execute_action("hotel_delayed_hours", booking_id, customer_id)
        if backend_res and backend_res.get("success") is True:
            return backend_res
    except Exception:
        pass

    booking = _get_booking(booking_id, customer_id)

    if not booking:
        return {
            "success": False,
            "action": "arrange_hotel",
            "message": "Booking could not be found."
        }

    if booking.get("status") != "delayed":
        return {
            "success": False,
            "action": "arrange_hotel",
            "message": "Hotel accommodation is only available for eligible delayed flights."
        }

    if booking.get("delay_hours", 0) <= 5:
        return {
            "success": False,
            "action": "arrange_hotel",
            "message": "This delay does not qualify for hotel accommodation."
        }

    if booking.get("hotel_status") == "arranged":
        return {
            "success": False,
            "action": "arrange_hotel",
            "message": "Hotel accommodation has already been arranged."
        }

    _patch_booking(booking_id, {
        "hotel_status": "arranged",
        "hotel_arranged_at": datetime.utcnow().isoformat()
    })

    return {
        "success": True,
        "action": "arrange_hotel",
        "booking_id": booking_id,
        "customer_id": customer_id,
        "message": "Hotel accommodation has been successfully arranged for the qualifying delayed hours."
    }