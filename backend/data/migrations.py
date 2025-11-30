#!/usr/bin/env python3
"""
Database Migration System for ATC Adaptive Alert Research System

Handles database schema versioning and migrations.
"""

import sqlite3
from pathlib import Path
from datetime import datetime
from typing import List, Tuple, Callable
import argparse


class Migration:
    """Represents a database migration"""

    def __init__(self, version: str, description: str, up_sql: str, down_sql: str = None):
        """
        Initialize migration

        Args:
            version: Version number (e.g., "1.0.1")
            description: Migration description
            up_sql: SQL to apply migration
            down_sql: SQL to rollback migration (optional)
        """
        self.version = version
        self.description = description
        self.up_sql = up_sql
        self.down_sql = down_sql


class MigrationManager:
    """Manages database migrations"""

    def __init__(self, db_path: str = None):
        """
        Initialize migration manager

        Args:
            db_path: Path to database file
        """
        if db_path is None:
            db_path = Path(__file__).parent / "research_data.db"
        else:
            db_path = Path(db_path)

        self.db_path = str(db_path)
        self.migrations = self._define_migrations()

    def _define_migrations(self) -> List[Migration]:
        """
        Define all migrations

        Returns:
            List of Migration objects
        """
        return [
            # Migration 1.0.1: Add participant email field
            Migration(
                version="1.0.1",
                description="Add email field to participants table",
                up_sql="""
                    ALTER TABLE participants ADD COLUMN email VARCHAR(255);
                    CREATE INDEX IF NOT EXISTS idx_participants_email ON participants(email);
                """,
                down_sql="""
                    -- SQLite doesn't support DROP COLUMN, would need to recreate table
                    -- For now, just drop the index
                    DROP INDEX IF EXISTS idx_participants_email;
                """
            ),

            # Migration 1.0.2: Add session configuration field
            Migration(
                version="1.0.2",
                description="Add configuration field to sessions table",
                up_sql="""
                    ALTER TABLE sessions ADD COLUMN configuration TEXT;
                    -- TEXT field for JSON configuration data
                """,
                down_sql=""
            ),

            # Migration 1.0.3: Add device info to behavioral events
            Migration(
                version="1.0.3",
                description="Add device information to behavioral_events table",
                up_sql="""
                    ALTER TABLE behavioral_events ADD COLUMN device_type VARCHAR(50);
                    ALTER TABLE behavioral_events ADD COLUMN browser_name VARCHAR(50);
                    ALTER TABLE behavioral_events ADD COLUMN browser_version VARCHAR(50);
                    CREATE INDEX IF NOT EXISTS idx_behavioral_device ON behavioral_events(device_type);
                """,
                down_sql=""
            ),

            # Migration 1.0.4: Add alert presentation metrics
            Migration(
                version="1.0.4",
                description="Add detailed presentation metrics to alerts table",
                up_sql="""
                    ALTER TABLE alerts ADD COLUMN time_visible REAL;
                    ALTER TABLE alerts ADD COLUMN interaction_count INTEGER DEFAULT 0;
                    ALTER TABLE alerts ADD COLUMN was_ignored BOOLEAN DEFAULT 0;
                """,
                down_sql=""
            ),

            # Migration 1.0.5: Add scenario checkpoints
            Migration(
                version="1.0.5",
                description="Create scenario checkpoints table",
                up_sql="""
                    CREATE TABLE IF NOT EXISTS scenario_checkpoints (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        session_id VARCHAR(50) NOT NULL,
                        checkpoint_name VARCHAR(100) NOT NULL,
                        reached_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        scenario_time REAL NOT NULL,
                        checkpoint_data TEXT,
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
                    );
                    CREATE INDEX IF NOT EXISTS idx_checkpoint_session ON scenario_checkpoints(session_id);
                    CREATE INDEX IF NOT EXISTS idx_checkpoint_name ON scenario_checkpoints(checkpoint_name);
                """,
                down_sql="""
                    DROP TABLE IF EXISTS scenario_checkpoints;
                """
            ),
        ]

    def get_current_version(self) -> str:
        """
        Get current database schema version

        Returns:
            Version string or "0.0.0" if no version found
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute("""
                SELECT version FROM schema_version
                ORDER BY applied_at DESC LIMIT 1
            """)

            row = cursor.fetchone()
            conn.close()

            return row[0] if row else "0.0.0"

        except sqlite3.Error:
            return "0.0.0"

    def get_applied_migrations(self) -> List[str]:
        """
        Get list of applied migration versions

        Returns:
            List of version strings
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute("""
                SELECT version FROM schema_version ORDER BY applied_at
            """)

            versions = [row[0] for row in cursor.fetchall()]
            conn.close()

            return versions

        except sqlite3.Error:
            return []

    def get_pending_migrations(self) -> List[Migration]:
        """
        Get list of pending migrations

        Returns:
            List of Migration objects
        """
        applied = set(self.get_applied_migrations())
        pending = [m for m in self.migrations if m.version not in applied]
        return sorted(pending, key=lambda m: m.version)

    def apply_migration(self, migration: Migration) -> bool:
        """
        Apply a single migration

        Args:
            migration: Migration object

        Returns:
            True if successful
        """
        try:
            print(f"Applying migration {migration.version}: {migration.description}")

            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Execute migration SQL
            cursor.executescript(migration.up_sql)

            # Record in schema_version
            cursor.execute("""
                INSERT INTO schema_version (version, description)
                VALUES (?, ?)
            """, (migration.version, migration.description))

            conn.commit()
            conn.close()

            print(f"✓ Migration {migration.version} applied successfully")
            return True

        except sqlite3.Error as e:
            print(f"✗ Error applying migration {migration.version}: {e}")
            return False

    def rollback_migration(self, migration: Migration) -> bool:
        """
        Rollback a single migration

        Args:
            migration: Migration object

        Returns:
            True if successful
        """
        if not migration.down_sql:
            print(f"⚠️  No rollback SQL defined for migration {migration.version}")
            return False

        try:
            print(f"Rolling back migration {migration.version}: {migration.description}")

            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Execute rollback SQL
            cursor.executescript(migration.down_sql)

            # Remove from schema_version
            cursor.execute("""
                DELETE FROM schema_version WHERE version = ?
            """, (migration.version,))

            conn.commit()
            conn.close()

            print(f"✓ Migration {migration.version} rolled back successfully")
            return True

        except sqlite3.Error as e:
            print(f"✗ Error rolling back migration {migration.version}: {e}")
            return False

    def migrate_up(self, target_version: str = None) -> bool:
        """
        Apply all pending migrations up to target version

        Args:
            target_version: Target version (None = latest)

        Returns:
            True if all migrations successful
        """
        pending = self.get_pending_migrations()

        if not pending:
            print("✓ Database is up to date")
            return True

        # Filter to target version if specified
        if target_version:
            pending = [m for m in pending if m.version <= target_version]

        if not pending:
            print(f"✓ Database is already at version {target_version}")
            return True

        print(f"\nApplying {len(pending)} migration(s)...\n")

        for migration in pending:
            if not self.apply_migration(migration):
                print(f"\n✗ Migration failed. Database is at version {self.get_current_version()}")
                return False

        print(f"\n✓ All migrations applied. Database is now at version {self.get_current_version()}")
        return True

    def migrate_down(self, target_version: str) -> bool:
        """
        Rollback migrations down to target version

        Args:
            target_version: Target version

        Returns:
            True if all rollbacks successful
        """
        applied = self.get_applied_migrations()
        current_version = self.get_current_version()

        if current_version <= target_version:
            print(f"✓ Database is already at or below version {target_version}")
            return True

        # Find migrations to rollback
        to_rollback = []
        for version in reversed(applied):
            if version > target_version:
                # Find migration object
                migration = next((m for m in self.migrations if m.version == version), None)
                if migration:
                    to_rollback.append(migration)

        if not to_rollback:
            print(f"✓ No migrations to rollback")
            return True

        print(f"\nRolling back {len(to_rollback)} migration(s)...\n")

        for migration in to_rollback:
            if not self.rollback_migration(migration):
                print(f"\n✗ Rollback failed. Database is at version {self.get_current_version()}")
                return False

        print(f"\n✓ All migrations rolled back. Database is now at version {self.get_current_version()}")
        return True

    def show_status(self):
        """Display migration status"""
        current = self.get_current_version()
        applied = self.get_applied_migrations()
        pending = self.get_pending_migrations()

        print(f"\n{'='*60}")
        print(f"Database Migration Status")
        print(f"{'='*60}\n")

        print(f"Current Version: {current}")
        print(f"Database Path:   {self.db_path}")

        print(f"\nApplied Migrations ({len(applied)}):")
        if applied:
            for version in applied:
                migration = next((m for m in self.migrations if m.version == version), None)
                desc = migration.description if migration else "Unknown"
                print(f"  ✓ {version} - {desc}")
        else:
            print("  (none)")

        print(f"\nPending Migrations ({len(pending)}):")
        if pending:
            for migration in pending:
                print(f"  ○ {migration.version} - {migration.description}")
        else:
            print("  (none)")

        print()


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Manage database migrations'
    )

    parser.add_argument(
        '--db-path',
        type=str,
        help='Path to database file'
    )

    parser.add_argument(
        '--status',
        action='store_true',
        help='Show migration status'
    )

    parser.add_argument(
        '--up',
        nargs='?',
        const='latest',
        metavar='VERSION',
        help='Migrate up to version (default: latest)'
    )

    parser.add_argument(
        '--down',
        metavar='VERSION',
        help='Migrate down to version'
    )

    args = parser.parse_args()

    # Create migration manager
    manager = MigrationManager(db_path=args.db_path)

    if args.status:
        manager.show_status()

    elif args.up:
        target_version = None if args.up == 'latest' else args.up
        manager.migrate_up(target_version)

    elif args.down:
        manager.migrate_down(args.down)

    else:
        parser.print_help()
        print("\nExamples:")
        print("  # Show migration status")
        print("  python migrations.py --status")
        print("\n  # Apply all pending migrations")
        print("  python migrations.py --up")
        print("\n  # Migrate to specific version")
        print("  python migrations.py --up 1.0.3")
        print("\n  # Rollback to version")
        print("  python migrations.py --down 1.0.0")


if __name__ == "__main__":
    main()
