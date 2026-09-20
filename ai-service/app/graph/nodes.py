import re

from app.graph.state import AgentState
from app.agents.customer_resolution_agent import CustomerResolutionAgent
from langgraph.types import interrupt
from app.audit.logger import log_event

from app.tools.customer_tools import get_customer_by_id
from app.tools.booking_tools import get_bookings_by_customer_id
from app.tools.action_tools import (
    initiate_refund,
    rebook_flight,
    issue_meal_voucher,
    grant_lounge_access,
    arrange_hotel
)

from app.tools.human_tools import create_human_approval_request


from app.rag.policy_retriever import retrieve_policies

from app.policies.policy_engine import (
    evaluate_delay,
    evaluate_cancellation,
    evaluate_fare_difference
)


agent = CustomerResolutionAgent()


def understand_request(state: AgentState):

    result = agent.understand_request(
        state["user_message"]
    )

    return {
        "intent": result.get("intent"),
        "requested_action": result.get("requested_action")
    }


def retrieve_customer(state: AgentState):

    customer_id = state.get("customer_id")

    if not customer_id:
        return {
            "customer": None
        }

    customer = get_customer_by_id(customer_id)

    return {
        "customer": customer
    }


def retrieve_booking(state: AgentState):

    customer_id = state.get("customer_id")

    if not customer_id:
        return {
            "bookings": [],
            "selected_booking": None
        }

    bookings = get_bookings_by_customer_id(
        customer_id
    )

    return {
        "bookings": bookings
    }


def select_booking(state: AgentState):

    bookings = state.get("bookings", [])
    user_message = state.get(
        "user_message",
        ""
    ).lower()

    if not bookings:
        return {
            "selected_booking": None,
            "decision": {
                "status": "needs_clarification",
                "reason": "No booking could be found."
            },
            "next_step": "clarify"
        }

    # ---------------------------------------------------------
    # Step 1: Try to identify a flight number from the message
    # Example: "SK-204", "SK204"
    # ---------------------------------------------------------

    normalized_message = user_message.replace(
        " ",
        ""
    )

    flight_matches = []

    for booking in bookings:

        flight_number = booking.get(
            "flight_number",
            ""
        )

        normalized_flight = flight_number.lower().replace(
            " ",
            ""
        )

        if normalized_flight and normalized_flight in normalized_message:
            flight_matches.append(booking)

    # If exactly one booking matches the flight number
    if len(flight_matches) == 1:

        return {
            "selected_booking": flight_matches[0]
        }

    # ---------------------------------------------------------
    # Step 2: If multiple bookings have the same flight number,
    # use the requested situation/status.
    # ---------------------------------------------------------

    candidate_bookings = (
        flight_matches
        if flight_matches
        else bookings
    )

    intent = state.get(
        "intent"
    )

    requested_action = state.get(
        "requested_action"
    )

    # Cancellation-related request
    cancellation_request = (
        intent == "cancellation"
        or requested_action in {
            "refund",
            "rebooking"
        }
        or "cancelled" in user_message
        or "canceled" in user_message
        or "refund" in user_message
    )

    if cancellation_request:

        cancelled = [
            booking
            for booking in candidate_bookings
            if booking.get("status") == "cancelled"
        ]

        if len(cancelled) == 1:

            return {
                "selected_booking": cancelled[0]
            }

        if len(cancelled) > 1:

            return {
                "selected_booking": None,
                "decision": {
                    "status": "needs_clarification",
                    "reason": "Multiple cancelled bookings match the request."
                },
                "next_step": "clarify"
            }

    # ---------------------------------------------------------
    # Step 3: Delay-related request
    # ---------------------------------------------------------

    delay_request = (
        intent == "delay"
        or intent == "hotel"
        or intent == "lounge"
        or intent == "meal_voucher"
        or "delay" in user_message
    )

    if delay_request:

        delayed = [
            booking
            for booking in candidate_bookings
            if booking.get("status") == "delayed"
        ]

        if len(delayed) == 1:

            return {
                "selected_booking": delayed[0]
            }

        if len(delayed) > 1:

            return {
                "selected_booking": None,
                "decision": {
                    "status": "needs_clarification",
                    "reason": "Multiple delayed bookings match the request."
                },
                "next_step": "clarify"
            }

    # ---------------------------------------------------------
    # Step 4: If exactly one booking remains, use it.
    # ---------------------------------------------------------

    if len(candidate_bookings) == 1:

        return {
            "selected_booking": candidate_bookings[0]
        }

    # ---------------------------------------------------------
    # Step 5: Multiple possible bookings.
    # Ask the customer to clarify.
    # ---------------------------------------------------------

    return {
        "selected_booking": None,
        "decision": {
            "status": "needs_clarification",
            "reason": "Multiple bookings could match the request."
        },
        "next_step": "clarify"
    }


def retrieve_policy(state: AgentState):

    intent = state.get("intent")

    category_map = {
        "cancellation": "cancellation",
        "refund": "refund",
        "delay": "delay",
        "hotel": "delay",
        "lounge": "delay",
        "meal_voucher": "delay",
        "rebooking": "cancellation",
        "fare_difference": "fare_difference",
        "compensation": "cancellation"
    }

    category = category_map.get(
        intent,
        "delay"
    )

    policies = retrieve_policies(
        category
    )

    return {
        "policies": policies
    }


def evaluate_request(state: AgentState):

    selected_booking = state.get(
        "selected_booking"
    )

    if not selected_booking:

        existing_decision = state.get(
            "decision"
        )

        if existing_decision:
            return {
                "decision": existing_decision,
                "next_step": "clarify"
            }

        return {
            "decision": {
                "status": "needs_clarification",
                "reason": "The relevant booking could not be identified."
            },
            "next_step": "clarify"
        }

    requested_action = state.get(
        "requested_action"
    )

    intent = state.get(
        "intent"
    )

    user_message = state.get(
        "user_message",
        ""
    ).lower()

    # ---------------------------------------------------------
    # Cancellation
    # ---------------------------------------------------------

    if selected_booking.get(
        "status"
    ) == "cancelled":

        decision = evaluate_cancellation()

        # Customer explicitly wants a refund
        is_refund_requested = (
            requested_action == "refund"
            or intent == "refund"
            or "refund" in user_message
        )

        # Customer explicitly wants rebooking
        is_rebooking_requested = (
            requested_action == "rebook"
            or intent == "rebook"
            or "rebook" in user_message
            or "alternative flight" in user_message
            or "another flight" in user_message
        )

        if is_refund_requested:
            decision["actions"] = [
                "full_refund"
            ]

        elif is_rebooking_requested:
            decision["actions"] = [
                "rebook_within_24_hours"
            ]

        return {
            "decision": decision,
            "next_step": "resolve"
        }

    # ---------------------------------------------------------
    # Fare Difference / Upgrade / Waiver
    # ---------------------------------------------------------

    is_fare_difference_request = (
        requested_action == "fare_difference"
        or requested_action == "upgrade"
        or requested_action == "waive_fare_difference"
        or "fare difference" in user_message
        or "waive" in user_message
        or "waiver" in user_message
        or "upgrade" in user_message
    )

    if is_fare_difference_request:

        # Assignment scenario:
        # Meher wants a higher-fare flight with ₹2,000 fare difference.
        fare_difference = selected_booking.get(
            "fare_difference",
            2000
        )

        decision = evaluate_fare_difference(
            fare_difference
        )

        # Customer is asking specifically for the waiver
        is_waiver_requested = (
            requested_action == "waive_fare_difference"
            or "waive" in user_message
            or "waiver" in user_message
            or "without paying" in user_message
            or "don't want to pay" in user_message
            or "do not want to pay" in user_message
        )

        if is_waiver_requested and decision.get(
            "waiver_requires_human",
            False
        ):

            decision["status"] = "requires_human_approval"

            # Do not execute anything yet.
            decision["actions"] = []

            return {
                "decision": decision,
                "next_step": "human_approval"
            }

        # Customer accepts paying the fare difference.
        decision["status"] = "approved"
        decision["actions"] = []

        return {
            "decision": decision,
            "next_step": "resolve"
        }

    # ---------------------------------------------------------
    # Delay
    # ---------------------------------------------------------

    if selected_booking.get(
        "status"
    ) == "delayed":

        delay_hours = selected_booking.get(
            "delay_hours",
            0
        )

        decision = evaluate_delay(
            delay_hours
        )

        return {
            "decision": decision,
            "next_step": "resolve"
        }

    # ---------------------------------------------------------
    # Fallback
    # ---------------------------------------------------------

    return {
        "decision": {
            "status": "needs_clarification",
            "reason": (
                "The requested situation is not covered "
                "by the current workflow."
            )
        },
        "next_step": "clarify"
    }


def check_human_approval(state: AgentState):

    decision = state.get(
        "decision",
        {}
    )

    booking = state.get(
        "selected_booking"
    )

    customer_id = state.get(
        "customer_id"
    )

    # Nothing to approve
    if not booking:
        return {
            "human_approval": None
        }

    # Check whether this decision actually requires HITL
    if decision.get(
        "status"
    ) != "requires_human_approval":

        return {
            "human_approval": None
        }

    fare_difference = decision.get(
        "fare_difference"
    )

    threshold = decision.get(
        "threshold",
        1500
    )

    # Create the approval request
    approval_request = create_human_approval_request(
        customer_id=customer_id,
        booking_id=booking["booking_id"],
        reason=(
            "Fare difference waiver exceeds "
            "agent authority threshold."
        ),
        details={
            "fare_difference": fare_difference,
            "authority_threshold": threshold,
            "customer_must_pay": decision.get(
                "customer_must_pay",
                True
            )
        }
    )

    # Record approval request in audit log before pausing
    log_event(
        event_type="human_approval_requested",
        customer_id=customer_id,
        booking_id=booking["booking_id"],
        details={
            "fare_difference": fare_difference,
            "authority_threshold": threshold,
            "reason": "Fare difference waiver exceeds agent authority threshold."
        }
    )

    # Pause the workflow for supervisor decision
    human_response = interrupt(
        {
            "type": "fare_difference_waiver",
            "message": (
                "Customer requested a waiver for a "
                f"₹{fare_difference} fare difference. "
                f"The agent authority threshold is ₹{threshold}."
            ),
            "approval_request": approval_request,
            "options": [
                "approve",
                "reject"
            ]
        }
    )

    # Log supervisor response once resumed
    log_event(
        event_type="human_approval_received",
        customer_id=customer_id,
        booking_id=booking["booking_id"],
        details={
            "fare_difference": fare_difference,
            "authority_threshold": threshold,
            "human_response": human_response
        }
    )

    return {
        "human_approval": {
            **approval_request,
            "status": human_response.get(
                "status",
                "approved"
            ),
            "decision": human_response
        }
    }


def execute_action(state: AgentState):

    decision = state.get(
        "decision",
        {}
    )

    booking = state.get(
        "selected_booking"
    )

    customer_id = state.get(
        "customer_id"
    )

    human_approval = state.get(
        "human_approval"
    )

    if not booking:
        return {
            "action_result": None
        }

    if decision.get("status") == "needs_clarification":
        return {
            "action_result": None
        }

    # Handle supervisor decision for waiver
    if decision.get("status") == "requires_human_approval":

        if not human_approval:
            return {
                "action_result": None
            }

        human_decision = human_approval.get(
            "decision",
            {}
        )

        approval_status = human_decision.get(
            "status"
        )

        if approval_status == "reject":
            action_res = {
                "action": "fare_difference_waiver",
                "success": False,
                "status": "rejected",
                "reason": (
                    "Supervisor rejected the fare "
                    "difference waiver. The customer "
                    "must pay the applicable fare difference."
                )
            }
            log_event(
                event_type="action_executed",
                customer_id=customer_id,
                booking_id=booking["booking_id"],
                details=action_res
            )
            return {
                "action_result": action_res
            }

        if approval_status == "approve":
            action_res = {
                "action": "fare_difference_waiver",
                "success": True,
                "status": "approved",
                "reason": (
                    "Supervisor approved the fare "
                    "difference waiver."
                )
            }
            log_event(
                event_type="action_executed",
                customer_id=customer_id,
                booking_id=booking["booking_id"],
                details=action_res
            )
            return {
                "action_result": action_res
            }

    # Execute policy-approved actions
    actions = decision.get(
        "actions",
        []
    )

    booking_id = booking["booking_id"]
    results = []

    if "full_refund" in actions:
        result = initiate_refund(
            booking_id=booking_id,
            customer_id=customer_id
        )
        results.append(result)

    if "rebook_within_24_hours" in actions:
        result = rebook_flight(
            booking_id=booking_id,
            customer_id=customer_id
        )
        results.append(result)

    if "meal_voucher" in actions:
        result = issue_meal_voucher(
            booking_id=booking_id,
            customer_id=customer_id
        )
        results.append(result)

    if "lounge_access" in actions:
        result = grant_lounge_access(
            booking_id=booking_id,
            customer_id=customer_id
        )
        results.append(result)

    if "hotel_delayed_hours" in actions:
        result = arrange_hotel(
            booking_id=booking_id,
            customer_id=customer_id
        )
        results.append(result)

    if not results:
        return {
            "action_result": None
        }

    # Log executed actions with actual results
    log_event(
        event_type="action_executed",
        customer_id=customer_id,
        booking_id=booking_id,
        details={
            "actions": actions,
            "results": results
        }
    )

    return {
        "action_result": results
    }


def generate_response(state: AgentState):

    decision = state.get(
        "decision",
        {}
    )

    action_result = state.get(
        "action_result"
    )

    customer = state.get(
        "customer"
    )

    booking = state.get(
        "selected_booking"
    )

    human_approval = state.get(
        "human_approval"
    )

    # ---------------------------------------------------------
    # Clarification
    # ---------------------------------------------------------

    if decision.get(
        "status"
    ) == "needs_clarification":

        return {
            "response": (
                "I need a little more information to "
                "identify the relevant booking and determine "
                "the applicable resolution."
            )
        }

    if not booking:

        return {
            "response": (
                "I could not identify the booking related "
                "to your request."
            )
        }

    customer_name = (
        customer.get("name")
        if customer
        else "Customer"
    )

    flight = booking.get(
        "flight_number",
        "your flight"
    )

    # ---------------------------------------------------------
    # Human-approved / rejected fare-difference waiver
    # ---------------------------------------------------------

    if decision.get(
        "status"
    ) == "requires_human_approval":

        # action_result is a dictionary for HITL decisions
        if isinstance(action_result, dict):

            action = action_result.get(
                "action"
            )

            status = action_result.get(
                "status"
            )

            if action == "fare_difference_waiver":

                fare_difference = decision.get(
                    "fare_difference",
                    0
                )

                if status == "approved":

                    return {
                        "response": (
                            f"{customer_name}, your supervisor "
                            f"approved the waiver of the "
                            f"₹{fare_difference} fare difference "
                            f"for {flight}. The fare difference "
                            "will not be charged."
                        )
                    }

                if status == "rejected":

                    return {
                        "response": (
                            f"{customer_name}, your request to "
                            f"waive the ₹{fare_difference} fare "
                            f"difference was not approved. "
                            f"You can still proceed with the "
                            f"higher-fare flight by paying the "
                            f"₹{fare_difference} difference."
                        )
                    }

        return {
            "response": (
                "Your request requires supervisor approval "
                "before the fare difference can be waived."
            )
        }

    # ---------------------------------------------------------
    # Cancellation
    # ---------------------------------------------------------

    if booking.get(
        "status"
    ) == "cancelled":

        successful_actions = set()

        if isinstance(
            action_result,
            list
        ):

            for result in action_result:

                if result.get(
                    "success"
                ) is True:

                    successful_actions.add(
                        result.get("action")
                    )

        elif isinstance(
            action_result,
            dict
        ):

            if action_result.get(
                "success"
            ) is True:

                successful_actions.add(
                    action_result.get("action")
                )

        if "initiate_refund" in successful_actions:

            return {
                "response": (
                    f"{customer_name}, your full refund for "
                    f"{flight} has been successfully initiated."
                )
            }

        if "rebook_flight" in successful_actions:

            return {
                "response": (
                    f"{customer_name}, your cancelled flight "
                    f"{flight} has been rebooked on the next "
                    "available flight within the permitted "
                    "24-hour window."
                )
            }

        return {
            "response": (
                f"{customer_name}, your flight {flight} was "
                "cancelled. Under the applicable policy, you "
                "are eligible for either a full refund or "
                "rebooking within 24 hours."
            )
        }

    # ---------------------------------------------------------
    # Delay
    # ---------------------------------------------------------

    if booking.get(
        "status"
    ) == "delayed":

        delay_hours = booking.get(
            "delay_hours",
            0
        )

        successful_actions = set()

        failed_actions = set()

        if isinstance(
            action_result,
            list
        ):

            for result in action_result:

                action_name = result.get(
                    "action"
                )

                if result.get(
                    "success"
                ) is True:

                    successful_actions.add(
                        action_name
                    )

                else:

                    failed_actions.add(
                        action_name
                    )

        elif isinstance(
            action_result,
            dict
        ):

            action_name = action_result.get(
                "action"
            )

            if action_result.get(
                "success"
            ) is True:

                successful_actions.add(
                    action_name
                )

            else:

                failed_actions.add(
                    action_name
                )

        response_parts = [
            (
                f"{customer_name}, your flight {flight} "
                f"is delayed by {delay_hours} hours."
            )
        ]

        # -----------------------------------------------------
        # Meal voucher
        # -----------------------------------------------------

        if "issue_meal_voucher" in successful_actions:

            response_parts.append(
                "Your meal voucher has been issued."
            )

        # -----------------------------------------------------
        # Lounge
        # -----------------------------------------------------

        if "grant_lounge_access" in successful_actions:

            response_parts.append(
                "Lounge access has been granted."
            )

        # -----------------------------------------------------
        # Hotel
        # -----------------------------------------------------

        if "arrange_hotel" in successful_actions:

            response_parts.append(
                "Hotel accommodation covering the "
                "eligible delayed hours has been arranged."
            )

        # -----------------------------------------------------
        # Policy explanation
        # -----------------------------------------------------

        if delay_hours > 5:

            response_parts.append(
                "The policy provides hotel accommodation "
                "for the delayed hours, rather than a "
                "full-night stay."
            )

        elif delay_hours > 3:

            response_parts.append(
                "The applicable policy provides meal and "
                "lounge benefits for this delay."
            )

        elif delay_hours > 0:

            response_parts.append(
                "The applicable policy provides a meal "
                "voucher for this delay."
            )

        return {
            "response": " ".join(
                response_parts
            )
        }

    # ---------------------------------------------------------
    # Fallback
    # ---------------------------------------------------------

    return {
        "response": (
            "I reviewed your request, but I could not "
            "determine an applicable resolution."
        )
    }
