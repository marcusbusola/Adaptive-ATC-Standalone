-- ============================================================================
-- ATC Adaptive Alert Research System - Database Schema
-- ============================================================================
-- SQLite Database Schema for Research Data Collection
-- Version: 1.0.0
-- ============================================================================

-- Enable foreign key support (SQLite specific)
PRAGMA foreign_keys = ON;

-- ============================================================================
-- TABLE: sessions
-- ============================================================================
-- Stores information about each research session
-- ============================================================================

CREATE TABLE IF NOT EXISTS sessions (
    -- Primary key
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Session identification
    session_id VARCHAR(50) UNIQUE NOT NULL,
    participant_id VARCHAR(100) NOT NULL,

    -- Scenario configuration
    scenario VARCHAR(10) NOT NULL CHECK (scenario IN ('L1', 'L2', 'L3', 'H4', 'H5', 'H6')),
    condition INTEGER NOT NULL CHECK (condition IN (1, 2, 3)),

    -- Timestamps
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,

    -- Session status
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'aborted', 'error')),
    end_reason VARCHAR(100),

    -- Session metadata
    duration_seconds REAL,
    total_events INTEGER DEFAULT 0,
    total_alerts INTEGER DEFAULT 0,
    total_behavioral_events INTEGER DEFAULT 0,

    -- Performance metrics (computed on session end)
    performance_score REAL,
    response_time_avg REAL,
    actions_completed INTEGER DEFAULT 0,

    -- Additional data
    initial_state TEXT, -- JSON
    final_state TEXT,   -- JSON
    notes TEXT,

    -- Crash-safety checkpoints
    checkpoint_data TEXT,   -- JSON: periodic snapshot of in-memory scenario state
    checkpoint_at TEXT,     -- ISO timestamp of last checkpoint

    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for sessions table
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_participant ON sessions(participant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_scenario ON sessions(scenario);
CREATE INDEX IF NOT EXISTS idx_sessions_condition ON sessions(condition);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_participant_scenario ON sessions(participant_id, scenario);


-- ============================================================================
-- TABLE: behavioral_events
-- ============================================================================
-- Stores all behavioral events (mouse movements, clicks, interactions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS behavioral_events (
    -- Primary key
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Foreign key to sessions
    session_id VARCHAR(50) NOT NULL,

    -- Event identification
    event_type VARCHAR(50) NOT NULL,
    -- Event types: mouse_move, click, key_press, scroll, hover, focus, etc.

    -- Event data (JSON format)
    event_data TEXT NOT NULL, -- JSON: {x, y, target, button, etc.}

    -- Timestamps
    timestamp REAL NOT NULL, -- Unix timestamp with millisecond precision
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Additional metadata
    screen_width INTEGER,
    screen_height INTEGER,
    viewport_width INTEGER,
    viewport_height INTEGER,

    -- Context
    active_element VARCHAR(100),
    scenario_time REAL, -- Time since scenario start

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraint
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- Indexes for behavioral_events table
CREATE INDEX IF NOT EXISTS idx_behavioral_session ON behavioral_events(session_id);
CREATE INDEX IF NOT EXISTS idx_behavioral_event_type ON behavioral_events(event_type);
CREATE INDEX IF NOT EXISTS idx_behavioral_timestamp ON behavioral_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_behavioral_session_type ON behavioral_events(session_id, event_type);
CREATE INDEX IF NOT EXISTS idx_behavioral_session_timestamp ON behavioral_events(session_id, timestamp);


-- ============================================================================
-- TABLE: scenario_events
-- ============================================================================
-- Stores scenario-specific events (aircraft state changes, emergencies, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS scenario_events (
    -- Primary key
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Foreign key to sessions
    session_id VARCHAR(50) NOT NULL,

    -- Event identification
    event_id VARCHAR(50) NOT NULL,
    event_name VARCHAR(100) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    -- Event types: alert, aircraft_state_change, system_event, weather_event,
    --              communication, conflict, emergency

    -- Timing
    triggered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    scenario_time REAL NOT NULL, -- Seconds from scenario start

    -- Controller response
    controller_response_time REAL, -- Seconds from trigger to first action
    controller_acknowledged_at TIMESTAMP,
    controller_action VARCHAR(100),

    -- Event details (JSON)
    event_data TEXT NOT NULL, -- JSON

    -- Severity (for alerts/emergencies)
    severity VARCHAR(20) CHECK (severity IN ('advisory', 'warning', 'critical', NULL)),

    -- Aircraft involved
    aircraft_id VARCHAR(20),

    -- Outcome
    resolved BOOLEAN DEFAULT 0,
    resolved_at TIMESTAMP,
    resolution_time REAL, -- Seconds from trigger to resolution

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraint
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- Indexes for scenario_events table
CREATE INDEX IF NOT EXISTS idx_scenario_session ON scenario_events(session_id);
CREATE INDEX IF NOT EXISTS idx_scenario_event_type ON scenario_events(event_type);
CREATE INDEX IF NOT EXISTS idx_scenario_triggered ON scenario_events(triggered_at);
CREATE INDEX IF NOT EXISTS idx_scenario_session_type ON scenario_events(session_id, event_type);
CREATE INDEX IF NOT EXISTS idx_scenario_aircraft ON scenario_events(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_scenario_severity ON scenario_events(severity);


-- ============================================================================
-- TABLE: alerts
-- ============================================================================
-- Stores alert presentation and response data
-- ============================================================================

CREATE TABLE IF NOT EXISTS alerts (
    -- Primary key
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Foreign key to sessions
    session_id VARCHAR(50) NOT NULL,

    -- Alert identification
    alert_id VARCHAR(50) UNIQUE NOT NULL,
    alert_type VARCHAR(50) NOT NULL,

    -- Alert condition (how it was presented)
    condition INTEGER NOT NULL CHECK (condition IN (1, 2, 3)),
    -- 1 = Traditional Modal
    -- 2 = Rule-Based Adaptive
    -- 3 = ML-Based Adaptive

    -- Alert details
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    message TEXT NOT NULL,

    -- Related entities
    aircraft_id VARCHAR(20),
    scenario_event_id INTEGER,

    -- Timing
    displayed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP,
    dismissed_at TIMESTAMP,

    -- Response metrics
    response_time REAL, -- Milliseconds from display to acknowledgment
    time_to_dismiss REAL, -- Milliseconds from display to dismiss

    -- Controller actions
    action_taken VARCHAR(100),
    action_correct BOOLEAN,

    -- Alert effectiveness
    was_acknowledged BOOLEAN DEFAULT 0,
    was_dismissed BOOLEAN DEFAULT 0,
    was_helpful BOOLEAN, -- Optional: post-alert survey

    -- Presentation details (JSON)
    presentation_data TEXT, -- JSON: {style, position, animation, etc.}

    -- Additional data
    additional_data TEXT, -- JSON

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraints
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
    FOREIGN KEY (scenario_event_id) REFERENCES scenario_events(id) ON DELETE SET NULL
);

-- Indexes for alerts table
CREATE INDEX IF NOT EXISTS idx_alerts_session ON alerts(session_id);
CREATE INDEX IF NOT EXISTS idx_alerts_alert_id ON alerts(alert_id);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_condition ON alerts(condition);
CREATE INDEX IF NOT EXISTS idx_alerts_priority ON alerts(priority);
CREATE INDEX IF NOT EXISTS idx_alerts_displayed ON alerts(displayed_at);
CREATE INDEX IF NOT EXISTS idx_alerts_session_condition ON alerts(session_id, condition);
CREATE INDEX IF NOT EXISTS idx_alerts_aircraft ON alerts(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON alerts(was_acknowledged);


-- ============================================================================
-- TABLE: metrics
-- ============================================================================
-- Stores performance metrics and measurements
-- ============================================================================

CREATE TABLE IF NOT EXISTS metrics (
    -- Primary key
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Foreign key to sessions
    session_id VARCHAR(50) NOT NULL,

    -- Metric identification
    metric_name VARCHAR(100) NOT NULL,
    metric_category VARCHAR(50) NOT NULL,
    -- Categories: performance, workload, attention, accuracy, efficiency, safety

    -- Metric value
    metric_value REAL NOT NULL,
    metric_unit VARCHAR(20), -- seconds, count, percentage, score, etc.

    -- Context
    phase VARCHAR(50), -- pre, during, post, baseline, intervention, etc.
    scenario_time REAL, -- When metric was measured (seconds from start)

    -- Alert context (if metric is alert-related)
    alert_id VARCHAR(50),

    -- Additional details
    metric_data TEXT, -- JSON: additional context

    -- Timestamps
    measured_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraints
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
    FOREIGN KEY (alert_id) REFERENCES alerts(alert_id) ON DELETE SET NULL
);

-- Indexes for metrics table
CREATE INDEX IF NOT EXISTS idx_metrics_session ON metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_metrics_category ON metrics(metric_category);
CREATE INDEX IF NOT EXISTS idx_metrics_phase ON metrics(phase);
CREATE INDEX IF NOT EXISTS idx_metrics_session_name ON metrics(session_id, metric_name);
CREATE INDEX IF NOT EXISTS idx_metrics_session_category ON metrics(session_id, metric_category);
CREATE INDEX IF NOT EXISTS idx_metrics_alert ON metrics(alert_id);


-- ============================================================================
-- TABLE: surveys
-- ============================================================================
-- Stores survey responses (NASA-TLX, SUS, custom questionnaires)
-- ============================================================================

CREATE TABLE IF NOT EXISTS surveys (
    -- Primary key
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Foreign key to sessions
    session_id VARCHAR(50) NOT NULL,

    -- Survey identification
    survey_id VARCHAR(50) UNIQUE NOT NULL,
    survey_type VARCHAR(50) NOT NULL,
    -- Survey types: NASA-TLX, SUS, post-session, demographic, etc.

    -- Timing
    survey_phase VARCHAR(20) NOT NULL CHECK (survey_phase IN ('pre', 'post', 'mid', 'followup')),
    completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Responses (JSON format)
    responses TEXT NOT NULL, -- JSON: complete survey responses

    -- Computed scores (for standardized surveys)
    overall_score REAL,
    subscale_scores TEXT, -- JSON: {mental_demand: 5, physical_demand: 3, ...}

    -- Survey metadata
    duration_seconds INTEGER, -- Time to complete survey
    completion_status VARCHAR(20) DEFAULT 'completed'
        CHECK (completion_status IN ('completed', 'partial', 'abandoned')),

    -- Additional data
    notes TEXT,

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraint
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- Indexes for surveys table
CREATE INDEX IF NOT EXISTS idx_surveys_session ON surveys(session_id);
CREATE INDEX IF NOT EXISTS idx_surveys_type ON surveys(survey_type);
CREATE INDEX IF NOT EXISTS idx_surveys_phase ON surveys(survey_phase);
CREATE INDEX IF NOT EXISTS idx_surveys_session_type ON surveys(session_id, survey_type);
CREATE INDEX IF NOT EXISTS idx_surveys_completed ON surveys(completed_at);


-- ============================================================================
-- TABLE: participants
-- ============================================================================
-- Stores participant information (optional - for anonymized tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS participants (
    -- Primary key
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Participant identification
    participant_id VARCHAR(100) UNIQUE NOT NULL,

    -- Demographics (anonymized)
    age_group VARCHAR(20), -- 18-25, 26-35, etc.
    experience_level VARCHAR(20), -- novice, intermediate, expert
    atc_background BOOLEAN DEFAULT 0,

    -- Assignment
    assigned_condition INTEGER CHECK (assigned_condition IN (1, 2, 3, NULL)),
    counterbalancing_group INTEGER,

    -- Metadata
    enrollment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_session_date TIMESTAMP,
    total_sessions INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'withdrawn')),

    -- Additional data
    notes TEXT,

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for participants table
CREATE INDEX IF NOT EXISTS idx_participants_id ON participants(participant_id);
CREATE INDEX IF NOT EXISTS idx_participants_condition ON participants(assigned_condition);
CREATE INDEX IF NOT EXISTS idx_participants_status ON participants(status);


-- ============================================================================
-- TABLE: system_logs
-- ============================================================================
-- Stores system events and errors for debugging
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_logs (
    -- Primary key
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Session context (optional)
    session_id VARCHAR(50),

    -- Log level
    level VARCHAR(20) NOT NULL CHECK (level IN ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL')),

    -- Log details
    message TEXT NOT NULL,
    module VARCHAR(100),
    function_name VARCHAR(100),

    -- Error details (if applicable)
    error_type VARCHAR(100),
    stack_trace TEXT,

    -- Additional context
    context_data TEXT, -- JSON

    -- Timestamp
    logged_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraint
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE SET NULL
);

-- Indexes for system_logs table
CREATE INDEX IF NOT EXISTS idx_logs_session ON system_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_logged_at ON system_logs(logged_at);


-- ============================================================================
-- VIEWS
-- ============================================================================

-- View: Session Summary
CREATE VIEW IF NOT EXISTS v_session_summary AS
SELECT
    s.id,
    s.session_id,
    s.participant_id,
    s.scenario,
    s.condition,
    s.started_at,
    s.ended_at,
    s.status,
    s.duration_seconds,
    COUNT(DISTINCT be.id) as behavioral_event_count,
    COUNT(DISTINCT se.id) as scenario_event_count,
    COUNT(DISTINCT a.id) as alert_count,
    AVG(a.response_time) as avg_alert_response_time,
    s.performance_score
FROM sessions s
LEFT JOIN behavioral_events be ON s.session_id = be.session_id
LEFT JOIN scenario_events se ON s.session_id = se.session_id
LEFT JOIN alerts a ON s.session_id = a.session_id
GROUP BY s.id;

-- View: Alert Performance
CREATE VIEW IF NOT EXISTS v_alert_performance AS
SELECT
    a.session_id,
    a.condition,
    a.priority,
    COUNT(*) as total_alerts,
    AVG(a.response_time) as avg_response_time,
    SUM(CASE WHEN a.was_acknowledged THEN 1 ELSE 0 END) as acknowledged_count,
    CAST(SUM(CASE WHEN a.was_acknowledged THEN 1 ELSE 0 END) AS REAL) / COUNT(*) as acknowledgment_rate,
    AVG(CASE WHEN a.was_acknowledged THEN a.response_time ELSE NULL END) as avg_ack_response_time
FROM alerts a
GROUP BY a.session_id, a.condition, a.priority;

-- View: Participant Performance
CREATE VIEW IF NOT EXISTS v_participant_performance AS
SELECT
    s.participant_id,
    COUNT(DISTINCT s.session_id) as total_sessions,
    AVG(s.performance_score) as avg_performance,
    AVG(s.duration_seconds) as avg_session_duration,
    SUM(s.total_alerts) as total_alerts_seen,
    AVG(a.response_time) as avg_alert_response
FROM sessions s
LEFT JOIN alerts a ON s.session_id = a.session_id
GROUP BY s.participant_id;

-- View: Scenario Difficulty
CREATE VIEW IF NOT EXISTS v_scenario_difficulty AS
SELECT
    s.scenario,
    COUNT(*) as session_count,
    AVG(s.performance_score) as avg_performance,
    AVG(s.duration_seconds) as avg_duration,
    AVG(s.total_alerts) as avg_alerts,
    AVG(a.response_time) as avg_response_time,
    STDDEV(s.performance_score) as performance_std_dev
FROM sessions s
LEFT JOIN alerts a ON s.session_id = a.session_id
WHERE s.status = 'completed'
GROUP BY s.scenario;


-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
