#!/usr/bin/env python3
"""Create or update an admin in the Supabase admins table.

Usage (run from the backend/ directory):
    python create_admin.py <username> <password>

Re-running with the same username updates the password.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import bcrypt
from dotenv import load_dotenv
load_dotenv()

from app.config import config


def main():
    if len(sys.argv) != 3:
        print("Usage: python create_admin.py <username> <password>")
        sys.exit(1)

    username, password = sys.argv[1], sys.argv[2]

    if not config.supabase_enabled():
        print("Error: SUPABASE_URL and SUPABASE_KEY must be set in .env")
        sys.exit(1)

    from supabase import create_client
    client = create_client(config.SUPABASE_URL, config.SUPABASE_KEY)

    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    result = client.table("admins").upsert(
        {"username": username, "password_hash": hashed},
        on_conflict="username",
    ).execute()

    if result.data:
        print(f"Admin '{username}' saved successfully.")
    else:
        print(f"Unexpected response: {result}")
        sys.exit(1)


if __name__ == "__main__":
    main()
