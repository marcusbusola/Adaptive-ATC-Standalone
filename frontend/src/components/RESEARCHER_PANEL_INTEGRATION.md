# Researcher Panel Integration Guide

## Overview
The ResearcherPanel component provides a comprehensive interface for non-technical researchers to manage research sessions.

## Features

### 1. Session Setup Tab
- Select scenario (L1, L2, H4, H5)
- Select condition (1: Traditional, 2: Adaptive, 3: ML)
- Enter participant ID
- Start session button

### 2. Session Monitoring Tab
- Real-time session information
- Elapsed timer (T+0:00 format)
- Current phase indicator
- Alert log table (last 20 alerts)
- Event log table (last 20 events)

### 3. Manual Controls Tab
- Pause/Resume session
- Skip to next phase (testing)
- Emergency stop button

### 4. Data Export Tab
- Quick metrics display
- Export session data as JSON
- Summary statistics

## Integration with App.jsx

```javascript
import React, { useState } from 'react';
import ResearcherPanel from './components/ResearcherPanel';
import ScenarioView from './components/ScenarioView';

function App() {
  const [showResearcherPanel, setShowResearcherPanel] = useState(true);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [sessionConfig, setSessionConfig] = useState({});
  const [sessionData, setSessionData] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [currentPhase, setCurrentPhase] = useState('setup');
  const [alerts, setAlerts] = useState([]);
  const [events, setEvents] = useState([]);
  const [scenarioState, setScenarioState] = useState({
    elapsed_time: 0,
    aircraft_count: 0
  });

  const handleStartSession = async (config) => {
    // Start session API call
    const response = await startSession({
      scenario: config.scenario,
      condition: config.condition,
      participant_id: config.participantId
    });

    setSessionId(response.session_id);
    setSessionData(response);
    setSessionConfig(config);
    setSessionActive(true);
    setCurrentPhase('instructions');
  };

  const handlePauseSession = () => {
    setIsPaused(true);
    // Pause tracking, timer, etc.
  };

  const handleResumeSession = () => {
    setIsPaused(false);
    // Resume tracking, timer, etc.
  };

  const handleStopSession = async () => {
    // End session API call
    await endSession(sessionId, { reason: 'emergency_stop' });
    setSessionActive(false);
    setCurrentPhase('complete');
  };

  const handleSkipPhase = () => {
    // Skip to next phase logic
    const phases = ['setup', 'instructions', 'scenario', 'survey', 'complete'];
    const currentIndex = phases.indexOf(currentPhase);
    if (currentIndex < phases.length - 1) {
      setCurrentPhase(phases[currentIndex + 1]);
    }
  };

  return (
    <div className="app">
      {showResearcherPanel ? (
        <ResearcherPanel
          sessionActive={sessionActive}
          sessionId={sessionId}
          sessionConfig={sessionConfig}
          sessionData={sessionData}
          scenarioState={scenarioState}
          alerts={alerts}
          events={events}
          onStartSession={handleStartSession}
          onPauseSession={handlePauseSession}
          onResumeSession={handleResumeSession}
          onStopSession={handleStopSession}
          onSkipPhase={handleSkipPhase}
          isPaused={isPaused}
          currentPhase={currentPhase}
        />
      ) : (
        <ScenarioView
          // ... scenario view props
        />
      )}
    </div>
  );
}
```

## API Service Requirements

Add this function to `src/services/api.js`:

```javascript
export const exportSessionData = async (sessionId) => {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/export`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to export session data');
  }

  return await response.json();
};
```

## Backend Endpoint Required

Add this endpoint to your FastAPI backend:

```python
@app.get("/api/sessions/{session_id}/export")
async def export_session_data(session_id: str):
    """Export complete session data for analysis"""
    db = DatabaseManager()
    
    # Get session summary
    session = db.get_session_summary(session_id)
    
    # Get all alerts
    alerts = db.get_alerts_by_session(session_id)
    
    # Get all behavioral events
    events = db.get_behavioral_events(session_id)
    
    # Get metrics
    metrics = db.get_session_metrics(session_id)
    
    return {
        "session": session,
        "alerts": alerts,
        "events": events,
        "metrics": metrics,
        "exported_at": datetime.utcnow().isoformat()
    }
```

## Usage Tips for Researchers

1. **Starting a Session**
   - Fill in Participant ID (must be unique)
   - Select appropriate scenario based on participant assignment
   - Select experimental condition
   - Click "START SESSION"
   - Panel automatically switches to Monitor tab

2. **Monitoring a Session**
   - Watch the timer to track session duration
   - Monitor alerts as they appear in real-time
   - Check event log for participant interactions
   - Current phase shows progress through session

3. **Using Controls**
   - Use Pause if participant needs a break
   - Emergency Stop if technical issues occur
   - Skip Phase only for testing/debugging

4. **Exporting Data**
   - Wait until session is complete
   - Go to Export tab
   - Review quick metrics
   - Click "Export Session Data"
   - JSON file downloads automatically

## Keyboard Shortcuts

- `Ctrl+R` - Toggle Researcher Panel (add this feature if needed)
- `Ctrl+Shift+D` - Open Debug Panel (from DebugPanel component)

## Notes

- The panel is designed for researchers without technical background
- All actions have confirmation dialogs to prevent mistakes
- Data exports include complete session data for offline analysis
- The interface automatically updates in real-time during sessions
