from app.db.postgres_client import get_db_cursor
from app.db.supabase_client import get_supabase


def get_customer_by_id(customer_id: str) -> dict | None:
    """
    Looks up a single customer by their ID using direct PostgreSQL connection,
    with fallback to Supabase client.
    """
    try:
        with get_db_cursor() as cur:
            cur.execute(
                "SELECT * FROM customers WHERE UPPER(customer_id) = %s LIMIT 1;",
                (customer_id.upper(),)
            )
            row = cur.fetchone()
            if row:
                return dict(row)
    except Exception as e:
        print(f"[customer_tools] Direct postgres lookup failed, trying fallback: {e}")

    try:
        sb = get_supabase()
        response = (
            sb.table("customers")
            .select("*")
            .eq("customer_id", customer_id.upper())
            .limit(1)
            .execute()
        )
        rows = response.data
        return rows[0] if rows else None
    except Exception as e:
        print(f"[customer_tools] Supabase fallback failed: {e}")
        return None


def get_customer_by_auth_user_id(auth_user_id: str) -> dict | None:
    """
    Looks up a customer by their Supabase Auth UUID (auth_user_id) using
    direct PostgreSQL connection, with fallback to Supabase client.
    """
    try:
        with get_db_cursor() as cur:
            cur.execute(
                "SELECT * FROM customers WHERE auth_user_id = %s LIMIT 1;",
                (auth_user_id,)
            )
            row = cur.fetchone()
            if row:
                return dict(row)
    except Exception as e:
        print(f"[customer_tools] Direct postgres lookup by auth_user_id failed, trying fallback: {e}")

    try:
        sb = get_supabase()
        response = (
            sb.table("customers")
            .select("*")
            .eq("auth_user_id", auth_user_id)
            .limit(1)
            .execute()
        )
        rows = response.data
        return rows[0] if rows else None
    except Exception as e:
        print(f"[customer_tools] Error looking up customer by auth_user_id: {e}")
        return None