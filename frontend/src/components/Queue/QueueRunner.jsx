import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '../../utils/apiConfig';
import { getAuthHeaders } from '../../services/tokenService';
import './QueueRunner.css';

const API_URL = getApiBaseUrl();

const QueueRunner = ({ queueId, onSessionStart, onQueueComplete }) => {
  const [queue, setQueue] = useState(null);
  const [currentItem, setCurrentItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [activeSessions, setActiveSessions] = useState([]);
  const [sessionActionError, setSessionActionError] = useState('');
  const navigate = useNavigate();

  // Load queue data
  const loadQueue = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/queues/${queueId}`, {
        headers: getAuthHeaders()
      });
      if (response.data.status === 'success') {
        setQueue(response.data.queue);
        setError(null);
      }
    } catch (err) {
      console.error('Error loading queue:', err);
      setError(err.response?.data?.detail || 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  }, [queueId]);

  // Get next pending item
  const loadNextItem = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/queues/${queueId}/next`, {
        headers: getAuthHeaders()
      });
      if (response.data.status === 'success') {
        setCurrentItem(response.data.item);
        return response.data.item;
      }
      return null;
    } catch (err) {
      console.error('Error loading next item:', err);
      setError(err.response?.data?.detail || 'Failed to load next item');
      return null;
    }
  }, [queueId]);

  // Initial load
  useEffect(() => {
    loadQueue();
    loadNextItem();
  }, [loadQueue, loadNextItem]);

  // Poll for queue updates every 5 seconds when session active
  useEffect(() => {
    if (!sessionActive) return;

    const interval = setInterval(() => {
      loadQueue();
    }, 5000);

    return () => clearInterval(interval);
  }, [sessionActive, loadQueue]);

  // Load active sessions for researcher consolidation
  const loadActiveSessions = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/sessions/active`, {
        headers: getAuthHeaders()
      });
      if (response.data?.sessions) {
        setActiveSessions(response.data.sessions);
      }
    } catch (err) {
      console.error('Error loading active sessions:', err);
    }
  }, []);

  useEffect(() => {
    loadActiveSessions();
    const interval = setInterval(loadActiveSessions, 5000);
    return () => clearInterval(interval);
  }, [loadActiveSessions]);

  // Start the next session
  const handleStartNext = async () => {
    if (!currentItem) {
      setError('No pending items in queue');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Find item index
      const itemIndex = queue.items.findIndex(
        item => item.scenario_id === currentItem.scenario_id &&
                item.condition === currentItem.condition &&
                item.status === 'pending'
      );

      if (itemIndex === -1) {
        throw new Error('Could not find pending item in queue');
      }

      // Start backend session with queue context
      const sessionResponse = await axios.post(`${API_URL}/api/sessions/start`, {
        scenario: currentItem.scenario_id,
        condition: currentItem.condition,
        participant_id: currentItem.participant_id,
        queue_id: queueId,
        queue_item_index: itemIndex
      });

      console.log('Session started:', sessionResponse.data);

      const createdSessionId = sessionResponse.data?.session_id;
      if (!createdSessionId) {
        throw new Error('Backend did not return a session_id');
      }

      // Update local state
      setSessionId(createdSessionId);
      setSessionActive(true);

      // Notify parent component
      if (onSessionStart) {
        onSessionStart({
          sessionId: createdSessionId,
          scenarioId: currentItem.scenario_id,
          condition: currentItem.condition,
          participantId: currentItem.participant_id,
          queueId: queueId,
          itemIndex: itemIndex
        });
      }

      // Construct return URL
      const returnUrl = `/queue/${queueId}`;

      // Navigate to session route with return URL and queue context
      window.location.href = `/session/${createdSessionId}?returnTo=${encodeURIComponent(returnUrl)}&queueId=${queueId}&itemIndex=${itemIndex}`;

    } catch (err) {
      console.error('Error starting session:', err);
      if (err.response?.status === 409) {
        const detail = err.response?.data?.detail;
        const existingSessionId = detail?.active_session_id || detail?.existing_session_id;
        if (existingSessionId) {
          setError('Participant already has an active session. Resume below.');
          setSessionId(existingSessionId);
          setSessionActive(true);
          return;
        }
      }
      setError(err.response?.data?.detail || 'Failed to start session');
      setLoading(false);
    }
  };

  const handleEndSession = async (id) => {
    setSessionActionError('');
    try {
      await axios.post(`${API_URL}/api/sessions/${id}/end`, {
        reason: 'ended_by_researcher'
      });
      // Refresh lists
      await Promise.all([loadActiveSessions(), loadQueue()]);
      if (sessionId === id) {
        setSessionActive(false);
        setSessionId(null);
      }
    } catch (err) {
      console.error('Failed to end session:', err);
      setSessionActionError('Failed to end session. Please try again.');
    }
  };

  const handleViewSession = (id) => {
    navigate(`/researcher/${id}`);
  };

  // Complete current session
  const handleSessionComplete = async (results) => {
    if (!sessionActive || !currentItem) return;

    setLoading(true);

    try {
      const itemIndex = queue.items.findIndex(
        item => item.session_id === sessionId
      );

      if (itemIndex === -1) {
        throw new Error('Could not find active item in queue');
      }

      // Mark as completed in backend
      await axios.post(`${API_URL}/api/queues/${queueId}/items/${itemIndex}/complete`, {
        results: results
      }, {
        headers: getAuthHeaders()
      });

      setSessionActive(false);
      setSessionId(null);

      // Reload queue
      await loadQueue();

      // Load next item
      const nextItem = await loadNextItem();

      // Check if queue is complete
      if (!nextItem) {
        if (onQueueComplete) {
          onQueueComplete(queue);
        }
      } else if (autoAdvance) {
        // Auto-advance to next session
        setTimeout(() => handleStartNext(), 2000);
      }

    } catch (err) {
      console.error('Error completing session:', err);
      setError(err.response?.data?.detail || 'Failed to complete session');
    } finally {
      setLoading(false);
    }
  };

  // Mark session as error
  const handleSessionError = async (errorMessage) => {
    if (!sessionActive || !currentItem) return;

    setLoading(true);

    try {
      const itemIndex = queue.items.findIndex(
        item => item.session_id === sessionId
      );

      if (itemIndex !== -1) {
        await axios.post(`${API_URL}/api/queues/${queueId}/items/${itemIndex}/error`, {
          error_message: errorMessage
        }, {
          headers: getAuthHeaders()
        });
      }

      setSessionActive(false);
      setSessionId(null);

      await loadQueue();
      await loadNextItem();

    } catch (err) {
      console.error('Error marking session error:', err);
      setError(err.response?.data?.detail || 'Failed to mark session error');
    } finally {
      setLoading(false);
    }
  };

  // Expose methods to parent via ref or callback
  useEffect(() => {
    // Provide completion handler to parent
    window.queueRunnerComplete = handleSessionComplete;
    window.queueRunnerError = handleSessionError;

    return () => {
      delete window.queueRunnerComplete;
      delete window.queueRunnerError;
    };
  }, [handleSessionComplete, handleSessionError]);

  if (loading && !queue) {
    return (
      <div className="queue-runner">
        <div className="loading">Loading queue...</div>
      </div>
    );
  }

  if (error && !queue) {
    return (
      <div className="queue-runner">
        <div className="error-message">
          {error}
        </div>
      </div>
    );
  }

  if (!queue) {
    return null;
  }

  const progress = queue.progress || {
    total: 0,
    completed: 0,
    in_progress: 0,
    pending: 0,
    errors: 0,
    percentage: 0
  };

  const isComplete = progress.pending === 0 && progress.in_progress === 0;

  return (
    <div className="queue-runner">
      <div className="queue-runner-header">
        <h2>Queue: {queue.participant_id}</h2>
        <span className={`queue-status ${queue.status}`}>{queue.status}</span>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      {sessionActionError && (
        <div className="error-message">
          {sessionActionError}
        </div>
      )}

      {/* Progress Bar */}
      <div className="progress-section">
        <div className="progress-bar-container">
          <div
            className="progress-bar-fill"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
        <div className="progress-text">
          {progress.completed} of {progress.total} sessions completed ({progress.percentage.toFixed(0)}%)
        </div>
      </div>

      {/* Progress Stats */}
      <div className="progress-stats">
        <div className="stat completed">
          <div className="stat-value">{progress.completed}</div>
          <div className="stat-label">Completed</div>
        </div>
        <div className="stat in-progress">
          <div className="stat-value">{progress.in_progress}</div>
          <div className="stat-label">In Progress</div>
        </div>
        <div className="stat pending">
          <div className="stat-value">{progress.pending}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat errors">
          <div className="stat-value">{progress.errors}</div>
          <div className="stat-label">Errors</div>
        </div>
      </div>

      {/* Current Session */}
      {currentItem && !isComplete && (
        <div className="current-session">
          <h3>Current Session</h3>
          <div className="session-details">
            <div className="detail-row">
              <span className="detail-label">Scenario:</span>
              <span className="detail-value">{currentItem.scenario_id}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Condition:</span>
              <span className="detail-value">Condition {currentItem.condition}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Status:</span>
              <span className={`status-badge ${currentItem.status}`}>
                {currentItem.status.replace('_', ' ')}
              </span>
            </div>
            {currentItem.status === 'in_progress' && currentItem.session_id && (
              <div className="detail-row">
                <span className="detail-label">Active Session:</span>
                <button className="link-button" onClick={() => navigate(`/session/${currentItem.session_id}?returnTo=/queue/${queueId}`)}>
                  Resume {currentItem.session_id}
                </button>
              </div>
            )}
          </div>

          {sessionActive && (
            <div className="session-active-indicator">
              <div className="pulse-dot" />
              <span>Session in progress...</span>
            </div>
          )}
        </div>
      )}

      {/* Queue Complete */}
      {isComplete && (
        <div className="queue-complete">
          <h3>Queue Complete!</h3>
          <p>All {progress.total} sessions have been completed.</p>
          {progress.errors > 0 && (
            <p className="error-note">
              Note: {progress.errors} session{progress.errors !== 1 ? 's' : ''} had errors.
            </p>
          )}
        </div>
      )}

      {/* Controls */}
      {!isComplete && (
        <div className="queue-controls">
          <div className="control-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={autoAdvance}
                onChange={(e) => setAutoAdvance(e.target.checked)}
                disabled={sessionActive}
              />
              <span>Auto-advance to next session</span>
            </label>
          </div>

          <button
            className="btn-start-next"
            onClick={handleStartNext}
            disabled={loading || sessionActive || !currentItem}
          >
            {loading ? 'Starting...' : sessionActive ? 'Session Active' : 'Start Next Session'}
          </button>
        </div>
      )}

      {/* Session List */}
      <div className="session-list">
        <h3>All Sessions</h3>
        <div className="session-items">
          {queue.items.map((item, index) => (
            <div
              key={index}
              className={`session-item ${item.status} ${item.session_id === sessionId ? 'active' : ''}`}
            >
              <div className="session-number">{index + 1}</div>
              <div className="session-info">
                <div className="session-name">
                  {item.scenario_id} - Condition {item.condition}
                </div>
                {item.duration_seconds && (
                  <div className="session-duration">
                    Duration: {(item.duration_seconds / 60).toFixed(1)} min
                  </div>
                )}
                {item.error_message && (
                  <div className="session-error">{item.error_message}</div>
                )}
              </div>
              <div className={`session-status ${item.status}`}>
                {item.status === 'completed' && 'Done'}
                {item.status === 'in_progress' && 'Running'}
                {item.status === 'pending' && 'Pending'}
                {item.status === 'error' && 'Error'}
              </div>
            </div>
            ))}
        </div>
      </div>

      <div className="active-sessions-card">
        <div className="active-sessions-header">
          <h3>Live Sessions</h3>
          <span className="pill">{activeSessions.length}</span>
        </div>
        {activeSessions.length === 0 ? (
          <p className="muted">No active sessions right now.</p>
        ) : (
          <div className="active-session-grid">
            {activeSessions.map((session) => (
              <div key={session.session_id} className="active-session-item">
                <div className="active-session-meta">
                  <p className="id">Session {session.session_id}</p>
                  <p className="participant">Participant: {session.participant_id}</p>
                  <p>Scenario: {session.scenario} • Condition: {session.condition}</p>
                  <p className="muted">Started: {new Date(session.started_at).toLocaleString()}</p>
                </div>
                <div className="active-session-actions">
                  <button className="ghost-btn" onClick={() => handleViewSession(session.session_id)}>View</button>
                  <button className="danger-btn" onClick={() => handleEndSession(session.session_id)}>End</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QueueRunner;
