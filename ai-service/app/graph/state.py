from typing import TypedDict, Optional


class AgentState(TypedDict, total=False):

    # Authenticated customer
    customer_id: Optional[str]

    # Conversation
    user_message: str
    response: str

    # Extracted by LLM
    intent: Optional[str]
    requested_action: Optional[str]

    # Retrieved from database
    customer: Optional[dict]
    bookings: list[dict]
    policies: list[dict]

    # Decision
    decision: Optional[dict]

    # Agent control
    next_step: Optional[str]

    # Audit
    audit_log: list[dict]