# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **ATC Adaptive Alert Research System** - a research platform for evaluating adaptive alert systems in Air Traffic Control (ATC) environments. The system compares three alert design approaches (Traditional Modal, Rule-Based Adaptive, ML-Based Adaptive) across multiple ATC scenario complexities to study controller performance and alert fatigue.

## Common Commands

### Backend (Python/FastAPI)
```bash
# Setup
cd backend
python -m venv venv
source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt

# Run server
python api/server.py
# Or: uvicorn api.server:app --reload --host 0.0.0.0 --port 8000

# Database setup
python data/setup_database.py --create
python data/setup_database.py --verify

# Run tests
pytest tests/ -v --cov=api --cov=ml_models

# Train ML model
python ml_models/train_complacency_model.py

# Code quality
black .
flake8 .
mypy .
```

### Frontend (React)
```bash
cd frontend
npm install
npm start          # Development server (port 3000)
npm run build      # Production build
npm test           # Run tests
npm run lint       # ESLint
```

## Architecture

### Three-Tier Structure
```
frontend/           # React 18 SPA with styled-components
backend/            # Python FastAPI with async SQLite/PostgreSQL
  ├── api/          # REST & WebSocket endpoints (server.py is main entry)
  ├── scenarios/    # Scenario controllers (L1, L2, L3, H4, H5, H6)
  ├── ml_models/    # Complacency detection ML (RandomForest)
  ├── simulation/   # Built-in aircraft simulation engine
  └── data/         # Database utilities and schema
```

### Alert Conditions (Experimental)
- **Condition 1**: Traditional modal alerts (blocking, requires acknowledgment)
- **Condition 2**: Rule-based adaptive alerts (context-aware presentation)
- **Condition 3**: ML-based adaptive alerts (predicts complacency, proactive alerting)

### Scenarios
Six scenarios with varying complexity:
- **L1/L2/L3**: Low complexity scenarios (routine operations, automation)
- **H4/H5/H6**: High complexity scenarios (emergencies, multiple crises)

All scenarios inherit from `BaseScenario` in `backend/scenarios/base_scenario.py`.

### Key Backend Components
- **server.py** (`backend/api/server.py`): Main FastAPI app, WebSocket handling, all REST endpoints
- **BaseScenario** (`backend/scenarios/base_scenario.py`): Abstract base for all scenarios, handles aircraft state, event scheduling, SAGAT probes
- **ComplacencyDetector** (`backend/ml_models/complacency_detector.py`): ML model for predicting controller attention failures
- **DatabaseManager** (`backend/data/db_utils.py`): Async database operations (SQLite or PostgreSQL)

### Key Frontend Components
- **App.jsx**: Main router with participant/researcher views
- **SessionRunner.jsx**: Manages active session lifecycle
- **RadarViewer.jsx**: ATC radar display visualization
- **Alert Components**: `TraditionalModalAlert.jsx`, `AdaptiveBannerAlert.jsx`, `MLPredictiveAlert.jsx`
- **Survey Components**: NASA-TLX, Trust, Demographics surveys in `components/Surveys/`

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

## Deployment (Render)

The project is configured for Render deployment with `render.yaml`:

```bash
# Deploy via Render Blueprint
git push origin main  # Render auto-deploys from main branch
```

Key files:
- `render.yaml`: Render Blueprint (web service + PostgreSQL)
- `build.sh`: Build script (installs deps, builds frontend, initializes DB)
- `DEPLOYMENT.md`: Full deployment guide

Production endpoints:
- Health: `/health`
- API Docs: `/docs`
- Frontend: Served from same origin (SPA catch-all)
