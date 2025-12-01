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
import { logBehavioralEvent, logAlertDisplay, logAlertAcknowledgment } from '../services/api';
import { getApiBaseUrl } from '../utils/apiConfig';
import { SCENARIO_ACTIONS } from '../config/scenarioActions';
import '../styles/session.css';

const API_URL = getApiBaseUrl();

// Polling interval in milliseconds
const POLLING_INTERVAL = 2000;

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
    const [alertHistory, setAlertHistory] = useState([]);
    const [sagatProbes, setSagatProbes] = useState([]);
    const [scenarioComplete, setScenarioComplete] = useState(false);
    const [showSurvey, setShowSurvey] = useState(false);
    const [selectedAircraftCallsign, setSelectedAircraftCallsign] = useState(null);

    const timerRef = useRef(null);
    const pollingRef = useRef(null);
    const scenarioStartedRef = useRef(false); // Ref to avoid stale closure in polling
    const startTimeRef = useRef(null);
    const pendingAlertTimers = useRef({}); // Timers for pending alerts

    const fetchSessionDetails = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await fetch(`${API_URL}/api/sessions/${sessionId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch session details.');
            }
            const data = await response.json();
            console.log('[Session] Fetched session details:', {
                scenario: data.scenario,
                condition: data.condition,
                aircraftConfigLength: data.aircraft_config?.length || 0,
                aircraftConfig: data.aircraft_config
            });
            if (data.aircraft_config && data.aircraft_config.length > 0) {
                console.log('[Session] First aircraft in config:', data.aircraft_config[0]);
            } else {
                console.warn('[Session] ⚠️ No aircraft_config in session details!');
            }
            setSessionDetails(data);
        } catch (err) {
            console.error('[Session] Failed to fetch session details:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [sessionId]);

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

            // If part of queue, mark item as complete
            if (queueId && itemIndex !== null) {
                try {
                    const responseData = await response.json();
                    await fetch(`${API_URL}/api/queues/${queueId}/items/${itemIndex}/complete`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ results: responseData })
                    });
                } catch (err) {
                    console.error('Failed to update queue:', err);
                    // Don't block survey flow if queue update fails
                }
            }

            // Show surveys instead of redirecting
            setShowSurvey(true);
            setScenarioComplete(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [sessionId, queueId, itemIndex]);

    const handleSurveyComplete = useCallback((data) => {
        console.log('Surveys completed:', data);

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

    // CRITICAL: Polling loop to get triggered events from backend
    const pollScenarioUpdate = useCallback(async () => {
        // Use ref instead of state to avoid stale closure issue
        if (!scenarioStartedRef.current || scenarioComplete) return;

        const currentElapsedTime = startTimeRef.current
            ? (Date.now() - startTimeRef.current) / 1000
            : elapsedTime;

        console.log('[Polling] Sending update request, elapsed:', currentElapsedTime.toFixed(1) + 's');

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
            console.log('[Polling] Response received:', {
                elapsed: data.elapsed_time,
                phase: data.current_phase,
                aircraft: Object.keys(data.aircraft || {}).length,
                events: data.triggered_events?.length || 0
            });

            // Update scenario state
            setElapsedTime(data.elapsed_time);
            setCurrentPhase(data.current_phase);
            setPhaseDescription(data.phase_description);
            setAircraft(data.aircraft || {});

            // Handle triggered events (convert to alerts)
            if (data.triggered_events && data.triggered_events.length > 0) {
                console.log('[Polling] TRIGGERED EVENTS:', data.triggered_events);
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

        } catch (err) {
            console.error('[Polling] Error:', err);
        }
    }, [sessionId, scenarioComplete, elapsedTime, handleEndSession]); // Removed scenarioStarted, using ref instead

    // Convert scenario events to alerts based on condition
    const processTriggeredEvents = async (events) => {
        const condition = sessionDetails?.condition || 1;

        for (const event of events) {
            const alertId = `alert_${event.event_type}_${event.target}_${Date.now()}`;
            const alertData = {
                id: alertId,
                type: event.event_type,
                target: event.target,
                priority: event.data?.priority || 'medium',
                message: event.data?.message || `${event.event_type}: ${event.target}`,
                details: event.data?.details || {},
                timestamp: Date.now(),
                condition: condition,
                acknowledged: false
            };

            // Log alert display
            try {
                await logAlertDisplay(sessionId, {
                    alert_id: alertId,
                    alert_type: event.event_type,
                    priority: alertData.priority,
                    message: alertData.message,
                    aircraft_id: event.target
                });
            } catch (err) {
                console.error('Failed to log alert display:', err);
            }

            setActiveAlerts(prev => [...prev, alertData]);
            setAlertHistory(prev => [...prev, alertData]);
        }
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
        const toastId = `toast_${alert.id}_${Date.now()}`;
        const newToast = {
            id: toastId,
            message: `${alert.target} situation handled correctly`,
            aircraft: alert.target,
            actionTaken: actionLabel,
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
        // Remove from pending
        setPendingAlerts(prev => prev.filter(a => a.id !== alert.id));

        // Clear the timer
        if (pendingAlertTimers.current[alert.id]) {
            clearTimeout(pendingAlertTimers.current[alert.id]);
            delete pendingAlertTimers.current[alert.id];
        }

        // Add back to active alerts with escalated state
        const escalatedAlert = {
            ...alert,
            isEscalated: true,
            reappearCount: (alert.reappearCount || 0) + 1,
            timestamp: Date.now() // Reset timestamp for new response time tracking
        };

        setActiveAlerts(prev => [...prev, escalatedAlert]);

        // Log the reappearance
        console.log(`[Alert] Alert reappeared (escalated): ${alert.id}, reappear count: ${escalatedAlert.reappearCount}`);
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
            pendingAlertTimers.current[alert.id] = setTimeout(() => {
                handleAlertReappear(pendingAlert);
            }, ALERT_HIDE_DURATION);

            console.log(`[Alert] Alert acknowledged and hidden: ${alert.id}, will reappear in ${ALERT_HIDE_DURATION / 1000}s if not resolved`);
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

    const handleAircraftSelect = (callsign) => {
        setSelectedAircraftCallsign(callsign);
    };

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
    const handleActionLogged = useCallback((actionData) => {
        console.log('[Session] Action logged:', actionData);

        // Check if this action resolves any pending alerts
        const resolvedAlerts = checkActionResolvesAlert(actionData);

        if (resolvedAlerts.length > 0) {
            console.log('[Session] Action resolves pending alerts:', resolvedAlerts.map(a => a.id));

            resolvedAlerts.forEach(alert => {
                // Clear the reappear timer
                if (pendingAlertTimers.current[alert.id]) {
                    clearTimeout(pendingAlertTimers.current[alert.id]);
                    delete pendingAlertTimers.current[alert.id];
                }

                // Show success toast
                showSuccessToast(alert, actionData.action_label);

                // Update alert history to mark as resolved
                setAlertHistory(prev => prev.map(a =>
                    a.id === alert.id ? { ...a, resolved: true, resolvedBy: actionData.action_id } : a
                ));
            });

            // Remove resolved alerts from pending
            const resolvedIds = resolvedAlerts.map(a => a.id);
            setPendingAlerts(prev => prev.filter(a => !resolvedIds.includes(a.id)));
        }
    }, [checkActionResolvesAlert, showSuccessToast]);

    useEffect(() => {
        fetchSessionDetails();
    }, [sessionId, fetchSessionDetails]);

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
        return <Instructions onContinue={handleContinueToExperiment} />;
    }

    // Show surveys after session ends
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
