from typing import List, Dict, Any
from app.services.backend_client import get_bookings as fetch_from_backend


def get_bookings_by_customer_id(customer_id: str) -> List[Dict[str, Any]]:
    """
    Returns all bookings that belong to a customer via the Node.js internal backend API.
    Zero direct database queries or Supabase client calls.
    """
    if not customer_id:
        return []
    return fetch_from_backend(customer_id.upper())