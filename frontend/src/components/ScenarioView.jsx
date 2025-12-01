import React from 'react';
import './ScenarioView.css';
import useSimulation from '../hooks/useSimulation';
import { logAlertAcknowledgment } from '../services/api';

const ScenarioView = ({
  sessionId,
  sessionConfig,
  scenarioState,
  alerts,
  onAlertAcknowledge,
  onEndScenario
}) => {
  const { connected, state: simState } = useSimulation();

  const handleAcknowledgeFirst = async () => {
    const first = alerts?.[0];
    if (!first) return;

    const alertId = first.alert_id || first.id;
    const timestamp = first.timestamp || first.displayed_at;
    const responseTime = timestamp ? Date.now() - new Date(timestamp).getTime() : null;

    try {
      if (sessionId && alertId) {
        await logAlertAcknowledgment(sessionId, alertId, {
          acknowledged_at: new Date().toISOString(),
          response_time_ms: responseTime
        });
      }
    } catch (err) {
      console.error('Failed to log alert acknowledgment from ScenarioView:', err);
    }

    if (onAlertAcknowledge && alertId) {
      onAlertAcknowledge(alertId);
    }
  };

  return (
    <div className="scenario-view">
      <div className="scenario-status">
        <div className="status-row">
          <span className="label">Simulation:</span>
          <span className={`value ${connected ? 'ok' : 'warn'}`}>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <div className="status-row">
          <span className="label">Elapsed:</span>
          <span className="value">{scenarioState?.elapsed_time?.toFixed?.(1) ?? '0.0'}s</span>
        </div>
        <div className="status-row">
          <span className="label">Phase:</span>
          <span className="value">{(scenarioState?.current_phase ?? 0) + 1} — {scenarioState?.phase_description || 'N/A'}</span>
        </div>
        <div className="status-row">
          <span className="label">Active Alerts:</span>
          <span className="value">{alerts?.length || 0}</span>
        </div>
        <div className="scenario-actions">
          <button className="btn" onClick={onEndScenario}>End Scenario</button>
          {alerts?.length > 0 && (
            <button className="btn" onClick={handleAcknowledgeFirst}>Acknowledge First Alert</button>
          )}
        </div>
      </div>

      <div className="telemetry-panel">
        <h3>Live Telemetry</h3>
        <pre className="telemetry-log">
          {simState ? JSON.stringify(simState, null, 2) : 'Waiting for telemetry...'}
        </pre>
      </div>
    </div>
  );
};

export default ScenarioView;
