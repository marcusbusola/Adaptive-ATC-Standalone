-- ============================================================================
-- ATC Adaptive Alert Research System - PostgreSQL Database Schema
-- ============================================================================
-- Version: 1.0.0
-- ============================================================================

-- ============================================================================
-- TABLE: sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(50) UNIQUE NOT NULL,
    participant_id VARCHAR(100) NOT NULL,
    scenario VARCHAR(10) NOT NULL CHECK (scenario IN ('L1', 'L2', 'H4', 'H5')),
    condition INTEGER NOT NULL CHECK (condition IN (1, 2, 3)),
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'aborted', 'error')),
    end_reason VARCHAR(100),
    duration_seconds REAL,
    total_events INTEGER DEFAULT 0,
    total_alerts INTEGER DEFAULT 0,
    total_behavioral_events INTEGER DEFAULT 0,
    performance_score REAL,
    response_time_avg REAL,
    actions_completed INTEGER DEFAULT 0,
    initial_state TEXT, -- JSON
    final_state TEXT,   -- JSON
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_participant ON sessions(participant_id);

-- ============================================================================
-- TABLE: behavioral_events
-- ============================================================================
CREATE TABLE IF NOT EXISTS behavioral_events (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data TEXT NOT NULL, -- JSON
    "timestamp" REAL NOT NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT NOW(),
    screen_width INTEGER,
    screen_height INTEGER,
    viewport_width INTEGER,
    viewport_height INTEGER,
    active_element VARCHAR(100),
    scenario_time REAL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_behavioral_session ON behavioral_events(session_id);
CREATE INDEX IF NOT EXISTS idx_behavioral_event_type ON behavioral_events(event_type);

-- ============================================================================
-- TABLE: scenario_events
-- ============================================================================
CREATE TABLE IF NOT EXISTS scenario_events (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL,
    event_id VARCHAR(50) NOT NULL,
    event_name VARCHAR(100) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    triggered_at TIMESTAMP NOT NULL DEFAULT NOW(),
    scenario_time REAL NOT NULL,
    controller_response_time REAL,
    controller_acknowledged_at TIMESTAMP,
    controller_action VARCHAR(100),
    event_data TEXT NOT NULL, -- JSON
    severity VARCHAR(20) CHECK (severity IN ('advisory', 'warning', 'critical', NULL)),
    aircraft_id VARCHAR(20),
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP,
    resolution_time REAL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scenario_session ON scenario_events(session_id);
CREATE INDEX IF NOT EXISTS idx_scenario_event_type ON scenario_events(event_type);

-- ============================================================================
-- TABLE: alerts
-- ============================================================================
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL,
    alert_id VARCHAR(50) UNIQUE NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    condition INTEGER NOT NULL CHECK (condition IN (1, 2, 3)),
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    message TEXT NOT NULL,
    aircraft_id VARCHAR(20),
    scenario_event_id INTEGER,
    displayed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMP,
    dismissed_at TIMESTAMP,
    response_time REAL,
    time_to_dismiss REAL,
    action_taken VARCHAR(100),
    action_correct BOOLEAN,
    was_acknowledged BOOLEAN DEFAULT false,
    was_dismissed BOOLEAN DEFAULT false,
    was_helpful BOOLEAN,
    presentation_data TEXT, -- JSON
    additional_data TEXT, -- JSON
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
    FOREIGN KEY (scenario_event_id) REFERENCES scenario_events(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_alerts_session ON alerts(session_id);
CREATE INDEX IF NOT EXISTS idx_alerts_alert_id ON alerts(alert_id);

-- ============================================================================
-- TABLE: metrics
-- ============================================================================
CREATE TABLE IF NOT EXISTS metrics (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_category VARCHAR(50) NOT NULL,
    metric_value REAL NOT NULL,
    metric_unit VARCHAR(20),
    phase VARCHAR(50),
    scenario_time REAL,
    alert_id VARCHAR(50),
    metric_data TEXT, -- JSON
    measured_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
    FOREIGN KEY (alert_id) REFERENCES alerts(alert_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_metrics_session ON metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(metric_name);

-- ============================================================================
-- TABLE: surveys
-- ============================================================================
CREATE TABLE IF NOT EXISTS surveys (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL,
    survey_id VARCHAR(50) UNIQUE NOT NULL,
    survey_type VARCHAR(50) NOT NULL,
    survey_phase VARCHAR(20) NOT NULL CHECK (survey_phase IN ('pre', 'post', 'mid', 'followup')),
    completed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    responses TEXT NOT NULL, -- JSON
    overall_score REAL,
    subscale_scores TEXT, -- JSON
    duration_seconds INTEGER,
    completion_status VARCHAR(20) DEFAULT 'completed' CHECK (completion_status IN ('completed', 'partial', 'abandoned')),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_surveys_session ON surveys(session_id);
CREATE INDEX IF NOT EXISTS idx_surveys_type ON surveys(survey_type);

-- ============================================================================
-- TABLE: participants
-- ============================================================================
CREATE TABLE IF NOT EXISTS participants (
    id SERIAL PRIMARY KEY,
    participant_id VARCHAR(100) UNIQUE NOT NULL,
    age_group VARCHAR(20),
    experience_level VARCHAR(20),
    atc_background BOOLEAN DEFAULT false,
    assigned_condition INTEGER CHECK (assigned_condition IN (1, 2, 3, NULL)),
    counterbalancing_group INTEGER,
    enrollment_date TIMESTAMP NOT NULL DEFAULT NOW(),
    last_session_date TIMESTAMP,
    total_sessions INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'withdrawn')),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_participants_id ON participants(participant_id);

-- ============================================================================
-- TABLE: system_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(50),
    level VARCHAR(20) NOT NULL CHECK (level IN ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL')),
    message TEXT NOT NULL,
    module VARCHAR(100),
    function_name VARCHAR(100),
    error_type VARCHAR(100),
    stack_trace TEXT,
    context_data TEXT, -- JSON
    logged_at TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_session ON system_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_logs_level ON system_logs(level);

-- ============================================================================
-- TABLE: metric_categories
-- ============================================================================
CREATE TABLE IF NOT EXISTS metric_categories (
    id SERIAL PRIMARY KEY,
    category_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO metric_categories (category_name, description) VALUES
    ('performance', 'Overall task performance metrics'),
    ('workload', 'Cognitive and physical workload measurements'),
    ('attention', 'Attention and situational awareness metrics'),
    ('accuracy', 'Decision accuracy and error rates'),
    ('efficiency', 'Time and resource efficiency metrics'),
    ('safety', 'Safety-related metrics and near-misses')
ON CONFLICT (category_name) DO NOTHING;

-- ============================================================================
-- VIEWS
-- ============================================================================
CREATE OR REPLACE VIEW v_session_summary AS
SELECT
    s.id, s.session_id, s.participant_id, s.scenario, s.condition, s.started_at, s.ended_at, s.status, s.duration_seconds,
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

-- ============================================================================
-- SCHEMA VERSION
-- ============================================================================
CREATE TABLE IF NOT EXISTS schema_version (
    version VARCHAR(10) PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_version (version, description) VALUES ('1.0.0', 'Initial PostgreSQL schema') ON CONFLICT (version) DO NOTHING;