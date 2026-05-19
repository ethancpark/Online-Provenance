"""
Supabase client for the pipeline.

Uses the SERVICE_ROLE key (server-side, full access). Never expose this
key in a browser — the Next.js side will use the anon key for reads.
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

_SUPABASE_URL = os.getenv("SUPABASE_URL")
_SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

_client: Client | None = None


def get_client() -> Client:
    """Returns a singleton Supabase client."""
    global _client
    if _client is None:
        if not _SUPABASE_URL or not _SUPABASE_KEY:
            raise RuntimeError(
                "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. "
                "Copy pipeline/.env.example to pipeline/.env and fill in your keys."
            )
        _client = create_client(_SUPABASE_URL, _SUPABASE_KEY)
    return _client


def ping() -> bool:
    """Smoke test — fetches one row from tribes to confirm the connection works."""
    try:
        client = get_client()
        client.table("tribes").select("id").limit(1).execute()
        return True
    except Exception as e:
        print(f"  Supabase ping failed: {e}")
        return False


if __name__ == "__main__":
    if ping():
        print("Supabase connection OK.")
    else:
        print("Supabase connection failed. Check pipeline/.env.")
