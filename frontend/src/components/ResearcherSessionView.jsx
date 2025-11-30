import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getApiBaseUrl, buildWebSocketUrl } from '../utils/apiConfig';
import { isAuthenticated, clearToken, getAuthHeaders } from '../services/tokenService';
import useWebSocket from '../hooks/useWebSocket';
import useSimulation from '../hooks/useSimulation';
import ResearcherLogin from './ResearcherLogin';
import './ResearcherSessionView.css';

const API_URL = getApiBaseUrl();

function ResearcherSessionView() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const [authenticated, setAuthenticated] = useState(false);
    const [sessionDetails, setSessionDetails] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [aircraft, setAircraft] = useState({});
    const [selectedAircraftCallsign, setSelectedAircraftCallsign] = useState(null);
    const [liveScenarioState, setLiveScenarioState] = useState(null);
    const [wsUrl, setWsUrl] = useState(null);
    const { connected: simConnected, state: simState } = useSimulation();

    useEffect(() => {
        setAuthenticated(isAuthenticated());
    }, []);

    // WebSocket for live monitoring
    const {
        connected,
        sendMessage,
        lastMessage,
        connectionStatus
    } = useWebSocket(sessionId, wsUrl);

    const fetchSessionDetails = useCallback(async () => {
        if (!authenticated) return;

        setIsLoading(true);
        setError('');
        try {
            const response = await fetch(`${API_URL}/api/sessions/${sessionId}`, {
                headers: getAuthHeaders()
            });
            if (!response.ok) {
                if (response.status === 401) {
                    setError('Authentication required. Please log in again.');
                    setAuthenticated(false);
                    clearToken();
                    return;
                }
                throw new Error('Failed to fetch session details.');
            }
            const data = await response.json();
            setSessionDetails(data);
            // Build websocket URL once we know the host
            setWsUrl(buildWebSocketUrl(`/ws/session/${sessionId}`));
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [sessionId, authenticated]);

    useEffect(() => {
        fetchSessionDetails();
        const interval = setInterval(fetchSessionDetails, 5000); // Refresh every 5 seconds
        return () => clearInterval(interval);
    }, [sessionId, fetchSessionDetails]);

    // Listen for websocket messages
    useEffect(() => {
        if (!lastMessage) return;
        if (lastMessage.type === 'scenario_state') {
            setLiveScenarioState(lastMessage.payload);
            setAircraft(lastMessage.payload.aircraft || {});
        }
    }, [lastMessage]);

    // Periodically ask for scenario updates over WebSocket
    useEffect(() => {
        if (!connected) return;
        const interval = setInterval(() => {
            sendMessage({ type: 'scenario_update' });
        }, 2000);
        return () => clearInterval(interval);
    }, [connected, sendMessage]);

    const handleEndSession = async () => {
        if (window.confirm('Are you sure you want to end this session?')) {
            try {
                const response = await fetch(`${API_URL}/api/sessions/${sessionId}/end`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason: 'ended_by_researcher' }),
                });
                if (!response.ok) {
                    throw new Error('Failed to end session.');
                }
                alert('Session ended successfully!');
                navigate('/researcher'); // Go back to dashboard
            } catch (err) {
                setError(err.message);
            }
        }
    };

    const handleAircraftSelect = (callsign) => {
        setSelectedAircraftCallsign(callsign);
    };

    const handleLogout = () => {
        clearToken();
        setAuthenticated(false);
        navigate('/researcher');
    };

    if (!authenticated) {
        return <ResearcherLogin onLoginSuccess={() => setAuthenticated(true)} />;
    }

    if (isLoading) {
        return <div className="researcher-view-loading">Loading session details...</div>;
    }

    if (error) {
        return <div className="researcher-view-error">{error}</div>;
    }

    if (!sessionDetails) {
        return <div className="researcher-view-error">Session not found or ended.</div>;
    }

    const liveElapsed = liveScenarioState?.elapsed_time;
    const liveAircraftCount = liveScenarioState ? Object.keys(liveScenarioState.aircraft || {}).length : null;
    const livePhase = liveScenarioState?.current_phase;
    const livePhaseDesc = liveScenarioState?.phase_description;
    const connectionLabel = connectionStatus ? connectionStatus.toUpperCase() : 'DISCONNECTED';

    return (
        <div className="researcher-session-view-container">
            <div className="researcher-session-header">
                <div>
                    <h1>Monitoring Session: {sessionDetails.session_id}</h1>
                    <p>Participant: {sessionDetails.participant_id} | Scenario: {sessionDetails.scenario} | Condition: {sessionDetails.condition}</p>
                    <p>Live WS: {connectionLabel}</p>
                </div>
                <div className="session-controls">
                    <button onClick={handleEndSession} className="end-session-button">End Session</button>
                    <button onClick={handleLogout} className="logout-button">Log Out</button>
                </div>
            </div>

            <div className="simulation-embed">
                <div className="researcher-live-panel">
                    <h3>Simulation Live Feed</h3>
                    <p>Status: {simConnected ? 'Connected' : 'Disconnected'}</p>
                    <pre className="telemetry-log">
                        {simState ? JSON.stringify(simState, null, 2) : 'Awaiting telemetry...'}
                    </pre>
                </div>
            </div>

            {/* Display session metrics here */}
            <div className="session-metrics">
                <h2>Session Metrics (Live)</h2>
                <p>Elapsed Time: {liveElapsed !== undefined ? liveElapsed.toFixed(1) : (sessionDetails.scenario_state?.elapsed_time || 0)}s</p>
                <p>Aircraft Count: {liveAircraftCount ?? (sessionDetails.scenario_state?.aircraft_count || 0)}</p>
                <p>Phase: {livePhase !== undefined ? livePhase + 1 : (sessionDetails.scenario_state?.current_phase || 0) + 1} - {livePhaseDesc || sessionDetails.scenario_state?.phase_description || 'N/A'}</p>
            </div>
        </div>
    );
}

export default ResearcherSessionView;
