import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '../utils/apiConfig';
import './ParticipantLobby.css';

const API_URL = getApiBaseUrl();

function ParticipantLobby() {
    const [participantId, setParticipantId] = useState('');
    const [nextSession, setNextSession] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleFindSession = async () => {
        if (!participantId) {
            setError('Please enter a Participant ID.');
            return;
        }
        setIsLoading(true);
        setError('');
        setNextSession(null);

        try {
            const response = await fetch(`${API_URL}/api/participants/${participantId}/next-session`);
            if (!response.ok) {
                if (response.status === 404) {
                    setError('No pending sessions found for this ID.');
                } else {
                    throw new Error('Failed to fetch session information.');
                }
            } else {
                const data = await response.json();
                setNextSession(data);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartSession = async () => {
        if (!nextSession) return;

        setIsLoading(true);
        setError('');

        try {
            const startRequest = {
                participant_id: nextSession.next_session.participant_id,
                scenario: nextSession.next_session.scenario_id,
                condition: nextSession.next_session.condition,
            };

            const response = await fetch(`${API_URL}/api/sessions/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(startRequest),
            });

            if (!response.ok) {
                throw new Error('Failed to start the session.');
            }

            const sessionData = await response.json();
            
            // Redirect to the experiment page
            navigate(`/session/${sessionData.session_id}`);

        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="lobby-shell">
            <div className="lobby-gradient"></div>
            <div className="lobby-card">
                <div className="lobby-header">
                    <p className="eyebrow">Adaptive Alert Study</p>
                    <h1>Welcome, Controller</h1>
                    <p className="lede">Sign in with your Participant ID to load your assigned scenario and alert condition.</p>
                </div>

                <div className="input-stack">
                    <label htmlFor="participant-id">Participant ID</label>
                    <div className="input-row">
                        <input
                            id="participant-id"
                            type="text"
                            value={participantId}
                            onChange={(e) => setParticipantId(e.target.value)}
                            placeholder="e.g., PAX-104"
                            disabled={isLoading}
                        />
                        <button className="primary-btn" onClick={handleFindSession} disabled={isLoading}>
                            {isLoading ? 'Searching…' : 'Find Session'}
                        </button>
                    </div>
                </div>

                {error && <div className="banner banner-error">{error}</div>}
                {isLoading && !error && <div className="banner banner-info">Checking for your next session…</div>}
                {nextSession && !error && (
                    <div className="session-panel">
                        <div className="session-meta">
                            <div className="pill">Scenario {nextSession.next_session.scenario_id}</div>
                            <div className="pill">Condition {nextSession.next_session.condition}</div>
                        </div>
                        <p className="session-desc">We’ll launch your 6-minute run with the assigned alert condition. Make sure audio is on.</p>
                        <button className="primary-btn accent" onClick={handleStartSession} disabled={isLoading}>
                            {isLoading ? 'Starting…' : 'Start Session'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ParticipantLobby;
