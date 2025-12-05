import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getApiBaseUrl } from '../utils/apiConfig';
import './ParticipantLobby.css';

const API_URL = getApiBaseUrl();

function ParticipantLobby() {
    const [participantId, setParticipantId] = useState('');
    const [nextSession, setNextSession] = useState(null);
    const [activeSession, setActiveSession] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Prefill participant ID from URL param (?id=) or localStorage
    useEffect(() => {
        const urlId = searchParams.get('id');
        if (urlId) {
            setParticipantId(urlId);
            localStorage.setItem('participantId', urlId);
        } else {
            const saved = localStorage.getItem('participantId');
            if (saved) {
                setParticipantId(saved);
            }
        }
    }, [searchParams]);

    const saveParticipantId = (value) => {
        setParticipantId(value);
        localStorage.setItem('participantId', value);
    };

    const isResume = useMemo(() => !!(activeSession || (nextSession && nextSession.status === 'resume')), [activeSession, nextSession]);

    const handleFindSession = async () => {
        if (!participantId) {
            setError('Please enter a Participant ID.');
            return;
        }
        setIsLoading(true);
        setError('');
        setNextSession(null);
        setActiveSession(null);
        setInfo('');

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
                if (data.status === 'active_session') {
                    setActiveSession(data.active_session);
                    setInfo('You already have an active session. Resume to continue.');
                } else {
                    setNextSession(data);
                    if (data.status === 'resume') {
                        setInfo('You have a session in progress. Resume to continue.');
                    }
                }
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
        setInfo('');

        try {
            const startRequest = {
                participant_id: nextSession.next_session.participant_id,
                scenario: nextSession.next_session.scenario_id,
                condition: nextSession.next_session.condition,
                queue_id: nextSession.queue_id,
                queue_item_index: nextSession.item_index
            };

            const response = await fetch(`${API_URL}/api/sessions/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(startRequest),
            });

            if (!response.ok) {
                if (response.status === 409) {
                    const detail = await response.json().catch(() => ({}));
                    const existingId = detail?.detail?.active_session_id || detail?.detail?.existing_session_id;
                    if (existingId) {
                        setActiveSession({
                            session_id: existingId,
                            scenario: detail?.detail?.scenario,
                            condition: detail?.detail?.condition
                        });
                        setInfo('You already have an active session. Resume below.');
                        return;
                    }
                }
                throw new Error('Failed to start the session.');
            }

            const sessionData = await response.json();
            
            // Redirect to the experiment page
            const params = new URLSearchParams();
            if (nextSession.queue_id) params.set('queueId', nextSession.queue_id);
            if (nextSession.item_index !== undefined && nextSession.item_index !== null) {
                params.set('itemIndex', nextSession.item_index);
            }
            params.set('returnTo', '/participant');
            navigate(`/session/${sessionData.session_id}?${params.toString()}`);

        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResumeSession = (sessionId) => {
        const params = new URLSearchParams();
        params.set('returnTo', '/participant');
        navigate(`/session/${sessionId}?${params.toString()}`);
    };

    const renderSkeleton = () => (
        <div className="session-panel skeleton">
            <div className="session-meta">
                <div className="pill skeleton-pill"></div>
                <div className="pill skeleton-pill"></div>
            </div>
            <p className="session-desc">Loading your next scenario…</p>
            <div className="skeleton-button"></div>
        </div>
    );

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
                            onChange={(e) => saveParticipantId(e.target.value)}
                            placeholder="e.g., PAX-104"
                            disabled={isLoading || isResume}
                        />
                        <button className="primary-btn" onClick={handleFindSession} disabled={isLoading || isResume}>
                            {isLoading ? 'Searching…' : (isResume ? 'Resume or Cancel' : 'Find Session')}
                        </button>
                    </div>
                </div>

                {error && <div className="banner banner-error">{error}</div>}
                {info && !error && <div className="banner banner-info">{info}</div>}
                {isLoading && !error && <div className="banner banner-info">Checking for your next session…</div>}
                {isLoading && renderSkeleton()}
                {activeSession && !error && (
                    <div className="session-panel">
                        <div className="session-meta">
                            <div className="pill">Active Session</div>
                            <div className="pill">Scenario {activeSession.scenario || '?'}</div>
                            <div className="pill">Condition {activeSession.condition || '?'}</div>
                        </div>
                        <p className="session-desc">You have an ongoing run. Resume to continue.</p>
                        <button className="primary-btn accent" onClick={() => handleResumeSession(activeSession.session_id)} disabled={isLoading}>
                            Resume Session
                        </button>
                    </div>
                )}
                {nextSession && !error && nextSession.status === 'resume' && (
                    <div className="session-panel">
                        <div className="session-meta">
                            <div className="pill">Resume</div>
                            <div className="pill">Scenario {nextSession.next_session?.scenario_id}</div>
                            <div className="pill">Condition {nextSession.next_session?.condition}</div>
                        </div>
                        <p className="session-desc">You previously started this run. Resume to continue.</p>
                        <button className="primary-btn accent" onClick={() => handleResumeSession(nextSession.session_id || nextSession.next_session?.session_id)} disabled={isLoading}>
                            Resume Session
                        </button>
                    </div>
                )}
                {nextSession && !error && nextSession.status !== 'resume' && (
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
