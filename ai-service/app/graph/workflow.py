from langgraph.graph import StateGraph, START, END

from app.graph.state import AgentState

from app.graph.nodes import (
    understand_request,
    retrieve_customer,
    retrieve_booking,
    retrieve_policy,
    evaluate_request,
    generate_response
)


def build_graph():

    graph = StateGraph(AgentState)

    # Nodes
    graph.add_node(
        "understand_request",
        understand_request
    )

    graph.add_node(
        "retrieve_customer",
        retrieve_customer
    )

    graph.add_node(
        "retrieve_booking",
        retrieve_booking
    )

    graph.add_node(
        "retrieve_policy",
        retrieve_policy
    )

    graph.add_node(
        "evaluate_request",
        evaluate_request
    )

    graph.add_node(
        "generate_response",
        generate_response
    )

    # Flow
    graph.add_edge(
        START,
        "understand_request"
    )

    graph.add_edge(
        "understand_request",
        "retrieve_customer"
    )

    graph.add_edge(
        "retrieve_customer",
        "retrieve_booking"
    )

    graph.add_edge(
        "retrieve_booking",
        "retrieve_policy"
    )

    graph.add_edge(
        "retrieve_policy",
        "evaluate_request"
    )

    graph.add_edge(
        "evaluate_request",
        "generate_response"
    )

    graph.add_edge(
        "generate_response",
        END
    )

    return graph.compile()