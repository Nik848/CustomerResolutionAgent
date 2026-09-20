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

        try:
            return json.loads(content)

        except json.JSONDecodeError:

            return {
                "intent": "other",
                "requested_action": None
            }