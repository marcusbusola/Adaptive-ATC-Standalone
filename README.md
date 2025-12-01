# ATC Adaptive Alert Research System

A research platform for evaluating adaptive alert systems in Air Traffic Control (ATC) environments. This system compares three alert design approaches across multiple ATC scenario complexities to study controller performance and alert fatigue.

## Research Objectives

This system investigates how different alert presentation strategies affect ATC controller performance under varying workload conditions:

- Minimize alert fatigue and interruption
- Maintain safety-critical awareness
- Adapt to controller workload and context
- Improve overall operational efficiency

## Alert Conditions (Independent Variable)

### Condition 1: Traditional Modal Alerts
Standard pop-up modal dialogs that interrupt workflow. Always displayed prominently, requires explicit acknowledgment. Baseline condition for comparison.

### Condition 2: Rule-Based Adaptive Alerts
Alerts adapt based on predefined heuristic rules:
- Traffic density, alert priority level, time since last alert
- High priority + high traffic = modal; Low priority + low traffic = peripheral notification

### Condition 3: ML-Based Adaptive Alerts
Machine learning model (RandomForest) predicts optimal alert presentation using:
- Real-time workload estimation from behavioral features
- Mouse velocity variance, interaction entropy, peripheral neglect duration
- Click patterns, dwell time variance, hover stability

## Scenarios

Six scenarios with varying complexity (defined in `backend/scenarios/scenario_manifest.json`):

| ID | Name | Workload | Aircraft | Duration | Description |
|----|------|----------|----------|----------|-------------|
| L1 | Baseline Emergency | Low | 5 | 6 min | Dual emergency with peripheral comm loss |
| L2 | System Failure Overload | Low | 5 | 6 min | Silent automation failure + VFR intrusion |
| L3 | Automation Complacency | Low | 5 | 6 min | Silent system crash + unalerted conflict |
| H4 | Conflict-Driven Tunneling | High | 9 | 6 min | Critical conflict + peripheral VFR intrusion |
| H5 | Compounded Stress | High | 9 | 6 min | Weather rerouting + fuel emergency + altitude deviation |
| H6 | Cry Wolf Effect | High | 9 | 6 min | False alarm followed by real conflict with delayed alert |

## System Architecture

```
frontend/                  # React 18 SPA with styled-components
  src/
    components/            # React components (alerts, surveys, radar display)
    components/Queue/      # Session queue management
    components/Surveys/    # NASA-TLX, Trust, Demographics, Effectiveness
    hooks/                 # useBehavioralTracking, useSimulation, useWebSocket
    services/              # API clients (api.js, tracking.js)
    scenarios/             # Generated config from backend manifest

backend/                   # Python FastAPI with async SQLite/PostgreSQL
  api/
    server.py              # Main FastAPI app, WebSocket, SSE, REST endpoints
    queue_manager.py       # Session queue management
  scenarios/
    scenario_manifest.json # Single source of truth for all scenario configs
    base_scenario.py       # Abstract base class for scenarios
    scenario_l1.py - scenario_h6.py  # Individual scenario implementations
  ml_models/
    complacency_detector.py  # RandomForest ML model
    predictor.py             # Real-time prediction service
    train_complacency_model.py
  simulation/
    sim_engine.py          # Standalone aircraft physics (no external deps)
    physics.py
  data/
    db_utils.py            # Async database operations
    setup_database.py      # Schema creation and verification
```

## Getting Started

### Prerequisites

- **Node.js**: v18.x or higher
- **Python**: 3.10 or higher

### Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # macOS/Linux
# venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Initialize database
python data/setup_database.py --create
python data/setup_database.py --verify

# Run server
python api/server.py
# Or: uvicorn api.server:app --reload --host 0.0.0.0 --port 8000
```

Backend available at: `http://localhost:8000`
API docs: `http://localhost:8000/docs`

### Frontend Setup

```bash
cd frontend

npm install
npm start  # Auto-generates scenario config from backend manifest
```

Frontend available at: `http://localhost:3000`

## API Endpoints

### Session Lifecycle
```
POST /api/sessions/start           # Create session
POST /api/sessions/{id}/start      # Start scenario
POST /api/sessions/{id}/update     # Poll for scenario updates
POST /api/sessions/{id}/end        # End session
```

### Data Collection
```
POST /api/sessions/{id}/behavioral-events  # Log behavioral data
POST /api/sessions/{id}/alerts             # Log alert display
POST /api/sessions/{id}/alerts/{id}/acknowledge
POST /api/sessions/{id}/surveys            # Submit survey responses
```

### Real-Time Communication
- WebSocket: `/ws/session/{session_id}` - behavioral events and scenario updates
- SSE: `/api/simulation/stream` - simulation state updates

## Testing

```bash
# Backend tests (from backend/)
pytest tests/ -v --cov=api --cov=ml_models

# Frontend tests (from frontend/)
npm test
```

## ML Model Training

```bash
cd backend
python ml_models/train_complacency_model.py
```

Models saved to `backend/ml_models/trained_models/`. When ML dependencies are unavailable, the system falls back to heuristic prediction.

## Deployment (Render)

Configured for Render deployment via `render.yaml`:

```bash
git push origin main  # Auto-deploys from main branch
```

Key files:
- `render.yaml`: Render Blueprint (web service + PostgreSQL)
- `build.sh`: Installs deps, builds frontend, initializes DB, trains ML model

Production endpoints:
- Health: `/health`
- API Docs: `/docs`
- Frontend: Served from backend (SPA catch-all)

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

## Measured Metrics

### Performance Metrics
- Response time (alert display to acknowledgment)
- Missed alerts (not acknowledged within timeout)
- Conflict resolution time

### Workload Metrics
- NASA-TLX subjective workload assessment
- Interaction frequency (mouse/keyboard activity)
- Dwell time on interface areas

### Behavioral Features (ML Input)
- Mouse velocity variance, interaction entropy
- Click rate/pattern entropy, hover stability
- Peripheral neglect duration, response time trend

## Database

- Development: SQLite (`backend/data/research_data.db`)
- Production: PostgreSQL (via DATABASE_URL)
- Key tables: `sessions`, `behavioral_events`, `alerts`, `metrics`, `surveys`
- Views: `v_alert_performance`, `v_scenario_difficulty`, `v_session_summary`

## License

MIT License
