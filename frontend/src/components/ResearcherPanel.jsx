import React, { useState, useEffect } from 'react';
import { fetchConditions, fetchScenarios, exportSessionData } from '../services/api';
import '../styles/researcher-panel.css';

/**
 * Comprehensive Researcher Panel
 *
 * Provides session setup, monitoring, controls, and data export
 * for non-technical researchers running the study
 */
const ResearcherPanel = ({
  sessionActive,
  sessionId,
  sessionConfig,
  sessionData,
  scenarioState,
  alerts,
  events,
  onStartSession,
  onPauseSession,
  onResumeSession,
  onStopSession,
  onSkipPhase,
  isPaused,
  currentPhase
}) => {
  // Setup State
  const [scenarios, setScenarios] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [setupForm, setSetupForm] = useState({
    participantId: '',
    scenario: '',
    condition: null
  });
  const [setupErrors, setSetupErrors] = useState({});

  // UI State
  const [activeTab, setActiveTab] = useState('setup'); // setup, monitor, controls, export
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // Metrics State
  const [metrics, setMetrics] = useState({
    avgResponseTime: 0,
    alertCount: 0,
    eventsCount: 0,
    fixationRatio: 0
  });

  // Load scenarios and conditions on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  // Auto-switch to monitor tab when session starts
  useEffect(() => {
    if (sessionActive && activeTab === 'setup') {
      setActiveTab('monitor');
    }
  }, [sessionActive]);

  // Calculate metrics when data changes
  useEffect(() => {
    if (sessionActive) {
      calculateMetrics();
    }
  }, [alerts, events, sessionActive]);

  const loadInitialData = async () => {
    try {
      const [scenariosData, conditionsData] = await Promise.all([
        fetchScenarios(),
        fetchConditions()
      ]);
      setScenarios(scenariosData);
      setConditions(conditionsData);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  const calculateMetrics = () => {
    // Calculate average response time
    const acknowledgedAlerts = alerts.filter(a => a.response_time_ms);
    const avgResponseTime = acknowledgedAlerts.length > 0
      ? acknowledgedAlerts.reduce((sum, a) => sum + a.response_time_ms, 0) / acknowledgedAlerts.length
      : 0;

    // Calculate fixation ratio (example: mouse movements vs clicks)
    const mouseMoves = events.filter(e => e.event_type === 'mouse_move').length;
    const clicks = events.filter(e => e.event_type === 'click').length;
    const fixationRatio = clicks > 0 ? mouseMoves / clicks : 0;

    setMetrics({
      avgResponseTime: Math.round(avgResponseTime),
      alertCount: alerts.length,
      eventsCount: events.length,
      fixationRatio: fixationRatio.toFixed(2)
    });
  };

  const validateSetup = () => {
    const errors = {};

    if (!setupForm.participantId.trim()) {
      errors.participantId = 'Participant ID is required';
    } else if (setupForm.participantId.length < 3) {
      errors.participantId = 'Participant ID must be at least 3 characters';
    }

    if (!setupForm.scenario) {
      errors.scenario = 'Please select a scenario';
    }

    if (setupForm.condition === null) {
      errors.condition = 'Please select a condition';
    }

    setSetupErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleStartSession = async () => {
    if (!validateSetup()) return;

    setLoading(true);
    try {
      await onStartSession({
        participantId: setupForm.participantId.trim(),
        scenario: setupForm.scenario,
        condition: setupForm.condition
      });
      setActiveTab('monitor');
    } catch (err) {
      console.error('Failed to start session:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    setExportLoading(true);
    try {
      const data = await exportSessionData(sessionId);

      // Create download link
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session_${sessionId}_${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export data:', err);
      alert('Failed to export session data');
    } finally {
      setExportLoading(false);
    }
  };

  const formatTime = (seconds) => {
    if (seconds === undefined || seconds === null || isNaN(seconds)) {
      return 'T+0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `T+${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const getPhaseLabel = (phase) => {
    const phaseLabels = {
      setup: 'Phase 0: Setup',
      instructions: 'Phase 1: Instructions',
      scenario: 'Phase 2: Scenario Active',
      survey: 'Phase 3: Post-Survey',
      complete: 'Phase 4: Complete'
    };
    return phaseLabels[phase] || 'Unknown Phase';
  };

  const getConditionLabel = (conditionId) => {
    const labels = {
      1: 'Traditional Modal',
      2: 'Rule-Based Adaptive',
      3: 'ML-Based Predictive'
    };
    return labels[conditionId] || 'Unknown';
  };

  // ============ RENDER SECTIONS ============

  const renderSetupTab = () => (
    <div className="tab-content">
      <h2>Session Setup</h2>
      <p className="section-description">
        Configure and start a new research session
      </p>

      <div className="setup-form">
        {/* Participant ID */}
        <div className="form-field">
          <label htmlFor="participant-id">
            Participant ID <span className="required">*</span>
          </label>
          <input
            id="participant-id"
            type="text"
            value={setupForm.participantId}
            onChange={(e) => setSetupForm({ ...setupForm, participantId: e.target.value })}
            placeholder="e.g., P001, PART_001"
            disabled={sessionActive}
            className={setupErrors.participantId ? 'error' : ''}
          />
          {setupErrors.participantId && (
            <span className="error-text">{setupErrors.participantId}</span>
          )}
          <span className="help-text">Unique identifier for this participant</span>
        </div>

        {/* Scenario Selection */}
        <div className="form-field">
          <label htmlFor="scenario">
            Scenario <span className="required">*</span>
          </label>
          <select
            id="scenario"
            value={setupForm.scenario}
            onChange={(e) => setSetupForm({ ...setupForm, scenario: e.target.value })}
            disabled={sessionActive}
            className={setupErrors.scenario ? 'error' : ''}
          >
            <option value="">-- Select Scenario --</option>
            {scenarios.map((scenario) => (
              <option key={scenario.scenario_id} value={scenario.scenario_id}>
                {scenario.scenario_id}: {scenario.name} ({scenario.complexity} complexity, {scenario.aircraft_count} aircraft)
              </option>
            ))}
          </select>
          {setupErrors.scenario && (
            <span className="error-text">{setupErrors.scenario}</span>
          )}
          <span className="help-text">Choose the air traffic scenario</span>
        </div>

        {/* Condition Selection */}
        <div className="form-field">
          <label htmlFor="condition">
            Condition <span className="required">*</span>
          </label>
          <select
            id="condition"
            value={setupForm.condition ?? ''}
            onChange={(e) => setSetupForm({ ...setupForm, condition: parseInt(e.target.value) })}
            disabled={sessionActive}
            className={setupErrors.condition ? 'error' : ''}
          >
            <option value="">-- Select Condition --</option>
            {conditions.map((condition) => (
              <option key={condition.condition_id} value={condition.condition_id}>
                Condition {condition.condition_id}: {condition.name}
              </option>
            ))}
          </select>
          {setupErrors.condition && (
            <span className="error-text">{setupErrors.condition}</span>
          )}
          <span className="help-text">Select the experimental condition</span>
        </div>

        {/* Condition Description */}
        {setupForm.condition !== null && (
          <div className="condition-info">
            <h4>Selected Condition: {getConditionLabel(setupForm.condition)}</h4>
            <p>
              {setupForm.condition === 1 && 'Traditional blocking modal alerts that require acknowledgment.'}
              {setupForm.condition === 2 && 'Adaptive banner alerts that adjust based on workload.'}
              {setupForm.condition === 3 && 'ML-based predictive alerts with complacency detection.'}
            </p>
          </div>
        )}

        {/* Start Button */}
        <button
          className="btn btn-primary btn-large"
          onClick={handleStartSession}
          disabled={sessionActive || loading}
        >
          {loading ? 'Starting...' : 'START SESSION'}
        </button>

        {sessionActive && (
          <div className="session-active-notice">
            Session is currently active. Go to Monitor tab to view progress.
          </div>
        )}
      </div>
    </div>
  );

  const renderMonitorTab = () => (
    <div className="tab-content">
      <h2>Session Monitoring</h2>

      {!sessionActive ? (
        <div className="no-session-message">
          <p>No active session. Start a session from the Setup tab.</p>
        </div>
      ) : (
        <>
          {/* Session Info */}
          <div className="monitor-grid">
            <div className="monitor-card">
              <div className="card-label">Session ID</div>
              <div className="card-value">{sessionId?.substring(0, 12)}...</div>
            </div>

            <div className="monitor-card">
              <div className="card-label">Participant</div>
              <div className="card-value">{sessionConfig.participantId}</div>
            </div>

            <div className="monitor-card">
              <div className="card-label">Scenario</div>
              <div className="card-value">{sessionConfig.scenario}</div>
            </div>

            <div className="monitor-card">
              <div className="card-label">Condition</div>
              <div className="card-value">
                {sessionConfig.condition}: {getConditionLabel(sessionConfig.condition)}
              </div>
            </div>

            <div className="monitor-card highlight">
              <div className="card-label">Elapsed Time</div>
              <div className="card-value timer">{formatTime(scenarioState.elapsed_time)}</div>
            </div>

            <div className="monitor-card highlight">
              <div className="card-label">Current Phase</div>
              <div className="card-value">{getPhaseLabel(currentPhase)}</div>
            </div>
          </div>

          {/* Alert Log */}
          <div className="log-section">
            <h3>Alert Log ({alerts.length} total)</h3>
            <div className="log-container">
              {alerts.length === 0 ? (
                <p className="log-empty">No alerts triggered yet</p>
              ) : (
                <table className="log-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Type</th>
                      <th>Priority</th>
                      <th>Message</th>
                      <th>Acknowledged</th>
                      <th>Response Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.slice().reverse().slice(0, 20).map((alert) => (
                      <tr key={alert.id}>
                        <td>{formatTimestamp(alert.timestamp)}</td>
                        <td>
                          <span className={`badge badge-${alert.type}`}>
                            {alert.type}
                          </span>
                        </td>
                        <td>
                          <span className={`badge badge-priority-${alert.priority}`}>
                            {alert.priority}
                          </span>
                        </td>
                        <td className="message-cell">{alert.message}</td>
                        <td>
                          {alert.acknowledged_at ? (
                            <span className="status-yes">Yes</span>
                          ) : (
                            <span className="status-no">No</span>
                          )}
                        </td>
                        <td>
                          {alert.response_time_ms
                            ? `${(alert.response_time_ms / 1000).toFixed(2)}s`
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Event Log */}
          <div className="log-section">
            <h3>Event Log (Last 20 events)</h3>
            <div className="log-container">
              {events.length === 0 ? (
                <p className="log-empty">No events recorded yet</p>
              ) : (
                <table className="log-table compact">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Event Type</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.slice().reverse().slice(0, 20).map((event, index) => (
                      <tr key={index}>
                        <td>{formatTimestamp(event.timestamp)}</td>
                        <td>
                          <span className="badge badge-event">
                            {event.type || event.event_type || 'unknown'}
                          </span>
                        </td>
                        <td className="details-cell">
                          {JSON.stringify(event.data || event).substring(0, 80)}...
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderControlsTab = () => (
    <div className="tab-content">
      <h2>Manual Controls</h2>
      <p className="section-description">
        Use these controls to manage the active session
      </p>

      {!sessionActive ? (
        <div className="no-session-message">
          <p>No active session. Controls are only available during an active session.</p>
        </div>
      ) : (
        <div className="controls-grid">
          {/* Pause/Resume */}
          <div className="control-card">
            <h3>Pause/Resume</h3>
            <p>Temporarily pause the session for technical issues or participant needs</p>
            {isPaused ? (
              <button
                className="btn btn-success"
                onClick={onResumeSession}
              >
                Resume Session
              </button>
            ) : (
              <button
                className="btn btn-warning"
                onClick={onPauseSession}
              >
                Pause Session
              </button>
            )}
            {isPaused && (
              <div className="status-message warning">
                Session is currently paused
              </div>
            )}
          </div>

          {/* Skip Phase */}
          <div className="control-card">
            <h3>Skip Phase</h3>
            <p>Skip to the next phase (for testing purposes only)</p>
            <button
              className="btn btn-secondary"
              onClick={onSkipPhase}
              disabled={currentPhase === 'complete'}
            >
              Skip to Next Phase
            </button>
            <div className="status-message info">
              Current: {getPhaseLabel(currentPhase)}
            </div>
          </div>

          {/* Emergency Stop */}
          <div className="control-card danger">
            <h3>Emergency Stop</h3>
            <p>Immediately end the session (data will be saved)</p>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (window.confirm('Are you sure you want to stop the session? This action cannot be undone.')) {
                  onStopSession();
                }
              }}
            >
              EMERGENCY STOP
            </button>
            <div className="status-message danger">
              Use only in case of emergency
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderExportTab = () => (
    <div className="tab-content">
      <h2>Data Export & Metrics</h2>

      {!sessionActive && !sessionId ? (
        <div className="no-session-message">
          <p>No session data available. Start or complete a session first.</p>
        </div>
      ) : (
        <>
          {/* Quick Metrics */}
          <div className="metrics-section">
            <h3>Quick Metrics</h3>
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-label">Avg Response Time</div>
                <div className="metric-value">
                  {metrics.avgResponseTime > 0
                    ? `${(metrics.avgResponseTime / 1000).toFixed(2)}s`
                    : 'N/A'}
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Total Alerts</div>
                <div className="metric-value">{metrics.alertCount}</div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Total Events</div>
                <div className="metric-value">{metrics.eventsCount}</div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Fixation Ratio</div>
                <div className="metric-value">{metrics.fixationRatio}</div>
              </div>
            </div>
          </div>

          {/* Export Section */}
          <div className="export-section">
            <h3>Export Session Data</h3>
            <p>Download complete session data as JSON file for analysis</p>

            <div className="export-info">
              <div className="info-row">
                <span className="info-label">Session ID:</span>
                <span className="info-value">{sessionId}</span>
              </div>
              {sessionConfig.participantId && (
                <div className="info-row">
                  <span className="info-label">Participant:</span>
                  <span className="info-value">{sessionConfig.participantId}</span>
                </div>
              )}
              <div className="info-row">
                <span className="info-label">Duration:</span>
                <span className="info-value">{formatTime(scenarioState.elapsed_time)}</span>
              </div>
            </div>

            <button
              className="btn btn-primary btn-large"
              onClick={handleExportData}
              disabled={exportLoading || !sessionId}
            >
              {exportLoading ? 'Exporting...' : 'Export Session Data (JSON)'}
            </button>

            <div className="export-note">
              <strong>Note:</strong> The exported file includes all behavioral events,
              alerts, response times, and session metadata for offline analysis.
            </div>
          </div>
        </>
      )}
    </div>
  );

  // ============ MAIN RENDER ============

  return (
    <div className="researcher-panel">
      <div className="panel-header">
        <h1>Researcher Control Panel</h1>
        <p className="panel-subtitle">ATC Adaptive Alert Research System</p>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'setup' ? 'active' : ''}`}
          onClick={() => setActiveTab('setup')}
          disabled={sessionActive && activeTab !== 'setup'}
        >
          Setup
        </button>
        <button
          className={`tab-button ${activeTab === 'monitor' ? 'active' : ''}`}
          onClick={() => setActiveTab('monitor')}
        >
          Monitor
          {sessionActive && <span className="live-indicator">LIVE</span>}
        </button>
        <button
          className={`tab-button ${activeTab === 'controls' ? 'active' : ''}`}
          onClick={() => setActiveTab('controls')}
        >
          Controls
        </button>
        <button
          className={`tab-button ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          Export
        </button>
      </div>

      {/* Tab Content */}
      <div className="panel-content">
        {activeTab === 'setup' && renderSetupTab()}
        {activeTab === 'monitor' && renderMonitorTab()}
        {activeTab === 'controls' && renderControlsTab()}
        {activeTab === 'export' && renderExportTab()}
      </div>
    </div>
  );
};

export default ResearcherPanel;
