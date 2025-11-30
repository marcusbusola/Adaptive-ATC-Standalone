"""
ATC Adaptive Alert Research System - Main Server
FastAPI server with comprehensive session management, WebSocket support, and data collection
"""

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, status, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
from datetime import datetime
import os
import uuid
import sys
import json
import asyncio
from pathlib import Path
from enum import Enum
from loguru import logger
from dotenv import load_dotenv
from sse_starlette.sse import EventSourceResponse

# Import simulation engine (replaces BlueSky)
from simulation import SimulationEngine, Aircraft

# Add parent directory to path to allow imports from data, scenarios, etc.
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import scenario controllers
from scenarios.scenario_l1 import ScenarioL1
from scenarios.scenario_l2 import ScenarioL2
from scenarios.scenario_l3 import ScenarioL3
from scenarios.scenario_h4 import ScenarioH4
from scenarios.scenario_h5 import ScenarioH5
from scenarios.scenario_h6 import ScenarioH6
from scenarios.base_scenario import BaseScenario

# Import ML models (optional - may fail if dependencies not installed)
try:
    from ml_models.predictor import AlertPredictor, predict_presentation
    ML_AVAILABLE = True
except ImportError as e:
    logger.warning(f"ML models not available: {e}")
    AlertPredictor = None
    ML_AVAILABLE = False

    def predict_presentation(events, scenario_state=None):
        """
        Fallback heuristic when ML stack is unavailable.
        Returns a lightweight prediction structure so Condition 3 can still function.
        """
        # Simple heuristic: more events -> higher workload -> prefer banner with highlight
        event_count = len(events) if events else 0
        workload_score = min(event_count / 20, 1.0)
        return {
            "presentation": "banner",
            "confidence": round(0.5 + 0.5 * workload_score, 2),
            "workload_estimate": workload_score,
            "notes": "Fallback prediction (ML dependencies not installed)"
        }

# Import database utilities and schema setup
from data.db_utils import get_db_manager, DatabaseManager
from data.setup_database import DatabaseSetup
from api.queue_manager import get_queue_manager

# Load environment variables
load_dotenv()

# Configure logging
log_dir = Path(__file__).parent.parent / "logs"
log_dir.mkdir(exist_ok=True)
logger.add(log_dir / "server_{time}.log", rotation="1 day", retention="30 days", level="INFO")

# Get DB Manager
db_manager = get_db_manager()

# Initialize FastAPI app
app = FastAPI(
    title="ATC Adaptive Alert Research System",
    description="Backend API for adaptive alert research with PostgreSQL support",
    version="2.2.0",
)

# CORS Configuration
_cors_env = os.getenv("CORS_ORIGINS")
frontend_url = os.getenv("FRONTEND_URL")
backend_url = os.getenv("BACKEND_URL")

origins = []
for candidate in [_cors_env, frontend_url, backend_url]:
    if candidate:
        origins.extend([o.strip() for o in candidate.split(",") if o.strip()])
if not origins:
    # Default to common local + Render domains to reduce accidental CORS blocks
    origins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://adaptive-atc-dashboard.onrender.com",
        "https://adaptive-atc-dashboard-2.onrender.com",
    ]

# Also allow any adaptive-atc-dashboard*.onrender.com host via regex to avoid silent typos
adaptive_onrender_regex = r"https://adaptive-atc-dashboard(-[a-zA-Z0-9]+)?\.onrender\.com"

logger.info(f"CORS allowed origins: {origins}")
logger.info(f"CORS allowed regex: {adaptive_onrender_regex}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=adaptive_onrender_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== SPA STATIC FILE SERVING (Production) =====
# Mount frontend build directory for production deployment
# This allows the backend to serve the React frontend
build_dir = Path(__file__).parent.parent.parent / "frontend" / "build"
if build_dir.exists():
    logger.info(f"Mounting frontend static files from {build_dir}")
    app.mount("/static", StaticFiles(directory=build_dir / "static"), name="static")
else:
    logger.info("Frontend build directory not found - static file serving disabled")

# ===== SIMULATION ENGINE =====
# Built-in aircraft simulation (no external simulator required)
sim_engine = SimulationEngine(tick_rate=1.0)
sim_live_connections: Dict[str, WebSocket] = {}

# ===== SCENARIO MANAGEMENT =====
# Map scenario types to their classes
SCENARIO_CLASSES = {
    "L1": ScenarioL1,
    "L2": ScenarioL2,
    "L3": ScenarioL3,
    "H4": ScenarioH4,
    "H5": ScenarioH5,
    "H6": ScenarioH6,
}

# Active scenarios tracking
active_scenarios: Dict[str, BaseScenario] = {}

# WebSocket connections tracking
websocket_connections: Dict[str, WebSocket] = {}

# ML Predictor instance
ml_predictor: Optional[AlertPredictor] = None

# Researcher API token (optional)
RESEARCHER_TOKEN = (os.getenv("RESEARCHER_TOKEN") or "").strip() or None
ALLOW_UNPROTECTED_RESEARCHER = os.getenv("ALLOW_UNPROTECTED_RESEARCHER", "false").lower() == "true"


def require_researcher_token(request: Request):
    """Guard researcher endpoints; allow unauthenticated access only in trusted local dev."""
    if not RESEARCHER_TOKEN:
        client_host = request.client.host if request.client else None
        if client_host in ("127.0.0.1", "::1", "localhost") or ALLOW_UNPROTECTED_RESEARCHER:
            return
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Researcher token required")

    auth_header = request.headers.get("Authorization")
    api_key = request.headers.get("X-API-KEY")

    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "", 1).strip()
    elif api_key:
        token = api_key.strip()

    if token != RESEARCHER_TOKEN:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")


# ===== Startup and Shutdown Events =====

@app.on_event("startup")
async def startup_event():
    global ml_predictor
    logger.info("="*50)
    logger.info("ATC Adaptive Alert Research System - Starting")
    logger.info("="*50)
    await db_manager.connect()
    logger.info("Database connection established.")

    # Initialize ML predictor
    if ML_AVAILABLE and AlertPredictor:
        try:
            ml_predictor = AlertPredictor()
            logger.info("ML Predictor initialized.")
        except Exception as e:
            logger.warning(f"ML Predictor initialization failed: {e}")
            ml_predictor = None
    else:
        logger.warning("ML models not available - skipping ML predictor initialization")
        ml_predictor = None

    logger.info("Server started successfully")

    # Register simulation engine event handler for real-time updates
    async def _sim_fan_out(state: dict):
        """Fan out simulation state to all connected WebSocket clients."""
        stale = []
        for session_id, ws in sim_live_connections.items():
            try:
                await ws.send_json({"type": "simulation", "state": state})
            except Exception as e:
                logger.warning(f"Failed to send simulation state to {session_id}: {e}")
                stale.append(session_id)
        for sid in stale:
            sim_live_connections.pop(sid, None)

    sim_engine.add_event_handler("tick", _sim_fan_out)
    logger.info("Simulation engine initialized (standalone mode)")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Server shutting down...")
    await sim_engine.stop()
    logger.info("Simulation engine stopped.")
    await db_manager.disconnect()
    logger.info("Database connection closed.")
    logger.info("Server shutdown complete")


# ===== DATA MODELS =====
class ScenarioType(str, Enum):
    L1 = "L1"
    L2 = "L2"
    L3 = "L3"
    H4 = "H4"
    H5 = "H5"
    H6 = "H6"

# Map ScenarioType to their durations (in seconds)
SCENARIO_DURATIONS = {
    ScenarioType.L1: ScenarioL1.duration,
    ScenarioType.L2: ScenarioL2.duration,
    ScenarioType.L3: ScenarioL3.duration,
    ScenarioType.H4: ScenarioH4.duration,
    ScenarioType.H5: ScenarioH5.duration,
    ScenarioType.H6: ScenarioH6.duration,
}

class ConditionType(int, Enum):
    TRADITIONAL = 1
    RULE_BASED = 2
    ML_BASED = 3

class SessionStartRequest(BaseModel):
    scenario: ScenarioType
    condition: ConditionType
    participant_id: str = Field(..., min_length=1, max_length=100)

class SessionStartResponse(BaseModel):
    session_id: str
    scenario: ScenarioType
    condition: ConditionType
    websocket_url: str
    created_at: datetime

class SessionEndRequest(BaseModel):
    reason: Optional[str] = "completed"
    final_state: Optional[Dict[str, Any]] = None
    performance_score: Optional[float] = None

class SessionEndResponse(BaseModel):
    session_id: str
    summary: Dict[str, Any]
    ended_at: datetime

class ScenarioUpdateRequest(BaseModel):
    elapsed_time: float

class ScenarioUpdateResponse(BaseModel):
    elapsed_time: float
    current_phase: int
    phase_description: str
    aircraft: Dict[str, Any]
    triggered_events: List[Dict[str, Any]]
    triggered_probes: List[Dict[str, Any]]
    scenario_complete: bool

class BehavioralEventRequest(BaseModel):
    events: List[Dict[str, Any]]

class CommandRequest(BaseModel):
    command: str

class AlertCreateRequest(BaseModel):
    alert_id: str
    alert_type: str
    priority: str
    message: str
    aircraft_id: Optional[str] = None
    presentation_data: Optional[Dict[str, Any]] = None
    additional_data: Optional[Dict[str, Any]] = None

class AlertAcknowledgeRequest(BaseModel):
    acknowledged_at: Optional[str] = None
    response_time_ms: Optional[float] = None
    action_taken: Optional[str] = None
    action_correct: Optional[bool] = None

class AlertDismissRequest(BaseModel):
    dismissed_at: Optional[str] = None
    time_displayed_ms: Optional[float] = None

class SurveyRequest(BaseModel):
    survey_type: str
    survey_phase: str = "post"
    responses: Dict[str, Any]
    duration_seconds: Optional[int] = None

class CreateQueueRequest(BaseModel):
    participant_id: str
    scenario_ids: List[str]
    conditions: List[int]
    metadata: Optional[Dict[str, Any]] = None


class QueueItemCompleteRequest(BaseModel):
    results: Optional[Dict[str, Any]] = None


# ===== V1 API CONTRACT MODELS =====

class V1CommandRequest(BaseModel):
    session_id: str
    command: str

class V1EventRequest(BaseModel):
    session_id: str
    event: Dict[str, Any]

class V1ScenarioNextRequest(BaseModel):
    session_id: str
    elapsed_time: float

class V1SessionEndRequest(SessionEndRequest):
    session_id: str


# ===== HEALTH CHECK =====

@app.get("/")
async def root():
    return {"status": "online", "service": "ATC Research Backend", "version": "2.2.0"}

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "database": "connected" if db_manager.database.is_connected else "disconnected",
        "ml_models": "loaded" if ml_predictor else "not loaded",
        "active_sessions": len(active_scenarios),
        "websocket_connections": len(websocket_connections)
    }


# ===== V1 VERSIONED ENDPOINTS (stable contract) =====

@app.post("/v1/session/start", response_model=SessionStartResponse, status_code=status.HTTP_201_CREATED)
async def v1_start_session(body: SessionStartRequest, request: Request):
    """Versioned wrapper for starting a session."""
    return await start_session(body, request)


@app.post("/v1/session/end", response_model=SessionEndResponse)
async def v1_end_session(body: V1SessionEndRequest):
    """Versioned wrapper for ending a session."""
    return await end_session(body.session_id, body)


@app.get("/v1/session/{session_id}/status")
async def v1_session_status(session_id: str):
    """Versioned session status endpoint."""
    return await get_session_details(session_id)


@app.post("/v1/command")
async def v1_command(request: V1CommandRequest):
    """Versioned command endpoint."""
    return await issue_command(request.session_id, CommandRequest(command=request.command))


@app.post("/v1/event")
async def v1_event(request: V1EventRequest):
    """Versioned event endpoint (maps to behavioral events)."""
    payload = request.event if isinstance(request.event, list) else [request.event]
    return await log_behavioral_events(request.session_id, BehavioralEventRequest(events=payload))


@app.get("/v1/scenario/next")
async def v1_scenario_next(session_id: str, elapsed_time: float):
    """Versioned scenario poll endpoint."""
    return await update_scenario(session_id, ScenarioUpdateRequest(elapsed_time=elapsed_time))


# ===== SESSION MANAGEMENT ENDPOINTS =====

@app.post("/api/sessions/start", response_model=SessionStartResponse, status_code=status.HTTP_201_CREATED)
async def start_session(body: SessionStartRequest, request: Request):
    """Starts a new research session and stores it in the database."""
    try:
        session_id = f"session_{uuid.uuid4().hex[:12]}"
        logger.info(f"Starting session: {session_id} for participant {body.participant_id}")

        # Create session in the database
        await db_manager.create_session(
            session_id=session_id,
            participant_id=body.participant_id,
            scenario=body.scenario.value,
            condition=body.condition.value,
        )

        # Construct WebSocket URL using actual hostname from request
        # For Render deployment, use the RENDER_EXTERNAL_URL if available
        render_url = os.getenv("RENDER_EXTERNAL_URL")
        if render_url:
            # Render provides full URL like https://myapp.onrender.com
            # Convert to wss:// for WebSocket
            ws_base = render_url.replace("https://", "wss://").replace("http://", "ws://")
            ws_url = f"{ws_base}/ws/session/{session_id}"
        else:
            # Fallback to request hostname for local development
            scheme = "wss" if request.url.scheme == "https" else "ws"
            host = request.url.hostname or "localhost"
            port = request.url.port
            if port and port not in (80, 443):
                ws_url = f"{scheme}://{host}:{port}/ws/session/{session_id}"
            else:
                ws_url = f"{scheme}://{host}/ws/session/{session_id}"

        return SessionStartResponse(
            session_id=session_id,
            scenario=body.scenario,
            condition=body.condition,
            websocket_url=ws_url,
            created_at=datetime.utcnow()
        )
    except Exception as e:
        logger.error(f"Failed to start session: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/api/sessions/{session_id}/start")
async def start_scenario(session_id: str):
    """Start the scenario for an existing session."""
    try:
        # Get session details
        session = await db_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

        if session_id in active_scenarios:
            # Scenario already started, return current state
            scenario = active_scenarios[session_id]
            return {
                "status": "already_started",
                "session_id": session_id,
                "elapsed_time": scenario.elapsed_time,
                "scenario_info": scenario.get_scenario_info()
            }

        # Create and initialize scenario
        scenario_type = session["scenario"]
        condition = session["condition"]

        if scenario_type not in SCENARIO_CLASSES:
            raise HTTPException(status_code=400, detail=f"Unknown scenario type: {scenario_type}")

        scenario_class = SCENARIO_CLASSES[scenario_type]
        scenario = scenario_class(session_id=session_id, condition=condition)
        scenario.start()

        # Store active scenario
        active_scenarios[session_id] = scenario

        logger.info(f"Scenario {scenario_type} started for session {session_id}")

        return {
            "status": "started",
            "session_id": session_id,
            "scenario_info": scenario.get_scenario_info(),
            "duration": SCENARIO_DURATIONS.get(ScenarioType(scenario_type), 360)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to start scenario for session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/sessions/{session_id}/update", response_model=ScenarioUpdateResponse)
async def update_scenario(session_id: str, request: ScenarioUpdateRequest):
    """Update scenario state and get triggered events - CRITICAL FOR POLLING."""
    try:
        if session_id not in active_scenarios:
            # Try to get session and check if it should be started
            session = await db_manager.get_session(session_id)
            if not session:
                raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

            # Auto-start scenario if not active
            scenario_type = session["scenario"]
            condition = session["condition"]

            if scenario_type not in SCENARIO_CLASSES:
                raise HTTPException(status_code=400, detail=f"Unknown scenario type: {scenario_type}")

            scenario_class = SCENARIO_CLASSES[scenario_type]
            scenario = scenario_class(session_id=session_id, condition=condition)
            scenario.start()
            active_scenarios[session_id] = scenario
            logger.info(f"Auto-started scenario {scenario_type} for session {session_id}")

        scenario = active_scenarios[session_id]

        # Update scenario state
        update_result = scenario.update()

        # Check if scenario is complete
        scenario_info = scenario.get_scenario_info()
        duration = scenario_info.get('duration_seconds', 360)
        scenario_complete = scenario.elapsed_time >= duration

        # Store triggered events in database
        for event in update_result.get('triggered_events', []):
            try:
                await db_manager.add_scenario_event(
                    session_id=session_id,
                    event_id=f"{event['event_type']}_{event['target']}_{int(event['time_offset'])}",
                    event_name=event['event_type'],
                    event_type=event['event_type'],
                    scenario_time=event['time_offset'],
                    event_data=event.get('data', {}),
                    severity=event.get('data', {}).get('priority'),
                    aircraft_id=event.get('target')
                )
            except Exception as e:
                logger.warning(f"Failed to store scenario event: {e}")

        return ScenarioUpdateResponse(
            elapsed_time=scenario.elapsed_time,
            current_phase=update_result.get('current_phase', 0),
            phase_description=update_result.get('phase_description', ''),
            aircraft=update_result.get('aircraft', {}),
            triggered_events=update_result.get('triggered_events', []),
            triggered_probes=update_result.get('triggered_probes', []),
            scenario_complete=scenario_complete
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update scenario for session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sessions/active", dependencies=[Depends(require_researcher_token)])
async def get_active_sessions():
    """Returns a list of all currently active sessions."""
    try:
        active_sessions = await db_manager.get_active_sessions()
        return {"status": "success", "sessions": active_sessions}
    except Exception as e:
        logger.error(f"Error getting active sessions: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


def convert_scenario_position_to_latlon(x: float, y: float) -> dict:
    """
    Convert scenario coordinates (nautical miles from reference) to lat/lon.
    Reference point: KSFO area (37.6213, -122.3790)

    1 nautical mile ≈ 1/60 degree of latitude
    For longitude, we need to account for the cosine of latitude
    """
    import math

    REF_LAT = 37.6213
    REF_LON = -122.3790
    NM_TO_DEG_LAT = 1 / 60  # 1 NM ≈ 1/60 degree latitude
    # Longitude degrees per NM varies with latitude
    NM_TO_DEG_LON = 1 / (60 * math.cos(math.radians(REF_LAT)))

    # x is east-west (positive = east), y is north-south (positive = north)
    lat = REF_LAT + (y * NM_TO_DEG_LAT)
    lon = REF_LON + (x * NM_TO_DEG_LON)

    return {"lat": lat, "lon": lon}


@app.get("/api/sessions/{session_id}")
async def get_session_details(session_id: str):
    """Returns details for a specific session."""
    try:
        session = await db_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found.")

        # Augment session data with scenario duration
        scenario_type = session["scenario"]
        try:
            session["scenario_duration"] = SCENARIO_DURATIONS.get(ScenarioType(scenario_type), 360)
        except ValueError:
            session["scenario_duration"] = 360

        # Include aircraft configuration for BlueSky
        aircraft_config = []
        if scenario_type in SCENARIO_CLASSES:
            # Create a temporary scenario instance to get aircraft config
            scenario_class = SCENARIO_CLASSES[scenario_type]
            temp_scenario = scenario_class(session_id="temp", condition=session.get("condition", 1))
            temp_scenario.initialize()  # Initialize aircraft, events, and probes

            logger.info(f"[Aircraft Config] Generating config for scenario {scenario_type}, found {len(temp_scenario.aircraft)} aircraft")

            for callsign, aircraft in temp_scenario.aircraft.items():
                pos = convert_scenario_position_to_latlon(aircraft.position[0], aircraft.position[1])
                ac_config = {
                    "callsign": callsign,
                    "position": pos,
                    "altitude": aircraft.altitude * 100,  # Convert FL to feet (FL280 -> 28000)
                    "heading": aircraft.heading,
                    "speed": aircraft.speed,
                    "type": "B737",  # Default type
                    "route": aircraft.route,
                    "destination": aircraft.destination if hasattr(aircraft, 'destination') else None
                }
                aircraft_config.append(ac_config)
                logger.debug(f"[Aircraft Config] {callsign}: pos={pos}, alt={ac_config['altitude']}ft, hdg={ac_config['heading']}°")

            logger.info(f"[Aircraft Config] Successfully generated {len(aircraft_config)} aircraft configurations")
        else:
            logger.warning(f"[Aircraft Config] Scenario type {scenario_type} not found in SCENARIO_CLASSES")

        session["aircraft_config"] = aircraft_config
        logger.info(f"[Aircraft Config] Added aircraft_config to session with {len(aircraft_config)} aircraft")

        return session
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting session {session_id} details: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/sessions/{session_id}/data")
async def get_session_data(session_id: str):
    """
    Alias for session details used by some frontend screens.
    Keeps backward compatibility with earlier API docs.
    """
    return await get_session_details(session_id)


@app.post("/api/sessions/{session_id}/end", response_model=SessionEndResponse)
async def end_session(session_id: str, request: Optional[SessionEndRequest] = None):
    """Ends a research session and updates its status in the database."""
    try:
        logger.info(f"Ending session {session_id}")

        reason = request.reason if request else "completed"
        final_state = request.final_state if request else None
        performance_score = request.performance_score if request else None

        # Get final scenario state if active
        if session_id in active_scenarios:
            scenario = active_scenarios[session_id]
            if final_state is None:
                final_state = scenario.get_results()
            # Remove from active scenarios
            del active_scenarios[session_id]

        # Close WebSocket if connected
        if session_id in websocket_connections:
            try:
                await websocket_connections[session_id].close()
            except:
                pass
            del websocket_connections[session_id]

        success = await db_manager.end_session(
            session_id=session_id,
            end_reason=reason,
            final_state=final_state,
            performance_score=performance_score
        )

        if not success:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found or could not be ended.")

        # Fetch the updated session to return summary
        session = await db_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found after ending.")

        summary = {
            "participant_id": session["participant_id"],
            "scenario": session["scenario"],
            "condition": session["condition"],
            "duration_seconds": session.get("duration_seconds", 0),
            "performance_score": session.get("performance_score"),
            "end_reason": session.get("end_reason")
        }

        return SessionEndResponse(
            session_id=session_id,
            summary=summary,
            ended_at=session["ended_at"]
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error ending session {session_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/sessions/{session_id}/export", dependencies=[Depends(require_researcher_token)])
async def export_session(session_id: str):
    """Export complete session data."""
    try:
        session = await db_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

        # Get all related data
        behavioral_events = await db_manager.get_behavioral_events(session_id)

        # Get scenario results if still active
        scenario_results = None
        if session_id in active_scenarios:
            scenario_results = active_scenarios[session_id].get_results()

        return {
            "session": session,
            "behavioral_events": behavioral_events,
            "scenario_results": scenario_results,
            "exported_at": datetime.utcnow().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting session {session_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ===== BEHAVIORAL EVENTS ENDPOINTS =====

@app.post("/api/sessions/{session_id}/behavioral-events")
async def log_behavioral_events(session_id: str, request: BehavioralEventRequest):
    """Log batched behavioral events."""
    try:
        session = await db_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

        logged_count = 0
        for event in request.events:
            try:
                await db_manager.add_behavioral_event(
                    session_id=session_id,
                    event_type=event.get('event_type', 'unknown'),
                    timestamp=event.get('timestamp', datetime.utcnow().timestamp()),
                    event_data=event,
                    screen_width=event.get('screen_width'),
                    screen_height=event.get('screen_height')
                )
                logged_count += 1
            except Exception as e:
                logger.warning(f"Failed to log behavioral event: {e}")

        return {
            "status": "success",
            "logged_count": logged_count,
            "total_received": len(request.events)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error logging behavioral events: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/sessions/{session_id}/behavioral-events")
async def get_behavioral_events(session_id: str, limit: int = 100, event_type: Optional[str] = None):
    """Get behavioral events for a session."""
    try:
        events = await db_manager.get_behavioral_events(session_id, event_type=event_type, limit=limit)
        return {
            "status": "success",
            "events": events,
            "count": len(events)
        }
    except Exception as e:
        logger.error(f"Error getting behavioral events: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/api/sessions/{session_id}/command")
async def issue_command(session_id: str, request: CommandRequest):
    """Records a user-issued command as an interaction in the scenario."""
    if session_id not in active_scenarios:
        raise HTTPException(status_code=404, detail="Active scenario not found for this session")

    scenario = active_scenarios[session_id]
    
    # The command string is expected to be in the format "CALLSIGN command params"
    parts = request.command.split()
    if not parts:
        raise HTTPException(status_code=400, detail="Command cannot be empty")
        
    target_callsign = parts[0]

    scenario.record_interaction(
        interaction_type='user_command',
        target=target_callsign,
        data={'command': request.command}
    )
    
    logger.info(f"Recorded command for session {session_id}: {request.command}")
    
    return {"status": "success", "command_recorded": request.command}


# ===== ALERT ENDPOINTS =====

@app.post("/api/sessions/{session_id}/alerts")
async def create_alert(session_id: str, request: AlertCreateRequest):
    """Log alert display."""
    try:
        session = await db_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

        await db_manager.add_alert(
            session_id=session_id,
            alert_id=request.alert_id,
            alert_type=request.alert_type,
            condition=session["condition"],
            priority=request.priority,
            message=request.message,
            aircraft_id=request.aircraft_id,
            presentation_data=request.presentation_data,
            additional_data=request.additional_data
        )

        return {
            "status": "success",
            "alert_id": request.alert_id
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating alert: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/api/sessions/{session_id}/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(session_id: str, alert_id: str, request: AlertAcknowledgeRequest):
    """Log alert acknowledgment."""
    try:
        await db_manager.acknowledge_alert(
            alert_id=alert_id,
            action_taken=request.action_taken,
            action_correct=request.action_correct,
            response_time_ms=request.response_time_ms
        )

        # Record interaction in scenario if active
        if session_id in active_scenarios:
            active_scenarios[session_id].record_interaction(
                interaction_type='alert_acknowledged',
                target=alert_id,
                data={
                    'response_time_ms': request.response_time_ms,
                    'action_taken': request.action_taken
                }
            )

        return {
            "status": "success",
            "alert_id": alert_id,
            "acknowledged": True
        }

    except Exception as e:
        logger.error(f"Error acknowledging alert: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/api/sessions/{session_id}/alerts/{alert_id}/dismiss")
async def dismiss_alert(session_id: str, alert_id: str, request: AlertDismissRequest):
    """Log alert dismissal."""
    try:
        # Update alert in database (mark as dismissed)
        async with db_manager.get_connection() as conn:
            await conn.execute(
                "UPDATE alerts SET was_dismissed = 1, dismissed_at = :dismissed_at, time_to_dismiss = :time_displayed WHERE alert_id = :alert_id",
                {
                    "dismissed_at": request.dismissed_at or datetime.utcnow().isoformat(),
                    "time_displayed": request.time_displayed_ms,
                    "alert_id": alert_id
                }
            )

        return {
            "status": "success",
            "alert_id": alert_id,
            "dismissed": True
        }

    except Exception as e:
        logger.error(f"Error dismissing alert: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/sessions/{session_id}/alerts")
async def get_alerts(session_id: str):
    """Get all alerts for a session."""
    try:
        async with db_manager.get_connection() as conn:
            rows = await conn.fetch_all(
                "SELECT * FROM alerts WHERE session_id = :session_id ORDER BY displayed_at",
                {"session_id": session_id}
            )

        return {
            "status": "success",
            "alerts": [dict(row) for row in rows],
            "count": len(rows)
        }

    except Exception as e:
        logger.error(f"Error getting alerts: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ===== SURVEY ENDPOINTS =====

@app.post("/api/sessions/{session_id}/surveys")
async def submit_survey(session_id: str, request: SurveyRequest):
    """Submit survey response."""
    try:
        session = await db_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

        survey_id = f"survey_{session_id}_{request.survey_type}_{uuid.uuid4().hex[:8]}"

        # Normalize survey_phase to match database CHECK constraint
        # Frontend sends: 'pre-session', 'post-session', 'post-phase-1'
        # Database accepts: 'pre', 'post', 'mid', 'followup'
        phase_mapping = {
            'pre-session': 'pre',
            'post-session': 'post',
            'post-phase-1': 'mid',
            'mid-session': 'mid',
        }
        normalized_phase = phase_mapping.get(request.survey_phase, request.survey_phase)

        # Validate normalized phase, default to 'post' if invalid
        valid_phases = ('pre', 'post', 'mid', 'followup')
        if normalized_phase not in valid_phases:
            normalized_phase = 'post'

        async with db_manager.get_connection() as conn:
            await conn.execute(
                """INSERT INTO surveys
                   (session_id, survey_id, survey_type, survey_phase, responses, duration_seconds)
                   VALUES (:session_id, :survey_id, :survey_type, :survey_phase, :responses, :duration)""",
                {
                    "session_id": session_id,
                    "survey_id": survey_id,
                    "survey_type": request.survey_type,
                    "survey_phase": normalized_phase,
                    "responses": json.dumps(request.responses),
                    "duration": request.duration_seconds
                }
            )

        return {
            "status": "success",
            "survey_id": survey_id
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting survey: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/sessions/{session_id}/surveys")
async def get_surveys(session_id: str):
    """Get all surveys for a session."""
    try:
        async with db_manager.get_connection() as conn:
            rows = await conn.fetch_all(
                "SELECT * FROM surveys WHERE session_id = :session_id ORDER BY completed_at",
                {"session_id": session_id}
            )

        return {
            "status": "success",
            "surveys": [dict(row) for row in rows],
            "count": len(rows)
        }

    except Exception as e:
        logger.error(f"Error getting surveys: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ===== METRICS ENDPOINTS =====

@app.get("/api/sessions/{session_id}/metrics")
async def get_session_metrics(session_id: str):
    """Get metrics for a session."""
    try:
        async with db_manager.get_connection() as conn:
            rows = await conn.fetch_all(
                "SELECT * FROM metrics WHERE session_id = :session_id ORDER BY measured_at",
                {"session_id": session_id}
            )

        # Also get computed metrics from scenario if active
        scenario_metrics = {}
        if session_id in active_scenarios:
            scenario = active_scenarios[session_id]
            scenario_metrics = scenario.measurements

        return {
            "status": "success",
            "stored_metrics": [dict(row) for row in rows],
            "scenario_metrics": scenario_metrics
        }

    except Exception as e:
        logger.error(f"Error getting metrics: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/sessions/{session_id}/performance")
async def get_performance_summary(session_id: str):
    """Get performance summary for a session."""
    try:
        session = await db_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

        # Get alert statistics
        async with db_manager.get_connection() as conn:
            alert_stats = await conn.fetch_one(
                """SELECT
                    COUNT(*) as total_alerts,
                    AVG(response_time) as avg_response_time,
                    SUM(CASE WHEN was_acknowledged = 1 THEN 1 ELSE 0 END) as acknowledged_count,
                    SUM(CASE WHEN action_correct = 1 THEN 1 ELSE 0 END) as correct_actions
                   FROM alerts WHERE session_id = :session_id""",
                {"session_id": session_id}
            )

        # Get scenario performance if active
        scenario_performance = None
        if session_id in active_scenarios:
            scenario = active_scenarios[session_id]
            if hasattr(scenario, 'analyze_performance'):
                scenario_performance = scenario.analyze_performance()

        return {
            "status": "success",
            "session_id": session_id,
            "performance_score": session.get("performance_score"),
            "duration_seconds": session.get("duration_seconds"),
            "alert_statistics": dict(alert_stats) if alert_stats else {},
            "scenario_performance": scenario_performance
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting performance: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ===== ML PREDICTION ENDPOINTS =====

@app.get("/api/sessions/{session_id}/ml-prediction")
async def get_ml_prediction(session_id: str):
    """Get ML complacency prediction for current session state."""
    try:
        if not predict_presentation:
            return {
                "status": "unavailable",
                "message": "ML predictor not initialized"
            }
        # If we have a predictor instance, use it; otherwise fall back to heuristic function.
        predictor_ready = ml_predictor is not None

        # Get recent behavioral events
        events = await db_manager.get_behavioral_events(session_id, limit=50)

        # Get scenario state if active
        scenario_state = None
        if session_id in active_scenarios:
            scenario = active_scenarios[session_id]
            scenario_state = {
                'aircraft_count': len(scenario.aircraft),
                'elapsed_time': scenario.elapsed_time,
                'current_phase': scenario.current_phase
            }

        # Get prediction
        result = predict_presentation(events, scenario_state=scenario_state)

        return {
            "status": "success" if predictor_ready else "fallback",
            "prediction": result
        }

    except Exception as e:
        logger.error(f"Error getting ML prediction: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/sessions/{session_id}/ml-predictions")
async def get_ml_prediction_history(session_id: str):
    """Get ML prediction history for a session."""
    try:
        # For now, return empty history - would need to track predictions over time
        return {
            "status": "success",
            "predictions": [],
            "message": "Prediction history tracking not yet implemented"
        }

    except Exception as e:
        logger.error(f"Error getting ML prediction history: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ===== SCENARIO AND CONDITION DATA =====

@app.get("/api/scenarios")
async def get_scenarios():
    """Get all available scenarios."""
    scenarios = []
    for scenario_type, scenario_class in SCENARIO_CLASSES.items():
        instance = scenario_class(session_id="info", condition=1)
        info = instance.get_scenario_info()
        scenarios.append({
            "scenario_id": scenario_type,
            "name": info.get("name", scenario_type),
            "complexity": info.get("complexity", "Unknown"),
            "workload": info.get("workload", "Unknown"),
            "aircraft_count": info.get("aircraft_count", 0),
            "duration": info.get("duration_seconds", 360),
            "description": info.get("description", "")
        })
    return scenarios


@app.get("/api/conditions")
async def get_conditions():
    """Get all available alert conditions."""
    return [
        {
            "condition_id": 1,
            "name": "Traditional Modal",
            "description": "Standard pop-up modal alerts that interrupt workflow"
        },
        {
            "condition_id": 2,
            "name": "Rule-Based Adaptive",
            "description": "Alerts adapt based on predefined heuristic rules"
        },
        {
            "condition_id": 3,
            "name": "ML-Based Adaptive",
            "description": "Machine learning model learns optimal alert presentation"
        }
    ]


# ===== QUEUE MANAGEMENT ENDPOINTS =====

@app.post("/api/queues/create", dependencies=[Depends(require_researcher_token)])
async def create_queue(request: CreateQueueRequest):
    """Creates a new session queue."""
    try:
        qm = get_queue_manager()
        queue = qm.create_queue(
            participant_id=request.participant_id,
            scenario_ids=request.scenario_ids,
            conditions=request.conditions,
            metadata=request.metadata
        )
        logger.info(f"Created queue {queue.queue_id} for participant {request.participant_id}")
        return {"status": "success", "queue_id": queue.queue_id, "queue": queue.to_dict()}
    except Exception as e:
        logger.error(f"Error creating queue: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/queues", dependencies=[Depends(require_researcher_token)])
async def list_queues():
    """List all queues."""
    try:
        qm = get_queue_manager()
        queues = [q.to_dict() for q in qm.get_all_queues()]
        return {"status": "success", "queues": queues}
    except Exception as e:
        logger.error(f"Error listing queues: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/queues/{queue_id}", dependencies=[Depends(require_researcher_token)])
async def get_queue(queue_id: str):
    """Get queue by ID."""
    qm = get_queue_manager()
    queue = qm.get_queue(queue_id)
    if not queue:
        raise HTTPException(status_code=404, detail=f"Queue {queue_id} not found")
    return {"status": "success", "queue": queue.to_dict()}

@app.get("/api/participants/{participant_id}/next-session")
async def get_participant_next_session(participant_id: str):
    """Gets the next pending session for a participant from their queues."""
    try:
        qm = get_queue_manager()
        participant_queues = qm.get_participant_queues(participant_id)

        for queue in sorted(participant_queues, key=lambda q: q.created_at):
            if queue.status == "active":
                next_item = queue.get_next_item()
                if next_item:
                    return {
                        "status": "success",
                        "next_session": next_item.to_dict(),
                        "queue_id": queue.queue_id,
                        "item_index": queue.current_index
                    }

        raise HTTPException(status_code=404, detail="No pending sessions found for this participant.")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting next session for participant {participant_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/queues/{queue_id}/next", dependencies=[Depends(require_researcher_token)])
async def get_next_queue_item(queue_id: str):
    """Get the next pending item in a queue (does not mark it complete)."""
    try:
        qm = get_queue_manager()
        queue = qm.get_queue(queue_id)
        if not queue:
            raise HTTPException(status_code=404, detail=f"Queue {queue_id} not found")

        item = queue.get_next_item()
        if not item:
            return {"status": "empty", "item": None}

        qm.update_queue(queue)
        return {"status": "success", "item": item.to_dict()}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting next item for queue {queue_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/api/queues/{queue_id}/items/{item_index}/complete", dependencies=[Depends(require_researcher_token)])
async def complete_queue_item(queue_id: str, item_index: int, request: Optional[QueueItemCompleteRequest] = None):
    """Mark a queue item as completed and persist the update."""
    try:
        qm = get_queue_manager()
        queue = qm.get_queue(queue_id)
        if not queue:
            raise HTTPException(status_code=404, detail=f"Queue {queue_id} not found")

        if item_index < 0 or item_index >= len(queue.items):
            raise HTTPException(status_code=404, detail=f"Queue item {item_index} not found")

        results = request.results if request else {}
        queue.mark_item_completed(item_index, results)

        # If all items are completed, mark queue status accordingly
        if queue.is_complete():
            queue.status = "completed"

        qm.update_queue(queue)

        return {"status": "success", "queue": queue.to_dict()}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing queue item {item_index} for queue {queue_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/queues/{queue_id}/items/{item_index}/error", dependencies=[Depends(require_researcher_token)])
async def error_queue_item(queue_id: str, item_index: int, request: Optional[QueueItemCompleteRequest] = None):
    """Mark a queue item as errored."""
    try:
        qm = get_queue_manager()
        queue = qm.get_queue(queue_id)
        if not queue:
            raise HTTPException(status_code=404, detail=f"Queue {queue_id} not found")

        if item_index < 0 or item_index >= len(queue.items):
            raise HTTPException(status_code=404, detail=f"Queue item {item_index} not found")

        message = None
        if request and isinstance(request.results, dict):
            message = request.results.get("error") or request.results.get("message")

        queue.mark_item_error(item_index, message or "Unknown error")
        qm.update_queue(queue)

        return {"status": "success", "queue": queue.to_dict()}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking queue item {item_index} error for queue {queue_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.delete("/api/queues/{queue_id}", dependencies=[Depends(require_researcher_token)])
async def delete_queue(queue_id: str):
    """Delete a queue."""
    try:
        qm = get_queue_manager()
        deleted = qm.delete_queue(queue_id)
        if not deleted:
            raise HTTPException(status_code=404, detail=f"Queue {queue_id} not found")
        return {"status": "success", "queue_id": queue_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting queue {queue_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ===== WEBSOCKET ENDPOINT =====

@app.websocket("/ws/session/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket connection for real-time session communication."""
    await websocket.accept()
    websocket_connections[session_id] = websocket
    logger.info(f"WebSocket connected for session {session_id}")

    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()

            message_type = data.get("type", "unknown")
            payload = data.get("payload", {})

            if message_type == "ping":
                await websocket.send_json({"type": "pong", "timestamp": datetime.utcnow().isoformat()})

            elif message_type == "behavioral_event":
                # Log behavioral event
                try:
                    await db_manager.add_behavioral_event(
                        session_id=session_id,
                        event_type=payload.get('event_type', 'unknown'),
                        timestamp=payload.get('timestamp', datetime.utcnow().timestamp()),
                        event_data=payload
                    )
                    await websocket.send_json({"type": "ack", "message_type": message_type})
                except Exception as e:
                    await websocket.send_json({"type": "error", "message": str(e)})

            elif message_type == "scenario_update":
                # Get scenario update
                if session_id in active_scenarios:
                    scenario = active_scenarios[session_id]
                    update_result = scenario.update()
                    await websocket.send_json({
                        "type": "scenario_state",
                        "payload": update_result
                    })
                else:
                    await websocket.send_json({
                        "type": "error",
                        "message": "No active scenario for this session"
                    })

            elif message_type == "alert_response":
                # Record alert response
                alert_id = payload.get("alert_id")
                response_type = payload.get("response_type")  # 'acknowledged', 'dismissed'

                if response_type == "acknowledged":
                    await db_manager.acknowledge_alert(
                        alert_id=alert_id,
                        action_taken=payload.get("action_taken"),
                        action_correct=payload.get("action_correct"),
                        response_time_ms=payload.get("response_time_ms")
                    )

                await websocket.send_json({"type": "ack", "alert_id": alert_id})

            elif message_type == "get_ml_prediction":
                # Get ML prediction
                if ml_predictor and predict_presentation:
                    events = await db_manager.get_behavioral_events(session_id, limit=50)
                    prediction = predict_presentation(events)
                    await websocket.send_json({
                        "type": "ml_prediction",
                        "payload": prediction
                    })
                else:
                    await websocket.send_json({
                        "type": "ml_prediction",
                        "payload": {"status": "unavailable"}
                    })

            else:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Unknown message type: {message_type}"
                })

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for session {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error for session {session_id}: {e}")
    finally:
        if session_id in websocket_connections:
            del websocket_connections[session_id]


# ===== DATA EXPORT ENDPOINTS =====

@app.get("/api/export/sessions", dependencies=[Depends(require_researcher_token)])
async def export_all_sessions(participant_id: Optional[str] = None, format: str = "json"):
    """Export session data for analysis."""
    try:
        async with db_manager.get_connection() as conn:
            if participant_id:
                rows = await conn.fetch_all(
                    "SELECT * FROM sessions WHERE participant_id = :participant_id ORDER BY started_at",
                    {"participant_id": participant_id}
                )
            else:
                rows = await conn.fetch_all("SELECT * FROM sessions ORDER BY started_at")

        sessions = [dict(row) for row in rows]

        return {
            "status": "success",
            "format": format,
            "count": len(sessions),
            "sessions": sessions
        }

    except Exception as e:
        logger.error(f"Error exporting sessions: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/export/metrics", dependencies=[Depends(require_researcher_token)])
async def export_metrics(participant_id: Optional[str] = None):
    """Export aggregated metrics for analysis."""
    try:
        async with db_manager.get_connection() as conn:
            # Get alert performance by condition
            alert_perf = await conn.fetch_all(
                "SELECT * FROM v_alert_performance"
            )

            # Get scenario difficulty
            scenario_diff = await conn.fetch_all(
                "SELECT * FROM v_scenario_difficulty"
            )

        return {
            "status": "success",
            "alert_performance": [dict(row) for row in alert_perf],
            "scenario_difficulty": [dict(row) for row in scenario_diff]
        }

    except Exception as e:
        logger.error(f"Error exporting metrics: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ===== SIMULATION ENDPOINTS =====


class SimulationStartRequest(BaseModel):
    aircraft: List[dict] = Field(default_factory=list)
    speed_multiplier: float = 1.0


class AircraftCommandRequest(BaseModel):
    altitude: Optional[float] = None
    heading: Optional[float] = None
    speed: Optional[float] = None


class SpawnRequest(BaseModel):
    callsign: str
    aircraft_type: str = "B738"
    lat: float
    lon: float
    altitude: float = 35000
    heading: float = 0
    speed: float = 250


class InjectEventRequest(BaseModel):
    event_type: str  # "emergency", "comm_loss"
    callsign: str
    details: Optional[str] = None


@app.get("/api/simulation/health")
async def simulation_health():
    """Check simulation engine status."""
    return {
        "enabled": True,
        "running": sim_engine.running,
        "paused": sim_engine.paused,
        "aircraft_count": len(sim_engine.aircraft),
        "sim_time": sim_engine.sim_time,
    }


@app.get("/api/simulation/state")
async def simulation_state():
    """Get current simulation state."""
    return sim_engine.get_state()


@app.post("/api/simulation/start")
async def simulation_start(body: SimulationStartRequest):
    """Start simulation with aircraft configuration."""
    try:
        sim_engine.load_scenario(body.aircraft)
        sim_engine.set_speed(body.speed_multiplier)
        await sim_engine.start()
        return {"status": "started", "aircraft_count": len(sim_engine.aircraft)}
    except Exception as e:
        logger.error(f"Simulation start failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/simulation/stop")
async def simulation_stop():
    """Stop simulation."""
    await sim_engine.stop()
    return {"status": "stopped"}


@app.post("/api/simulation/pause")
async def simulation_pause():
    """Pause simulation."""
    sim_engine.pause()
    return {"status": "paused"}


@app.post("/api/simulation/resume")
async def simulation_resume():
    """Resume simulation."""
    sim_engine.resume()
    return {"status": "resumed"}


@app.post("/api/simulation/speed")
async def simulation_speed(multiplier: float):
    """Set simulation speed multiplier."""
    sim_engine.set_speed(multiplier)
    return {"status": "ok", "speed_multiplier": sim_engine.speed_multiplier}


@app.post("/api/aircraft/spawn")
async def spawn_aircraft(body: SpawnRequest):
    """Spawn a new aircraft."""
    try:
        ac = sim_engine.add_aircraft({
            "callsign": body.callsign,
            "aircraft_type": body.aircraft_type,
            "lat": body.lat,
            "lon": body.lon,
            "altitude": body.altitude,
            "heading": body.heading,
            "speed": body.speed,
        })
        return {"status": "spawned", "aircraft": ac.to_dict()}
    except Exception as e:
        logger.error(f"Aircraft spawn failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/aircraft/{callsign}/command")
async def aircraft_command(callsign: str, body: AircraftCommandRequest):
    """Issue command to aircraft (altitude, heading, speed)."""
    success = sim_engine.command_aircraft(
        callsign,
        altitude=body.altitude,
        heading=body.heading,
        speed=body.speed,
    )
    if not success:
        raise HTTPException(status_code=404, detail=f"Aircraft {callsign} not found")
    return {"status": "commanded", "callsign": callsign}


@app.post("/api/aircraft/{callsign}/remove")
async def remove_aircraft(callsign: str):
    """Remove aircraft from simulation."""
    success = sim_engine.remove_aircraft(callsign)
    if not success:
        raise HTTPException(status_code=404, detail=f"Aircraft {callsign} not found")
    return {"status": "removed", "callsign": callsign}


@app.post("/api/simulation/inject-event")
async def inject_event(body: InjectEventRequest):
    """Inject an event (emergency, comm loss) for an aircraft."""
    if body.event_type == "emergency":
        sim_engine.trigger_emergency(body.callsign, body.details or "general")
    elif body.event_type == "comm_loss":
        sim_engine.trigger_comm_loss(body.callsign)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown event type: {body.event_type}")
    return {"status": "injected", "event_type": body.event_type, "callsign": body.callsign}


@app.get("/api/simulation/stream")
async def simulation_stream(request: Request):
    """Server-Sent Events stream for real-time simulation updates."""
    async def event_generator():
        while True:
            if await request.is_disconnected():
                break
            state = sim_engine.get_state()
            yield {"event": "state", "data": json.dumps(state)}
            await asyncio.sleep(1.0 / sim_engine.speed_multiplier)

    return EventSourceResponse(event_generator())


@app.websocket("/ws/simulation/live")
async def simulation_live(ws: WebSocket):
    """WebSocket endpoint for real-time simulation updates."""
    await ws.accept()
    conn_id = f"sim_{uuid.uuid4().hex[:8]}"
    sim_live_connections[conn_id] = ws
    logger.info(f"Simulation live WS connected: {conn_id}")

    try:
        while True:
            # Keep connection alive, handle any incoming commands
            data = await ws.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "command" and msg.get("callsign"):
                    sim_engine.command_aircraft(
                        msg["callsign"],
                        altitude=msg.get("altitude"),
                        heading=msg.get("heading"),
                        speed=msg.get("speed"),
                    )
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        logger.info(f"Simulation live WS disconnected: {conn_id}")
    except Exception as e:
        logger.error(f"Simulation live WS error ({conn_id}): {e}")
    finally:
        sim_live_connections.pop(conn_id, None)


# ===== SPA CATCH-ALL ROUTE (Must be last) =====
# Serve index.html for all non-API routes to support React Router client-side routing
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """
    Catch-all route for SPA (Single Page Application) support.
    Serves index.html for any path that isn't an API endpoint.
    This allows React Router to handle client-side routing.
    """
    # Don't catch API routes
    if full_path.startswith("api/") or full_path.startswith("ws/") or full_path == "health":
        raise HTTPException(status_code=404, detail="Not found")

    # Serve index.html if build directory exists
    if build_dir.exists():
        index_file = build_dir / "index.html"
        if index_file.exists():
            return FileResponse(index_file)

    # If no build directory, return 404
    raise HTTPException(status_code=404, detail="Frontend not built")


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("BACKEND_HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", 8000))
    reload = os.getenv("BACKEND_RELOAD", "true").lower() == "true"
    uvicorn.run("server:app", host=host, port=port, reload=reload)
