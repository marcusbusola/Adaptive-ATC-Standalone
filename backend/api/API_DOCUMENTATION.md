# ATC Adaptive Alert Research System - API Documentation

## Overview

FastAPI server providing comprehensive session management, real-time WebSocket communication, and data collection for the ATC Adaptive Alert Research System.

**Server Version:** 2.0.0
**Base URL:** `http://localhost:8000`
**Documentation:** `http://localhost:8000/docs` (Swagger UI)
**ReDoc:** `http://localhost:8000/redoc`

---

## Table of Contents

1. [Session Management Endpoints](#session-management-endpoints)
2. [Real-time Event Endpoints](#real-time-event-endpoints)
3. [Data Collection Endpoints](#data-collection-endpoints)
4. [Alert Trigger Endpoints](#alert-trigger-endpoints)
5. [Data Models](#data-models)
6. [Error Handling](#error-handling)
7. [Usage Examples](#usage-examples)

---

## Session Management Endpoints

### 1. Start Session

**Endpoint:** `POST /api/sessions/start`

Start a new research session with specified scenario, condition, and participant.

**Request Body:**
```json
{
  "scenario": "L1",           // L1, L2, H4, or H5
  "condition": 1,             // 1 (Traditional), 2 (Rule-Based), 3 (ML-Based)
  "participant_id": "P001"
}
```

**Response (201 Created):**
```json
{
  "session_id": "session_abc123def456",
  "initial_state": {
    "scenario_id": "L1",
    "metadata": { ... },
    "aircraft": [ ... ],
    "condition": 1,
    "start_time": 1700000000.0
  },
  "scenario_metadata": { ... },
  "websocket_url": "ws://localhost:8000/ws/session/session_abc123def456",
  "created_at": "2024-11-20T10:00:00.000000"
}
```

**Parameters:**
- `scenario`: Scenario type
  - `L1`: Low Complexity, Low Traffic
  - `L2`: Low Complexity, High Traffic
  - `H4`: High Complexity, Low Traffic
  - `H5`: High Complexity, High Traffic
- `condition`: Alert condition type
  - `1`: Traditional Modal alerts
  - `2`: Rule-Based Adaptive alerts
  - `3`: ML-Based Adaptive alerts
- `participant_id`: Unique participant identifier (1-100 characters)

**Error Responses:**
- `400 Bad Request`: Invalid parameters
- `500 Internal Server Error`: Server error

---

### 2. End Session

**Endpoint:** `POST /api/sessions/{session_id}/end`

End an active session and retrieve summary data.

**Request Body (Optional):**
```json
{
  "reason": "completed",      // Optional: completion reason
  "final_state": { ... }      // Optional: final state data
}
```

**Response (200 OK):**
```json
{
  "session_id": "session_abc123def456",
  "summary": {
    "participant_id": "P001",
    "scenario": "L1",
    "condition": 1,
    "duration_seconds": 300.5,
    "total_events": 45,
    "total_alerts": 3,
    "behavioral_events": 1250,
    "performance": {
      "scenario_id": "L1",
      "duration": 300.5,
      "actions_taken": 12,
      "events_triggered": 4,
      "scenario_specific": { ... }
    }
  },
  "ended_at": "2024-11-20T10:05:00.500000"
}
```

**Error Responses:**
- `404 Not Found`: Session not found
- `500 Internal Server Error`: Server error

---

## Real-time Event Endpoints

### WebSocket Connection

**Endpoint:** `WS /ws/session/{session_id}`

Establish bidirectional WebSocket connection for real-time communication.

**Connection URL:**
```
ws://localhost:8000/ws/session/session_abc123def456
```

#### Server → Client Messages

**1. Connection Confirmation**
```json
{
  "type": "connected",
  "session_id": "session_abc123def456",
  "timestamp": "2024-11-20T10:00:00.000000"
}
```

**2. Scenario Event**
```json
{
  "type": "scenario_event",
  "event_type": "aircraft_state_change",
  "timestamp": "2024-11-20T10:01:00.000000",
  "data": {
    "aircraft_id": "AAL123",
    "new_altitude": 15000,
    "new_heading": 270
  }
}
```

**3. Alert**
```json
{
  "type": "alert",
  "timestamp": "2024-11-20T10:02:00.000000",
  "data": {
    "alert_id": "alert_xyz789",
    "alert_type": "fuel_emergency",
    "priority": "critical",
    "message": "AAL123 reports fuel critical",
    "aircraft_id": "AAL123",
    "data": { ... }
  }
}
```

**4. System Message**
```json
{
  "type": "system",
  "message": "Session will end in 60 seconds",
  "timestamp": "2024-11-20T10:04:00.000000"
}
```

#### Client → Server Messages

**1. Behavioral Data**
```json
{
  "type": "behavioral_data",
  "event_type": "mouse_move",
  "timestamp": 1700000060.123,
  "data": {
    "x": 450,
    "y": 300,
    "screen_width": 1920,
    "screen_height": 1080
  }
}
```

**2. User Action**
```json
{
  "type": "action",
  "timestamp": 1700000065.456,
  "data": {
    "action": "clear_aircraft",
    "aircraft_id": "AAL123",
    "command": "direct_to_airport"
  }
}
```

**3. Alert Acknowledgment**
```json
{
  "type": "acknowledgment",
  "timestamp": 1700000062.789,
  "alert_id": "alert_xyz789",
  "data": {
    "response_time_ms": 1234,
    "action_taken": "acknowledged"
  }
}
```

**4. Ping/Pong**
```json
{
  "type": "ping"
}
```

Response:
```json
{
  "type": "pong",
  "timestamp": "2024-11-20T10:00:00.000000"
}
```

---

## Data Collection Endpoints

### 1. Receive Event

**Endpoint:** `POST /api/events`

Receive and store behavioral events from the frontend.

**Request Body:**
```json
{
  "session_id": "session_abc123def456",
  "event_type": "click",
  "timestamp": 1700000060.123,
  "data": {
    "target": "aircraft_AAL123",
    "x": 450,
    "y": 300,
    "button": "left"
  }
}
```

**Response (201 Created):**
```json
{
  "status": "received",
  "session_id": "session_abc123def456",
  "event_type": "click",
  "timestamp": "2024-11-20T10:01:00.123000"
}
```

**Common Event Types:**
- `mouse_move`: Mouse movement tracking
- `click`: Mouse clicks
- `key_press`: Keyboard input
- `scroll`: Scroll events
- `hover`: Element hover events
- `focus`: Focus changes
- `command`: ATC commands issued

**Error Responses:**
- `404 Not Found`: Session not found
- `500 Internal Server Error`: Server error

---

### 2. Get Session Data

**Endpoint:** `GET /api/sessions/{session_id}/data`

Retrieve complete session data for analysis.

**Response (200 OK):**
```json
{
  "session_id": "session_abc123def456",
  "participant_id": "P001",
  "scenario": "L1",
  "condition": 1,
  "start_time": "2024-11-20T10:00:00.000000",
  "end_time": "2024-11-20T10:05:00.500000",
  "events": [
    {
      "event_type": "click",
      "timestamp": 1700000060.123,
      "data": { ... },
      "recorded_at": "2024-11-20T10:01:00.123000"
    }
  ],
  "alerts": [
    {
      "alert_id": "alert_xyz789",
      "alert_type": "fuel_emergency",
      "priority": "critical",
      "message": "...",
      "triggered_at": "2024-11-20T10:02:00.000000"
    }
  ],
  "behavioral_data": [
    {
      "event_type": "mouse_move",
      "timestamp": 1700000055.500,
      "data": { ... },
      "recorded_at": "2024-11-20T10:00:55.500000"
    }
  ],
  "scenario_state": { ... }
}
```

**Error Responses:**
- `404 Not Found`: Session not found
- `500 Internal Server Error`: Server error

---

## Alert Trigger Endpoints

### Trigger Alert

**Endpoint:** `POST /api/alerts/trigger`

Trigger an alert and send to frontend via WebSocket.

**Request Body:**
```json
{
  "session_id": "session_abc123def456",
  "alert_type": "fuel_emergency",
  "priority": "critical",
  "message": "AAL123 reports fuel critical. 15 minutes remaining.",
  "aircraft_id": "AAL123",
  "data": {
    "fuel_remaining_minutes": 15,
    "souls_on_board": 156,
    "requested_action": "immediate_landing"
  }
}
```

**Response (201 Created):**
```json
{
  "status": "triggered",
  "alert_id": "alert_xyz789",
  "session_id": "session_abc123def456",
  "timestamp": "2024-11-20T10:02:00.000000"
}
```

**Priority Levels:**
- `low`: Informational alerts
- `medium`: Standard alerts requiring attention
- `high`: Important alerts requiring prompt action
- `critical`: Emergency alerts requiring immediate action

**Error Responses:**
- `404 Not Found`: Session not found
- `500 Internal Server Error`: Server error

---

## Data Models

### ScenarioType
```python
L1 = "L1"  # Low Complexity, Low Traffic
L2 = "L2"  # Low Complexity, High Traffic
H4 = "H4"  # High Complexity, Low Traffic
H5 = "H5"  # High Complexity, High Traffic
```

### ConditionType
```python
TRADITIONAL = 1  # Traditional Modal alerts
RULE_BASED = 2   # Rule-Based Adaptive alerts
ML_BASED = 3     # ML-Based Adaptive alerts
```

### Session States
- `active`: Session is running
- `completed`: Session ended normally
- `aborted`: Session ended early
- `error`: Session ended due to error

---

## Error Handling

All errors follow a consistent format:

```json
{
  "status": "error",
  "detail": "Error message description",
  "timestamp": "2024-11-20T10:00:00.000000"
}
```

**HTTP Status Codes:**
- `200 OK`: Successful request
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request parameters
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error
- `1008 WebSocket Policy Violation`: Invalid WebSocket connection
- `1011 WebSocket Internal Error`: WebSocket error

---

## Usage Examples

### Python Client Example

```python
import requests
import websocket
import json

# 1. Start a session
response = requests.post(
    "http://localhost:8000/api/sessions/start",
    json={
        "scenario": "L1",
        "condition": 1,
        "participant_id": "P001"
    }
)
session_data = response.json()
session_id = session_data["session_id"]
ws_url = session_data["websocket_url"]

# 2. Connect to WebSocket
ws = websocket.WebSocket()
ws.connect(ws_url)

# 3. Send behavioral data
event = {
    "type": "behavioral_data",
    "event_type": "click",
    "timestamp": time.time(),
    "data": {"x": 100, "y": 200}
}
ws.send(json.dumps(event))

# 4. Receive alerts
message = json.loads(ws.recv())
if message["type"] == "alert":
    print(f"Alert received: {message['data']}")

# 5. End session
response = requests.post(
    f"http://localhost:8000/api/sessions/{session_id}/end",
    json={"reason": "completed"}
)
summary = response.json()
print(f"Session ended: {summary}")
```

### JavaScript Client Example

```javascript
// 1. Start a session
const response = await fetch('http://localhost:8000/api/sessions/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    scenario: 'L1',
    condition: 1,
    participant_id: 'P001'
  })
});
const sessionData = await response.json();
const sessionId = sessionData.session_id;

// 2. Connect to WebSocket
const ws = new WebSocket(sessionData.websocket_url);

ws.onopen = () => {
  console.log('Connected to WebSocket');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'alert') {
    console.log('Alert received:', message.data);
  }
};

// 3. Send behavioral data
function sendEvent(eventType, data) {
  ws.send(JSON.stringify({
    type: 'behavioral_data',
    event_type: eventType,
    timestamp: Date.now() / 1000,
    data: data
  }));
}

// Track mouse movements
document.addEventListener('mousemove', (e) => {
  sendEvent('mouse_move', { x: e.clientX, y: e.clientY });
});

// 4. End session
const endResponse = await fetch(
  `http://localhost:8000/api/sessions/${sessionId}/end`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'completed' })
  }
);
const summary = await endResponse.json();
console.log('Session ended:', summary);
```

---

## Logging

All server activity is logged to:
- **Console:** Real-time logging output
- **File:** `backend/logs/server_{timestamp}.log`

**Log Levels:**
- `INFO`: General information
- `DEBUG`: Detailed debugging information
- `WARNING`: Warning messages
- `ERROR`: Error messages

**Log Retention:** 30 days
**Log Rotation:** Daily

---

## Data Storage

Session data is stored in:
```
backend/data/sessions/{session_id}.json
```

Each session file contains:
- Session metadata
- All events and behavioral data
- Alert history
- Performance evaluation
- Scenario state

---

## Running the Server

### Development Mode
```bash
cd backend/api
python server.py
```

### Production Mode
```bash
uvicorn server:app --host 0.0.0.0 --port 8000 --workers 4
```

### Environment Variables
```bash
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
BACKEND_RELOAD=true
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

---

## Testing

Interactive API documentation available at:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

Test WebSocket connections using tools like:
- [websocat](https://github.com/vi/websocat)
- [wscat](https://github.com/websockets/wscat)
- Browser DevTools

---

## Support

For issues or questions:
1. Check server logs in `backend/logs/`
2. Verify session data in `backend/data/sessions/`
3. Review API documentation at `/docs`
4. Check health endpoint: `GET /health`
