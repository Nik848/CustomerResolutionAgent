from decimal import Decimal
from app.db.postgres_client import get_db_cursor
from app.db.supabase_client import get_supabase


def _clean_row(row: dict) -> dict:
    clean = {}
    for k, v in row.items():
        if isinstance(v, Decimal):
            clean[k] = int(v) if v % 1 == 0 else float(v)
        else:
            clean[k] = v
    return clean


def get_bookings_by_customer_id(customer_id: str) -> list[dict]:
    """
    Returns all bookings that belong to a customer using direct PostgreSQL connection,
    with fallback to Supabase client.
    """
    try:
        with get_db_cursor() as cur:
            cur.execute(
                "SELECT * FROM bookings WHERE UPPER(customer_id) = %s ORDER BY booking_id;",
                (customer_id.upper(),)
            )
            rows = cur.fetchall()
            return [_clean_row(dict(r)) for r in rows] if rows else []
    except Exception as e:
        print(f"[booking_tools] Direct postgres lookup failed, trying fallback: {e}")

    try:
        sb = get_supabase()
        response = (
            sb.table("bookings")
            .select("*")
            .eq("customer_id", customer_id.upper())
            .execute()
        )
        return response.data or []
    except Exception as e:
        print(f"[booking_tools] Supabase fallback failed: {e}")
        return []