"""
Database Utilities Module for ATC Adaptive Alert Research System

Provides a database-agnostic, asynchronous interface for data storage
using the `databases` library, compatible with PostgreSQL and SQLite.
"""

import os
import json
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path
from contextlib import asynccontextmanager

from databases import Database
from sqlalchemy import create_engine, text

# Use DATABASE_URL from environment, falling back to a local SQLite file
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{Path(__file__).parent / 'atc_research.db'}")

class DatabaseManager:
    """Asynchronous database manager for SQLite and PostgreSQL."""

    def __init__(self, db_url: str = DATABASE_URL):
        self.db_url = db_url

        # Normalize Postgres URLs for async driver (Render may supply postgres://)
        async_db_url = db_url
        if async_db_url.startswith("postgres://"):
            async_db_url = async_db_url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif async_db_url.startswith("postgresql://") and "asyncpg" not in async_db_url:
            async_db_url = async_db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

        # For sync engine (schema execution), use psycopg2 driver
        sync_db_url = db_url
        if sync_db_url.startswith("postgres://"):
            sync_db_url = sync_db_url.replace("postgres://", "postgresql://", 1)
        elif "asyncpg" in sync_db_url:
            sync_db_url = sync_db_url.replace("postgresql+asyncpg://", "postgresql://", 1)

        # Ensure directory exists for SQLite databases
        if db_url.startswith("sqlite"):
            db_path = Path(db_url.replace("sqlite:///", ""))
            db_path.parent.mkdir(parents=True, exist_ok=True)

        self.database = Database(async_db_url)
        self._engine = create_engine(sync_db_url)
        self.is_postgres = self._engine.dialect.name == 'postgresql'

    async def connect(self):
        await self.database.connect()

    async def disconnect(self):
        await self.database.disconnect()

    @asynccontextmanager
    async def get_connection(self):
        if not self.database.is_connected:
            await self.connect()
        yield self.database

    async def execute_schema(self, schema_file: str):
        schema_path = Path(__file__).parent / schema_file
        if not schema_path.exists():
            raise FileNotFoundError(f"Schema file not found: {schema_path}")

        with open(schema_path, "r") as f:
            schema = f.read()

        with self._engine.connect() as connection:
            trans = connection.begin()
            try:
                for statement in schema.split(';'):
                    if statement.strip():
                        connection.execute(text(statement))
                trans.commit()
            except Exception:
                trans.rollback()
                raise

    async def _execute_insert(self, query: str, values: dict) -> int:
        async with self.get_connection() as conn:
            if self.is_postgres:
                query += " RETURNING id;"
                return await conn.execute(query=query, values=values)
            else: # SQLite
                res = await conn.execute(query=query, values=values)
                return res

    # ========== SESSION OPERATIONS ==========

    async def create_session(self, session_id: str, participant_id: str, scenario: str, condition: int, initial_state: Optional[Dict] = None) -> int:
        await self.create_participant_if_not_exists(participant_id)
        query = "INSERT INTO sessions (session_id, participant_id, scenario, condition, initial_state, status) VALUES (:session_id, :participant_id, :scenario, :condition, :initial_state, 'active')"
        values = {"session_id": session_id, "participant_id": participant_id, "scenario": scenario, "condition": condition, "initial_state": json.dumps(initial_state) if initial_state else None}
        return await self._execute_insert(query, values)

    async def end_session(self, session_id: str, end_reason: str = "completed", final_state: Optional[Dict] = None, performance_score: Optional[float] = None) -> bool:
        async with self.get_connection() as conn:
            row = await conn.fetch_one("SELECT started_at FROM sessions WHERE session_id = :session_id", {"session_id": session_id})
            if not row: return False
            started_at = row['started_at']
            ended_at = datetime.utcnow()
            duration = (ended_at - started_at).total_seconds()
            query = "UPDATE sessions SET ended_at = :ended_at, status = 'completed', end_reason = :end_reason, duration_seconds = :duration, final_state = :final_state, performance_score = :performance_score WHERE session_id = :session_id"
            await conn.execute(query=query, values={"ended_at": ended_at, "end_reason": end_reason, "duration": duration, "final_state": json.dumps(final_state) if final_state else None, "performance_score": performance_score, "session_id": session_id})
        return True

    async def get_session(self, session_id: str) -> Optional[Dict]:
        async with self.get_connection() as conn:
            row = await conn.fetch_one("SELECT * FROM sessions WHERE session_id = :session_id", {"session_id": session_id})
        return dict(row) if row else None

    async def get_session_summary(self, session_id: str) -> Optional[Dict]:
        async with self.get_connection() as conn:
            row = await conn.fetch_one("SELECT * FROM v_session_summary WHERE session_id = :session_id", {"session_id": session_id})
        return dict(row) if row else None

    # ========== BEHAVIORAL EVENT OPERATIONS ==========

    async def add_behavioral_event(self, session_id: str, event_type: str, timestamp: float, event_data: Dict, screen_width: Optional[int] = None, screen_height: Optional[int] = None) -> int:
        query = 'INSERT INTO behavioral_events (session_id, event_type, "timestamp", event_data, screen_width, screen_height) VALUES (:session_id, :event_type, :timestamp, :event_data, :screen_width, :screen_height)'
        values = {"session_id": session_id, "event_type": event_type, "timestamp": timestamp, "event_data": json.dumps(event_data), "screen_width": screen_width, "screen_height": screen_height}
        return await self._execute_insert(query, values)

    async def get_behavioral_events(self, session_id: str, event_type: Optional[str] = None, limit: Optional[int] = None) -> List[Dict]:
        query = "SELECT * FROM behavioral_events WHERE session_id = :session_id"
        values = {"session_id": session_id}
        if event_type:
            query += " AND event_type = :event_type"
            values["event_type"] = event_type
        query += " ORDER BY timestamp"
        if limit: query += f" LIMIT {limit}"
        async with self.get_connection() as conn:
            rows = await conn.fetch_all(query, values)
        return [dict(row) for row in rows]

    # ========== SCENARIO EVENT OPERATIONS ==========

    async def add_scenario_event(self, session_id: str, event_id: str, event_name: str, event_type: str, scenario_time: float, event_data: Dict, severity: Optional[str] = None, aircraft_id: Optional[str] = None) -> int:
        query = "INSERT INTO scenario_events (session_id, event_id, event_name, event_type, scenario_time, event_data, severity, aircraft_id) VALUES (:session_id, :event_id, :event_name, :event_type, :scenario_time, :event_data, :severity, :aircraft_id)"
        values = {"session_id": session_id, "event_id": event_id, "event_name": event_name, "event_type": event_type, "scenario_time": scenario_time, "event_data": json.dumps(event_data), "severity": severity, "aircraft_id": aircraft_id}
        return await self._execute_insert(query, values)

    async def update_scenario_event_response(self, event_id: str, response_time: float, action: str) -> bool:
        now = datetime.utcnow()
        query = "UPDATE scenario_events SET controller_response_time = :response_time, controller_acknowledged_at = :now, controller_action = :action WHERE event_id = :event_id"
        async with self.get_connection() as conn:
            await conn.execute(query=query, values={"response_time": response_time, "now": now, "action": action, "event_id": event_id})
        return True

    # ========== ALERT OPERATIONS ==========

    async def add_alert(self, session_id: str, alert_id: str, alert_type: str, condition: int, priority: str, message: str, aircraft_id: Optional[str] = None, presentation_data: Optional[Dict] = None, additional_data: Optional[Dict] = None) -> int:
        query = "INSERT INTO alerts (session_id, alert_id, alert_type, condition, priority, message, aircraft_id, presentation_data, additional_data) VALUES (:session_id, :alert_id, :alert_type, :condition, :priority, :message, :aircraft_id, :presentation_data, :additional_data)"
        values = {"session_id": session_id, "alert_id": alert_id, "alert_type": alert_type, "condition": condition, "priority": priority, "message": message, "aircraft_id": aircraft_id, "presentation_data": json.dumps(presentation_data) if presentation_data else None, "additional_data": json.dumps(additional_data) if additional_data else None}
        return await self._execute_insert(query, values)

    async def acknowledge_alert(self, alert_id: str, action_taken: Optional[str] = None, action_correct: Optional[bool] = None, response_time_ms: Optional[float] = None) -> bool:
        now = datetime.utcnow()
        query = "UPDATE alerts SET acknowledged_at = :now, was_acknowledged = 1, action_taken = :action_taken, action_correct = :action_correct, response_time = :response_time WHERE alert_id = :alert_id"
        async with self.get_connection() as conn:
            await conn.execute(query=query, values={"now": now, "action_taken": action_taken, "action_correct": action_correct, "response_time": response_time_ms, "alert_id": alert_id})
        return True

    # ========== PARTICIPANT OPERATIONS ==========

    async def create_participant_if_not_exists(self, participant_id: str, age_group: Optional[str] = None, experience_level: Optional[str] = None, atc_background: bool = False) -> int:
        async with self.get_connection() as conn:
            find_query = "SELECT id FROM participants WHERE participant_id = :participant_id"
            row = await conn.fetch_one(query=find_query, values={"participant_id": participant_id})
            if row:
                return row['id']
            insert_query = "INSERT INTO participants (participant_id, age_group, experience_level, atc_background) VALUES (:participant_id, :age_group, :experience_level, :atc_background)"
            values = {"participant_id": participant_id, "age_group": age_group, "experience_level": experience_level, "atc_background": atc_background}
            return await self._execute_insert(insert_query, values)

    # ========== ANALYTICS ==========
    async def get_participant_performance(self, participant_id: str) -> Optional[Dict]:
        async with self.get_connection() as conn:
            row = await conn.fetch_one("SELECT * FROM v_participant_performance WHERE participant_id = :participant_id", {"participant_id": participant_id})
        return dict(row) if row else None

    async def get_active_sessions(self) -> List[Dict]:
        """Get all currently active sessions."""
        query = "SELECT * FROM sessions WHERE status = 'active'"
        async with self.get_connection() as conn:
            rows = await conn.fetch_all(query)
        return [dict(row) for row in rows]

    # ========== METRICS OPERATIONS ==========

    async def add_metric(
        self,
        session_id: str,
        metric_name: str,
        metric_category: str,
        metric_value: float,
        metric_unit: Optional[str] = None,
        phase: Optional[str] = None,
        scenario_time: Optional[float] = None,
        alert_id: Optional[str] = None,
        metric_data: Optional[Dict] = None
    ) -> int:
        """Add a metric measurement to the database."""
        query = """
            INSERT INTO metrics
            (session_id, metric_name, metric_category, metric_value, metric_unit,
             phase, scenario_time, alert_id, metric_data)
            VALUES
            (:session_id, :metric_name, :metric_category, :metric_value, :metric_unit,
             :phase, :scenario_time, :alert_id, :metric_data)
        """
        values = {
            "session_id": session_id,
            "metric_name": metric_name,
            "metric_category": metric_category,
            "metric_value": metric_value,
            "metric_unit": metric_unit,
            "phase": phase,
            "scenario_time": scenario_time,
            "alert_id": alert_id,
            "metric_data": json.dumps(metric_data) if metric_data else None
        }
        return await self._execute_insert(query, values)

    # ========== CHECKPOINT OPERATIONS (Crash Safety) ==========

    async def save_session_checkpoint(
        self,
        session_id: str,
        checkpoint_data: Dict[str, Any]
    ) -> bool:
        """Save periodic checkpoint of in-memory scenario state for crash recovery."""
        query = """
            UPDATE sessions
            SET checkpoint_data = :checkpoint_data,
                checkpoint_at = :checkpoint_at
            WHERE session_id = :session_id
        """
        async with self.get_connection() as conn:
            await conn.execute(query=query, values={
                "session_id": session_id,
                "checkpoint_data": json.dumps(checkpoint_data),
                "checkpoint_at": datetime.utcnow().isoformat()
            })
        return True

    async def get_session_checkpoint(self, session_id: str) -> Optional[Dict]:
        """Retrieve the last checkpoint for a session (used for crash recovery)."""
        async with self.get_connection() as conn:
            row = await conn.fetch_one(
                "SELECT checkpoint_data, checkpoint_at FROM sessions WHERE session_id = :session_id",
                {"session_id": session_id}
            )
        if row and row['checkpoint_data']:
            return {
                'data': json.loads(row['checkpoint_data']),
                'checkpoint_at': row['checkpoint_at']
            }
        return None

# Singleton instance
_db_manager = None

def get_db_manager() -> "DatabaseManager":
    global _db_manager
    if _db_manager is None:
        _db_manager = DatabaseManager()
    return _db_manager
