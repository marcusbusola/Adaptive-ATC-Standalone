# ATC Adaptive Alert Research System - Backend API

## Quick Start

### Installation

1. **Install dependencies:**
```bash
cd backend
pip install -r requirements.txt
```

2. **Set up environment variables (optional):**
```bash
cp ../.env.example .env
# Edit .env with your configuration
```

3. **Run the server:**
```bash
cd api
python server.py
```

The server will start at `http://localhost:8000`

### Verify Installation

Check these endpoints:
- **Health Check:** http://localhost:8000/health
- **API Docs:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

---

## Files

### `server.py`
Main FastAPI server with all endpoints:
- **Session Management:** Start/end sessions
- **WebSocket:** Real-time bidirectional communication
- **Data Collection:** Store behavioral events
- **Alert Triggers:** Send alerts to frontend

### `main.py`
Original API file (now superseded by server.py)

### `API_DOCUMENTATION.md`
Comprehensive API documentation with:
- Endpoint descriptions
- Request/response examples
- Data models
- Usage examples in Python and JavaScript

### `example_client.py`
Example Python client demonstrating:
- Starting sessions
- WebSocket connections
- Sending behavioral data
- Receiving alerts
- Ending sessions

---

## Key Features

### ✅ Session Management
- Create sessions with specific scenarios (L1/L2/H4/H5)
- Support for 3 alert conditions (Traditional/Rule-Based/ML-Based)
- Automatic session data persistence
- Performance evaluation on session end

### ✅ Real-time Communication
- WebSocket support for bidirectional messaging
- Server sends: alerts, scenario events, system messages
- Client sends: behavioral data, actions, acknowledgments
- Automatic connection management

### ✅ Data Collection
- Comprehensive behavioral event tracking
- Mouse movements, clicks, interactions
- Timestamped event storage
- Structured data export

### ✅ Alert System
- Trigger alerts programmatically
- Priority levels: low/medium/high/critical
- WebSocket broadcast to connected clients
- Alert acknowledgment tracking

### ✅ Error Handling & Logging
- Request validation with Pydantic
- Comprehensive error responses
- File and console logging
- 30-day log retention

---

## API Endpoints Summary

### Session Management
- `POST /api/sessions/start` - Start new session
- `POST /api/sessions/{id}/end` - End session

### Data Collection
- `POST /api/events` - Receive behavioral events
- `GET /api/sessions/{id}/data` - Get session data

### Alert Triggers
- `POST /api/alerts/trigger` - Trigger alert

### Real-time
- `WS /ws/session/{id}` - WebSocket connection

### Utility
- `GET /` - API information
- `GET /health` - Health check

---

## Testing the API

### 1. Using the Interactive Docs

Visit http://localhost:8000/docs and try the endpoints directly in the browser.

### 2. Using the Example Client

```bash
# Make sure server is running
python server.py

# In another terminal:
python example_client.py
```

### 3. Using cURL

**Start a session:**
```bash
curl -X POST http://localhost:8000/api/sessions/start \
  -H "Content-Type: application/json" \
  -d '{
    "scenario": "L1",
    "condition": 1,
    "participant_id": "P001"
  }'
```

**Trigger an alert:**
```bash
curl -X POST http://localhost:8000/api/alerts/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "session_abc123",
    "alert_type": "fuel_emergency",
    "priority": "critical",
    "message": "Fuel critical"
  }'
```

### 4. Using WebSocket Test Tools

**With wscat:**
```bash
npm install -g wscat
wscat -c ws://localhost:8000/ws/session/session_abc123
```

**With websocat:**
```bash
websocat ws://localhost:8000/ws/session/session_abc123
```

---

## Data Storage

### Session Files
Session data is automatically saved to:
```
backend/data/sessions/{session_id}.json
```

Each file contains:
- Session metadata
- All events and behavioral data
- Alert history
- Performance evaluation
- Scenario state

### Logs
Server logs are stored in:
```
backend/logs/server_{timestamp}.log
```

- **Rotation:** Daily
- **Retention:** 30 days
- **Format:** Structured with timestamps

---

## Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```env
# Server Configuration
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
BACKEND_RELOAD=true

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

### Production Deployment

For production, use multiple workers:

```bash
uvicorn server:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 4 \
  --log-level info
```

Or with Gunicorn:

```bash
gunicorn server:app \
  -w 4 \
  -k uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000
```

---

## Development

### Project Structure

```
backend/api/
├── server.py                 # Main FastAPI server (USE THIS)
├── main.py                   # Original API (deprecated)
├── example_client.py         # Example client
├── API_DOCUMENTATION.md      # Full API docs
└── README.md                 # This file

backend/scenarios/
├── base_scenario.py          # Base scenario class
├── scenario_l1.py            # L1 scenario
├── scenario_l2.py            # L2 scenario
├── scenario_h4.py            # H4 scenario
└── scenario_h5.py            # H5 scenario

backend/data/
└── sessions/                 # Session data files

backend/logs/
└── server_*.log             # Server logs
```

### Adding New Features

1. **New Endpoint:** Add to `server.py` with proper validation
2. **New Data Model:** Add Pydantic model in `server.py`
3. **New Scenario:** Inherit from `BaseScenario` in scenarios/
4. **New Event Type:** Add to WebSocket message handlers

### Code Style

- **Type Hints:** Use Python type hints
- **Docstrings:** Document all functions
- **Validation:** Use Pydantic models
- **Logging:** Log important events

---

## Troubleshooting

### Server won't start
- Check if port 8000 is already in use: `lsof -i :8000`
- Verify all dependencies are installed: `pip install -r requirements.txt`
- Check logs in `backend/logs/`

### WebSocket connection fails
- Ensure session exists before connecting
- Check WebSocket URL format: `ws://host:port/ws/session/{session_id}`
- Verify CORS settings in `.env`

### Session not found
- Session may have expired or been deleted
- Check `backend/data/sessions/` for session files
- Verify session_id is correct

### Data not being saved
- Check write permissions on `backend/data/sessions/`
- Review logs for save errors
- Ensure session was properly started

---

## Next Steps

1. **Frontend Integration:** Connect React frontend to these endpoints
2. **Database:** Replace in-memory storage with PostgreSQL/MongoDB
3. **Authentication:** Add JWT authentication for participants
4. **ML Model:** Integrate ML model predictions
5. **Analytics:** Add real-time performance analytics
6. **Deployment:** Deploy to cloud platform (AWS/GCP/Azure)

---

## Support

- **Documentation:** See `API_DOCUMENTATION.md`
- **Examples:** Run `example_client.py`
- **API Playground:** http://localhost:8000/docs
- **Health Check:** http://localhost:8000/health

---

## License

Part of the ATC Adaptive Alert Research System
