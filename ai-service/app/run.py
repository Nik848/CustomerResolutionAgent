from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_env_path)
load_dotenv()

from app.graph.workflow import build_graph


def main():

    graph = build_graph()

    print("\nAirline Customer Resolution Agent")
    print("----------------------------------")

    # Simulated authenticated user.
    # In the real application this will come from authentication.
    customer_id = input(
        "Logged-in customer ID: "
    ).strip()

    while True:

        user_message = input("\nCustomer: ")

        if user_message.lower() in {
            "exit",
            "quit"
        }:
            break

        result = graph.invoke({
            "customer_id": customer_id,
            "user_message": user_message
        })

        print("\nAgent:")
        print(result.get("response"))


if __name__ == "__main__":
    main()