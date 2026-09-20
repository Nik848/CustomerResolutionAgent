from app.graph.state import AgentState
from app.agents.customer_resolution_agent import CustomerResolutionAgent

from app.tools.customer_tools import get_customer_by_id
from app.tools.booking_tools import get_bookings_by_customer_id

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
            "bookings": []
        }

    bookings = get_bookings_by_customer_id(
        customer_id
    )

    return {
        "bookings": bookings
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

    policies = retrieve_policies(category)

    return {
        "policies": policies
    }


def evaluate_request(state: AgentState):

    intent = state.get("intent")
    requested_action = state.get("requested_action")
    bookings = state.get("bookings", [])

    if not bookings:

        return {
            "decision": {
                "status": "needs_clarification",
                "reason": "No booking could be found."
            },
            "next_step": "clarify"
        }

    booking = bookings[0]

    # Cancellation
    if booking.get("status") == "cancelled":

        decision = evaluate_cancellation()

        return {
            "decision": decision,
            "next_step": "resolve"
        }

    # Delay
    if booking.get("status") == "delayed":

        delay_hours = booking.get(
            "delay_hours",
            0
        )

        decision = evaluate_delay(delay_hours)

        return {
            "decision": decision,
            "next_step": "resolve"
        }

    # Fallback
    return {
        "decision": {
            "status": "needs_clarification",
            "reason": "The requested situation is not covered by the current workflow."
        },
        "next_step": "clarify"
    }


def generate_response(state: AgentState):

    decision = state.get("decision", {})
    customer = state.get("customer")
    bookings = state.get("bookings", [])

    if decision.get("status") == "needs_clarification":

        response = (
            "I need a little more information to verify your booking "
            "and determine the applicable resolution."
        )

        return {
            "response": response
        }

    actions = decision.get("actions", [])

    if not bookings:

        return {
            "response": "I could not find a booking for the information provided."
        }

    booking = bookings[0]

    customer_name = (
        customer.get("name")
        if customer
        else "Customer"
    )

    flight = booking.get(
        "flight_number",
        "your flight"
    )

    if booking.get("status") == "cancelled":

        response = (
            f"{customer_name}, your flight {flight} has been cancelled "
            "due to operational reasons. Under the applicable policy, "
            "you can choose either a free rebooking on the next available "
            "flight within 24 hours or a full refund."
        )

        return {
            "response": response
        }

    if booking.get("status") == "delayed":

        delay_hours = booking.get(
            "delay_hours",
            0
        )

        if "hotel_delayed_hours" in actions:

            response = (
                f"{customer_name}, your flight {flight} is delayed by "
                f"{delay_hours} hours. You are eligible for a meal voucher, "
                "lounge access, and hotel accommodation covering the "
                "delayed hours. The policy does not provide a full-night "
                "hotel stay."
            )

        elif "lounge_access" in actions:

            response = (
                f"{customer_name}, your flight {flight} is delayed by "
                f"{delay_hours} hours. You are eligible for a meal voucher "
                "and lounge access. Hotel accommodation is not included "
                "for this delay duration."
            )

        else:

            response = (
                f"{customer_name}, your flight {flight} is delayed. "
                "You are eligible for the applicable meal voucher."
            )

        return {
            "response": response
        }

    return {
        "response": (
            "I have reviewed your request, but I need additional "
            "information before I can determine the appropriate resolution."
        )
    }