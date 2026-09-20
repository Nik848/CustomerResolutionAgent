from datetime import datetime


def create_human_approval_request(
    customer_id: str,
    booking_id: str,
    reason: str,
    details: dict
):
    """
    Creates a simulated human approval request.

    In the prototype this does not contact a real supervisor.
    It creates the approval payload that LangGraph will interrupt on.
    """

    return {
        "required": True,
        "status": "pending",
        "customer_id": customer_id,
        "booking_id": booking_id,
        "reason": reason,
        "details": details,
        "created_at": datetime.utcnow().isoformat()
    }