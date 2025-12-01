/**
 * Action Panel Component
 *
 * Displays situation context and available ATC commands for the current scenario phase.
 * Logs all operator actions for research analysis.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { getApiBaseUrl } from '../utils/apiConfig';
import { SCENARIO_ACTIONS, COMMON_COMMANDS } from '../config/scenarioActions';
import './ActionPanel.css';

const ActionPanel = ({
  sessionId,
  scenario,
  currentPhase = 0,
  phaseDescription,
  aircraft = {},
  elapsedTime = 0,
  onActionLogged
}) => {
  const [selectedAircraft, setSelectedAircraft] = useState(null);
  const [actionHistory, setActionHistory] = useState([]);
  const [isLogging, setIsLogging] = useState(false);

  // Get scenario-specific configuration
  const scenarioConfig = useMemo(() => {
    return SCENARIO_ACTIONS[scenario] || null;
  }, [scenario]);

  // Get current phase configuration (phases are 1-indexed in config)
  const phaseConfig = useMemo(() => {
    if (!scenarioConfig) return null;
    // currentPhase from backend is 0-indexed, config phases are 1-indexed
    return scenarioConfig.phases[currentPhase + 1] || null;
  }, [scenarioConfig, currentPhase]);

  // Log action to backend
  const logAction = useCallback(async (action) => {
    if (!sessionId) {
      console.warn('[ActionPanel] No sessionId, cannot log action');
      return;
    }

    const actionData = {
      timestamp: Date.now(),
      elapsed_time: elapsedTime,
      action_id: action.id,
      action_type: action.type,
      action_label: action.label,
      target_aircraft: action.target,
      command_text: action.command,
      scenario_phase: currentPhase + 1,
      is_expected: phaseConfig?.expectedActions?.includes(action.id) || false,
      simulated: true
    };

    setIsLogging(true);

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/sessions/${sessionId}/behavioral-events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          events: [{
            event_type: 'atc_command',
            ...actionData
          }]
        })
      });

      if (!response.ok) {
        console.error('[ActionPanel] Failed to log action:', response.statusText);
      }
    } catch (err) {
      console.error('[ActionPanel] Failed to log action:', err);
    } finally {
      setIsLogging(false);
    }

    // Update local history
    setActionHistory(prev => [...prev, actionData]);

    // Notify parent
    onActionLogged?.(actionData);
  }, [sessionId, currentPhase, elapsedTime, phaseConfig, onActionLogged]);

  // Handle command button click
  const handleCommandClick = useCallback((action) => {
    logAction(action);
  }, [logAction]);

  // Handle common command click (requires selected aircraft)
  const handleCommonCommandClick = useCallback((cmd) => {
    const action = {
      ...cmd,
      target: selectedAircraft || 'N/A',
      command: `${cmd.label} for ${selectedAircraft || 'selected aircraft'}`
    };
    logAction(action);
  }, [selectedAircraft, logAction]);

  // Format elapsed time for display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Convert aircraft object to array
  const aircraftList = useMemo(() => {
    if (Array.isArray(aircraft)) return aircraft;
    return Object.values(aircraft);
  }, [aircraft]);

  // Check if an expected action has been completed
  const isActionCompleted = useCallback((actionId) => {
    return actionHistory.some(h => h.action_id === actionId);
  }, [actionHistory]);

  // Count completed expected actions
  const completedExpectedCount = useMemo(() => {
    if (!phaseConfig?.expectedActions) return 0;
    return phaseConfig.expectedActions.filter(id => isActionCompleted(id)).length;
  }, [phaseConfig, isActionCompleted]);

  if (!scenarioConfig) {
    return (
      <div className="action-panel">
        <div className="action-panel-header">
          <h2>Action Panel</h2>
        </div>
        <div className="panel-section">
          <p className="no-scenario">
            {scenario ? `Unknown scenario: ${scenario}` : 'No scenario loaded'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="action-panel">
      {/* Header */}
      <div className="action-panel-header">
        <h2>Action Panel</h2>
        <div className="elapsed-time">{formatTime(elapsedTime)}</div>
      </div>

      {/* Situation Context */}
      <section className="panel-section situation-context">
        <h3>Situation Context</h3>
        <div className="scenario-name">{scenarioConfig.name}</div>
        <div className="phase-info">
          <span className="phase-label">Phase {currentPhase + 1}:</span>
          <span className="phase-name">{phaseConfig?.name || phaseDescription || 'Loading...'}</span>
        </div>
        <p className="context-description">
          {phaseConfig?.context || 'Monitor the situation and respond as needed.'}
        </p>
      </section>

      {/* Aircraft Selector */}
      <section className="panel-section aircraft-selector">
        <h3>Select Aircraft ({aircraftList.length})</h3>
        <div className="aircraft-buttons">
          {aircraftList.map(ac => (
            <button
              key={ac.callsign}
              className={`aircraft-btn ${selectedAircraft === ac.callsign ? 'selected' : ''}
                         ${ac.emergency ? 'emergency' : ''}
                         ${ac.comm_loss ? 'nordo' : ''}`}
              onClick={() => setSelectedAircraft(ac.callsign === selectedAircraft ? null : ac.callsign)}
              title={`${ac.callsign} - FL${Math.floor((ac.altitude || 0) / 100)}`}
            >
              {ac.callsign}
              {ac.emergency && <span className="status-indicator emergency">!</span>}
              {ac.comm_loss && <span className="status-indicator nordo">X</span>}
            </button>
          ))}
          {aircraftList.length === 0 && (
            <p className="no-aircraft">No aircraft in sector</p>
          )}
        </div>
      </section>

      {/* Phase-Specific Commands */}
      {phaseConfig?.availableActions?.length > 0 && (
        <section className="panel-section phase-commands">
          <h3>
            Scenario Commands
            {phaseConfig.expectedActions?.length > 0 && (
              <span className="expected-counter">
                {completedExpectedCount}/{phaseConfig.expectedActions.length} expected
              </span>
            )}
          </h3>
          <div className="command-list">
            {phaseConfig.availableActions.map(action => {
              const isExpected = phaseConfig.expectedActions?.includes(action.id);
              const isCompleted = isActionCompleted(action.id);
              return (
                <button
                  key={action.id}
                  className={`command-btn scenario-cmd
                             ${isExpected ? 'expected' : ''}
                             ${isCompleted ? 'completed' : ''}`}
                  onClick={() => handleCommandClick(action)}
                  disabled={isLogging}
                  title={action.command}
                >
                  <div className="command-main">
                    <span className="command-label">{action.label}</span>
                    {isExpected && !isCompleted && (
                      <span className="expected-badge">Expected</span>
                    )}
                    {isCompleted && (
                      <span className="completed-badge">✓</span>
                    )}
                  </div>
                  <span className="command-target">{action.target}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Common ATC Commands */}
      <section className="panel-section common-commands">
        <h3>ATC Commands</h3>
        <div className="command-grid">
          {COMMON_COMMANDS.map(cmd => (
            <button
              key={cmd.id}
              className="command-btn common"
              onClick={() => handleCommonCommandClick(cmd)}
              disabled={!selectedAircraft || isLogging}
              title={selectedAircraft ? `${cmd.label} for ${selectedAircraft}` : 'Select an aircraft first'}
            >
              <span className="command-icon">{cmd.icon}</span>
              <span className="command-label">{cmd.label}</span>
            </button>
          ))}
        </div>
        {!selectedAircraft && (
          <p className="hint">Select an aircraft above to issue commands</p>
        )}
      </section>

      {/* Expected Actions Checklist */}
      {phaseConfig?.expectedActions?.length > 0 && (
        <section className="panel-section expected-actions">
          <h3>Expected Actions</h3>
          <ul className="expected-list">
            {phaseConfig.expectedActions.map(actionId => {
              const action = phaseConfig.availableActions.find(a => a.id === actionId);
              const completed = isActionCompleted(actionId);
              return (
                <li key={actionId} className={completed ? 'completed' : ''}>
                  <span className="check-icon">{completed ? '✓' : '○'}</span>
                  <span className="action-name">{action?.label || actionId}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Action History */}
      <section className="panel-section action-history">
        <h3>Action Log ({actionHistory.length})</h3>
        <div className="history-list">
          {actionHistory.slice(-5).reverse().map((action, idx) => (
            <div key={`${action.timestamp}-${idx}`} className="history-item">
              <span className="history-time">{formatTime(action.elapsed_time)}</span>
              <span className="history-action">{action.action_label}</span>
              <span className="history-target">{action.target_aircraft}</span>
            </div>
          ))}
          {actionHistory.length === 0 && (
            <p className="no-actions">No actions taken yet</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default ActionPanel;
