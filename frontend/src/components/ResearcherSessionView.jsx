import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getApiBaseUrl, buildWebSocketUrl } from '../utils/apiConfig';
import { isAuthenticated, clearToken, getAuthHeaders } from '../services/tokenService';
import useWebSocket from '../hooks/useWebSocket';
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
        const interval = setInterval(fetchSessionDetails, 30000); // Fallback heartbeat every 30 seconds
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
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                    },
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
                    <h3>Session Live Feed (via WebSocket)</h3>
                    <p>WebSocket: {connected ? 'Connected' : 'Disconnected'}</p>
                    <pre className="telemetry-log">
                        {liveScenarioState ? JSON.stringify(liveScenarioState, null, 2) : 'Awaiting session data...'}
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

            {/* Aircraft status panel */}
            <div className="aircraft-panel">
                <h3>Aircraft ({Object.keys(aircraft).length})</h3>
                {Object.keys(aircraft).length > 0 ? (
                    <table className="aircraft-table">
                        <thead>
                            <tr>
                                <th>Callsign</th>
                                <th>Altitude</th>
                                <th>Speed</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(aircraft).map(([callsign, ac]) => (
                                <tr
                                    key={callsign}
                                    className={`${ac.emergency ? 'emergency' : ''} ${ac.comm_status === 'lost' ? 'comm-lost' : ''} ${selectedAircraftCallsign === callsign ? 'selected' : ''}`}
                                    onClick={() => handleAircraftSelect(callsign)}
                                >
                                    <td>{callsign}</td>
                                    <td>FL{ac.altitude || ac.flight_level || 'N/A'}</td>
                                    <td>{ac.speed || ac.ground_speed || 'N/A'} kts</td>
                                    <td>
                                        {ac.emergency ? (
                                            <span className="status-emergency">{ac.emergency_type || 'EMERGENCY'}</span>
                                        ) : ac.comm_status === 'lost' ? (
                                            <span className="status-nordo">NORDO</span>
                                        ) : (
                                            <span className="status-normal">Normal</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="no-data">No aircraft data available</p>
                )}
            </div>

            {/* Active alerts panel */}
            <div className="alerts-panel">
                <h3>Active Alerts ({(liveScenarioState?.active_alerts || []).length})</h3>
                {(liveScenarioState?.active_alerts || []).length > 0 ? (
                    <table className="alerts-table">
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Type</th>
                                <th>Target</th>
                                <th>Priority</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(liveScenarioState?.active_alerts || []).map((alert, index) => (
                                <tr key={alert.alert_id || index} className={`priority-${alert.priority || 'medium'}`}>
                                    <td>T+{(alert.generated_at || alert.elapsed_time || 0).toFixed(0)}s</td>
                                    <td>{alert.type || alert.alert_type || 'Unknown'}</td>
                                    <td>{alert.target || alert.aircraft_id || 'N/A'}</td>
                                    <td className={`priority-badge priority-${alert.priority || 'medium'}`}>
                                        {(alert.priority || 'medium').toUpperCase()}
                                    </td>
                                    <td>
                                        {alert.acknowledged_at ? (
                                            <span className="status-acknowledged">ACK</span>
                                        ) : (
                                            <span className="status-pending">PENDING</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="no-data">No active alerts</p>
                )}
            </div>
        </div>
    );
}

export default ResearcherSessionView;
