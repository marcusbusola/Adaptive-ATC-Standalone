import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import RadarViewer from './RadarViewer';
import ActionPanel from './ActionPanel';
import Instructions from './Instructions';
import TraditionalModalAlert from './TraditionalModalAlert';
import AdaptiveBannerAlert from './AdaptiveBannerAlert';
import MLPredictiveAlert from './MLPredictiveAlert';
import SurveyManager from './Surveys/SurveyManager';
import CommandPalette from './CommandPalette';
import { SuccessToastContainer } from './SuccessToast';
import ScenarioTransition from './ScenarioTransition';
import ShiftOverScreen from './ShiftOverScreen';
import { logBehavioralEvent, logAlertDisplay, logAlertAcknowledgment } from '../services/api';
import { getApiBaseUrl } from '../utils/apiConfig';
import { SCENARIO_ACTIONS } from '../config/scenarioActions';
import { playSuccessSound } from '../utils/alertSounds';
import useBehavioralTracking from '../hooks/useBehavioralTracking';
import useWorkloadState from '../hooks/useWorkloadState';
import { computePresentation } from '../utils/alertPresentationEngine';
import { playNudgeSound, playAlertByIntensity } from '../utils/alertAudio';
import '../styles/session.css';

const API_URL = getApiBaseUrl();

// Polling interval in milliseconds
const POLLING_INTERVAL = 2000;

// Event types that should generate visible alerts to participants
// Internal events (phase_transition, internal, aircraft_spawn) are excluded
const ALERT_EVENT_TYPES = [
    'emergency',
    'comm_loss',
    'conflict',
    'weather',
    'altitude_deviation',
    'vfr_intrusion',
    'comm_failure',
    'system_crash',
    'conflict_threshold',
    'false_alarm',
    'delayed_alert'
];

// Event types that are condition-specific
const CONDITION_SPECIFIC_EVENTS = {
    'ml_prediction': 3  // Only show ML predictions for Condition 3
};

// Time in milliseconds before acknowledged alert reappears if not resolved
const ALERT_HIDE_DURATION = 15000;

function Session() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const returnTo = searchParams.get('returnTo');
    const queueId = searchParams.get('queueId');
    const itemIndex = searchParams.get('itemIndex');

    const [sessionDetails, setSessionDetails] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [showInstructions, setShowInstructions] = useState(true);
    const [scenarioStarted, setScenarioStarted] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [currentPhase, setCurrentPhase] = useState(0);
    const [phaseDescription, setPhaseDescription] = useState('');
    const [aircraft, setAircraft] = useState({});
    const [activeAlerts, setActiveAlerts] = useState([]);
    const [pendingAlerts, setPendingAlerts] = useState([]); // Acknowledged but not resolved
    const [successToasts, setSuccessToasts] = useState([]); // Success notifications
    const [conflicts, setConflicts] = useState([]); // Aircraft separation conflicts
    const [alertHistory, setAlertHistory] = useState([]);
    const [sagatProbes, setSagatProbes] = useState([]);
    const [scenarioComplete, setScenarioComplete] = useState(false);

    // Gamification state
    const [safetyScore, setSafetyScore] = useState(100); // 0-100 scale (target: 90+)
    const [scoreChanges, setScoreChanges] = useState([]);
    const [pilotComplaints, setPilotComplaints] = useState([]);
    const [showSurvey, setShowSurvey] = useState(false);
    const [showSurveyIntro, setShowSurveyIntro] = useState(false);
    const [selectedAircraftCallsign, setSelectedAircraftCallsign] = useState(null);
    const [showShiftOver, setShowShiftOver] = useState(false); // End-of-shift summary screen
    const [alertsHandledCount, setAlertsHandledCount] = useState(0); // Track alerts handled
    const [needsResolvedCount, setNeedsResolvedCount] = useState(0); // Track needs resolved

    // Multi-scenario queue state
    const [queueScenarios, setQueueScenarios] = useState([]); // All scenarios in queue
    const [currentScenarioIndex, setCurrentScenarioIndex] = useState(0);
    const [showTransition, setShowTransition] = useState(false);
    const [isLoadingNextScenario, setIsLoadingNextScenario] = useState(false);

    const timerRef = useRef(null);
    const pollingRef = useRef(null);
    const scenarioStartedRef = useRef(false); // Ref to avoid stale closure in polling
    const startTimeRef = useRef(null);
    const pendingAlertTimers = useRef({}); // Timers for pending alerts
    const nudgeIntervalRef = useRef(null); // Timer for idle nudging

    // Behavioral tracking for workload computation
    const behavioralTracking = useBehavioralTracking(sessionId);

    // Workload state monitoring
    const { workloadState, currentFocus, unresolvedCount, shouldNudge } = useWorkloadState({
        getRecentEventCount: behavioralTracking.getRecentEventCount,
        selectedAircraft: selectedAircraftCallsign,
        activePanel: 'radar',
        pendingAlerts,
        conflicts
    });

    const fetchSessionDetails = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await fetch(`${API_URL}/api/sessions/${sessionId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch session details.');
            }
            const data = await response.json();
            if (!data.aircraft_config || data.aircraft_config.length === 0) {
                console.warn('[Session] No aircraft_config in session details');
            }
            setSessionDetails(data);
        } catch (err) {
            console.error('[Session] Failed to fetch session details:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [sessionId]);

    // Load queue data from session details (no auth required)
    // Queue items are now embedded in the session details response
    useEffect(() => {
        if (sessionDetails?.queue_items && sessionDetails.queue_items.length > 0) {
            console.log('[Session] Queue items loaded from session details:', sessionDetails.queue_items.length);
            setQueueScenarios(sessionDetails.queue_items);
            // Use queue_item_index from session details if available, otherwise from URL param
            const idx = sessionDetails.queue_item_index ?? (parseInt(itemIndex) || 0);
            setCurrentScenarioIndex(idx);
        } else if (queueId) {
            // Fallback: queue context in URL but not in session details (shouldn't happen normally)
            console.warn('[Session] Queue ID in URL but no queue_items in session details');
        }
    }, [sessionDetails?.queue_items, sessionDetails?.queue_item_index, itemIndex, queueId]);

    const handleEndSession = useCallback(async (reason = 'completed') => {
        // Stop timers
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }

        // Clear cached session state
        try {
            sessionStorage.removeItem(`session_${sessionId}`);
        } catch (e) {
            // Ignore storage errors
        }

        setIsLoading(true);
        setError('');
        try {
            // End session on backend
            const response = await fetch(`${API_URL}/api/sessions/${sessionId}/end`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: reason }),
            });
            if (!response.ok) {
                throw new Error('Failed to end session.');
            }

            // If part of queue, mark item as complete (session-scoped endpoint to prevent spoofing)
            if (queueId && itemIndex !== null) {
                const parsedItemIndex = Number(itemIndex);
                if (!Number.isNaN(parsedItemIndex)) {
                    try {
                        const responseData = await response.json();
                        await fetch(`${API_URL}/api/queues/${queueId}/items/${parsedItemIndex}/complete-from-session`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                session_id: sessionId,
                                results: responseData
                            })
                        });
                    } catch (err) {
                        console.error('Failed to update queue:', err);
                        // Don't block flow if queue update fails
                    }
                }
            }

            // Check if there are more scenarios in the queue
            const hasMoreScenarios = queueScenarios.length > 0 && currentScenarioIndex < queueScenarios.length - 1;

            if (hasMoreScenarios) {
                // Show transition screen instead of surveys
                setScenarioComplete(true);
                setShowTransition(true);
            } else {
                // Last scenario (or no queue) - show shift over screen first
                setScenarioComplete(true);
                setShowShiftOver(true);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [sessionId, queueId, itemIndex, queueScenarios, currentScenarioIndex]);

    const handleSurveyComplete = useCallback((data) => {
        // Show brief completion message, then redirect
        setTimeout(() => {
            if (returnTo) {
                // Return to queue if launched from queue
                window.location.href = returnTo;
            } else {
                // Return to participant lobby
                navigate('/participant');
            }
        }, 2000);
    }, [returnTo, navigate]);

    // Handler for ShiftOverScreen continue button
    const handleShiftOverContinue = useCallback(() => {
        setShowShiftOver(false);
        setShowSurveyIntro(true);
        setTimeout(() => setShowSurvey(true), 1000);
    }, []);

    // Handle transition countdown complete - start next scenario
    const handleTransitionComplete = useCallback(async () => {
        if (isLoadingNextScenario) return;

        setIsLoadingNextScenario(true);
        const nextIndex = currentScenarioIndex + 1;
        const nextScenario = queueScenarios[nextIndex];

        if (!nextScenario) {
            console.error('[Session] No next scenario found');
            setShowTransition(false);
            setShowSurvey(true);
            return;
        }

        console.log('[Session] Starting next scenario:', {
            index: nextIndex,
            scenarioId: nextScenario.scenario_id,
            condition: nextScenario.condition
        });

        try {
            // Start new session on backend
            const response = await fetch(`${API_URL}/api/sessions/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scenario: nextScenario.scenario_id,
                    condition: nextScenario.condition,
                    participant_id: nextScenario.participant_id,
                    queue_id: queueId,
                    queue_item_index: nextIndex
                })
            });

            if (!response.ok) {
                throw new Error('Failed to start next scenario');
            }

            const data = await response.json();
            const newSessionId = data.session_id;

            // Navigate to new session
            window.location.href = `/session/${newSessionId}?queueId=${queueId}&itemIndex=${nextIndex}`;

        } catch (err) {
            console.error('[Session] Failed to start next scenario:', err);
            setError('Failed to start next scenario. Please try again.');
            setShowTransition(false);
            setIsLoadingNextScenario(false);
        }
    }, [currentScenarioIndex, queueScenarios, queueId, isLoadingNextScenario]);

    // CRITICAL: Polling loop to get triggered events from backend
    const pollScenarioUpdate = useCallback(async () => {
        // Use ref instead of state to avoid stale closure issue
        if (!scenarioStartedRef.current || scenarioComplete) return;

        const currentElapsedTime = startTimeRef.current
            ? (Date.now() - startTimeRef.current) / 1000
            : elapsedTime;

        try {
            const response = await fetch(`${API_URL}/api/sessions/${sessionId}/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ elapsed_time: currentElapsedTime }),
            });

            if (!response.ok) {
                console.error('[Polling] Failed to poll scenario update, status:', response.status);
                return;
            }

            const data = await response.json();

            // Update scenario state
            setElapsedTime(data.elapsed_time);
            setCurrentPhase(data.current_phase);
            setPhaseDescription(data.phase_description);
            setAircraft(data.aircraft || {});

            // Update gamification state
            if (data.safety_score !== undefined) {
                setSafetyScore(data.safety_score);
            }
            if (data.score_changes) {
                setScoreChanges(data.score_changes);
            }
            if (data.pilot_complaints) {
                setPilotComplaints(data.pilot_complaints);
            }

            // Update conflicts (separation violations)
            if (data.detected_conflicts) {
                setConflicts(data.detected_conflicts);
            }

            // Handle triggered events (convert to alerts)
            if (data.triggered_events && data.triggered_events.length > 0) {
                await processTriggeredEvents(data.triggered_events);
            }

            // Handle SAGAT probes
            if (data.triggered_probes && data.triggered_probes.length > 0) {
                setSagatProbes(prev => [...prev, ...data.triggered_probes]);
            }

            // Check if scenario is complete
            if (data.scenario_complete) {
                setScenarioComplete(true);
                handleEndSession('scenario_completed');
            }

            // Cache session state for recovery on navigation back
            try {
                sessionStorage.setItem(`session_${sessionId}`, JSON.stringify({
                    elapsed_time: data.elapsed_time,
                    current_phase: data.current_phase,
                    phase_description: data.phase_description,
                    safety_score: data.safety_score,
                    scenario_started: true,
                    cached_at: Date.now()
                }));
            } catch (e) {
                // Ignore storage errors
            }

        } catch (err) {
            console.error('[Polling] Error:', err);
        }
    }, [sessionId, scenarioComplete, elapsedTime, handleEndSession]); // Removed scenarioStarted, using ref instead

    // Convert scenario events to alerts based on condition
    // Uses stable alert IDs to deduplicate and enable proper escalation
    // Filters out internal events (phase_transition, aircraft_spawn, internal)
    // and condition-specific events (ml_prediction only for Condition 3)
    const processTriggeredEvents = async (events) => {
        const condition = sessionDetails?.condition || 1;

        for (const event of events) {
            // Filter out internal/infrastructure events that shouldn't be shown to users
            if (!ALERT_EVENT_TYPES.includes(event.event_type)) {
                // Check if it's a condition-specific event
                const requiredCondition = CONDITION_SPECIFIC_EVENTS[event.event_type];
                if (requiredCondition !== undefined) {
                    // Only show if we're in the correct condition
                    if (condition !== requiredCondition) {
                        console.log(`[Alert] Skipping ${event.event_type} - only for Condition ${requiredCondition}, current: ${condition}`);
                        continue;
                    }
                } else {
                    // Internal event (phase_transition, internal, aircraft_spawn) - skip entirely
                    console.log(`[Alert] Skipping internal event: ${event.event_type}`);
                    continue;
                }
            }

            // Stable alert ID based on event type + target (no timestamp)
            const alertId = `alert_${event.event_type}_${event.target}`;
            const newPriority = event.data?.priority || 'medium';

            // Check if this alert already exists in active, pending, or history
            const existsInActive = activeAlerts.some(a => a.id === alertId);
            const existsInPending = pendingAlerts.some(a => a.id === alertId);
            const existsInHistory = alertHistory.some(a => a.id === alertId);

            if (existsInActive) {
                // Alert already showing - escalate it
                console.log(`[Alert] Escalating existing active alert: ${alertId}`);
                setActiveAlerts(prev => prev.map(a => {
                    if (a.id === alertId) {
                        const newEscalationLevel = (a.escalationLevel || 1) + 1;
                        return {
                            ...a,
                            escalationLevel: newEscalationLevel,
                            priority: getPriorityMax(a.priority, newPriority),
                            message: event.data?.message || a.message,
                            lastEscalatedAt: Date.now()
                        };
                    }
                    return a;
                }));
                continue; // Skip to next event
            }

            if (existsInPending) {
                // Alert is pending (acknowledged but not resolved) - don't create duplicate
                console.log(`[Alert] Alert already pending, skipping: ${alertId}`);
                continue;
            }

            if (existsInHistory && !existsInActive && !existsInPending) {
                // Alert was previously resolved/dismissed - could be a new occurrence
                // Check if it was resolved recently (within 30 seconds)
                const historyAlert = alertHistory.find(a => a.id === alertId);
                if (historyAlert?.resolved && (Date.now() - (historyAlert.resolvedAt || 0)) < 30000) {
                    console.log(`[Alert] Alert recently resolved, skipping: ${alertId}`);
                    continue;
                }
            }

            // Map priority to severity for presentation engine
            const severityMap = {
                'critical': 'critical',
                'high': 'high',
                'medium': 'medium',
                'low': 'low'
            };
            const severity = severityMap[newPriority] || 'medium';

            // Compute presentation based on condition, workload, and focus
            const presentation = computePresentation({
                eventType: event.event_type,
                severity: severity,
                condition: condition,
                workloadState: workloadState,
                currentFocus: currentFocus,
                unresolvedItems: unresolvedCount,
                affectedAircraft: event.target
            });

            // New alert - create it with presentation data
            const alertData = {
                id: alertId,
                type: event.event_type,
                target: event.target,
                priority: newPriority,
                message: event.data?.message || `${event.event_type}: ${event.target}`,
                details: event.data?.details || {},
                timestamp: Date.now(),
                condition: condition,
                acknowledged: false,
                escalationLevel: 1,
                reappearCount: 0,
                // Presentation data
                visualIntensity: presentation.visual,
                audioIntensity: presentation.audio,
                logicMode: presentation.logicMode,
                workloadStateAtPresentation: presentation.workloadStateAtPresentation,
                shouldNudge: presentation.shouldNudge,
                nudgeCount: 0
            };

            // Log alert display with workload context
            try {
                await logAlertDisplay(sessionId, {
                    alert_id: alertId,
                    alert_type: event.event_type,
                    priority: alertData.priority,
                    message: alertData.message,
                    aircraft_id: event.target,
                    // Workload context for research logging
                    workload_state: workloadState,
                    visual_intensity: alertData.visualIntensity,
                    audio_intensity: alertData.audioIntensity,
                    logic_mode: alertData.logicMode,
                    current_focus_aircraft: currentFocus?.selectedAircraft || null
                });
            } catch (err) {
                console.error('Failed to log alert display:', err);
            }

            console.log(`[Alert] Creating new alert: ${alertId}`);
            setActiveAlerts(prev => [...prev, alertData]);
            setAlertHistory(prev => [...prev, alertData]);
        }
    };

    // Helper to get the higher priority
    const getPriorityMax = (p1, p2) => {
        const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
        return (priorityOrder[p1] || 0) >= (priorityOrder[p2] || 0) ? p1 : p2;
    };

    /**
     * Get expected resolution actions for an alert based on scenario and phase
     * Returns array of action IDs that would resolve this alert
     */
    const getExpectedActionsForAlert = useCallback((alert) => {
        const scenario = sessionDetails?.scenario;
        const phaseNum = currentPhase + 1; // Phases are 1-indexed in config

        if (!scenario || !SCENARIO_ACTIONS[scenario]) return [];

        const phaseConfig = SCENARIO_ACTIONS[scenario].phases[phaseNum];
        if (!phaseConfig) return [];

        // Find actions that target this alert's aircraft
        const targetAircraft = alert.target;
        const matchingActions = phaseConfig.availableActions?.filter(action =>
            action.target === targetAircraft ||
            action.target === 'all' ||
            action.target === 'both' ||
            action.target === 'multiple' ||
            action.target === 'system' ||
            (action.target && action.target.includes(targetAircraft))
        ) || [];

        // Return the IDs of expected actions that match this alert's target
        const expectedIds = phaseConfig.expectedActions || [];
        return matchingActions
            .filter(action => expectedIds.includes(action.id))
            .map(action => action.id);
    }, [sessionDetails?.scenario, currentPhase]);

    /**
     * Check if an action resolves any pending alerts
     */
    const checkActionResolvesAlert = useCallback((actionData) => {
        const actionId = actionData.action_id;
        const targetAircraft = actionData.target_aircraft;

        // Find pending alerts that could be resolved by this action
        const resolvedAlerts = pendingAlerts.filter(alert => {
            const expectedActions = getExpectedActionsForAlert(alert);

            // Check if this action is expected for this alert
            if (expectedActions.includes(actionId)) {
                return true;
            }

            // Also check if any action on the target aircraft could resolve it
            if (targetAircraft && alert.target === targetAircraft) {
                return expectedActions.length > 0 && expectedActions.includes(actionId);
            }

            return false;
        });

        return resolvedAlerts;
    }, [pendingAlerts, getExpectedActionsForAlert]);

    /**
     * Show success toast when alert is resolved
     */
    const showSuccessToast = useCallback((alert, actionLabel) => {
        // Play success confirmation sound
        playSuccessSound();

        const toastId = `toast_${alert.id}_${Date.now()}`;
        const newToast = {
            id: toastId,
            message: `${alert.target} situation handled correctly`,
            aircraft: alert.target,
            actionTaken: actionLabel,
            alertType: alert.type,
            duration: 3000
        };

        setSuccessToasts(prev => [...prev, newToast]);
    }, []);

    /**
     * Dismiss success toast
     */
    const dismissSuccessToast = useCallback((toastId) => {
        setSuccessToasts(prev => prev.filter(t => t.id !== toastId));
    }, []);

    /**
     * Handle alert reappearance after hide duration
     */
    const handleAlertReappear = useCallback((alert) => {
        console.log(`[DEBUG] Reappear timer fired for alert ${alert.id}. Moving from pending back to active.`);
        // Remove from pending
        setPendingAlerts(prev => prev.filter(a => a.id !== alert.id));

        // Clear the timer
        if (pendingAlertTimers.current[alert.id]) {
            clearTimeout(pendingAlertTimers.current[alert.id]);
            delete pendingAlertTimers.current[alert.id];
        }

        const newReappearCount = (alert.reappearCount || 0) + 1;
        const newEscalationLevel = (alert.escalationLevel || 1) + 1;

        // Add back to active alerts with escalated state
        const escalatedAlert = {
            ...alert,
            isEscalated: true,
            reappearCount: newReappearCount,
            escalationLevel: newEscalationLevel,
            // Keep original timestamp for tracking, but record reappear time
            originalTimestamp: alert.originalTimestamp || alert.timestamp,
            timestamp: Date.now() // Reset for new response time tracking
        };

        setActiveAlerts(prev => [...prev, escalatedAlert]);

        // Log the reappearance
        console.log(`[Alert] Alert reappeared (escalated): ${alert.id}, reappear count: ${newReappearCount}, escalation level: ${newEscalationLevel}`);
    }, []);

    // Handle alert acknowledgment - for traditional alerts, this hides them for 15 seconds
    const handleAlertAcknowledge = async (alert, actionTaken = null) => {
        const responseTime = Date.now() - alert.timestamp;
        const condition = sessionDetails?.condition || 1;

        // Log acknowledgment
        try {
            await logAlertAcknowledgment(sessionId, alert.id, {
                acknowledged_at: new Date().toISOString(),
                response_time_ms: responseTime,
                action_taken: actionTaken
            });
        } catch (err) {
            console.error('Failed to log alert acknowledgment:', err);
        }

        // For ML predictions (Condition 3), resolve the prediction when accepted
        // This prevents the real alert from appearing later
        if (condition === 3 && actionTaken === 'accepted' && alert.details?.prediction_id) {
            try {
                const response = await fetch(`${API_URL}/api/sessions/${sessionId}/predictions/${alert.details.prediction_id}/resolve`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prediction_id: alert.details.prediction_id,
                        action_taken: actionTaken,
                        resolved_at: new Date().toISOString()
                    })
                });
                if (response.ok) {
                    console.log(`[ML Prediction] Prediction resolved: ${alert.details.prediction_id}`);
                }
            } catch (err) {
                console.error('Failed to resolve ML prediction:', err);
            }
        }

        // Remove from active alerts
        setActiveAlerts(prev => prev.filter(a => a.id !== alert.id));

        // For traditional alerts (condition 1), move to pending instead of dismissing
        if (condition === 1) {
            // Add to pending alerts
            const pendingAlert = {
                ...alert,
                acknowledgedAt: Date.now(),
                responseTime
            };
            setPendingAlerts(prev => [...prev, pendingAlert]);

            // Set timer for reappearance if not resolved
            const timerId = setTimeout(() => {
                handleAlertReappear(pendingAlert);
            }, ALERT_HIDE_DURATION);
            pendingAlertTimers.current[alert.id] = timerId;

            console.log(`[DEBUG] Traditional alert ${alert.id} acknowledged. Reappear timer set for ${ALERT_HIDE_DURATION / 1000}s. Timer ID: ${timerId}`);
        }

        // Update history
        setAlertHistory(prev => prev.map(a =>
            a.id === alert.id ? { ...a, acknowledged: true, responseTime } : a
        ));
    };

    // Handle alert dismiss (for non-blocking alerts)
    const handleAlertDismiss = async (alert) => {
        const displayTime = Date.now() - alert.timestamp;

        try {
            await fetch(`${API_URL}/api/sessions/${sessionId}/alerts/${alert.id}/dismiss`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dismissed_at: new Date().toISOString(),
                    time_displayed_ms: displayTime
                })
            });
        } catch (err) {
            console.error('Failed to log alert dismissal:', err);
        }

        setActiveAlerts(prev => prev.filter(a => a.id !== alert.id));
    };

    const handleContinueToExperiment = useCallback(async () => {
        setShowInstructions(false);
        // Start the scenario on the backend
        try {
            const response = await fetch(`${API_URL}/api/sessions/${sessionId}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!response.ok) {
                throw new Error('Failed to start scenario on backend.');
            }

            const data = await response.json();
            console.log('Scenario started:', data);

            setScenarioStarted(true);
            scenarioStartedRef.current = true; // Set ref immediately for polling
            startTimeRef.current = Date.now();

            // Start behavioral tracking for workload computation
            behavioralTracking.startTracking();

            // Start the local timer for display
            timerRef.current = setInterval(() => {
                setElapsedTime(prevTime => prevTime + 1);
            }, 1000);

            // Start the polling loop - CRITICAL for triggering events
            pollingRef.current = setInterval(pollScenarioUpdate, POLLING_INTERVAL);

        } catch (err) {
            setError(err.message);
        }
    }, [sessionId, pollScenarioUpdate]);

    // Handle aircraft selection - syncs between RadarViewer and ActionPanel
    const handleAircraftSelect = useCallback((aircraftOrCallsign) => {
        if (aircraftOrCallsign === null) {
            setSelectedAircraftCallsign(null);
        } else if (typeof aircraftOrCallsign === 'string') {
            // Callsign passed (from ActionPanel)
            setSelectedAircraftCallsign(aircraftOrCallsign);
        } else {
            // Full aircraft object passed (from RadarViewer)
            setSelectedAircraftCallsign(aircraftOrCallsign?.callsign || null);
        }
    }, []);

    const handleCommand = async (commandString) => {
        console.log(`Issuing command: ${commandString}`);
        try {
            await fetch(`${API_URL}/api/sessions/${sessionId}/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: commandString }),
            });
        } catch (err) {
            console.error('Failed to send command:', err);
        }
    };

    /**
     * Handle action logged from ActionPanel - check if it resolves any pending alerts
     */
    const handleActionLogged = useCallback(async (actionData) => {
        console.log('[Session] Action logged:', actionData);

        // Check if this action resolves any pending alerts
        const resolvedAlerts = checkActionResolvesAlert(actionData);

        if (resolvedAlerts.length > 0) {
            console.log('[Session] Action resolves pending alerts:', resolvedAlerts.map(a => a.id));

            for (const alert of resolvedAlerts) {
                // Clear the reappear timer
                if (pendingAlertTimers.current[alert.id]) {
                    const timerId = pendingAlertTimers.current[alert.id];
                    console.log(`[DEBUG] Action resolves pending alert ${alert.id}. Clearing reappear timer ID: ${timerId}.`);
                    clearTimeout(timerId);
                    delete pendingAlertTimers.current[alert.id];
                }

                // Show success toast
                showSuccessToast(alert, actionData.action_label);

                // Log to backend that the alert was resolved via this action
                try {
                    await logAlertAcknowledgment(sessionId, alert.id, {
                        acknowledged_at: new Date().toISOString(),
                        response_time_ms: null,
                        action_taken: actionData.action_id,
                        action_correct: true
                    });
                } catch (err) {
                    console.error('Failed to record alert resolution via action:', err);
                }

                // Update alert history to mark as resolved
                setAlertHistory(prev => prev.map(a =>
                    a.id === alert.id ? { ...a, resolved: true, resolvedBy: actionData.action_id } : a
                ));
            }

            // Remove resolved alerts from pending
            const resolvedIds = resolvedAlerts.map(a => a.id);
            setPendingAlerts(prev => prev.filter(a => !resolvedIds.includes(a.id)));
        }
    }, [checkActionResolvesAlert, showSuccessToast]);

    useEffect(() => {
        fetchSessionDetails();
        // Queue data is now loaded automatically via useEffect when sessionDetails arrives
    }, [sessionId, fetchSessionDetails]);

    // Check for cached session state on mount (for recovery after back navigation)
    useEffect(() => {
        if (!sessionDetails || scenarioStarted) return;

        try {
            const cached = sessionStorage.getItem(`session_${sessionId}`);
            if (cached) {
                const cachedState = JSON.parse(cached);
                // Only restore if cached recently (within 30 minutes) and scenario was started
                const cacheAge = Date.now() - cachedState.cached_at;
                if (cachedState.scenario_started && cacheAge < 30 * 60 * 1000) {
                    console.log('[Session] Restoring cached state from navigation');
                    setShowInstructions(false);
                    setScenarioStarted(true);
                    scenarioStartedRef.current = true;
                    startTimeRef.current = Date.now() - (cachedState.elapsed_time * 1000);
                    setElapsedTime(cachedState.elapsed_time);
                    setCurrentPhase(cachedState.current_phase);
                    setPhaseDescription(cachedState.phase_description || '');
                    if (cachedState.safety_score !== undefined) {
                        setSafetyScore(cachedState.safety_score);
                    }
                }
            }
        } catch (e) {
            console.warn('[Session] Failed to restore cached state:', e);
        }
    }, [sessionId, sessionDetails, scenarioStarted]);

    // Log when aircraftConfig is available
    useEffect(() => {
        if (sessionDetails?.aircraft_config) {
            console.log('[Session] ✓ aircraftConfig prop ready to pass to BlueSkyViewer:', {
                count: sessionDetails.aircraft_config.length,
                callsigns: sessionDetails.aircraft_config.map(ac => ac.callsign)
            });
        }
    }, [sessionDetails?.aircraft_config]);

    // Effect to check for session end based on duration
    useEffect(() => {
        if (scenarioStarted && sessionDetails?.scenario_duration && elapsedTime >= sessionDetails.scenario_duration) {
            handleEndSession('scenario_completed');
        }
    }, [scenarioStarted, sessionDetails, elapsedTime, handleEndSession]);

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
            }
            // Clear all pending alert timers
            Object.values(pendingAlertTimers.current).forEach(timer => {
                clearTimeout(timer);
            });
            pendingAlertTimers.current = {};
        };
    }, []);

    // Warn user before leaving during active session
    useEffect(() => {
        if (scenarioStarted && !scenarioComplete) {
            const handleBeforeUnload = (e) => {
                e.preventDefault();
                e.returnValue = ''; // Required for Chrome
                return ''; // For older browsers
            };
            window.addEventListener('beforeunload', handleBeforeUnload);
            return () => window.removeEventListener('beforeunload', handleBeforeUnload);
        }
    }, [scenarioStarted, scenarioComplete]);

    // Idle Nudging for ML-Based Condition (Condition 3)
    // When player is idle and there are unresolved alerts, increase alert salience
    useEffect(() => {
        // Only for Condition 3
        if (sessionDetails?.condition !== 3) return;

        // Clear any existing nudge interval
        if (nudgeIntervalRef.current) {
            clearInterval(nudgeIntervalRef.current);
            nudgeIntervalRef.current = null;
        }

        // Only nudge when idle with unresolved items
        if (workloadState !== 'idle' || unresolvedCount === 0) return;

        console.log('[Nudge] Starting idle nudging - workload:', workloadState, 'unresolved:', unresolvedCount);

        // Set up nudge interval (every 10 seconds)
        nudgeIntervalRef.current = setInterval(() => {
            // Increase visual intensity on pending alerts
            setPendingAlerts(prev => prev.map(alert => ({
                ...alert,
                visualIntensity: Math.min((alert.visualIntensity || 3) + 1, 5),
                nudgeCount: (alert.nudgeCount || 0) + 1,
                isNudge: true
            })));

            // Also boost active alerts
            setActiveAlerts(prev => prev.map(alert => ({
                ...alert,
                visualIntensity: Math.min((alert.visualIntensity || 3) + 1, 5),
                nudgeCount: (alert.nudgeCount || 0) + 1,
                isNudge: true
            })));

            // Play nudge sound
            playNudgeSound();
            console.log('[Nudge] Nudge triggered for idle player');
        }, 10000); // Every 10 seconds

        return () => {
            if (nudgeIntervalRef.current) {
                clearInterval(nudgeIntervalRef.current);
                nudgeIntervalRef.current = null;
            }
        };
    }, [sessionDetails?.condition, workloadState, unresolvedCount]);

    // Render alerts based on condition
    const renderAlerts = () => {
        if (activeAlerts.length === 0) return null;

        const condition = sessionDetails?.condition || 1;

        return activeAlerts.map(alert => {
            // Map priority to severity
            const severityMap = {
                'critical': 'critical',
                'high': 'warning',
                'medium': 'warning',
                'low': 'info'
            };
            const severity = severityMap[alert.priority] || 'warning';

            switch (condition) {
                case 1: // Traditional Modal
                    return (
                        <TraditionalModalAlert
                            key={alert.id}
                            alertId={alert.id}
                            title={`${alert.type.toUpperCase()}: ${alert.target}`}
                            message={alert.message}
                            severity={alert.isEscalated ? 'critical' : severity}
                            timestamp={alert.timestamp}
                            details={alert.details}
                            requiresAcknowledgment={true}
                            isEscalated={alert.isEscalated || false}
                            reappearCount={alert.reappearCount || 0}
                            escalationLevel={alert.escalationLevel || 1}
                            visualIntensity={alert.visualIntensity || 4}
                            audioIntensity={alert.audioIntensity || 3}
                            onAcknowledge={(data) => handleAlertAcknowledge(alert, data?.action_taken)}
                        />
                    );
                case 2: // Rule-Based Adaptive
                    return (
                        <AdaptiveBannerAlert
                            key={alert.id}
                            alertId={alert.id}
                            title={`${alert.type.toUpperCase()}: ${alert.target}`}
                            message={alert.message}
                            severity={severity}
                            timestamp={alert.timestamp}
                            autoDismiss={alert.priority !== 'critical'}
                            autoDismissDelay={alert.priority === 'high' ? 15000 : 10000}
                            recommendedActions={[
                                { label: 'Acknowledge', description: 'Acknowledge this alert' }
                            ]}
                            visualIntensity={alert.visualIntensity || 3}
                            audioIntensity={alert.audioIntensity || 1}
                            enableAudio={true}
                            onDismiss={() => handleAlertDismiss(alert)}
                            onActionClick={() => handleAlertAcknowledge(alert, 'acknowledged')}
                        />
                    );
                case 3: // ML-Based Adaptive
                    return (
                        <MLPredictiveAlert
                            key={alert.id}
                            alertId={alert.id}
                            title={`${alert.type.toUpperCase()}: ${alert.target}`}
                            message={alert.message}
                            confidence={alert.details?.confidence || 85}
                            reasoning={alert.details?.explanation || 'ML model detected potential issue'}
                            highlightRegions={alert.details?.highlight_regions || []}
                            timestamp={alert.timestamp}
                            visualIntensity={alert.visualIntensity || 3}
                            audioIntensity={alert.audioIntensity || 1}
                            isNudge={alert.isNudge || false}
                            nudgeCount={alert.nudgeCount || 0}
                            onDismiss={() => handleAlertDismiss(alert)}
                            onAcceptSuggestion={() => handleAlertAcknowledge(alert, 'accepted')}
                            onRejectSuggestion={() => handleAlertAcknowledge(alert, 'rejected')}
                        />
                    );
                default:
                    return (
                        <TraditionalModalAlert
                            key={alert.id}
                            alertId={alert.id}
                            title={`${alert.type.toUpperCase()}: ${alert.target}`}
                            message={alert.message}
                            severity={severity}
                            timestamp={alert.timestamp}
                            onAcknowledge={(data) => handleAlertAcknowledge(alert, data?.action_taken)}
                        />
                    );
            }
        });
    };

    if (isLoading || !sessionDetails) {
        return <div className="session-loading">Loading session...</div>;
    }

    if (error) {
        return <div className="session-error">{error}</div>;
    }

    if (showInstructions) {
        return <Instructions onContinue={handleContinueToExperiment} condition={sessionDetails?.condition || 1} />;
    }

    // Show transition screen between scenarios
    if (showTransition && queueScenarios.length > currentScenarioIndex + 1) {
        const currentScenario = queueScenarios[currentScenarioIndex];
        const nextScenario = queueScenarios[currentScenarioIndex + 1];
        return (
            <ScenarioTransition
                completedScenarioId={currentScenario?.scenario_id || sessionDetails?.scenario}
                nextScenarioId={nextScenario?.scenario_id}
                scenarioNumber={currentScenarioIndex + 1}
                totalScenarios={queueScenarios.length}
                condition={nextScenario?.condition || sessionDetails?.condition}
                countdownSeconds={5}
                onCountdownComplete={handleTransitionComplete}
            />
        );
    }

    // Show shift over screen before surveys
    if (showShiftOver) {
        return (
            <ShiftOverScreen
                safetyScore={safetyScore}
                elapsedTime={elapsedTime}
                aircraft={aircraft}
                needsResolved={needsResolvedCount}
                alertsHandled={alertsHandledCount}
                pilotComplaints={pilotComplaints}
                onContinue={handleShiftOverContinue}
            />
        );
    }

    // Show surveys after session ends
    if (showSurveyIntro && !showSurvey) {
        return (
            <div className="session-loading">
                Run complete. Loading survey…
            </div>
        );
    }

    if (showSurvey) {
        return (
            <SurveyManager
                sessionId={sessionId}
                condition={sessionDetails?.condition}
                phase="post-session"
                onComplete={handleSurveyComplete}
            />
        );
    }

    if (!scenarioStarted) {
        return <div className="session-loading">Starting scenario...</div>;
    }

    const timeRemaining = Math.max(0, (sessionDetails.scenario_duration || 360) - elapsedTime);
    const selectedAircraft = selectedAircraftCallsign ? aircraft[selectedAircraftCallsign] : null;

    return (
        <div className="session-container">
            <div className="session-header">
                <h1>Experiment Session</h1>
                <div className="session-info">
                    <span>Scenario: {sessionDetails.scenario}</span>
                    <span>Condition: {sessionDetails.condition}</span>
                    <span>Phase: {currentPhase + 1} - {phaseDescription}</span>
                    <span className={timeRemaining < 60 ? 'time-warning' : ''}>
                        Time: {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
                    </span>
                </div>
            </div>

            {/* Alert Layer */}
            <div className="alert-layer">
                {renderAlerts()}
            </div>

            {/* Success Toast Container */}
            <SuccessToastContainer
                toasts={successToasts}
                onDismiss={dismissSuccessToast}
            />

            <div className="session-body">
                {/* Radar Viewer */}
                <div className="session-radar-wrapper">
                    <RadarViewer
                        scenario={sessionDetails.scenario}
                        condition={sessionDetails.condition}
                        showControls={false}
                        aircraftConfig={sessionDetails.aircraft_config}
                        liveAircraft={aircraft}
                        pendingAlerts={pendingAlerts}
                        selectedAircraft={selectedAircraft}
                        onAircraftSelect={handleAircraftSelect}
                    />
                </div>

                {/* Action Panel */}
                <ActionPanel
                    sessionId={sessionId}
                    scenario={sessionDetails.scenario}
                    currentPhase={currentPhase}
                    phaseDescription={phaseDescription}
                    aircraft={aircraft}
                    elapsedTime={elapsedTime}
                    pendingAlerts={pendingAlerts}
                    onActionLogged={handleActionLogged}
                    selectedAircraft={selectedAircraft}
                    onAircraftSelect={handleAircraftSelect}
                    conflicts={conflicts}
                    // Gamification props
                    safetyScore={safetyScore}
                    scoreChanges={scoreChanges}
                    pilotComplaints={pilotComplaints}
                    // Active monitoring callbacks
                    onNeedResolved={() => setNeedsResolvedCount(c => c + 1)}
                    onAlertHandled={() => setAlertsHandledCount(c => c + 1)}
                />
            </div>

            {/* Debug info (remove in production) */}
            {process.env.NODE_ENV === 'development' && (
                <div className="debug-panel">
                    <h4>Debug Info</h4>
                    <p>Elapsed: {elapsedTime}s | Phase: {currentPhase}</p>
                    <p>Active Alerts: {activeAlerts.length} | Pending: {pendingAlerts.length}</p>
                    <p>Aircraft: {Object.keys(aircraft).length}</p>
                    <p>Selected AC: {selectedAircraftCallsign || 'None'}</p>
                    {pendingAlerts.length > 0 && (
                        <p style={{color: '#ff9800'}}>
                            Pending: {pendingAlerts.map(a => a.target).join(', ')}
                        </p>
                    )}
                    <button onClick={() => handleEndSession('manual_end')}>
                        End Session (Debug)
                    </button>
                </div>
            )}
        </div>
    );
}

export default Session;
