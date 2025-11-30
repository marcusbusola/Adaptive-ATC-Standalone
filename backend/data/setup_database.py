#!/usr/bin/env python3
"""
Database Setup Script for ATC Adaptive Alert Research System

This script initializes the database with the correct schema for either
SQLite or PostgreSQL, based on the DATABASE_URL environment variable.
"""

import os
import asyncio
from pathlib import Path
import argparse
import sys
from dotenv import load_dotenv

# Load .env file from the project root
dotenv_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(dotenv_path=dotenv_path)

# Add backend path to allow importing db_utils
sys.path.append(str(Path(__file__).parent.parent))

from data.db_utils import get_db_manager

class DatabaseSetup:
    """Handle database setup and initialization for SQLite and PostgreSQL."""

    def __init__(self):
        self.db_manager = get_db_manager()
        self.is_postgres = self.db_manager.is_postgres
        self.schema_dir = Path(__file__).parent

    async def create_database(self, force: bool = False):
        """
        Create database and initialize schema.
        """
        if self.is_postgres:
            schema_file = "schema_postgres.sql"
            print("🚀 Initializing PostgreSQL database...")
        else:
            schema_file = "schema.sql"
            print("🚀 Initializing SQLite database...")
            db_path_str = self.db_manager.db_url.replace("sqlite:///", "")
            db_path = Path(db_path_str)
            if db_path.exists() and force:
                print(f"⚠️ Deleting existing SQLite database: {db_path}")
                db_path.unlink()

        try:
            print(f"📖 Applying schema from: {schema_file}")
            await self.db_manager.execute_schema(schema_file)
            print("✓ Database schema applied successfully.")
        except Exception as e:
            print(f"✗ Error applying schema: {e}")
            sys.exit(1)

    async def verify_database(self) -> bool:
        """Verify database structure and integrity."""
        print("\n🔍 Verifying database...")
        try:
            async with self.db_manager.get_connection() as conn:
                if self.is_postgres:
                    query = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
                    rows = await conn.fetch_all(query)
                    existing_tables = [row['table_name'] for row in rows]
                else: # SQLite
                    query = "SELECT name FROM sqlite_master WHERE type='table'"
                    rows = await conn.fetch_all(query)
                    existing_tables = [row['name'] for row in rows]

            required_tables = [
                'sessions', 'behavioral_events', 'scenario_events', 'alerts',
                'metrics', 'surveys', 'participants', 'system_logs',
                'schema_version', 'metric_categories'
            ]
            missing_tables = set(required_tables) - set(existing_tables)

            if missing_tables:
                print(f"✗ Missing tables: {', '.join(missing_tables)}")
                return False

            print("✓ All required tables exist.")
            return True
        except Exception as e:
            print(f"✗ Error verifying database: {e}")
            return False

async def main():
    parser = argparse.ArgumentParser(description='Setup and manage the ATC Research database.')
    parser.add_argument('--create', action='store_true', help='Create new database.')
    parser.add_argument('--force', action='store_true', help='Force recreate database (deletes existing if SQLite).')
    parser.add_argument('--verify', action='store_true', help='Verify database integrity.')

    args = parser.parse_args()

    setup = DatabaseSetup()

    if args.create:
        await setup.create_database(force=args.force)
        await setup.verify_database()
    elif args.verify:
        await setup.verify_database()
    else:
        parser.print_help()

    await setup.db_manager.disconnect()

if __name__ == "__main__":
    if not os.getenv("DATABASE_URL"):
        print("⚠️  WARNING: DATABASE_URL environment variable not set.")
        print("   Falling back to default SQLite database.\n")
    else:
        print(f"✓ DATABASE_URL found in environment.")

    asyncio.run(main())
