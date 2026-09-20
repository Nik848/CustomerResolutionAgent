from typing import TypedDict, Optional, Union


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
    selected_booking: Optional[dict]
    policies: list[dict]

    # Decision made by the policy engine
    decision: Optional[dict]

    # What actually happened — a list when multiple actions ran,
    # or a single dict for HITL-style outcomes
    action_result: Optional[Union[dict, list]]

    # Populated only when a supervisor had to weigh in
    human_approval: Optional[dict]

    # Controls which branch the graph should take next
    next_step: Optional[str]

    # Running list of audit events appended during execution
    audit_log: list[dict]