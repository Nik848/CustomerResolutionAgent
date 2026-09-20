import json
from decimal import Decimal
from typing import Optional
from fastapi import HTTPException, status
from app.db.postgres_client import get_db_cursor
from app.audit.logger import log_event


def _clean_dict(data: dict) -> dict:
    if not data:
        return {}
    clean = {}
    for k, v in data.items():
        if isinstance(v, Decimal):
            clean[k] = int(v) if v % 1 == 0 else float(v)
        elif isinstance(v, dict):
            clean[k] = _clean_dict(v)
        else:
            clean[k] = v
    return clean


def create_db_approval_request(
    customer_id: str,
    booking_id: Optional[str],
    thread_id: str,
    req_type: str,
    reason: str,
    details: dict
) -> dict:
    """
    Creates a persistent approval_requests record in the database.
    """
    cleaned_details = _clean_dict(details or {})

    with get_db_cursor() as cur:
        # Check if a pending request already exists for this thread to prevent duplicates
        cur.execute(
            """
            SELECT id FROM public.approval_requests
            WHERE thread_id = %s AND status = 'pending'
            LIMIT 1;
            """,
            (thread_id,)
        )
        existing = cur.fetchone()
        if existing:
            approval_id = str(existing["id"])
            cur.execute(
                """
                UPDATE public.approval_requests
                SET type = %s, reason = %s, details = %s, updated_at = NOW()
                WHERE id = %s
                RETURNING *;
                """ if False else
                """
                UPDATE public.approval_requests
                SET type = %s, reason = %s, details = %s
                WHERE id = %s
                RETURNING *;
                """,
                (req_type, reason, json.dumps(cleaned_details), approval_id)
            )
            row = cur.fetchone()
            return _clean_dict(dict(row))

        cur.execute(
            """
            INSERT INTO public.approval_requests (
                customer_id, booking_id, thread_id, type, reason, details, status
            ) VALUES (%s, %s, %s, %s, %s, %s, 'pending')
            RETURNING *;
            """,
            (customer_id, booking_id, thread_id, req_type, reason, json.dumps(cleaned_details))
        )
        row = cur.fetchone()
        created = _clean_dict(dict(row))

    # Log approval_created in audit log
    log_event(
        event_type="approval_created",
        customer_id=customer_id,
        booking_id=booking_id,
        details={
            "approval_id": str(created["id"]),
            "type": req_type,
            "reason": reason,
            "thread_id": thread_id,
            "details": cleaned_details
        }
    )

    return created


def get_pending_approvals() -> list[dict]:
    """
    Returns all pending approval requests joined with customer and booking details.
    """
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT ar.*,
                   c.name AS customer_name,
                   c.email AS customer_email,
                   c.loyalty_tier,
                   b.pnr,
                   b.flight_number,
                   b.origin,
                   b.destination,
                   b.date AS travel_date,
                   b.scheduled_departure,
                   b.status AS booking_status,
                   b.delay_hours,
                   b.disruption_reason,
                   b.fare_difference
            FROM public.approval_requests ar
            LEFT JOIN public.customers c ON ar.customer_id = c.customer_id
            LEFT JOIN public.bookings b ON ar.booking_id = b.booking_id
            WHERE ar.status = 'pending'
            ORDER BY ar.created_at DESC;
            """
        )
        rows = cur.fetchall()
        return [_clean_dict(dict(r)) for r in rows] if rows else []


def get_approval_history(limit: int = 50) -> list[dict]:
    """
    Returns resolved approval requests (approved and rejected) joined with customer and booking details.
    """
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT ar.*,
                   c.name AS customer_name,
                   c.email AS customer_email,
                   c.loyalty_tier,
                   b.pnr,
                   b.flight_number,
                   b.origin,
                   b.destination,
                   b.date AS travel_date,
                   b.scheduled_departure,
                   b.status AS booking_status,
                   b.delay_hours,
                   b.disruption_reason,
                   b.fare_difference
            FROM public.approval_requests ar
            LEFT JOIN public.customers c ON ar.customer_id = c.customer_id
            LEFT JOIN public.bookings b ON ar.booking_id = b.booking_id
            WHERE ar.status IN ('approved', 'rejected')
            ORDER BY ar.resolved_at DESC
            LIMIT %s;
            """,
            (limit,)
        )
        rows = cur.fetchall()
        return [_clean_dict(dict(r)) for r in rows] if rows else []


def get_approval_by_id(approval_id: str) -> dict:
    """
    Fetches a single approval request with full customer and booking details.
    Raises 404 HTTPException if not found.
    """
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT ar.*,
                   c.name AS customer_name,
                   c.email AS customer_email,
                   c.loyalty_tier,
                   b.pnr,
                   b.flight_number,
                   b.origin,
                   b.destination,
                   b.date AS travel_date,
                   b.scheduled_departure,
                   b.status AS booking_status,
                   b.delay_hours,
                   b.disruption_reason,
                   b.fare_difference
            FROM public.approval_requests ar
            LEFT JOIN public.customers c ON ar.customer_id = c.customer_id
            LEFT JOIN public.bookings b ON ar.booking_id = b.booking_id
            WHERE ar.id::text = %s
            LIMIT 1;
            """,
            (str(approval_id),)
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Approval request {approval_id} not found"
            )
        return _clean_dict(dict(row))


def resolve_approval_request(
    approval_id: str,
    decision: str,
    resolved_by: str,
    resolution_note: Optional[str] = None
) -> dict:
    """
    Resolves an approval request (status: 'approved' or 'rejected').
    Enforces that an approval request can only be resolved once.
    """
    if decision not in {"approved", "rejected"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Decision must be 'approved' or 'rejected'"
        )

    current = get_approval_by_id(approval_id)
    current_status = current.get("status")

    if current_status in {"approved", "rejected"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot {decision} an already {current_status} request"
        )

    with get_db_cursor() as cur:
        cur.execute(
            """
            UPDATE public.approval_requests
            SET status = %s,
                resolved_at = NOW(),
                resolved_by = %s,
                resolution_note = %s
            WHERE id::text = %s
            RETURNING *;
            """,
            (decision, resolved_by, resolution_note or f"Resolved as {decision} by admin", str(approval_id))
        )
        updated = cur.fetchone()

    # Log in audit log
    log_event(
        event_type="human_approval_received" if decision == "approved" else "approval_rejected",
        customer_id=current["customer_id"],
        booking_id=current.get("booking_id"),
        details={
            "approval_id": approval_id,
            "admin_user_id": resolved_by,
            "decision": decision,
            "resolution_note": resolution_note
        }
    )

    return _clean_dict(dict(updated))
