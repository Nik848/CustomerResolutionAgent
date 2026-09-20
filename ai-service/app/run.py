from pathlib import Path

from dotenv import load_dotenv

from langgraph.types import Command

_env_path = Path(__file__).resolve().parent.parent / ".env"

load_dotenv(
    dotenv_path=_env_path
)

load_dotenv()

from app.graph.workflow import build_graph


def main():

    graph = build_graph()

    print("\nAirline Customer Resolution Agent")
    print("----------------------------------")

    authenticated_user = {
        "customer_id": "CUST001"
    }

    customer_id = authenticated_user[
        "customer_id"
    ]

    print(
        f"Logged-in customer ID: {customer_id}"
    )

    thread_id = "customer-session-001"

    config = {
        "configurable": {
            "thread_id": thread_id
        }
    }

    while True:

        user_message = input(
            "\nCustomer: "
        )

        if user_message.lower() in {
            "exit",
            "quit"
        }:
            break

        result = graph.invoke(
            {
                "customer_id": customer_id,
                "user_message": user_message
            },
            config
        )

        # -----------------------------------------------------
        # Human approval required
        # -----------------------------------------------------

        if "__interrupt__" in result:

            print("\nHuman Approval Required")
            print("-----------------------")

            interrupt_data = result[
                "__interrupt__"
            ][0].value

            print(
                interrupt_data.get(
                    "message",
                    "Human approval is required."
                )
            )

            print("\nOptions:")
            print("1. approve")
            print("2. reject")

            approval = input(
                "\nSupervisor decision: "
            ).lower().strip()

            if approval not in {
                "approve",
                "reject"
            }:
                print(
                    "Invalid decision."
                )
                continue

            result = graph.invoke(
                Command(
                    resume={
                        "status": approval
                    }
                ),
                config
            )

        print("\nAgent:")
        print(
            result.get(
                "response"
            )
        )


if __name__ == "__main__":
    main()