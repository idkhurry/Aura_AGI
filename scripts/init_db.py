#!/usr/bin/env python3
"""Initialize SurrealDB with schema."""

import asyncio
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from aura.config import settings
from aura.db.client import DatabaseClient


async def main():
    """Initialize database with schema."""
    print("Initializing SurrealDB...")
    print(f"URL: {settings.surreal_url}")
    print(f"Namespace: {settings.surreal_ns}")
    print(f"Database: {settings.surreal_db}")

    # Connect to database
    db = DatabaseClient()
    await db.connect()

    print("\nDatabase connected!")

    # Read schema file
    schema_path = Path(__file__).parent / "init_schema.surql"

    if not schema_path.exists():
        print(f"Error: Schema file not found at {schema_path}")
        return

    print(f"\nReading schema from {schema_path}...")
    schema_sql = schema_path.read_text()

    # Execute schema (split by semicolons)
    statements = [s.strip() for s in schema_sql.split(";") if s.strip()]

    print(f"\nExecuting {len(statements)} schema statements...")

    for i, statement in enumerate(statements, 1):
        if statement:
            try:
                await db.query(statement)
                print(f"  [{i}/{len(statements)}] ✓")
            except Exception as e:
                print(f"  [{i}/{len(statements)}] ✗ Error: {e}")

    print("\n✓ Schema initialization complete!")

    # Verify emotion table
    result = await db.query("SELECT count() FROM emotion GROUP ALL")
    if result:
        count = result[0].get("count", 0)
        print(f"\nVerification: {count} emotions initialized")

    await db.close()
    print("\nDatabase connection closed")


if __name__ == "__main__":
    asyncio.run(main())

