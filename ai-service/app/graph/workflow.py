from langgraph.graph import StateGraph, START, END

from app.graph.state import AgentState

from app.graph.nodes import (
    understand_request,
    retrieve_customer,
    retrieve_booking,
    select_booking,
    retrieve_policy,
    evaluate_request,
    check_human_approval,
    execute_action,
    generate_response
)

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver


def build_graph():

    graph = StateGraph(AgentState)

    # ---------------------------------------------------------
    # Nodes
    # ---------------------------------------------------------

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
        "select_booking",
        select_booking
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
        "check_human_approval",
        check_human_approval
    )

    graph.add_node(
        "execute_action",
        execute_action
    )

    graph.add_node(
        "generate_response",
        generate_response
    )

    # ---------------------------------------------------------
    # Main Flow
    # ---------------------------------------------------------

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
        "select_booking"
    )

    graph.add_edge(
        "select_booking",
        "retrieve_policy"
    )

    graph.add_edge(
        "retrieve_policy",
        "evaluate_request"
    )

    graph.add_edge(
        "evaluate_request",
        "check_human_approval"
    )

    graph.add_edge(
        "check_human_approval",
        "execute_action"
    )

    graph.add_edge(
        "execute_action",
        "generate_response"
    )

    graph.add_edge(
        "generate_response",
        END
    )

    # ---------------------------------------------------------
    # Compile with checkpointing
    # ---------------------------------------------------------

    checkpointer = MemorySaver()

    compiled = graph.compile(
        checkpointer=checkpointer
    )

    orig_invoke = compiled.invoke

    def invoke_with_interrupts(input_data, config=None, **kwargs):
        res = orig_invoke(input_data, config, **kwargs)
        if config and isinstance(res, dict):
            state = compiled.get_state(config)
            if state.tasks:
                interrupts = [
                    i for t in state.tasks for i in getattr(t, "interrupts", [])
                ]
                if interrupts:
                    res["__interrupt__"] = interrupts
        return res

    compiled.invoke = invoke_with_interrupts
    return compiled