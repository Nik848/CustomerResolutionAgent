import os
from pathlib import Path
from functools import lru_cache

from dotenv import load_dotenv
from supabase import create_client, Client


# Load .env from the ai-service root — works both locally and in tests
_env_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=_env_path)
load_dotenv()  # also picks up any shell-level env vars


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    """
    Returns the same Supabase client for the lifetime of the process.
    lru_cache(1) means we only create the connection once — no matter
    how many times the tools call this.
    """
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY")

    if not url or not key:
        raise EnvironmentError(
            "SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env"
        )

    return create_client(url, key)
