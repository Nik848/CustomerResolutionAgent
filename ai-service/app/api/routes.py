from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from langgraph.types import Command

from app.graph.workflow import build_graph

router = APIRouter()

# Build once at startup — the graph holds checkpointer state in memory
graph = build_graph()


class AgentProcessRequest(BaseModel):
    customer: Optional[Dict[str, Any]] = None
    bookings: Optional[List[Dict[str, Any]]] = None
    message: str
    thread_id: str = "api-session-001"
    customer_id: Optional[str] = None


class AgentResumeRequest(BaseModel):
    thread_id: str
    decision: str


@router.post("/agent/process")
def agent_process(request: AgentProcessRequest):
    """
    Main entry point for Node.js backend.
    Accepts customer profile, bookings, message, thread_id.
    Runs LangGraph workflow with injected data and returns structured decision.
    """
    customer_id = (
        request.customer.get("customer_id")
        if request.customer and isinstance(request.customer, dict)
        else request.customer_id
    )

    config = {
        "configurable": {
            "thread_id": request.thread_id
        }
    }

    initial_state = {
        "user_message": request.message,
        "customer_id": customer_id,
        "customer": request.customer,
        "bookings": request.bookings or []
    }

    result = graph.invoke(initial_state, config)

    if "__interrupt__" in result:
        interrupt_data = result["__interrupt__"][0].value
        approval_req = interrupt_data.get("approval_request") or {}

        return {
            "status": "human_approval_required",
            "requires_human_approval": True,
            "response": "Your request requires supervisor approval. A supervisor has been notified.",
            "interrupt": interrupt_data,
            "approval_request": approval_req,
            "intent": result.get("intent"),
            "decision": result.get("decision"),
            "booking_id": (result.get("selected_booking") or {}).get("booking_id"),
            "thread_id": request.thread_id
        }

    return {
        "status": "completed",
        "response": result.get("response"),
        "decision": result.get("decision"),
        "action_result": result.get("action_result"),
        "actions": (result.get("decision") or {}).get("actions", []),
        "booking_id": (result.get("selected_booking") or {}).get("booking_id"),
        "selected_booking": result.get("selected_booking"),
        "thread_id": request.thread_id
    }


@router.post("/agent/resume")
def agent_resume(request: AgentResumeRequest):
    """
    Resume a paused LangGraph workflow after supervisor approve/reject.
    """
    if request.decision not in {"approve", "reject"}:
        raise HTTPException(
            status_code=400,
            detail="decision must be 'approve' or 'reject'"
        )

    config = {
        "configurable": {
            "thread_id": request.thread_id
        }
    }

    result = graph.invoke(
        Command(resume={"status": request.decision}),
        config
    )

    return {
        "status": "completed",
        "response": result.get("response"),
        "decision": result.get("decision"),
        "action_result": result.get("action_result"),
        "human_approval": result.get("human_approval"),
        "actions": (result.get("decision") or {}).get("actions", []),
        "booking_id": (result.get("selected_booking") or {}).get("booking_id"),
        "selected_booking": result.get("selected_booking"),
        "thread_id": request.thread_id
    }


@router.get("/health")
def health():
    return {"status": "ok", "service": "ai-service"}