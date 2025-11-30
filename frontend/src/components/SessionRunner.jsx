import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

// Components
import InstructionsScreen from './InstructionsScreen';
import ScenarioView from './ScenarioView';
import SurveyScreen from './SurveyScreen';
import DebugPanel from './DebugPanel';

// Services
import { endSession } from '../services/api';
import useWebSocket from '../hooks/useWebSocket';
import useBehavioralTracking from '../hooks/useBehavioralTracking';
import { getApiBaseUrl, buildWebSocketUrl } from '../utils/apiConfig';

const API_URL = getApiBaseUrl();

// Session phases
const PHASES = {
  LOADING: 'loading',
  INSTRUCTIONS: 'instructions',
  SCENARIO: 'scenario',
  SURVEY: 'survey',
  COMPLETE: 'complete'
};

const SessionRunner = () => {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Get return URL and queue context from URL params
  const returnTo = searchParams.get('returnTo');
  const queueId = searchParams.get('queueId');
  const itemIndex = searchParams.get('itemIndex');

  // ========== Session State ==========
  const [phase, setPhase] = useState(PHASES.LOADING);
  const [sessionConfig, setSessionConfig] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [websocketUrl, setWebsocketUrl] = useState(null);

  // ========== UI State ==========
  const [alerts, setAlerts] = useState([]);
  const [scenarioState, setScenarioState] = useState({
    elapsed_time: 0,
    aircraft_count: 0,
    active_alerts: 0,
    events: []
  });
  const [debugMode, setDebugMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ========== Refs ==========
  const scenarioStartTime = useRef(null);

  // ========== WebSocket Connection ==========
  const {
    connected,
    sendMessage,
    lastMessage,
    connectionStatus
  } = useWebSocket(sessionId, websocketUrl);

  // ========== Behavioral Tracking ==========
  const {
    startTracking,
    stopTracking,
    trackingActive,
    getTrackedEvents
  } = useBehavioralTracking(sessionId);

  // Load session data on mount
  useEffect(() => {
    const loadSession = async () => {
      if (!sessionId) {
        setError('No session ID provided');
        return;
      }

      try {
        const response = await axios.get(`${API_URL}/api/sessions/${sessionId}/data`);

        if (response.data) {
          setSessionData(response.data);
          setSessionConfig({
            participantId: response.data.participant_id,
            scenario: response.data.scenario,
            condition: response.data.condition
          });

          // Construct WebSocket URL from configured API host/protocol
          setWebsocketUrl(buildWebSocketUrl(`/ws/session/${sessionId}`));

          setPhase(PHASES.INSTRUCTIONS);
        }
      } catch (err) {
        console.error('Failed to load session:', err);
        setError('Failed to load session data');
      }
    };

    loadSession();
  }, [sessionId]);

  // ========== Session Management ==========

  const handleEndSession = useCallback(async (reason = 'completed') => {
    setLoading(true);

    try {
      // Stop behavioral tracking
      if (trackingActive) {
        stopTracking();
      }

      // End session on backend
      const response = await endSession(sessionId, {
        reason,
        final_state: {
          elapsed_time: scenarioState.elapsed_time,
          total_alerts: alerts.length,
          tracked_events: getTrackedEvents().length
        }
      });

      console.log('Session ended:', response);

      // If part of a queue, mark queue item as completed
      if (queueId && itemIndex !== null) {
        try {
          await axios.post(
            `${API_URL}/api/queues/${queueId}/items/${itemIndex}/complete`,
            { results: response.summary }
          );
          console.log('Queue item marked as completed');
        } catch (err) {
          console.error('Failed to update queue status:', err);
        }
      }

      // Move to survey phase
      setPhase(PHASES.SURVEY);
      setLoading(false);

    } catch (err) {
      console.error('Failed to end session:', err);
      setError(err.message || 'Failed to end session');
      setLoading(false);
    }
  }, [sessionId, trackingActive, stopTracking, alerts, scenarioState, getTrackedEvents, queueId, itemIndex]);

  const handleSurveyComplete = useCallback(() => {
    setPhase(PHASES.COMPLETE);

    // Return to queue or home after short delay
    setTimeout(() => {
      if (returnTo) {
        window.location.href = returnTo;
      } else {
        navigate('/');
      }
    }, 2000);
  }, [returnTo, navigate]);

  const handleStartScenario = useCallback(() => {
    setPhase(PHASES.SCENARIO);
    scenarioStartTime.current = Date.now();
    startTracking();
  }, [startTracking]);

  // ========== WebSocket Message Handler ==========
  useEffect(() => {
    if (!lastMessage) return;

    const message = lastMessage;
    const payload = message?.payload ?? message?.data ?? message;

    // Handle different message types
    if (message.type === 'scenario_state') {
      setScenarioState(payload);
    } else if (message.type === 'alert') {
      setAlerts(prev => [...prev, payload]);
    } else if (message.type === 'alert_acknowledged') {
      setAlerts(prev => prev.filter(a => a.alert_id !== payload.alert_id));
    }
  }, [lastMessage]);

  // ========== Keyboard Shortcuts ==========
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ctrl+Shift+D to toggle debug mode
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setDebugMode(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // ========== Alert Management ==========
  const addAlert = useCallback((alertData) => {
    setAlerts(prev => [...prev, alertData]);
  }, []);

  const removeAlert = useCallback((alertId) => {
    setAlerts(prev => prev.filter(a => a.alert_id !== alertId));
  }, []);

  // ========== Rendering ==========

  const renderPhase = () => {
    if (phase === PHASES.LOADING) {
      return (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading-text">Loading session...</div>
        </div>
      );
    }

    if (phase === PHASES.INSTRUCTIONS) {
      return (
        <InstructionsScreen
          scenarioInfo={sessionData?.scenario_metadata || {}}
          participantId={sessionConfig?.participantId}
          onStart={handleStartScenario}
        />
      );
    }

    if (phase === PHASES.SCENARIO) {
      return (
        <ScenarioView
          sessionId={sessionId}
          sessionConfig={sessionConfig}
          scenarioState={scenarioState}
          alerts={alerts}
          onAlertAcknowledge={removeAlert}
          onEndScenario={() => handleEndSession('completed')}
          sendMessage={sendMessage}
        />
      );
    }

    if (phase === PHASES.SURVEY) {
      return (
        <SurveyScreen
          sessionId={sessionId}
          sessionConfig={sessionConfig}
          onComplete={handleSurveyComplete}
        />
      );
    }

    if (phase === PHASES.COMPLETE) {
      return (
        <div className="completion-screen">
          <h1>Session Complete!</h1>
          <p>Thank you for participating.</p>
          {returnTo && <p>Returning to queue...</p>}
          {!returnTo && <p>Returning to home...</p>}
        </div>
      );
    }
  };

  return (
    <div className="session-runner">
      {/* Connection Status Indicator */}
      {phase === PHASES.SCENARIO && (
        <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
          <span className="status-dot"></span>
          <span className="status-text">
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      )}

      {/* Main Content */}
      <main className="session-main">
        {renderPhase()}
      </main>

      {/* Debug Panel (Ctrl+Shift+D to toggle) */}
      {debugMode && phase === PHASES.SCENARIO && (
        <DebugPanel
          sessionId={sessionId}
          sessionConfig={sessionConfig}
          scenarioState={scenarioState}
          alerts={alerts}
          trackingActive={trackingActive}
          wsConnected={connected}
          wsStatus={connectionStatus}
          onClose={() => setDebugMode(false)}
          onTriggerAlert={(alertData) => addAlert(alertData)}
          onEndSession={() => handleEndSession('debug')}
        />
      )}

      {/* Global Error Display */}
      {error && (
        <div className="error-banner">
          <span className="error-message">{error}</span>
          <button
            className="error-close"
            onClick={() => setError(null)}
          >
            &times;
          </button>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <div className="loading-text">Loading...</div>
        </div>
      )}
    </div>
  );
};

export default SessionRunner;
