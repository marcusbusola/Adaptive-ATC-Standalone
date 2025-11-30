# ATC Adaptive Alert Research System - Database Documentation

## Overview

SQLite database system for storing comprehensive research data from ATC adaptive alert experiments.

**Database File:** `research_data.db`
**Schema Version:** 1.0.0
**Type:** SQLite 3

---

## Quick Start

### 1. Create Database

```bash
cd backend/data
python setup_database.py --create
```

### 2. Verify Database

```bash
python setup_database.py --verify
```

### 3. Create with Test Data

```bash
python setup_database.py --create --test-data
```

---

## Database Schema

### Tables

#### 1. `sessions`
Stores session metadata and summary information.

**Key Fields:**
- `session_id` - Unique session identifier
- `participant_id` - Participant identifier
- `scenario` - Scenario type (L1, L2, H4, H5)
- `condition` - Alert condition (1=Traditional, 2=Rule-Based, 3=ML-Based)
- `started_at`, `ended_at` - Session timestamps
- `status` - Session status (active, completed, aborted, error)
- `performance_score` - Computed performance score

**Indexes:**
- session_id (unique)
- participant_id
- scenario, condition
- status, started_at

---

#### 2. `behavioral_events`
Stores all behavioral events (mouse movements, clicks, interactions).

**Key Fields:**
- `session_id` - Foreign key to sessions
- `event_type` - Type of event (mouse_move, click, key_press, etc.)
- `event_data` - JSON data with event details
- `timestamp` - Unix timestamp with millisecond precision
- `screen_width`, `screen_height` - Display dimensions

**Common Event Types:**
- `mouse_move` - Mouse movement tracking
- `click` - Mouse clicks
- `key_press` - Keyboard input
- `scroll` - Scroll events
- `hover` - Element hover events
- `focus` - Focus changes

**Indexes:**
- session_id
- event_type
- timestamp
- Combined: (session_id, event_type), (session_id, timestamp)

---

#### 3. `scenario_events`
Stores scenario-specific events (aircraft state changes, emergencies).

**Key Fields:**
- `session_id` - Foreign key to sessions
- `event_id` - Unique event identifier
- `event_name` - Event name
- `event_type` - Event type (alert, aircraft_state_change, emergency, etc.)
- `scenario_time` - Time from scenario start (seconds)
- `controller_response_time` - Time to first controller action
- `severity` - Event severity (advisory, warning, critical)
- `aircraft_id` - Related aircraft

**Indexes:**
- session_id, event_type
- aircraft_id, severity
- triggered_at

---

#### 4. `alerts`
Stores alert presentation and response data.

**Key Fields:**
- `session_id` - Foreign key to sessions
- `alert_id` - Unique alert identifier
- `alert_type` - Type of alert (fuel_emergency, conflict, etc.)
- `condition` - How alert was presented (1, 2, 3)
- `priority` - Alert priority (low, medium, high, critical)
- `displayed_at`, `acknowledged_at`, `dismissed_at` - Timing
- `response_time` - Milliseconds from display to acknowledgment
- `action_taken` - Controller action
- `presentation_data` - JSON presentation details

**Indexes:**
- session_id, alert_id
- condition, priority
- aircraft_id
- was_acknowledged

**Triggers:**
- Auto-calculate response_time when acknowledged
- Auto-calculate time_to_dismiss when dismissed
- Auto-increment session alert count

---

#### 5. `metrics`
Stores performance metrics and measurements.

**Key Fields:**
- `session_id` - Foreign key to sessions
- `metric_name` - Metric name (response_time, accuracy, etc.)
- `metric_category` - Category (performance, workload, attention, etc.)
- `metric_value` - Numeric value
- `metric_unit` - Unit (seconds, count, percentage, score)
- `phase` - Measurement phase (pre, during, post, baseline)
- `alert_id` - Related alert (optional)

**Standard Categories:**
- `performance` - Task performance metrics
- `workload` - Cognitive/physical workload
- `attention` - Attention and situational awareness
- `accuracy` - Decision accuracy and errors
- `efficiency` - Time and resource efficiency
- `safety` - Safety-related metrics

**Indexes:**
- session_id, metric_name
- metric_category, phase
- alert_id

---

#### 6. `surveys`
Stores survey responses (NASA-TLX, SUS, custom questionnaires).

**Key Fields:**
- `session_id` - Foreign key to sessions
- `survey_id` - Unique survey identifier
- `survey_type` - Survey type (NASA-TLX, SUS, post-session, etc.)
- `survey_phase` - Phase (pre, post, mid, followup)
- `responses` - JSON complete responses
- `overall_score` - Computed overall score
- `subscale_scores` - JSON subscale scores
- `duration_seconds` - Survey completion time

**Common Survey Types:**
- `NASA-TLX` - Workload assessment
- `SUS` - System Usability Scale
- `post-session` - Post-session questionnaire
- `demographic` - Demographic information

**Indexes:**
- session_id, survey_type
- survey_phase
- completed_at

---

#### 7. `participants`
Stores participant information (anonymized).

**Key Fields:**
- `participant_id` - Unique participant identifier
- `age_group` - Age range (18-25, 26-35, etc.)
- `experience_level` - Experience level (novice, intermediate, expert)
- `atc_background` - Has ATC background (boolean)
- `assigned_condition` - Assigned experimental condition
- `total_sessions` - Total sessions completed

**Indexes:**
- participant_id (unique)
- assigned_condition
- status

**Triggers:**
- Auto-increment total_sessions when new session created
- Auto-update last_session_date

---

#### 8. `system_logs`
Stores system events and errors for debugging.

**Key Fields:**
- `session_id` - Related session (optional)
- `level` - Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
- `message` - Log message
- `module`, `function_name` - Source location
- `error_type`, `stack_trace` - Error details
- `context_data` - JSON additional context

**Indexes:**
- session_id
- level, logged_at

---

### Views

#### `v_session_summary`
Comprehensive session summary with event counts.

**Fields:**
- All session fields
- `behavioral_event_count` - Total behavioral events
- `scenario_event_count` - Total scenario events
- `alert_count` - Total alerts
- `avg_alert_response_time` - Average response time

---

#### `v_alert_performance`
Alert performance metrics by condition and priority.

**Fields:**
- `session_id`, `condition`, `priority`
- `total_alerts` - Number of alerts
- `avg_response_time` - Average response time
- `acknowledged_count` - Number acknowledged
- `acknowledgment_rate` - Percentage acknowledged

---

#### `v_participant_performance`
Participant performance summary across all sessions.

**Fields:**
- `participant_id`
- `total_sessions` - Sessions completed
- `avg_performance` - Average performance score
- `avg_session_duration` - Average session duration
- `total_alerts_seen` - Total alerts across all sessions
- `avg_alert_response` - Average alert response time

---

#### `v_scenario_difficulty`
Scenario difficulty analysis.

**Fields:**
- `scenario` - Scenario ID
- `session_count` - Number of sessions
- `avg_performance` - Average performance score
- `avg_duration` - Average duration
- `avg_alerts` - Average alerts per session
- `avg_response_time` - Average response time
- `performance_std_dev` - Performance variability

---

## Database Operations

### Using Python API

```python
from data.db_utils import get_db_manager

# Get database manager
db = get_db_manager()

# Create session
session_id = db.create_session(
    session_id="session_001",
    participant_id="P001",
    scenario="L1",
    condition=1
)

# Add behavioral event
db.add_behavioral_event(
    session_id="session_001",
    event_type="click",
    timestamp=1700000000.0,
    event_data={"x": 100, "y": 200}
)

# Add alert
db.add_alert(
    session_id="session_001",
    alert_id="alert_001",
    alert_type="fuel_emergency",
    condition=1,
    priority="critical",
    message="Fuel critical"
)

# Acknowledge alert
db.acknowledge_alert(
    alert_id="alert_001",
    action_taken="cleared_to_land"
)

# Add metric
db.add_metric(
    session_id="session_001",
    metric_name="response_time",
    metric_category="performance",
    metric_value=1.5,
    metric_unit="seconds"
)

# End session
db.end_session(
    session_id="session_001",
    end_reason="completed",
    performance_score=85.5
)

# Get session data
session = db.get_session("session_001")
summary = db.get_session_summary("session_001")
alerts = db.get_alerts("session_001")
metrics = db.get_metrics("session_001")
```

---

### Using SQL Directly

```sql
-- Get all sessions for a participant
SELECT * FROM sessions
WHERE participant_id = 'P001'
ORDER BY started_at DESC;

-- Get alert performance by condition
SELECT
    condition,
    priority,
    COUNT(*) as total_alerts,
    AVG(response_time) as avg_response_time,
    SUM(CASE WHEN was_acknowledged THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as ack_rate
FROM alerts
WHERE session_id = 'session_001'
GROUP BY condition, priority;

-- Get behavioral event timeline
SELECT
    event_type,
    COUNT(*) as count,
    MIN(timestamp) as first_occurrence,
    MAX(timestamp) as last_occurrence
FROM behavioral_events
WHERE session_id = 'session_001'
GROUP BY event_type
ORDER BY count DESC;

-- Get participant performance
SELECT * FROM v_participant_performance
WHERE participant_id = 'P001';

-- Get scenario difficulty
SELECT * FROM v_scenario_difficulty
ORDER BY avg_performance;
```

---

## Database Management

### Setup and Initialization

```bash
# Create new database
python setup_database.py --create

# Create with backup of existing
python setup_database.py --create --force --backup

# Create with test data
python setup_database.py --create --test-data

# Verify database
python setup_database.py --verify

# Show statistics
python setup_database.py --stats

# Export schema
python setup_database.py --export-schema schema_export.sql
```

---

### Migrations

```bash
# Show migration status
python migrations.py --status

# Apply all pending migrations
python migrations.py --up

# Migrate to specific version
python migrations.py --up 1.0.3

# Rollback to version
python migrations.py --down 1.0.0
```

---

### Backup and Recovery

```bash
# Manual backup
cp research_data.db backups/research_data_$(date +%Y%m%d_%H%M%S).db

# Using setup script (creates backup automatically)
python setup_database.py --backup

# Restore from backup
cp backups/research_data_20241120_100000.db research_data.db
python setup_database.py --verify
```

---

## Data Export

### Export to CSV

```python
import sqlite3
import pandas as pd

# Connect to database
conn = sqlite3.connect('research_data.db')

# Export sessions
sessions_df = pd.read_sql_query("SELECT * FROM sessions", conn)
sessions_df.to_csv('exports/sessions.csv', index=False)

# Export alerts
alerts_df = pd.read_sql_query("SELECT * FROM alerts", conn)
alerts_df.to_csv('exports/alerts.csv', index=False)

# Export behavioral events
events_df = pd.read_sql_query(
    "SELECT * FROM behavioral_events WHERE session_id = ?",
    conn,
    params=('session_001',)
)
events_df.to_csv('exports/behavioral_events.csv', index=False)

conn.close()
```

### Export to JSON

```python
import sqlite3
import json

conn = sqlite3.connect('research_data.db')
conn.row_factory = sqlite3.Row

# Export session with all related data
cursor = conn.cursor()

cursor.execute("SELECT * FROM sessions WHERE session_id = ?", ('session_001',))
session = dict(cursor.fetchone())

cursor.execute("SELECT * FROM behavioral_events WHERE session_id = ?", ('session_001',))
session['behavioral_events'] = [dict(row) for row in cursor.fetchall()]

cursor.execute("SELECT * FROM alerts WHERE session_id = ?", ('session_001',))
session['alerts'] = [dict(row) for row in cursor.fetchall()]

cursor.execute("SELECT * FROM metrics WHERE session_id = ?", ('session_001',))
session['metrics'] = [dict(row) for row in cursor.fetchall()]

# Save to JSON
with open('exports/session_001.json', 'w') as f:
    json.dump(session, f, indent=2, default=str)

conn.close()
```

---

## Performance Optimization

### Indexes

All critical queries are optimized with indexes:
- Primary keys on all tables
- Foreign key indexes
- Composite indexes for common queries
- Covering indexes for views

### Query Optimization

```sql
-- Use EXPLAIN QUERY PLAN to optimize queries
EXPLAIN QUERY PLAN
SELECT * FROM behavioral_events
WHERE session_id = 'session_001' AND event_type = 'click';

-- Use indexes effectively
-- Good: Uses index
SELECT * FROM alerts WHERE session_id = 'session_001';

-- Bad: Full table scan
SELECT * FROM alerts WHERE message LIKE '%fuel%';

-- Better: Use indexed columns for filtering
SELECT * FROM alerts
WHERE alert_type = 'fuel_emergency' AND session_id = 'session_001';
```

### Database Maintenance

```sql
-- Analyze database for query optimization
ANALYZE;

-- Vacuum to reclaim space
VACUUM;

-- Check integrity
PRAGMA integrity_check;

-- Check foreign key constraints
PRAGMA foreign_key_check;
```

---

## Data Retention

### Archiving Old Sessions

```python
import sqlite3
from datetime import datetime, timedelta

conn = sqlite3.connect('research_data.db')
cursor = conn.cursor()

# Archive sessions older than 90 days
archive_date = (datetime.now() - timedelta(days=90)).isoformat()

# Get sessions to archive
cursor.execute("""
    SELECT session_id FROM sessions
    WHERE ended_at < ? AND status = 'completed'
""", (archive_date,))

sessions_to_archive = [row[0] for row in cursor.fetchall()]

# Export to archive database
archive_conn = sqlite3.connect('research_data_archive.db')
for session_id in sessions_to_archive:
    # Copy session and related data
    # ... (implementation details)

    # Delete from main database
    cursor.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))

conn.commit()
conn.close()
archive_conn.close()
```

---

## Security and Privacy

### Anonymization

```sql
-- Remove identifying information
UPDATE participants
SET email = NULL, notes = NULL
WHERE enrollment_date < date('now', '-1 year');

-- Hash participant IDs
-- (Implement in application layer using hashlib)
```

### Access Control

```bash
# Set database file permissions
chmod 600 research_data.db

# Only allow specific users
chown researcher:research_group research_data.db
```

---

## Troubleshooting

### Database is Locked

```python
# Use timeout when connecting
conn = sqlite3.connect('research_data.db', timeout=10.0)
```

### Large Database File

```bash
# Vacuum to reclaim space
sqlite3 research_data.db "VACUUM;"

# Check file size
ls -lh research_data.db
```

### Corrupted Database

```bash
# Check integrity
sqlite3 research_data.db "PRAGMA integrity_check;"

# Attempt recovery
sqlite3 research_data.db ".recover" | sqlite3 recovered.db
```

### Slow Queries

```sql
-- Analyze query performance
EXPLAIN QUERY PLAN SELECT ...;

-- Update statistics
ANALYZE;

-- Add missing indexes
CREATE INDEX idx_custom ON table_name(column_name);
```

---

## File Structure

```
backend/data/
├── schema.sql              # Database schema definition
├── setup_database.py       # Database setup script
├── migrations.py           # Migration management
├── db_utils.py            # Python database utilities
├── DATABASE_README.md     # This file
├── research_data.db       # Main database (generated)
├── backups/               # Database backups
│   └── research_data_YYYYMMDD_HHMMSS.db
├── sessions/              # JSON session exports (legacy)
└── exports/               # Data exports (CSV, JSON)
```

---

## Best Practices

1. **Always backup before migrations**
   ```bash
   python setup_database.py --backup
   ```

2. **Use transactions for bulk operations**
   ```python
   with db.get_connection() as conn:
       cursor = conn.cursor()
       # Multiple operations...
       conn.commit()
   ```

3. **Validate data before insertion**
   ```python
   # Use Pydantic models for validation
   # Check foreign key constraints
   ```

4. **Regular maintenance**
   ```bash
   # Weekly: Analyze and vacuum
   sqlite3 research_data.db "ANALYZE; VACUUM;"
   ```

5. **Monitor database size**
   ```bash
   python setup_database.py --stats
   ```

---

## Support

For issues or questions:
- Check database integrity: `python setup_database.py --verify`
- View logs: `backend/logs/server_*.log`
- Review schema: `schema.sql`
- Check migrations: `python migrations.py --status`
