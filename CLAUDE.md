# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **ATC Adaptive Alert Research System** - a research platform for evaluating adaptive alert systems in Air Traffic Control (ATC) environments. The system compares three alert design approaches (Traditional Modal, Rule-Based Adaptive, ML-Based Adaptive) across multiple ATC scenario complexities to study controller performance and alert fatigue.

## Common Commands

### Backend (Python/FastAPI)
```bash
# Setup (from backend/ directory)
python -m venv venv
source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt

# Run server (two options)
python api/server.py
uvicorn api.server:app --reload --host 0.0.0.0 --port 8000

# Database setup
python data/setup_database.py --create
python data/setup_database.py --verify

# Run tests
pytest tests/ -v --cov=api --cov=ml_models

# Run a single test
pytest tests/test_scenario_validation.py -v
pytest tests/test_scenario_validation.py::test_function_name -v

# Train ML model
python ml_models/train_complacency_model.py

# Code quality
black .
flake8 .
mypy .
```

### Frontend (React)
```bash
# From frontend/ directory
npm install
npm start          # Dev server (port 3000) - auto-generates scenario config via prestart hook
npm run build      # Production build
npm test           # Run tests
npm run lint       # ESLint
npm run generate-config  # Manually regenerate scenario config from backend manifest
```

## Architecture

### Project Structure
```
frontend/                  # React 18 SPA with styled-components
  src/
    components/            # React components (alerts, surveys, radar display)
    components/Queue/      # Session queue management (QueueBuilder, QueueRunner, ResultsDashboard)
    components/Surveys/    # NASA-TLX, Trust, Demographics, Effectiveness, ManipulationCheck
    hooks/                 # Custom hooks (useBehavioralTracking, useSimulation, useWebSocket)
    services/              # API clients (api.js, tracking.js, behavioralTracker.js)
    scenarios/             # Generated scenario config (from backend manifest)
backend/                   # Python FastAPI with async SQLite/PostgreSQL
  api/                     # REST & WebSocket endpoints (server.py main entry, queue_manager.py)
  scenarios/               # Scenario controllers (L1, L2, L3, H4, H5, H6) + scenario_manifest.json
  ml_models/               # Complacency detection ML (RandomForest)
  simulation/              # Aircraft simulation (sim_engine.py, physics.py)
  data/                    # Database utilities, schema, migrations
```

### Alert Conditions (Experimental)
- **Condition 1**: Traditional modal alerts (blocking, requires acknowledgment)
- **Condition 2**: Rule-based adaptive alerts (context-aware presentation)
- **Condition 3**: ML-based adaptive alerts (predicts complacency, proactive alerting)

### Scenarios
Six scenarios with varying complexity (defined in `backend/scenarios/scenario_manifest.json`):
- **L1**: Baseline Emergency - dual emergency with peripheral comm loss (5 aircraft)
- **L2**: System Failure Overload - silent automation failure + VFR intrusion (5 aircraft)
- **L3**: Automation Complacency - silent system crash + unalerted conflict (5 aircraft)
- **H4**: Conflict-Driven Tunneling - critical conflict + peripheral VFR intrusion (9 aircraft)
- **H5**: Compounded Stress - weather rerouting + fuel emergency + altitude deviation (9 aircraft)
- **H6**: Cry Wolf Effect - false alarm followed by real conflict with delayed alert (9 aircraft)

All scenarios inherit from `BaseScenario` in `backend/scenarios/base_scenario.py`. The manifest JSON is the single source of truth for scenario configurations, phases, and timing.

### Key Backend Components
- **server.py** (`backend/api/server.py`): Main FastAPI app with WebSocket, SSE, all REST endpoints. Includes SCENARIO_CLASSES dict mapping scenario IDs to classes
- **BaseScenario** (`backend/scenarios/base_scenario.py`): Abstract base for all scenarios. Loads config from `scenario_manifest.json`, handles event scheduling, SAGAT probes
- **scenario_manifest.json** (`backend/scenarios/`): Single source of truth for all scenario configs (phases, timing, aircraft counts, expected detection times)
- **SimulationEngine** (`backend/simulation/sim_engine.py`): Standalone aircraft physics simulation (no external BlueSky dependency)
- **ComplacencyDetector** (`backend/ml_models/complacency_detector.py`): RandomForest ML model for predicting attention failures
- **DatabaseManager** (`backend/data/db_utils.py`): Async database operations (SQLite dev, PostgreSQL production)

### Key Frontend Components
- **App.jsx**: Main router with participant/researcher views
- **Session.jsx**: Main session orchestrator - manages scenario lifecycle, alert display, conflicts, and polls `/api/sessions/{id}/update` for triggered events
- **RadarViewer.jsx**: ATC radar display visualization with canvas rendering
- **ActionPanel.jsx**: Control panel with aircraft selection, commands, safety score, and conflict warnings
- **useBehavioralTracking.js** (`hooks/`): Tracks mouse, clicks, hovers, dwell times - batches events every 5s or 50 events for ML feature extraction
- **Alert Components**: `TraditionalModalAlert.jsx`, `AdaptiveBannerAlert.jsx`, `MLPredictiveAlert.jsx`
- **Survey Components**: NASA-TLX, Trust, Demographics, Effectiveness, ManipulationCheck in `components/Surveys/`
- **Queue Components**: `QueueBuilder.jsx`, `QueueRunner.jsx`, `ResultsDashboard.jsx` in `components/Queue/`
- **ParticipantLobby.jsx**: Entry point for participants - loads session from queue via participant ID URL param

### Real-Time Communication
- WebSocket endpoint: `/ws/session/{session_id}` for behavioral events and scenario updates
- SSE endpoint: `/api/simulation/stream` for simulation state updates
- Polling: `/api/sessions/{session_id}/update` for scenario state changes

## API Structure

### Session Lifecycle
```
POST /api/sessions/start        # Create session
POST /api/sessions/{id}/start   # Start scenario
POST /api/sessions/{id}/update  # Poll for scenario updates (returns triggered events)
POST /api/sessions/{id}/end     # End session
```

### Data Collection
```
POST /api/sessions/{id}/behavioral-events  # Log behavioral data
POST /api/sessions/{id}/alerts             # Log alert display
POST /api/sessions/{id}/alerts/{id}/acknowledge
POST /api/sessions/{id}/surveys            # Submit survey responses
```

### Versioned API (v1)
Stable contract endpoints exist at `/v1/session/start`, `/v1/session/end`, etc.

## Database

- Default: SQLite (`backend/data/research_data.db`)
- Production: PostgreSQL supported via DATABASE_URL env var
- Key tables: `sessions`, `behavioral_events`, `alerts`, `metrics`, `surveys`
- Views: `v_alert_performance`, `v_scenario_difficulty`, `v_session_summary`

## Environment Variables

```env
# Backend
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
DATABASE_URL=sqlite:///./data/research_data.db
CORS_ORIGINS=http://localhost:3000
RESEARCHER_TOKEN=your-secret-token

# Frontend
REACT_APP_API_URL=http://localhost:8000
```

## ML Model Notes

The complacency detector extracts 10 behavioral features:
- Mouse velocity variance, interaction entropy, peripheral neglect duration
- Click rate/pattern entropy, dwell time variance, hover stability
- Command sequence entropy, response time trend, activity level

Model files stored in `backend/ml_models/trained_models/`.

When ML dependencies are unavailable, `server.py` falls back to a heuristic predictor that estimates workload based on event count.

## Deployment (Render)

The project is configured for Render deployment with `render.yaml`:

```bash
# Deploy via Render Blueprint
git push origin main  # Render auto-deploys from main branch
```

Key files:
- `render.yaml`: Render Blueprint (web service + PostgreSQL database)
- `build.sh`: Build script (installs deps, builds frontend, initializes DB, trains ML model if needed)

Production endpoints:
- Health: `/health`
- API Docs: `/docs`
- Frontend: Served from same origin (backend serves `frontend/build/` static files)

## Scenario Config Sync

Frontend scenario config is generated from the backend manifest:
1. `frontend/scripts/generate-scenario-config.js` reads `backend/scenarios/scenario_manifest.json`
2. Outputs to `frontend/src/scenarios/scenarioConfig.generated.js`
3. Runs automatically via `npm run prestart` and `npm run prebuild`

## Participant/Researcher Workflow

### Researcher Flow
1. Create batch queue via `QueueManagementPanel` → `QueueBuilder`
2. Share participant link: `/participant?id={participant_id}`
3. Monitor progress via `QueueRunner` and `ResultsDashboard`

### Participant Flow
1. Enter via `/participant?id={participant_id}` or `/participant` (manual ID entry)
2. `ParticipantLobby` loads next session from queue
3. Session runs in `Session.jsx` with condition-specific alerts
4. Post-session surveys collected via `SurveyManager`
5. Returns to lobby for next queued session

## Important Implementation Notes

### Coordinate Systems
Two coordinate systems are used:
- **Radar coordinates** (`backend/scenarios/base_scenario.py`): (x, y) in nautical miles from sector center, used in scenario Aircraft class
- **Geographic coordinates** (`backend/simulation/aircraft.py`): lat/lon for BlueSky-style simulation engine

Use `_convert_to_bluesky_coords()` in BaseScenario to convert between them.

### Event Types for Alerts
Events that generate visible alerts (defined in `Session.jsx`):
`emergency`, `comm_loss`, `conflict`, `weather`, `altitude_deviation`, `vfr_intrusion`, `comm_failure`, `system_crash`, `conflict_threshold`, `false_alarm`, `delayed_alert`

Internal events (`phase_transition`, `internal`, `aircraft_spawn`) do not generate alerts.

### Timing Constants
- Polling interval: 2000ms (`Session.jsx`)
- Alert hide duration after acknowledgment: 15000ms

### Alert ID Format
Alert IDs follow format: `alert_{event_type}_{aircraft_callsign}` (e.g., `alert_emergency_UAL238`). When acknowledging alerts, the callsign is extracted to resolve pilot mood state.

### Survey ID Length Constraint
The `survey_id` column is `VARCHAR(50)`. Survey IDs use abbreviated type names to fit: `tlx`, `trust`, `effect`, `manip`, `demo`.

### CSS Z-Index Hierarchy
Defined in `frontend/src/styles/session.css`:
- `--z-banner-alert: 500` (non-blocking adaptive/ML banners)
- `--z-modal-alert: 1000` (traditional blocking modal)
- `--z-loading: 9999` (loading overlays)
