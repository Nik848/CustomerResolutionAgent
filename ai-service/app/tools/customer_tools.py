from typing import Optional, Dict, Any
from app.services.backend_client import get_customer as fetch_from_backend


def get_customer_by_id(customer_id: str) -> Optional[Dict[str, Any]]:
    """
    Looks up a single customer by their ID via the Node.js internal backend API.
    Zero direct database queries or Supabase client calls.
    """
    if not customer_id:
        return None
    return fetch_from_backend(customer_id.upper())