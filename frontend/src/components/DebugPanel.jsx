import React, { useState } from 'react';
import '../styles/debug.css';

/**
 * Debug Panel for Researchers
 *
 * Accessible via Ctrl+Shift+D during scenario
 * Provides real-time monitoring and testing capabilities
 */
const DebugPanel = ({
  sessionId,
  sessionConfig,
  scenarioState,
  alerts,
  trackingActive,
  wsConnected,
  wsStatus,
  onClose,
  onTriggerAlert,
  onEndSession
}) => {
  const [testAlertType, setTestAlertType] = useState('conflict');
  const [testAlertPriority, setTestAlertPriority] = useState('medium');
  const [testAlertMessage, setTestAlertMessage] = useState('Test alert message');
  const [showRawData, setShowRawData] = useState(false);

  const handleTriggerTestAlert = () => {
    onTriggerAlert({
      type: testAlertType,
      priority: testAlertPriority,
      message: testAlertMessage,
      source: 'debug',
      data: {
        test: true,
        triggered_at: new Date().toISOString()
      }
    });
  };

  const formatTime = (ms) => {
    if (!ms) return 'N/A';
    const date = new Date(ms);
    return date.toLocaleTimeString();
  };

  return (
    <div className="debug-panel">
      <div className="debug-panel-header">
        <h2>Debug Panel (Researcher Mode)</h2>
        <button className="btn-close-debug" onClick={onClose}>
          &times;
        </button>
      </div>

      <div className="debug-panel-content">
        {/* Session Information */}
        <section className="debug-section">
          <h3>Session Information</h3>
          <div className="debug-grid">
            <div className="debug-item">
              <span className="debug-label">Session ID:</span>
              <span className="debug-value">{sessionId}</span>
            </div>
            <div className="debug-item">
              <span className="debug-label">Participant:</span>
              <span className="debug-value">{sessionConfig.participantId}</span>
            </div>
            <div className="debug-item">
              <span className="debug-label">Scenario:</span>
              <span className="debug-value">{sessionConfig.scenario}</span>
            </div>
            <div className="debug-item">
              <span className="debug-label">Condition:</span>
              <span className="debug-value">
                {sessionConfig.condition} ({
                  sessionConfig.condition === 1 ? 'Traditional' :
                  sessionConfig.condition === 2 ? 'Adaptive' :
                  'ML-Based'
                })
              </span>
            </div>
          </div>
        </section>

        {/* Connection Status */}
        <section className="debug-section">
          <h3>System Status</h3>
          <div className="debug-grid">
            <div className="debug-item">
              <span className="debug-label">WebSocket:</span>
              <span className={`debug-value status-${wsConnected ? 'connected' : 'disconnected'}`}>
                {wsConnected ? 'Connected' : 'Disconnected'} ({wsStatus})
              </span>
            </div>
            <div className="debug-item">
              <span className="debug-label">Tracking:</span>
              <span className={`debug-value status-${trackingActive ? 'active' : 'inactive'}`}>
                {trackingActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="debug-item">
              <span className="debug-label">Elapsed Time:</span>
              <span className="debug-value">
                {Math.floor(scenarioState.elapsed_time / 60)}:
                {(scenarioState.elapsed_time % 60).toString().padStart(2, '0')}
              </span>
            </div>
            <div className="debug-item">
              <span className="debug-label">Aircraft Count:</span>
              <span className="debug-value">{scenarioState.aircraft_count}</span>
            </div>
          </div>
        </section>

        {/* Active Alerts */}
        <section className="debug-section">
          <h3>Active Alerts ({alerts.length})</h3>
          <div className="debug-alerts-list">
            {alerts.length === 0 ? (
              <p className="debug-empty">No active alerts</p>
            ) : (
              alerts.map((alert) => (
                <div key={alert.id} className="debug-alert-item">
                  <div className="alert-id">{alert.id.substring(0, 12)}...</div>
                  <div className="alert-info">
                    <span className={`alert-type type-${alert.type}`}>{alert.type}</span>
                    <span className={`alert-priority priority-${alert.priority}`}>
                      {alert.priority}
                    </span>
                  </div>
                  <div className="alert-message">{alert.message}</div>
                  <div className="alert-status">
                    <span>Displayed: {formatTime(alert.timestamp)}</span>
                    {alert.acknowledged_at && (
                      <span>Ack: {formatTime(new Date(alert.acknowledged_at).getTime())}</span>
                    )}
                    {alert.dismissed_at && (
                      <span>Dismissed: {formatTime(new Date(alert.dismissed_at).getTime())}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Recent Events */}
        <section className="debug-section">
          <h3>Recent Scenario Events ({scenarioState.events.length})</h3>
          <div className="debug-events-list">
            {scenarioState.events.length === 0 ? (
              <p className="debug-empty">No events yet</p>
            ) : (
              scenarioState.events.slice(-10).reverse().map((event, index) => (
                <div key={index} className="debug-event-item">
                  <span className="event-type">{event.type || 'unknown'}</span>
                  <span className="event-data">
                    {JSON.stringify(event.data || event).substring(0, 100)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Test Controls */}
        <section className="debug-section">
          <h3>Test Controls</h3>

          <div className="test-controls">
            <div className="control-group">
              <label>Alert Type:</label>
              <select
                value={testAlertType}
                onChange={(e) => setTestAlertType(e.target.value)}
              >
                <option value="conflict">Conflict</option>
                <option value="predictive">Predictive</option>
                <option value="system">System</option>
                <option value="test">Test</option>
              </select>
            </div>

            <div className="control-group">
              <label>Priority:</label>
              <select
                value={testAlertPriority}
                onChange={(e) => setTestAlertPriority(e.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div className="control-group">
              <label>Message:</label>
              <input
                type="text"
                value={testAlertMessage}
                onChange={(e) => setTestAlertMessage(e.target.value)}
                placeholder="Alert message..."
              />
            </div>

            <button
              className="btn btn-test-alert"
              onClick={handleTriggerTestAlert}
            >
              Trigger Test Alert
            </button>
          </div>
        </section>

        {/* Actions */}
        <section className="debug-section">
          <h3>Actions</h3>
          <div className="debug-actions">
            <button
              className="btn btn-danger"
              onClick={() => {
                if (window.confirm('Force end session? This will skip to survey.')) {
                  onEndSession();
                }
              }}
            >
              Force End Session
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => setShowRawData(!showRawData)}
            >
              {showRawData ? 'Hide' : 'Show'} Raw Data
            </button>
          </div>
        </section>

        {/* Raw Data View */}
        {showRawData && (
          <section className="debug-section">
            <h3>Raw Data</h3>
            <div className="debug-raw-data">
              <h4>Session Config</h4>
              <pre>{JSON.stringify(sessionConfig, null, 2)}</pre>

              <h4>Scenario State</h4>
              <pre>{JSON.stringify(scenarioState, null, 2)}</pre>

              <h4>Alerts</h4>
              <pre>{JSON.stringify(alerts, null, 2)}</pre>
            </div>
          </section>
        )}
      </div>

      <div className="debug-panel-footer">
        <p className="debug-help">
          Press <kbd>Ctrl+Shift+D</kbd> to close |
          <kbd>Ctrl+Shift+E</kbd> to force end |
          <kbd>Ctrl+Shift+A</kbd> to trigger test alert
        </p>
      </div>
    </div>
  );
};

export default DebugPanel;
