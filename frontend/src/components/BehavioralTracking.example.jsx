/**
 * Behavioral Tracking - Usage Examples
 *
 * Demonstrates integration of behavioral tracking service
 * with the ATC research system and three alert conditions
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  useBehavioralTracking,
  useAlertTracking,
  useRegionTracking,
  useRegionRef,
  useAttentionMetrics,
  useAutoTracking
} from '../hooks/useBehavioralTracking';
import TraditionalModalAlert from './TraditionalModalAlert';
import AdaptiveBannerAlert from './AdaptiveBannerAlert';
import MLPredictiveAlert from './MLPredictiveAlert';
import trackingAnalysis from '../utils/trackingAnalysis';

/**
 * Example 1: Basic Tracking Setup
 */
export function Example1_BasicTracking() {
  const [participantId, setParticipantId] = useState('');
  const [scenario, setScenario] = useState('L1');
  const [condition, setCondition] = useState('1');

  const {
    isTracking,
    sessionId,
    startSession,
    stopSession,
    stats,
    downloadData
  } = useBehavioralTracking();

  const handleStart = () => {
    if (!participantId) {
      alert('Please enter participant ID');
      return;
    }

    startSession({
      participantId,
      scenario,
      condition: parseInt(condition),
      experimentDate: new Date().toISOString()
    });
  };

  const handleStop = () => {
    const data = stopSession();
    console.log('Session data:', data);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Example 1: Basic Tracking</h2>

      {!isTracking ? (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '10px' }}>
            <label>
              Participant ID:
              <input
                type="text"
                value={participantId}
                onChange={(e) => setParticipantId(e.target.value)}
                placeholder="e.g., P001"
                style={{ marginLeft: '10px', padding: '5px' }}
              />
            </label>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label>
              Scenario:
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                style={{ marginLeft: '10px', padding: '5px' }}
              >
                <option value="L1">L1 - Low Complexity (Baseline)</option>
                <option value="L2">L2 - Low Complexity (Weather)</option>
                <option value="H4">H4 - High Complexity (Conflicts)</option>
                <option value="H5">H5 - High Complexity (Combined)</option>
              </select>
            </label>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label>
              Condition:
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                style={{ marginLeft: '10px', padding: '5px' }}
              >
                <option value="1">Condition 1 - Traditional Modal</option>
                <option value="2">Condition 2 - Adaptive Banner</option>
                <option value="3">Condition 3 - ML Predictive</option>
              </select>
            </label>
          </div>

          <button
            onClick={handleStart}
            style={{
              padding: '10px 20px',
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Start Tracking Session
          </button>
        </div>
      ) : (
        <div>
          <div style={{
            background: '#e8f5e9',
            padding: '15px',
            borderRadius: '4px',
            marginBottom: '20px'
          }}>
            <h3>Session Active</h3>
            <p>Session ID: {sessionId}</p>
            <p>Participant: {participantId}</p>
            <p>Scenario: {scenario}</p>
            <p>Condition: {condition}</p>
            {stats && (
              <>
                <p>Duration: {Math.floor(stats.sessionDuration)}s</p>
                <p>Mouse Movements: {stats.mouseMovements}</p>
                <p>Click Events: {stats.clickEvents}</p>
                <p>Alert Interactions: {stats.alertInteractions}</p>
              </>
            )}
          </div>

          <button
            onClick={handleStop}
            style={{
              padding: '10px 20px',
              background: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            Stop Session
          </button>

          <button
            onClick={() => downloadData()}
            style={{
              padding: '10px 20px',
              background: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Export Data
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Example 2: Region Tracking with Radar Display
 */
export function Example2_RegionTracking() {
  const { defineRegions } = useRegionTracking();
  const radarRef = useRegionRef('radar_display', { category: 'radar', priority: 1 });
  const alertRef = useRegionRef('alert_area', { category: 'alert', priority: 2 });

  useEffect(() => {
    // Define additional regions for different sectors
    defineRegions({
      northern_cluster: {
        name: 'Northern Cluster',
        x: 50,
        y: 50,
        width: 200,
        height: 150,
        category: 'radar',
        priority: 0
      },
      southern_cluster: {
        name: 'Southern Cluster',
        x: 50,
        y: 250,
        width: 200,
        height: 150,
        category: 'radar',
        priority: 0
      },
      control_panel: {
        name: 'Control Panel',
        x: 300,
        y: 50,
        width: 200,
        height: 350,
        category: 'control',
        priority: 0
      }
    });
  }, [defineRegions]);

  const metrics = useAttentionMetrics({ updateInterval: 2000 });

  return (
    <div style={{ padding: '20px' }}>
      <h2>Example 2: Region Tracking</h2>

      <div style={{ display: 'flex', gap: '20px' }}>
        {/* Radar Display */}
        <div
          ref={radarRef}
          style={{
            width: '400px',
            height: '400px',
            background: '#1a1a1a',
            color: '#00ff00',
            padding: '20px',
            fontFamily: 'monospace',
            position: 'relative'
          }}
        >
          <h3>Radar Display</h3>
          <div style={{ marginTop: '20px' }}>
            <p>AAL123: FL350, HDG 270°</p>
            <p>UAL456: FL360, HDG 180°</p>
            <p>SWA789: FL380, HDG 090°</p>
          </div>

          {/* Visual region indicators */}
          <div style={{
            position: 'absolute',
            top: '50px',
            left: '50px',
            width: '200px',
            height: '150px',
            border: '2px dashed #00ff00',
            opacity: 0.3
          }}>
            <span style={{ fontSize: '10px' }}>Northern Cluster</span>
          </div>
        </div>

        {/* Alert Area */}
        <div
          ref={alertRef}
          style={{
            width: '300px',
            height: '400px',
            background: '#f5f5f5',
            padding: '20px'
          }}
        >
          <h3>Alert Area</h3>
          <div style={{
            background: '#ff9800',
            padding: '15px',
            borderRadius: '4px',
            marginTop: '20px'
          }}>
            <p>Sample Alert Content</p>
          </div>
        </div>
      </div>

      {/* Attention Metrics */}
      {metrics && (
        <div style={{
          marginTop: '20px',
          background: '#e3f2fd',
          padding: '15px',
          borderRadius: '4px'
        }}>
          <h3>Real-Time Attention Metrics</h3>
          <p>Current Region: {metrics.currentRegion || 'None'}</p>
          <p>Scan Velocity: {metrics.scanVelocity.toFixed(2)} px/s</p>

          <h4>Dwell Times:</h4>
          <ul>
            {Object.entries(metrics.dwellTimes).map(([region, time]) => (
              <li key={region}>
                {region}: {(time / 1000).toFixed(1)}s
              </li>
            ))}
          </ul>

          {metrics.crisisFixationRatio && (
            <div>
              <h4>Crisis Fixation Ratio:</h4>
              <p>Alert Time: {(metrics.crisisFixationRatio.alertTime / 1000).toFixed(1)}s</p>
              <p>Radar Time: {(metrics.crisisFixationRatio.radarTime / 1000).toFixed(1)}s</p>
              <p>Ratio: {metrics.crisisFixationRatio.ratio.toFixed(2)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Example 3: Alert Tracking Integration (Condition 1)
 */
export function Example3_AlertTrackingCondition1() {
  const [showAlert, setShowAlert] = useState(false);
  const { trackAlertPresented, trackAlertResponse } = useAlertTracking();

  const alertData = {
    alertId: 'test_alert_001',
    title: 'FUEL EMERGENCY',
    message: 'Aircraft AAL123 reports fuel critical. Immediate landing required.',
    severity: 'critical'
  };

  const handleShowAlert = () => {
    setShowAlert(true);
    trackAlertPresented(alertData);
  };

  const handleAcknowledge = (ackData) => {
    trackAlertResponse(alertData.alertId, 'acknowledged', {
      responseTime: ackData.responseTime,
      interactionType: 'manual'
    });
    setShowAlert(false);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Example 3: Alert Tracking (Condition 1)</h2>

      <button
        onClick={handleShowAlert}
        style={{
          padding: '10px 20px',
          background: '#f44336',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Trigger Alert (Modal)
      </button>

      {showAlert && (
        <TraditionalModalAlert
          {...alertData}
          requiresAcknowledgment={true}
          onAcknowledge={handleAcknowledge}
          enableAudio={false}
        />
      )}
    </div>
  );
}

/**
 * Example 4: Alert Tracking Integration (Condition 2)
 */
export function Example4_AlertTrackingCondition2() {
  const [showAlert, setShowAlert] = useState(false);
  const { trackAlertPresented, trackAlertResponse, trackAlertAction } = useAlertTracking();

  const alertData = {
    alertId: 'test_alert_002',
    title: 'Weather Deviation Request',
    message: 'SWA321 requesting deviation 20nm right due to moderate turbulence.',
    severity: 'advisory'
  };

  const handleShowAlert = () => {
    setShowAlert(true);
    trackAlertPresented(alertData);
  };

  const handleDismiss = (dismissData) => {
    trackAlertResponse(alertData.alertId, 'dismissed', dismissData);
    setShowAlert(false);
  };

  const handleAction = (actionLabel) => {
    trackAlertAction(alertData.alertId, actionLabel, {
      timestamp: Date.now()
    });
    console.log('Action clicked:', actionLabel);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Example 4: Alert Tracking (Condition 2)</h2>

      <button
        onClick={handleShowAlert}
        style={{
          padding: '10px 20px',
          background: '#ff9800',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Trigger Alert (Banner)
      </button>

      {showAlert && (
        <AdaptiveBannerAlert
          {...alertData}
          recommendedActions={[
            {
              label: 'Approve Deviation',
              onClick: () => handleAction('Approve Deviation')
            },
            {
              label: 'Request Alternate',
              onClick: () => handleAction('Request Alternate')
            }
          ]}
          onDismiss={handleDismiss}
          timestamp={Date.now()}
        />
      )}
    </div>
  );
}

/**
 * Example 5: Alert Tracking Integration (Condition 3)
 */
export function Example5_AlertTrackingCondition3() {
  const [showAlert, setShowAlert] = useState(false);
  const {
    trackAlertPresented,
    trackAlertResponse,
    trackAlertAction
  } = useAlertTracking();

  const alertData = {
    alertId: 'test_alert_003',
    title: 'TRAFFIC CONFLICT PREDICTED',
    message: 'ML model predicts separation violation between AAL123 and UAL456.',
    severity: 'warning',
    confidence: 94
  };

  const handleShowAlert = () => {
    setShowAlert(true);
    trackAlertPresented(alertData);
  };

  const handleDismiss = (dismissData) => {
    trackAlertResponse(alertData.alertId, 'dismissed', dismissData);
    setShowAlert(false);
  };

  const handleAccept = (acceptData) => {
    trackAlertResponse(alertData.alertId, 'accepted', {
      ...acceptData,
      mlFeedback: 'positive'
    });
  };

  const handleReject = (rejectData) => {
    trackAlertResponse(alertData.alertId, 'rejected', {
      ...rejectData,
      mlFeedback: 'negative'
    });
  };

  const handleAction = (actionLabel) => {
    trackAlertAction(alertData.alertId, actionLabel);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Example 5: Alert Tracking (Condition 3)</h2>

      <button
        onClick={handleShowAlert}
        style={{
          padding: '10px 20px',
          background: '#5e35b1',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Trigger ML Alert
      </button>

      {showAlert && (
        <MLPredictiveAlert
          {...alertData}
          reasoning="Both aircraft converging on waypoint ALPHA with insufficient vertical separation."
          highlightRegions={[
            {
              x: 200,
              y: 150,
              width: 80,
              height: 60,
              label: 'AAL123',
              severity: 'high'
            },
            {
              x: 320,
              y: 180,
              width: 80,
              height: 60,
              label: 'UAL456',
              severity: 'high'
            }
          ]}
          predictionTime={180}
          suggestedActions={[
            {
              label: 'Vector AAL123',
              onClick: () => handleAction('Vector AAL123')
            },
            {
              label: 'Altitude Change',
              onClick: () => handleAction('Altitude Change')
            }
          ]}
          onDismiss={handleDismiss}
          onAcceptSuggestion={handleAccept}
          onRejectSuggestion={handleReject}
          timestamp={Date.now()}
        />
      )}
    </div>
  );
}

/**
 * Example 6: Complete Research Session
 */
export function Example6_CompleteResearchSession() {
  const [sessionState, setSessionState] = useState('setup'); // 'setup', 'running', 'complete'
  const [participantId, setParticipantId] = useState('');
  const [scenario, setScenario] = useState('L1');
  const [condition, setCondition] = useState(1);

  const tracking = useBehavioralTracking();
  const { defineRegions } = useRegionTracking();

  const handleStartSession = () => {
    // Define regions
    defineRegions({
      radar_display: {
        name: 'Radar Display',
        x: 0,
        y: 100,
        width: 800,
        height: 600,
        category: 'radar',
        priority: 1
      },
      alert_area: {
        name: 'Alert Area',
        x: 0,
        y: 0,
        width: window.innerWidth,
        height: 100,
        category: 'alert',
        priority: 2
      },
      control_panel: {
        name: 'Control Panel',
        x: 820,
        y: 100,
        width: 300,
        height: 600,
        category: 'control',
        priority: 1
      }
    });

    // Start tracking
    tracking.startSession({
      participantId,
      scenario,
      condition,
      experimentDate: new Date().toISOString(),
      experimentVersion: '1.0.0'
    });

    setSessionState('running');
  };

  const handleCompleteSession = () => {
    const data = tracking.stopSession();

    // Generate analysis
    const summary = trackingAnalysis.generateStatisticalSummary(data);
    const workload = trackingAnalysis.calculateWorkloadMetrics(data);
    const sa = trackingAnalysis.calculateSituationalAwareness(data);

    console.log('Session Summary:', summary);
    console.log('Workload:', workload);
    console.log('Situational Awareness:', sa);

    // Download data
    tracking.downloadData(`${participantId}_${scenario}_C${condition}_${Date.now()}.json`);

    setSessionState('complete');
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Example 6: Complete Research Session</h2>

      {sessionState === 'setup' && (
        <div style={{
          background: '#f5f5f5',
          padding: '20px',
          borderRadius: '4px',
          maxWidth: '500px'
        }}>
          <h3>Session Setup</h3>

          <div style={{ marginBottom: '15px' }}>
            <label>
              Participant ID:
              <input
                type="text"
                value={participantId}
                onChange={(e) => setParticipantId(e.target.value)}
                placeholder="e.g., P001"
                style={{
                  marginLeft: '10px',
                  padding: '8px',
                  width: '200px'
                }}
              />
            </label>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label>
              Scenario:
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                style={{
                  marginLeft: '10px',
                  padding: '8px'
                }}
              >
                <option value="L1">L1 - Low Complexity (Baseline)</option>
                <option value="L2">L2 - Low Complexity (Weather)</option>
                <option value="H4">H4 - High Complexity (Conflicts)</option>
                <option value="H5">H5 - High Complexity (Combined)</option>
              </select>
            </label>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label>
              Condition:
              <select
                value={condition}
                onChange={(e) => setCondition(parseInt(e.target.value))}
                style={{
                  marginLeft: '10px',
                  padding: '8px'
                }}
              >
                <option value={1}>Condition 1 - Traditional Modal</option>
                <option value={2}>Condition 2 - Adaptive Banner</option>
                <option value={3}>Condition 3 - ML Predictive</option>
              </select>
            </label>
          </div>

          <button
            onClick={handleStartSession}
            disabled={!participantId}
            style={{
              padding: '12px 24px',
              background: participantId ? '#4caf50' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: participantId ? 'pointer' : 'not-allowed',
              fontSize: '16px'
            }}
          >
            Start Session
          </button>
        </div>
      )}

      {sessionState === 'running' && (
        <div>
          <div style={{
            background: '#e8f5e9',
            padding: '20px',
            borderRadius: '4px',
            marginBottom: '20px'
          }}>
            <h3>Session Active</h3>
            <p><strong>Participant:</strong> {participantId}</p>
            <p><strong>Scenario:</strong> {scenario}</p>
            <p><strong>Condition:</strong> {condition}</p>
            {tracking.stats && (
              <>
                <p><strong>Duration:</strong> {Math.floor(tracking.stats.sessionDuration)}s</p>
                <p><strong>Mouse Movements:</strong> {tracking.stats.mouseMovements}</p>
                <p><strong>Click Events:</strong> {tracking.stats.clickEvents}</p>
              </>
            )}
          </div>

          <p style={{ marginBottom: '20px' }}>
            Simulate the ATC scenario here. All interactions are being tracked.
          </p>

          <button
            onClick={handleCompleteSession}
            style={{
              padding: '12px 24px',
              background: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Complete Session
          </button>
        </div>
      )}

      {sessionState === 'complete' && (
        <div style={{
          background: '#e3f2fd',
          padding: '20px',
          borderRadius: '4px'
        }}>
          <h3>Session Complete</h3>
          <p>Data has been exported and saved.</p>
          <p>Check the console for analysis results.</p>

          <button
            onClick={() => {
              setSessionState('setup');
              setParticipantId('');
            }}
            style={{
              padding: '10px 20px',
              background: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '15px'
            }}
          >
            Start New Session
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Example 7: Auto-tracking with Cleanup
 */
export function Example7_AutoTracking({ participantId, scenario, condition }) {
  // Automatically start tracking on mount and stop on unmount
  useAutoTracking({
    participantId,
    scenario,
    condition
  });

  return (
    <div style={{ padding: '20px' }}>
      <h2>Example 7: Auto-Tracking</h2>
      <p>Tracking automatically started for participant: {participantId}</p>
      <p>All interactions on this page are being tracked.</p>
      <p>Tracking will automatically stop when this component unmounts.</p>
    </div>
  );
}

export default Example1_BasicTracking;
