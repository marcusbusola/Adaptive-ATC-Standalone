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
  onAircraftSelect = null, // Callback to sync selection with RadarViewer
  conflicts = [], // Separation conflicts between aircraft
  // Gamification props
  safetyScore = 100,
  scoreChanges = [],
  pilotComplaints = [],
  // Active monitoring callbacks
  onNeedResolved = null,
  onAlertHandled = null
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

  // Active Monitoring state (needs inspection and emergency resolution)
  const [inspectedNeeds, setInspectedNeeds] = useState({}); // callsign -> { pending_needs: [], emergency_options: [] }
  const [isInspecting, setIsInspecting] = useState(false);
  const [isResolvingNeed, setIsResolvingNeed] = useState(false);
  const [isResolvingEmergency, setIsResolvingEmergency] = useState(false);
  const [emergencyFeedback, setEmergencyFeedback] = useState(null); // { correct, feedback, points }

  // UI state
  const [situationCollapsed, setSituationCollapsed] = useState(true);

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

  // Conflicts involving the selected aircraft
  const conflictsForSelectedAircraft = useMemo(() => {
    if (!selectedAircraftCallsign || !conflicts.length) return [];
    return conflicts.filter(
      conflict =>
        conflict.aircraft_1 === selectedAircraftCallsign ||
        conflict.aircraft_2 === selectedAircraftCallsign
    );
  }, [selectedAircraftCallsign, conflicts]);

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

  // ===== ACTIVE MONITORING HANDLERS =====

  // Inspect aircraft to reveal pending maintenance needs
  const inspectAircraft = useCallback(async (callsign) => {
    if (!sessionId || isInspecting) return;

    setIsInspecting(true);
    setActionError('');

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/api/sessions/${sessionId}/aircraft/${callsign}/inspect`,
        { method: 'POST' }
      );
      const data = await response.json();

      if (data.status === 'success') {
        setInspectedNeeds(prev => ({
          ...prev,
          [callsign]: {
            pending_needs: data.pending_needs || [],
            emergency_options: data.emergency_options || null,
            has_emergency: data.has_emergency,
            emergency_type: data.emergency_type,
            mood: data.mood,
            safety_score: data.safety_score,
            altitude: data.altitude,
            heading: data.heading,
            speed: data.speed,
            destination: data.destination,
            fuel_remaining: data.fuel_remaining,
            comm_status: data.comm_status,
            inspected_at: Date.now()
          }
        }));
        setActionToast(`Inspected ${callsign}: ${data.pending_needs?.length || 0} pending needs`);
      }
    } catch (err) {
      console.error('[ActionPanel] Failed to inspect aircraft:', err);
      setActionError('Failed to inspect aircraft');
    } finally {
      setIsInspecting(false);
    }
  }, [sessionId, isInspecting]);

  // Resolve a maintenance need
  const resolveNeed = useCallback(async (callsign, needType) => {
    if (!sessionId || isResolvingNeed) return;

    setIsResolvingNeed(true);
    setActionError('');

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/api/sessions/${sessionId}/aircraft/${callsign}/resolve-need`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ need_type: needType })
        }
      );
      const data = await response.json();

      if (data.resolved) {
        // Remove the resolved need from local state
        setInspectedNeeds(prev => ({
          ...prev,
          [callsign]: {
            ...prev[callsign],
            pending_needs: (prev[callsign]?.pending_needs || []).filter(n => n.type !== needType)
          }
        }));
        setActionToast(`Resolved: ${needType.replace(/_/g, ' ')}`);

        // Log the action
        logAction({
          id: `resolve_${needType}_${callsign}`,
          type: 'need_resolution',
          label: `Resolved ${needType.replace(/_/g, ' ')}`,
          target: callsign,
          command: `Resolved maintenance need: ${needType}`
        });

        // Notify parent of resolution
        onNeedResolved?.();
      }
    } catch (err) {
      console.error('[ActionPanel] Failed to resolve need:', err);
      setActionError('Failed to resolve need');
    } finally {
      setIsResolvingNeed(false);
    }
  }, [sessionId, isResolvingNeed, logAction, onNeedResolved]);

  // Submit emergency resolution choice
  const submitEmergencyResolution = useCallback(async (callsign, actionId, actionLabel) => {
    if (!sessionId || isResolvingEmergency) return;

    setIsResolvingEmergency(true);
    setActionError('');
    setEmergencyFeedback(null);

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/api/sessions/${sessionId}/aircraft/${callsign}/emergency-resolution`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action_id: actionId })
        }
      );
      const data = await response.json();

      if (data.status === 'success') {
        setEmergencyFeedback({
          correct: data.correct,
          feedback: data.feedback,
          points: data.points,
          emergency_resolved: data.emergency_resolved
        });

        // If emergency was resolved, clear the inspected state for this aircraft
        if (data.emergency_resolved) {
          setInspectedNeeds(prev => ({
            ...prev,
            [callsign]: {
              ...prev[callsign],
              has_emergency: false,
              emergency_options: null,
              emergency_type: null
            }
          }));

          // Notify parent of alert handled
          onAlertHandled?.();
        }

        // Log the action
        logAction({
          id: `emergency_${actionId}_${callsign}`,
          type: 'emergency_resolution',
          label: actionLabel,
          target: callsign,
          command: `Emergency resolution: ${actionLabel}`,
          correct: data.correct,
          points: data.points
        });

        // Clear feedback after 3 seconds
        setTimeout(() => setEmergencyFeedback(null), 3000);
      }
    } catch (err) {
      console.error('[ActionPanel] Failed to submit emergency resolution:', err);
      setActionError('Failed to submit resolution');
    } finally {
      setIsResolvingEmergency(false);
    }
  }, [sessionId, isResolvingEmergency, logAction, onAlertHandled]);

  // Get inspected data for selected aircraft
  const selectedAircraftInspection = useMemo(() => {
    if (!selectedAircraftCallsign) return null;
    return inspectedNeeds[selectedAircraftCallsign] || null;
  }, [selectedAircraftCallsign, inspectedNeeds]);

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

  // Get color for safety score progress bar (red to green gradient)
  const getScoreColor = (score) => {
    if (score >= 80) return '#4caf50'; // Green
    if (score >= 60) return '#8bc34a'; // Light green
    if (score >= 40) return '#ffeb3b'; // Yellow
    if (score >= 20) return '#ff9800'; // Orange
    return '#f44336'; // Red
  };

  return (
    <div className="action-panel">
      {/* Header - Fixed */}
      <div className="action-panel-header">
        <h2>Action Panel</h2>
        <div className="elapsed-time">{formatTime(elapsedTime)}</div>
      </div>

      {/* Safety Score Display */}
        <section className="panel-section safety-score-section">
        <h3>Safety Score</h3>
        <div className="safety-score-display">
          <span className={`score-value ${safetyScore >= 80 ? 'good' : safetyScore >= 40 ? 'warning' : 'danger'}`}>
            {safetyScore}
          </span>
          <span className="score-trend">
            {scoreChanges.length > 0 && scoreChanges[scoreChanges.length - 1]?.delta > 0 ? '↑' :
             scoreChanges.length > 0 && scoreChanges[scoreChanges.length - 1]?.delta < 0 ? '↓' : '—'}
          </span>
        </div>
        {scoreChanges.length > 0 && scoreChanges[scoreChanges.length - 1]?.reasons && (
          <div className="score-reason">
            {scoreChanges[scoreChanges.length - 1].reasons.join(', ')}
          </div>
        )}
        {pilotComplaints.length > 0 && (
          <div className="pilot-complaint">
            {pilotComplaints[pilotComplaints.length - 1]?.message}
          </div>
        )}
      </section>

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

      {/* Situation Context - Collapsible */}
      <section className={`panel-section situation-context ${situationCollapsed ? 'collapsed' : ''}`}>
        <h3
          className="collapsible-header"
          onClick={() => setSituationCollapsed(!situationCollapsed)}
          title={situationCollapsed ? 'Click to expand' : 'Click to collapse'}
        >
          Situation Context
          <span className="collapse-icon">{situationCollapsed ? '▶' : '▼'}</span>
        </h3>
        {!situationCollapsed && (
          <>
            <div className="scenario-name">{scenarioConfig.name}</div>
            <div className="phase-info">
              <span className="phase-label">Phase {currentPhase + 1}:</span>
              <span className="phase-name">{phaseConfig?.name || phaseDescription || 'Loading...'}</span>
            </div>
            <p className="context-description">
              {phaseConfig?.context || 'Monitor the situation and respond as needed.'}
            </p>
          </>
        )}
      </section>

      {/* Aircraft Selector */}
      <section className="panel-section aircraft-selector">
        <h3>Select Aircraft ({aircraftList.length})</h3>
        <div className="aircraft-buttons">
          {aircraftList.map(ac => {
            const hasPendingAlert = aircraftWithPendingAlerts.has(ac.callsign);
            const mood = ac.mood || 'happy';
            return (
              <button
                key={ac.callsign}
                className={`aircraft-btn ${selectedAircraftCallsign === ac.callsign ? 'selected' : ''}
                           ${ac.emergency ? 'emergency' : ''}
                           ${ac.comm_loss ? 'nordo' : ''}
                           ${hasPendingAlert ? 'pending-alert' : ''}
                           mood-${mood}`}
                onClick={() => handleAircraftSelect(ac.callsign)}
                title={`${ac.callsign} - FL${Math.floor((ac.altitude || 0) / 100)}${hasPendingAlert ? ' - ACTION REQUIRED' : ''}${mood !== 'happy' ? ` - Pilot ${mood}` : ''}`}
              >
                {ac.callsign}
                {ac.emergency && <span className="status-indicator emergency">!</span>}
                {ac.comm_loss && <span className="status-indicator nordo">X</span>}
                {hasPendingAlert && <span className="status-indicator pending">⚠</span>}
                {mood === 'annoyed' && <span className="mood-indicator annoyed">😐</span>}
                {mood === 'angry' && <span className="mood-indicator angry">😠</span>}
              </button>
            );
          })}
          {aircraftList.length === 0 && (
            <p className="no-aircraft">No aircraft in sector</p>
          )}
        </div>
      </section>

      {/* Dynamic Content Area - Active Monitoring & Emergency Resolution */}
        <section className="panel-section dynamic-content">
        {selectedAircraftData ? (
          // AIRCRAFT SELECTED
          <>
            <h3 className="selected-header">
              Selected: {selectedAircraftData.callsign}
              <span className={`mood-badge mood-${selectedAircraftData.mood || 'happy'}`}>
                {selectedAircraftData.mood === 'angry' ? '😠' : selectedAircraftData.mood === 'annoyed' ? '😐' : '😊'}
              </span>
            </h3>

            {/* EMERGENCY RESOLUTION MODE */}
            {selectedAircraftData.emergency && selectedAircraftInspection?.emergency_options ? (
              <div className="emergency-resolution-panel">
                <div className="emergency-header">
                  <span className="emergency-icon">🚨</span>
                  <span className="emergency-title">EMERGENCY: {selectedAircraftData.emergency_type?.replace(/_/g, ' ').toUpperCase()}</span>
                </div>
                <p className="emergency-prompt">Select the best resolution:</p>

                {emergencyFeedback && (
                  <div className={`emergency-feedback ${emergencyFeedback.correct ? 'correct' : 'incorrect'}`}>
                    <span className="feedback-icon">{emergencyFeedback.correct ? '✓' : '✗'}</span>
                    <span className="feedback-text">{emergencyFeedback.feedback}</span>
                    <span className="feedback-points">
                      {emergencyFeedback.points > 0 ? '+' : ''}{emergencyFeedback.points} pts
                    </span>
                  </div>
                )}

                <div className="emergency-options">
                  {selectedAircraftInspection.emergency_options.map((option, idx) => (
                    <button
                      key={option.id}
                      className={`emergency-option-btn ${option.correct ? 'correct-option' : ''}`}
                      onClick={() => submitEmergencyResolution(selectedAircraftCallsign, option.id, option.label)}
                      disabled={isResolvingEmergency}
                    >
                      <span className="option-number">{idx + 1}</span>
                      <span className="option-label">{option.label}</span>
                      {option.correct && <span className="resolve-tag">RESOLVES</span>}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* ACTIVE MONITORING MODE */
              <>
                {/* Inspect Button - for discovering needs */}
                <div className="inspect-section">
                  <button
                    className={`inspect-btn ${isInspecting ? 'loading' : ''}`}
                    onClick={() => inspectAircraft(selectedAircraftCallsign)}
                    disabled={isInspecting}
                  >
                    {isInspecting ? 'Checking...' : 'Check Status'}
                  </button>
                  {selectedAircraftInspection && (
                    <span className="last-inspected">
                      Last checked: {Math.round((Date.now() - selectedAircraftInspection.inspected_at) / 1000)}s ago
                    </span>
                  )}
                </div>

                {/* Pending Needs - shown after inspection */}
                {selectedAircraftInspection?.pending_needs?.length > 0 && (
                  <div className="pending-needs-section">
                    <h4>Pending Requests ({selectedAircraftInspection.pending_needs.length})</h4>
                    <div className="needs-list">
                      {selectedAircraftInspection.pending_needs.map((need, idx) => (
                        <div key={`${need.type}-${idx}`} className={`need-item priority-${need.priority}`}>
                          <div className="need-info">
                            <span className="need-label">{need.label}</span>
                            <span className="need-description">{need.description}</span>
                          </div>
                          <button
                            className="resolve-need-btn"
                            onClick={() => resolveNeed(selectedAircraftCallsign, need.type)}
                            disabled={isResolvingNeed}
                          >
                            Resolve
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No needs after inspection */}
                {selectedAircraftInspection && selectedAircraftInspection.pending_needs?.length === 0 && (
                  <div className="no-needs-message">
                    <span className="check-icon">✓</span>
                    <span>No pending requests</span>
                  </div>
                )}

                {/* Conflict Warnings */}
                {conflictsForSelectedAircraft.length > 0 && (
                  <div className="conflict-warning-box">
                    <div className="conflict-warning-header">
                      <span className="conflict-icon">⚠</span>
                      <span>SEPARATION WARNING</span>
                    </div>
                    {conflictsForSelectedAircraft.map((conflict, idx) => {
                      const otherAircraft = conflict.aircraft_1 === selectedAircraftCallsign
                        ? conflict.aircraft_2
                        : conflict.aircraft_1;
                      return (
                        <div key={idx} className={`conflict-detail severity-${conflict.severity}`}>
                          <div className="conflict-with">
                            <span className="conflict-label">With:</span>
                            <span className="conflict-callsign">{otherAircraft}</span>
                          </div>
                          <div className="conflict-separation">
                            <span className="separation-item">
                              <span className="sep-label">H:</span>
                              <span className="sep-value">{conflict.horizontal_separation_nm} nm</span>
                            </span>
                            <span className="separation-item">
                              <span className="sep-label">V:</span>
                              <span className="sep-value">{conflict.vertical_separation_ft} ft</span>
                            </span>
                          </div>
                          <span className={`severity-badge ${conflict.severity}`}>
                            {conflict.severity.toUpperCase()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Aircraft Telemetry */}
                <div className="aircraft-info-section">
                  <h4>Aircraft Information</h4>

                  {selectedAircraftData.safety_score !== undefined && (
                    <div className="aircraft-safety-score">
                      <span className="score-label">Safety</span>
                      <div className="score-bar-container">
                        <div
                          className="score-bar-fill"
                          style={{
                            width: `${selectedAircraftData.safety_score}%`,
                            backgroundColor: getScoreColor(selectedAircraftData.safety_score)
                          }}
                        />
                      </div>
                      <span className="score-percentage">{Math.round(selectedAircraftData.safety_score)}%</span>
                    </div>
                  )}

                  <div className="aircraft-telemetry">
                    <div className="telemetry-row">
                      <span className="telemetry-label">Altitude:</span>
                      <span className="telemetry-value">{Math.floor(selectedAircraftData.altitude || 0).toLocaleString()} ft</span>
                    </div>
                    <div className="telemetry-row">
                      <span className="telemetry-label">Speed:</span>
                      <span className="telemetry-value">{Math.floor(selectedAircraftData.speed || 0)} kts</span>
                    </div>
                    <div className="telemetry-row">
                      <span className="telemetry-label">Heading:</span>
                      <span className="telemetry-value">{Math.floor(selectedAircraftData.heading || 0)}°</span>
                    </div>
                    {selectedAircraftData.destination && (
                      <div className="telemetry-row">
                        <span className="telemetry-label">Destination:</span>
                        <span className="telemetry-value destination">{selectedAircraftData.destination}</span>
                      </div>
                    )}
                    <div className="telemetry-row status">
                      <span className="telemetry-label">Status:</span>
                      {selectedAircraftData.emergency ? (
                        <span className="telemetry-value emergency">
                          EMERGENCY{selectedAircraftData.emergency_type ? ` (${selectedAircraftData.emergency_type})` : ''}
                        </span>
                      ) : selectedAircraftData.comm_status === 'lost' || selectedAircraftData.comm_loss ? (
                        <span className="telemetry-value nordo">COMM LOSS</span>
                      ) : (
                        <span className="telemetry-value normal">NORMAL</span>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          // NO SELECTION: Prompt to select aircraft for active monitoring
          <div className="no-selection-prompt">
            <div className="prompt-icon">✈</div>
            <h4>Active Monitoring</h4>
            <p>Select an aircraft to check its status and pending requests.</p>
            <p className="hint-text">Aircraft may have needs that aren't visible until you check them.</p>
          </div>
        )}
      </section>

      {/* Common ATC Commands */}
        <section className="panel-section common-commands">
        {/* Only show header if no Required Actions are displayed */}
        {commandsForSelectedAircraft.length === 0 && (
          <h3>ATC Commands</h3>
        )}
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
