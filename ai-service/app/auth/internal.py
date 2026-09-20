import os
from fastapi import Header, HTTPException, status
from dotenv import load_dotenv

load_dotenv()


def verify_internal_api_key(
    x_internal_api_key: str = Header(None, alias="X-Internal-API-Key")
) -> str:
    """
    Validates X-Internal-API-Key against the configured INTERNAL_API_KEY environment variable.
    Protects internal endpoints called by the Node.js backend.
    """
    expected_key = os.getenv("INTERNAL_API_KEY")
    if not expected_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="INTERNAL_API_KEY is not configured on the AI service"
        )

    if not x_internal_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing internal API key (X-Internal-API-Key header required)"
        )

    if x_internal_api_key != expected_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid internal API key"
        )

    return x_internal_api_key
