import json
import os
from pathlib import Path

from dotenv import load_dotenv
from langchain_groq import ChatGroq

from app.prompts.customer_agent import CUSTOMER_AGENT_PROMPT

# Load environment variables
_env_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=_env_path)
load_dotenv()


class CustomerResolutionAgent:

    def __init__(self):
        groq_api_key = os.getenv("GROQ_API_KEY")
        if not groq_api_key:
            raise ValueError(
                "GROQ_API_KEY environment variable is missing. "
                "Please check your ai-service/.env file."
            )

        self.llm = ChatGroq(
            api_key=groq_api_key,
            model="openai/gpt-oss-20b",
            temperature=0
        )

    def understand_request(self, user_message: str) -> dict:

        prompt = CUSTOMER_AGENT_PROMPT.format(
            user_message=user_message
        )

        response = self.llm.invoke(prompt)

        content = response.content

        if isinstance(content, list):
            content = "".join(
                item.get("text", "")
                if isinstance(item, dict)
                else str(item)
                for item in content
            )

        content = content.strip()

        if content.startswith("```"):
            content = content.replace("```json", "")
            content = content.replace("```", "")
            content = content.strip()

        parsed = {}
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            parsed = {
                "intent": "other",
                "requested_action": None
            }

        # Normalize fields
        intent = parsed.get("intent", "other")
        req_action = parsed.get("requested_action")
        req_actions = parsed.get("requested_actions") or []
        if req_action and req_action not in req_actions:
            req_actions.append(req_action)

        msg_lower = user_message.lower()

        # Heuristic checks for ambiguity
        is_ambiguous = parsed.get("is_ambiguous", False)
        if any(p in msg_lower for p in ("take care of my flight", "what can you do for me", "help with my flight")):
            is_ambiguous = True

        # Heuristic checks for inquiry only vs action
        is_inquiry_only = parsed.get("is_inquiry_only", False)
        if any(p in msg_lower for p in ("am i eligible", "what do i qualify for", "do i get", "am i entitled", "what is the policy")):
            is_inquiry_only = True

        # Multi-intent detection fallback if LLM only returned one
        if "refund" in msg_lower and "lounge" in msg_lower:
            if "refund" not in req_actions:
                req_actions.append("refund")
            if "lounge" not in req_actions:
                req_actions.append("lounge")

        return {
            "intent": intent,
            "requested_action": req_action,
            "requested_actions": req_actions,
            "is_inquiry_only": is_inquiry_only,
            "is_ambiguous": is_ambiguous
        }