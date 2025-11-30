import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getApiBaseUrl } from '../utils/apiConfig';
import { isAuthenticated, clearToken, getAuthHeaders } from '../services/tokenService';
import ResearcherLogin from './ResearcherLogin';
import './ResearcherDashboard.css';

const API_URL = getApiBaseUrl();

function ResearcherDashboard() {
    const [authenticated, setAuthenticated] = useState(false);
    const [activeSessions, setActiveSessions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        setAuthenticated(isAuthenticated());
    }, []);

    useEffect(() => {
        if (!authenticated) return;

        const fetchActiveSessions = async () => {
            setIsLoading(true);
            setError('');
            try {
                const response = await fetch(`${API_URL}/api/sessions/active`, {
                    headers: getAuthHeaders()
                });
                if (!response.ok) {
                    if (response.status === 401) {
                        setError('Authentication required. Please log in again.');
                        setAuthenticated(false);
                        clearToken();
                        return;
                    }
                    throw new Error('Failed to fetch active sessions.');
                }
                const data = await response.json();
                setActiveSessions(data.sessions);
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchActiveSessions();
        const interval = setInterval(fetchActiveSessions, 5000); // Refresh every 5 seconds
        return () => clearInterval(interval);
    }, [authenticated]);

    const handleLogout = () => {
        clearToken();
        setAuthenticated(false);
    };

    if (!authenticated) {
        return <ResearcherLogin onLoginSuccess={() => setAuthenticated(true)} />;
    }

    if (isLoading) {
        return <div className="dashboard-loading">Loading active sessions...</div>;
    }

    if (error) {
        return <div className="dashboard-error">{error}</div>;
    }

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div>
                    <h1>Researcher Dashboard</h1>
                    <p>Monitor and manage active experiment sessions.</p>
                </div>
                <button onClick={handleLogout} className="logout-button">
                    Log Out
                </button>
            </div>

            {activeSessions.length === 0 ? (
                <p>No active sessions currently running.</p>
            ) : (
                <div className="session-list">
                    {activeSessions.map(session => (
                        <div key={session.session_id} className="session-item">
                            <h3>Session ID: {session.session_id}</h3>
                            <p>Participant: {session.participant_id}</p>
                            <p>Scenario: {session.scenario}</p>
                            <p>Condition: {session.condition}</p>
                            <p>Started At: {new Date(session.started_at).toLocaleString()}</p>
                            <Link to={`/researcher/${session.session_id}`} className="view-button">
                                View Session
                            </Link>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default ResearcherDashboard;
