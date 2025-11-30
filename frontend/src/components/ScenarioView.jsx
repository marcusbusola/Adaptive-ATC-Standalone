import React from 'react';
import './ScenarioView.css';
import useSimulation from '../hooks/useSimulation';

const ScenarioView = ({
  sessionId,
  sessionConfig,
  scenarioState,
  alerts,
  onAlertAcknowledge,
  onEndScenario
}) => {
  const { connected, state: simState } = useSimulation();

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
            <button className="btn" onClick={() => onAlertAcknowledge(alerts[0].alert_id)}>Acknowledge First Alert</button>
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
