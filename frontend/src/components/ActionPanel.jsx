/**
 * Action Panel Component
 *
 * Displays situation context and available ATC commands for the current scenario phase.
 * Logs all operator actions for research analysis.
 * Now supports real simulation control via simulation API.
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { getApiBaseUrl } from '../utils/apiConfig';
import { SCENARIO_ACTIONS, COMMON_COMMANDS } from '../config/scenarioActions';
import simulationApi from '../services/simulation-api';
import './ActionPanel.css';

const ActionPanel = ({
  sessionId,
  scenario,
  currentPhase = 0,
  phaseDescription,
  aircraft = {},
  elapsedTime = 0,
  pendingAlerts = [], // Alerts that are acknowledged but not yet resolved
  onActionLogged,
  selectedAircraft: externalSelectedAircraft = null, // External selection from Session
  onAircraftSelect = null // Callback to sync selection with RadarViewer
}) => {
  // Use external selection if provided, otherwise maintain internal state
  const [internalSelectedAircraft, setInternalSelectedAircraft] = useState(null);
  const selectedAircraftCallsign = externalSelectedAircraft?.callsign || internalSelectedAircraft;

  const [actionHistory, setActionHistory] = useState([]);
  const [isLogging, setIsLogging] = useState(false);
  const [clickedActionId, setClickedActionId] = useState(null); // For click feedback animation
  const [actionError, setActionError] = useState('');
  const [actionToast, setActionToast] = useState('');
  const toastTimeoutRef = useRef(null);

  // Command input state
  const [activeCommandInput, setActiveCommandInput] = useState(null); // 'altitude', 'heading', 'speed', or null
  const [commandValue, setCommandValue] = useState('');
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);

  // Handle aircraft selection - notify parent if callback provided
  const handleAircraftSelect = useCallback((callsign) => {
    const newCallsign = callsign === selectedAircraftCallsign ? null : callsign;
    setInternalSelectedAircraft(newCallsign);
    if (onAircraftSelect) {
      // Find the full aircraft object to pass to parent
      const aircraftObj = newCallsign ? (Array.isArray(aircraft) ? aircraft.find(a => a.callsign === newCallsign) : aircraft[newCallsign]) : null;
      onAircraftSelect(aircraftObj);
    }
  }, [selectedAircraftCallsign, aircraft, onAircraftSelect]);

  // Get selected aircraft object with live data
  const selectedAircraftData = useMemo(() => {
    if (!selectedAircraftCallsign) return null;
    if (Array.isArray(aircraft)) {
      return aircraft.find(a => a.callsign === selectedAircraftCallsign);
    }
    return aircraft[selectedAircraftCallsign] || null;
  }, [selectedAircraftCallsign, aircraft]);

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
    setActionError('');

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
        const detail = await response.text().catch(() => response.statusText);
        throw new Error(detail || response.statusText);
      }

      // Only update local state if backend logging succeeded
      setActionHistory(prev => [...prev, actionData]);

      // Notify parent
      onActionLogged?.(actionData);
      setActionToast(`${action.label} sent`);
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      toastTimeoutRef.current = setTimeout(() => setActionToast(''), 2000);
    } catch (err) {
      console.error('[ActionPanel] Failed to log action:', err);
      setActionError('Failed to log action. Please try again.');
    } finally {
      setIsLogging(false);
    }
  }, [sessionId, currentPhase, elapsedTime, phaseConfig, onActionLogged]);

  // Handle command button click with visual feedback
  const handleCommandClick = useCallback((action) => {
    // Visual feedback - flash the button
    setClickedActionId(action.id);
    setTimeout(() => setClickedActionId(null), 300);

    logAction(action);
  }, [logAction]);

  // Handle common command click - show input for altitude/heading/speed
  const handleCommonCommandClick = useCallback((cmd) => {
    // Visual feedback
    setClickedActionId(cmd.id);
    setTimeout(() => setClickedActionId(null), 300);

    // For altitude, heading, speed - show input
    if (['altitude', 'heading', 'speed'].includes(cmd.id)) {
      setActiveCommandInput(cmd.id);
      setCommandValue('');
      return;
    }

    // For other commands, log directly
    const action = {
      ...cmd,
      target: selectedAircraftCallsign || 'N/A',
      command: `${cmd.label} for ${selectedAircraftCallsign || 'selected aircraft'}`
    };
    logAction(action);
  }, [selectedAircraftCallsign, logAction]);

  // Execute simulation command (altitude, heading, or speed)
  const executeSimulationCommand = useCallback(async () => {
    if (!selectedAircraftCallsign || !commandValue || !activeCommandInput) return;

    setIsExecutingCommand(true);
    setActionError('');

    try {
      let parsedValue = parseFloat(commandValue);
      let displayValue = commandValue;

      // Convert flight level to feet if needed (values < 1000 are FL)
      if (activeCommandInput === 'altitude' && parsedValue < 1000) {
        parsedValue = parsedValue * 100;
        displayValue = `FL${commandValue}`;
      } else if (activeCommandInput === 'altitude') {
        displayValue = `${parsedValue} ft`;
      } else if (activeCommandInput === 'heading') {
        displayValue = `${parsedValue}°`;
      } else if (activeCommandInput === 'speed') {
        displayValue = `${parsedValue} kts`;
      }

      // Call simulation API
      switch (activeCommandInput) {
        case 'altitude':
          await simulationApi.setAltitude(selectedAircraftCallsign, parsedValue);
          break;
        case 'heading':
          await simulationApi.setHeading(selectedAircraftCallsign, parsedValue);
          break;
        case 'speed':
          await simulationApi.setAircraftSpeed(selectedAircraftCallsign, parsedValue);
          break;
        default:
          break;
      }

      // Log the action for research
      const action = {
        id: `${activeCommandInput}_command`,
        type: 'atc_command',
        label: `${activeCommandInput.charAt(0).toUpperCase() + activeCommandInput.slice(1)} ${displayValue}`,
        target: selectedAircraftCallsign,
        command: `Set ${activeCommandInput} to ${displayValue} for ${selectedAircraftCallsign}`,
        simulated: false // Real command sent to simulation
      };
      await logAction(action);

      // Show success toast
      setActionToast(`${action.label} sent to ${selectedAircraftCallsign}`);
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      toastTimeoutRef.current = setTimeout(() => setActionToast(''), 3000);

      // Close input
      setActiveCommandInput(null);
      setCommandValue('');

    } catch (err) {
      console.error('[ActionPanel] Failed to execute command:', err);
      setActionError(`Failed to send command: ${err.message}`);
    } finally {
      setIsExecutingCommand(false);
    }
  }, [selectedAircraftCallsign, commandValue, activeCommandInput, logAction]);

  // Cancel command input
  const cancelCommandInput = useCallback(() => {
    setActiveCommandInput(null);
    setCommandValue('');
  }, []);

  // Check if an action would resolve any pending alerts
  const getResolvableAlerts = useCallback((action) => {
    if (!pendingAlerts.length) return [];
    return pendingAlerts.filter(alert => {
      // Check if this action targets the same aircraft as the alert
      if (action.target === alert.target) return true;
      // Check if action is an expected action for alerts on this target
      if (action.target === 'all' || action.target === 'multiple') return true;
      return false;
    });
  }, [pendingAlerts]);

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

  // Get set of aircraft callsigns that have pending (unresolved) alerts
  const aircraftWithPendingAlerts = useMemo(() => {
    return new Set(pendingAlerts.map(alert => alert.target));
  }, [pendingAlerts]);

  // Alerts for selected aircraft
  const alertsForSelectedAircraft = useMemo(() => {
    if (!selectedAircraftCallsign || !pendingAlerts.length) return [];
    return pendingAlerts.filter(alert => alert.target === selectedAircraftCallsign);
  }, [selectedAircraftCallsign, pendingAlerts]);

  // Commands for selected aircraft (only if it has alerts)
  const commandsForSelectedAircraft = useMemo(() => {
    if (!alertsForSelectedAircraft.length || !phaseConfig?.availableActions) return [];
    return phaseConfig.availableActions.filter(action =>
      action.target === selectedAircraftCallsign ||
      action.target === 'all' ||
      action.target === 'multiple'
    );
  }, [alertsForSelectedAircraft, phaseConfig, selectedAircraftCallsign]);

  // All commands related to any pending alert (when no aircraft selected)
  const alertRelatedCommands = useMemo(() => {
    if (!pendingAlerts.length || !phaseConfig?.availableActions) return [];
    const alertTargets = new Set(pendingAlerts.map(a => a.target));
    return phaseConfig.availableActions.filter(action =>
      alertTargets.has(action.target) ||
      action.target === 'all' ||
      action.target === 'multiple'
    );
  }, [pendingAlerts, phaseConfig]);

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
      {actionError && (
        <div className="panel-section">
          <div className="error-message">{actionError}</div>
        </div>
      )}
      {actionToast && (
        <div className="panel-section">
          <div className="success-message">{actionToast}</div>
        </div>
      )}

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
          {aircraftList.map(ac => {
            const hasPendingAlert = aircraftWithPendingAlerts.has(ac.callsign);
            return (
              <button
                key={ac.callsign}
                className={`aircraft-btn ${selectedAircraftCallsign === ac.callsign ? 'selected' : ''}
                           ${ac.emergency ? 'emergency' : ''}
                           ${ac.comm_loss ? 'nordo' : ''}
                           ${hasPendingAlert ? 'pending-alert' : ''}`}
                onClick={() => handleAircraftSelect(ac.callsign)}
                title={`${ac.callsign} - FL${Math.floor((ac.altitude || 0) / 100)}${hasPendingAlert ? ' - ACTION REQUIRED' : ''}`}
              >
                {ac.callsign}
                {ac.emergency && <span className="status-indicator emergency">!</span>}
                {ac.comm_loss && <span className="status-indicator nordo">X</span>}
                {hasPendingAlert && <span className="status-indicator pending">⚠</span>}
              </button>
            );
          })}
          {aircraftList.length === 0 && (
            <p className="no-aircraft">No aircraft in sector</p>
          )}
        </div>
      </section>

      {/* Dynamic Content Area - shows aircraft info or scenario commands based on state */}
      <section className="panel-section dynamic-content">
        {selectedAircraftData ? (
          // AIRCRAFT SELECTED: Show info + commands if aircraft has alerts
          <>
            <h3>Selected: {selectedAircraftData.callsign}</h3>
            <div className="aircraft-telemetry">
              <div className="telemetry-row">
                <span className="telemetry-label">Altitude:</span>
                <span className="telemetry-value">{Math.floor(selectedAircraftData.altitude || 0).toLocaleString()} ft</span>
                {selectedAircraftData.target_altitude && selectedAircraftData.target_altitude !== selectedAircraftData.altitude && (
                  <span className="telemetry-target">
                    {selectedAircraftData.target_altitude > selectedAircraftData.altitude ? '↑' : '↓'} {Math.floor(selectedAircraftData.target_altitude).toLocaleString()} ft
                  </span>
                )}
              </div>
              {selectedAircraftData.vertical_rate && Math.abs(selectedAircraftData.vertical_rate) > 50 && (
                <div className="telemetry-row sub">
                  <span className="telemetry-label">V/S:</span>
                  <span className="telemetry-value vs">{selectedAircraftData.vertical_rate > 0 ? '+' : ''}{Math.floor(selectedAircraftData.vertical_rate)} fpm</span>
                </div>
              )}
              <div className="telemetry-row">
                <span className="telemetry-label">Speed:</span>
                <span className="telemetry-value">{Math.floor(selectedAircraftData.speed || 0)} kts</span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Heading:</span>
                <span className="telemetry-value">{Math.floor(selectedAircraftData.heading || 0)}°</span>
              </div>
              {(selectedAircraftData.emergency || selectedAircraftData.comm_loss) && (
                <div className="telemetry-row status">
                  <span className="telemetry-label">Status:</span>
                  <span className={`telemetry-value ${selectedAircraftData.emergency ? 'emergency' : 'nordo'}`}>
                    {selectedAircraftData.emergency ? 'EMERGENCY' : 'COMM LOSS'}
                  </span>
                </div>
              )}
            </div>

            {/* Commands for this aircraft (only shown if aircraft has alerts) */}
            {commandsForSelectedAircraft.length > 0 && (
              <div className="aircraft-commands">
                <h4>Required Actions</h4>
                <div className="command-list">
                  {commandsForSelectedAircraft.map(action => {
                    const isClicked = clickedActionId === action.id;
                    const resolvableAlerts = getResolvableAlerts(action);
                    const willResolveAlert = resolvableAlerts.length > 0;
                    return (
                      <button
                        key={action.id}
                        className={`command-btn scenario-cmd ${isClicked ? 'clicked' : ''} ${willResolveAlert ? 'resolves-alert' : ''}`}
                        onClick={() => handleCommandClick(action)}
                        disabled={isLogging}
                        title={action.command}
                      >
                        <div className="command-main">
                          <span className="command-label">{action.label}</span>
                          {willResolveAlert && (
                            <span className="resolves-badge">Resolves Alert</span>
                          )}
                        </div>
                        <span className="command-target">{action.target}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : pendingAlerts.length > 0 ? (
          // NO SELECTION + PENDING ALERTS: Show alert-related commands
          <>
            <h3>Pending Alerts ({pendingAlerts.length})</h3>
            <p className="alert-hint">Select an aircraft or take action:</p>
            <div className="command-list">
              {alertRelatedCommands.map(action => {
                const isClicked = clickedActionId === action.id;
                const resolvableAlerts = getResolvableAlerts(action);
                const willResolveAlert = resolvableAlerts.length > 0;
                return (
                  <button
                    key={action.id}
                    className={`command-btn scenario-cmd ${isClicked ? 'clicked' : ''} ${willResolveAlert ? 'resolves-alert' : ''}`}
                    onClick={() => handleCommandClick(action)}
                    disabled={isLogging}
                    title={action.command}
                  >
                    <div className="command-main">
                      <span className="command-label">{action.label}</span>
                      {willResolveAlert && (
                        <span className="resolves-badge">Resolves Alert</span>
                      )}
                    </div>
                    <span className="command-target">{action.target}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          // ALL CLEAR: No pending alerts, no selection
          <div className="all-clear-status">
            <span className="status-icon">✓</span>
            <span>All situations resolved</span>
          </div>
        )}
      </section>

      {/* Common ATC Commands */}
      <section className="panel-section common-commands">
        <h3>ATC Commands</h3>
        <div className="command-grid">
          {COMMON_COMMANDS.map(cmd => {
            const isClicked = clickedActionId === cmd.id;
            const isActive = activeCommandInput === cmd.id;
            return (
              <button
                key={cmd.id}
                className={`command-btn common ${isClicked ? 'clicked' : ''} ${isActive ? 'active' : ''}`}
                onClick={() => handleCommonCommandClick(cmd)}
                disabled={!selectedAircraftCallsign || isLogging || isExecutingCommand}
                title={selectedAircraftCallsign ? `${cmd.label} for ${selectedAircraftCallsign}` : 'Select an aircraft first'}
              >
                <span className="command-icon">{cmd.icon}</span>
                <span className="command-label">{cmd.label}</span>
              </button>
            );
          })}
        </div>

        {/* Command Input Panel */}
        {activeCommandInput && selectedAircraftCallsign && (
          <div className="command-input-panel">
            <div className="input-header">
              <span className="input-title">
                {activeCommandInput === 'altitude' && 'Enter Altitude'}
                {activeCommandInput === 'heading' && 'Enter Heading'}
                {activeCommandInput === 'speed' && 'Enter Speed'}
              </span>
              <span className="input-target">for {selectedAircraftCallsign}</span>
            </div>
            <div className="input-row">
              <input
                type="number"
                className="command-input"
                placeholder={
                  activeCommandInput === 'altitude' ? 'FL or feet (e.g., 350 or 35000)' :
                  activeCommandInput === 'heading' ? 'Degrees (0-360)' :
                  'Knots'
                }
                value={commandValue}
                onChange={(e) => setCommandValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && commandValue) executeSimulationCommand();
                  if (e.key === 'Escape') cancelCommandInput();
                }}
                autoFocus
              />
              <span className="input-unit">
                {activeCommandInput === 'altitude' && (commandValue && parseFloat(commandValue) < 1000 ? 'FL' : 'ft')}
                {activeCommandInput === 'heading' && '°'}
                {activeCommandInput === 'speed' && 'kts'}
              </span>
            </div>
            <div className="input-actions">
              <button
                className="btn-execute"
                onClick={executeSimulationCommand}
                disabled={!commandValue || isExecutingCommand}
              >
                {isExecutingCommand ? 'Sending...' : 'Execute'}
              </button>
              <button
                className="btn-cancel"
                onClick={cancelCommandInput}
                disabled={isExecutingCommand}
              >
                Cancel
              </button>
            </div>
            {activeCommandInput === 'altitude' && (
              <p className="input-hint">Enter flight level (e.g., 350) or altitude in feet (e.g., 35000)</p>
            )}
          </div>
        )}

        {!selectedAircraftCallsign && (
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
