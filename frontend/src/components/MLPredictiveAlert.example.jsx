/**
 * ML-Based Predictive Alert - Usage Examples
 *
 * Demonstrates how to use the MLPredictiveAlert component
 * for Condition 3 (ML-Based Adaptive Alerts) in the ATC research system.
 */

import React, { useState, useEffect } from 'react';
import MLPredictiveAlert, {
  MLPredictiveAlertStack
} from './MLPredictiveAlert';

/**
 * Example 1: Basic ML Prediction Alert
 */
export function Example1_BasicMLAlert() {
  const [showAlert, setShowAlert] = useState(true);

  const handleDismiss = (data) => {
    console.log('ML Alert dismissed:', data);
    setShowAlert(false);
  };

  const handleAccept = (data) => {
    console.log('Prediction accepted:', data);
  };

  const handleReject = (data) => {
    console.log('Prediction rejected:', data);
  };

  return (
    <div>
      <h2>Example 1: Basic ML Prediction</h2>
      <button onClick={() => setShowAlert(true)}>
        Show ML Prediction
      </button>

      {showAlert && (
        <MLPredictiveAlert
          title="TRAFFIC INTRUSION PREDICTED"
          message="ML model predicts potential separation issue between AAL123 and UAL456 in northern sector."
          confidence={94}
          reasoning="Analysis of current trajectories and velocity vectors indicates a high probability of minimum separation violation. Both aircraft are converging on waypoint ALPHA with insufficient vertical separation."
          highlightRegions={[
            {
              x: 200,
              y: 150,
              width: 80,
              height: 60,
              label: 'AAL123',
              severity: 'high',
              description: 'American Airlines 123 - FL350, heading 270°'
            },
            {
              x: 320,
              y: 180,
              width: 80,
              height: 60,
              label: 'UAL456',
              severity: 'high',
              description: 'United Airlines 456 - FL360, heading 180°'
            }
          ]}
          predictionTime={180}
          modelInfo={{
            name: 'Conflict Predictor v2.1',
            version: '2.1.0',
            features: ['traffic_density', 'velocity_vectors', 'historical_patterns']
          }}
          onDismiss={handleDismiss}
          onAcceptSuggestion={handleAccept}
          onRejectSuggestion={handleReject}
          alertId="ml_prediction_001"
          timestamp={Date.now()}
        />
      )}
    </div>
  );
}

/**
 * Example 2: High Confidence Alert with Suggested Actions
 */
export function Example2_HighConfidenceWithActions() {
  const [showAlert, setShowAlert] = useState(true);

  return (
    <div>
      <h2>Example 2: High Confidence with Actions</h2>
      <button onClick={() => setShowAlert(true)}>
        Show High Confidence Alert
      </button>

      {showAlert && (
        <MLPredictiveAlert
          title="CRITICAL CONFLICT ALERT"
          message="URGENT: ML model detects imminent separation violation. Immediate action recommended."
          confidence={97}
          reasoning="Multiple factors indicate critical conflict: (1) Both aircraft on collision course at same altitude FL380, (2) Current closure rate 850 knots, (3) Time to minimum separation: 2 minutes 15 seconds. Historical data shows 98% accuracy for this scenario pattern."
          highlightRegions={[
            {
              x: 300,
              y: 200,
              width: 100,
              height: 80,
              label: 'SWA789',
              severity: 'high',
              description: 'Southwest 789 - FL380, 520kts'
            },
            {
              x: 450,
              y: 240,
              width: 100,
              height: 80,
              label: 'DAL234',
              severity: 'high',
              description: 'Delta 234 - FL380, 480kts'
            }
          ]}
          predictionTime={135}
          suggestedActions={[
            {
              label: 'Descend SWA789 to FL360',
              description: 'Issue immediate descent to FL360 for vertical separation',
              onClick: () => {
                console.log('Issuing descent clearance to SWA789');
                // openScopeAdapter.setAltitude('SWA789', 36000, true);
              }
            },
            {
              label: 'Turn DAL234 Right 30°',
              description: 'Issue right turn for lateral separation',
              onClick: () => {
                console.log('Issuing turn to DAL234');
                // openScopeAdapter.setHeading('DAL234', 30, 'right');
              }
            },
            {
              label: 'Speed Reduction DAL234',
              description: 'Reduce speed to 250 knots',
              onClick: () => {
                console.log('Reducing DAL234 speed');
                // openScopeAdapter.setSpeed('DAL234', 250);
              }
            }
          ]}
          onDismiss={(data) => {
            console.log('Critical alert dismissed:', data);
            setShowAlert(false);
          }}
          onAcceptSuggestion={(data) => {
            console.log('Critical prediction accepted:', data);
          }}
          onRejectSuggestion={(data) => {
            console.log('Critical prediction rejected:', data);
          }}
          alertId="ml_critical_001"
          timestamp={Date.now()}
        />
      )}
    </div>
  );
}

/**
 * Example 3: Medium Confidence Advisory
 */
export function Example3_MediumConfidence() {
  const [showAlert, setShowAlert] = useState(true);

  return (
    <div>
      <h2>Example 3: Medium Confidence Advisory</h2>
      <button onClick={() => setShowAlert(true)}>
        Show Medium Confidence Alert
      </button>

      {showAlert && (
        <MLPredictiveAlert
          title="WORKLOAD SURGE PREDICTED"
          message="ML model predicts increased workload in next 5 minutes. Consider proactive measures."
          confidence={76}
          reasoning="Pattern analysis indicates 5 aircraft will enter sector simultaneously at 14:25 UTC. Traffic density will increase by 60%. Similar patterns historically resulted in elevated controller workload."
          highlightRegions={[
            {
              x: 150,
              y: 100,
              width: 200,
              height: 150,
              label: 'High Density Zone',
              severity: 'medium',
              description: '5 aircraft converging'
            }
          ]}
          predictionTime={300}
          suggestedActions={[
            {
              label: 'Request D-Side Support',
              description: 'Request additional controller assistance',
              onClick: () => console.log('Requesting support')
            },
            {
              label: 'Initiate Flow Control',
              description: 'Request traffic flow management',
              onClick: () => console.log('Initiating flow control')
            }
          ]}
          modelInfo={{
            name: 'Workload Predictor v1.5',
            version: '1.5.3',
            features: ['traffic_density', 'sector_complexity', 'time_patterns']
          }}
          onDismiss={(data) => {
            console.log('Workload alert dismissed:', data);
            setShowAlert(false);
          }}
          onAcceptSuggestion={(data) => {
            console.log('Workload prediction accepted:', data);
          }}
          onRejectSuggestion={(data) => {
            console.log('Workload prediction rejected:', data);
          }}
          alertId="ml_workload_001"
          timestamp={Date.now()}
        />
      )}
    </div>
  );
}

/**
 * Example 4: Weather-Related Prediction
 */
export function Example4_WeatherPrediction() {
  const [showAlert, setShowAlert] = useState(true);

  return (
    <div>
      <h2>Example 4: Weather-Related Prediction</h2>
      <button onClick={() => setShowAlert(true)}>
        Show Weather Alert
      </button>

      {showAlert && (
        <MLPredictiveAlert
          title="WEATHER DEVIATION PATTERN DETECTED"
          message="ML model predicts multiple deviation requests due to developing weather system."
          confidence={88}
          reasoning="Thunderstorm cell developing at 30nm west is growing rapidly. NEXRAD data shows tops at FL450. Based on historical patterns, 3-4 aircraft will request deviations in next 10 minutes. Recommended to plan alternative routing."
          highlightRegions={[
            {
              x: 100,
              y: 250,
              width: 150,
              height: 120,
              label: 'Weather Cell',
              severity: 'medium',
              description: 'Thunderstorm - Tops FL450'
            },
            {
              x: 280,
              y: 200,
              width: 80,
              height: 60,
              label: 'JBU567',
              severity: 'low',
              description: 'Likely deviation request'
            }
          ]}
          predictionTime={600}
          suggestedActions={[
            {
              label: 'Proactive Reroute JBU567',
              description: 'Offer 20nm right deviation before request',
              onClick: () => console.log('Offering proactive reroute')
            },
            {
              label: 'View Weather Radar',
              description: 'Open detailed weather display',
              onClick: () => console.log('Opening weather radar')
            },
            {
              label: 'Alert Adjacent Sectors',
              description: 'Coordinate with neighboring controllers',
              onClick: () => console.log('Alerting adjacent sectors')
            }
          ]}
          modelInfo={{
            name: 'Weather Impact Predictor v3.0',
            version: '3.0.1',
            features: ['NEXRAD_data', 'pilot_behavior', 'weather_patterns']
          }}
          onDismiss={(data) => setShowAlert(false)}
          onAcceptSuggestion={(data) => console.log('Weather prediction accepted:', data)}
          onRejectSuggestion={(data) => console.log('Weather prediction rejected:', data)}
          onFeedback={(data) => console.log('Feedback:', data)}
          alertId="ml_weather_001"
          timestamp={Date.now()}
        />
      )}
    </div>
  );
}

/**
 * Example 5: Multiple Stacked ML Alerts
 */
export function Example5_StackedMLAlerts() {
  const [alerts, setAlerts] = useState([
    {
      alertId: 'ml_stack_001',
      title: 'TRAFFIC CONFLICT PREDICTED',
      message: 'Potential separation issue between AAL123 and UAL456.',
      confidence: 92,
      reasoning: 'Converging trajectories with insufficient separation margin.',
      highlightRegions: [
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
      ],
      predictionTime: 180,
      modelInfo: {
        name: 'Conflict Predictor v2.1',
        features: ['trajectories', 'velocities']
      },
      timestamp: Date.now()
    },
    {
      alertId: 'ml_stack_002',
      title: 'ALTITUDE DEVIATION LIKELY',
      message: 'SWA789 pattern suggests potential altitude deviation.',
      confidence: 78,
      reasoning: 'Aircraft flight profile matches historical deviation patterns.',
      highlightRegions: [
        {
          x: 450,
          y: 300,
          width: 80,
          height: 60,
          label: 'SWA789',
          severity: 'medium'
        }
      ],
      predictionTime: 240,
      modelInfo: {
        name: 'Deviation Predictor v1.8',
        features: ['flight_profile', 'historical_data']
      },
      timestamp: Date.now() + 1000
    }
  ]);

  const handleDismiss = (alertId, data) => {
    console.log(`ML Alert ${alertId} dismissed:`, data);
    setAlerts(alerts.filter(a => a.alertId !== alertId));
  };

  const handleAccept = (data) => {
    console.log('ML prediction accepted:', data);
  };

  const handleReject = (data) => {
    console.log('ML prediction rejected:', data);
  };

  const addAlert = () => {
    const newAlert = {
      alertId: `ml_stack_${Date.now()}`,
      title: 'WORKLOAD INCREASE PREDICTED',
      message: 'Traffic surge expected in 4 minutes.',
      confidence: 85,
      reasoning: 'Multiple aircraft approaching sector boundary simultaneously.',
      highlightRegions: [
        {
          x: 100,
          y: 100,
          width: 150,
          height: 120,
          label: 'Surge Zone',
          severity: 'medium'
        }
      ],
      predictionTime: 240,
      modelInfo: {
        name: 'Workload Predictor v1.5',
        features: ['traffic_density']
      },
      timestamp: Date.now()
    };
    setAlerts([...alerts, newAlert]);
  };

  return (
    <div>
      <h2>Example 5: Multiple Stacked ML Alerts</h2>
      <p>Current ML alerts: {alerts.length}</p>
      <button onClick={addAlert}>Add ML Alert</button>
      <button onClick={() => setAlerts([])}>Clear All</button>

      <MLPredictiveAlertStack
        alerts={alerts}
        onDismiss={handleDismiss}
        onAcceptSuggestion={handleAccept}
        onRejectSuggestion={handleReject}
        maxVisible={2}
      />
    </div>
  );
}

/**
 * Example 6: OpenScope Integration
 */
export function Example6_OpenScopeIntegration({ openScopeAdapter }) {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!openScopeAdapter) return;

    // Listen for ML predictions from OpenScope
    const unsubConflict = openScopeAdapter.on('ML_CONFLICT_PREDICTION', (prediction) => {
      const newAlert = {
        alertId: `ml_conflict_${Date.now()}`,
        title: 'ML CONFLICT PREDICTION',
        message: `Predicted separation violation: ${prediction.aircraft[0]} and ${prediction.aircraft[1]}`,
        confidence: prediction.confidence || 85,
        reasoning: prediction.reasoning || 'ML model detected potential conflict based on current trajectories.',
        highlightRegions: prediction.aircraft.map((callsign, index) => ({
          x: prediction.positions[index].x,
          y: prediction.positions[index].y,
          width: 80,
          height: 60,
          label: callsign,
          severity: prediction.confidence > 90 ? 'high' : 'medium'
        })),
        predictionTime: prediction.timeToConflict || 180,
        suggestedActions: [
          {
            label: `Vector ${prediction.aircraft[0]}`,
            description: 'Issue heading change for separation',
            onClick: () => {
              openScopeAdapter.setHeading(prediction.aircraft[0], 30, 'right');
            }
          },
          {
            label: `Altitude ${prediction.aircraft[1]}`,
            description: 'Change altitude for vertical separation',
            onClick: () => {
              openScopeAdapter.setAltitude(prediction.aircraft[1],
                prediction.suggestedAltitude || 35000, true);
            }
          }
        ],
        modelInfo: {
          name: 'Conflict Predictor v2.1',
          features: ['trajectories', 'velocities', 'historical_patterns']
        },
        timestamp: prediction.timestamp
      };

      setAlerts(prev => [...prev, newAlert]);
    });

    // Listen for workload predictions
    const unsubWorkload = openScopeAdapter.on('ML_WORKLOAD_PREDICTION', (prediction) => {
      const newAlert = {
        alertId: `ml_workload_${Date.now()}`,
        title: 'WORKLOAD SURGE PREDICTED',
        message: `Traffic surge expected: ${prediction.aircraftCount} aircraft in ${prediction.timeToSurge}s`,
        confidence: prediction.confidence || 75,
        reasoning: prediction.reasoning || 'Pattern analysis indicates increased sector complexity.',
        highlightRegions: prediction.regions || [],
        predictionTime: prediction.timeToSurge || 300,
        suggestedActions: [
          {
            label: 'Request Support',
            onClick: () => console.log('Requesting D-side support')
          }
        ],
        modelInfo: {
          name: 'Workload Predictor v1.5',
          features: ['traffic_density', 'sector_complexity']
        },
        timestamp: prediction.timestamp
      };

      setAlerts(prev => [...prev, newAlert]);
    });

    return () => {
      unsubConflict();
      unsubWorkload();
    };
  }, [openScopeAdapter]);

  const handleDismiss = (alertId, data) => {
    console.log('OpenScope ML alert dismissed:', data);
    setAlerts(alerts.filter(a => a.alertId !== alertId));

    // Track in research system
    // trackMLAlertEvent({ ...data, alertType: 'ml_predictive' });
  };

  const handleAccept = (data) => {
    console.log('OpenScope ML prediction accepted:', data);
    // trackMLAlertAction({ ...data, action: 'accept' });
  };

  const handleReject = (data) => {
    console.log('OpenScope ML prediction rejected:', data);
    // trackMLAlertAction({ ...data, action: 'reject' });
  };

  return (
    <div>
      <h2>Example 6: OpenScope Integration</h2>
      <p>ML alerts automatically appear for OpenScope predictions</p>
      <p>Current ML alerts: {alerts.length}</p>

      <MLPredictiveAlertStack
        alerts={alerts}
        onDismiss={handleDismiss}
        onAcceptSuggestion={handleAccept}
        onRejectSuggestion={handleReject}
        onFeedback={(data) => console.log('ML feedback:', data)}
        maxVisible={2}
      />
    </div>
  );
}

/**
 * Example 7: Research Comparison - All Three Conditions
 */
export function Example7_ResearchComparison() {
  const [condition, setCondition] = useState('condition3'); // 'condition1', 'condition2', 'condition3'
  const [showAlert, setShowAlert] = useState(false);

  const triggerAlert = () => {
    setShowAlert(true);
  };

  const conflictScenario = {
    title: 'TRAFFIC CONFLICT DETECTED',
    message: 'Separation violation predicted between AAL123 and UAL456.',
    aircraft: ['AAL123', 'UAL456'],
    severity: 'high',
    confidence: 94,
    reasoning: 'Both aircraft converging on waypoint ALPHA with insufficient vertical separation. Current closure rate 800 knots. Time to minimum separation: 2 minutes 30 seconds.'
  };

  return (
    <div>
      <h2>Example 7: Research Comparison</h2>

      <div style={{ marginBottom: '20px' }}>
        <label>
          <input
            type="radio"
            value="condition1"
            checked={condition === 'condition1'}
            onChange={(e) => setCondition(e.target.value)}
          />
          Condition 1: Traditional Modal (Blocking)
        </label>
        <label style={{ marginLeft: '20px' }}>
          <input
            type="radio"
            value="condition2"
            checked={condition === 'condition2'}
            onChange={(e) => setCondition(e.target.value)}
          />
          Condition 2: Adaptive Banner (Non-blocking)
        </label>
        <label style={{ marginLeft: '20px' }}>
          <input
            type="radio"
            value="condition3"
            checked={condition === 'condition3'}
            onChange={(e) => setCondition(e.target.value)}
          />
          Condition 3: ML Predictive (Banner + Radar)
        </label>
      </div>

      <button onClick={triggerAlert}>
        Trigger Conflict Alert
      </button>

      <div style={{ marginTop: '20px', padding: '20px', background: '#f0f0f0' }}>
        <h3>Simulated Radar Display</h3>
        <div style={{
          position: 'relative',
          height: '500px',
          background: '#1a1a1a',
          color: '#00ff00',
          fontFamily: 'monospace'
        }}>
          {/* Simulated radar content */}
          <div style={{ padding: '20px' }}>
            <p>RADAR SCOPE - SECTOR 23</p>
            <p>─────────────────────────</p>
            <p>AAL123: FL350, HDG 270°, 480kts</p>
            <p>UAL456: FL360, HDG 180°, 520kts</p>
            <p>SWA789: FL380, HDG 090°, 495kts</p>
            <p>─────────────────────────</p>
            <p>
              {condition === 'condition1'
                ? '✗ BLOCKED BY MODAL'
                : condition === 'condition2'
                  ? '✓ INTERACTIVE (Banner at top)'
                  : '✓ INTERACTIVE (Banner + Highlights)'}
            </p>
          </div>

          {/* Condition-specific alerts */}
          {showAlert && condition === 'condition1' && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(183, 28, 28, 0.95)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '24px',
              fontWeight: 'bold',
              border: '5px solid #ffc107',
              zIndex: 2000
            }}>
              <div style={{ textAlign: 'center' }}>
                <p>⚠️ {conflictScenario.title} ⚠️</p>
                <p style={{ fontSize: '16px', margin: '20px 0' }}>
                  {conflictScenario.message}
                </p>
                <button
                  style={{
                    padding: '15px 40px',
                    fontSize: '18px',
                    background: '#ffc107',
                    color: '#000',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                  onClick={() => setShowAlert(false)}
                >
                  ACKNOWLEDGE
                </button>
              </div>
            </div>
          )}

          {showAlert && condition === 'condition2' && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
              color: '#fff',
              padding: '15px',
              borderBottom: '3px solid #e65100',
              zIndex: 1000
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    {conflictScenario.title}
                  </span>
                  <p style={{ margin: '5px 0 0 0', fontSize: '14px' }}>
                    {conflictScenario.message}
                  </p>
                </div>
                <button
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    color: '#fff',
                    width: '32px',
                    height: '32px',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  onClick={() => setShowAlert(false)}
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {showAlert && condition === 'condition3' && (
            <>
              {/* ML Banner */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                background: 'linear-gradient(135deg, #5e35b1 0%, #3949ab 100%)',
                color: '#fff',
                padding: '15px',
                borderBottom: '4px solid #7c4dff',
                zIndex: 1000
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{
                      background: 'linear-gradient(135deg, #00e676 0%, #00c853 100%)',
                      color: '#000',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      marginRight: '10px'
                    }}>
                      ML PREDICTION
                    </span>
                    <span style={{ fontSize: '18px', fontWeight: 'bold' }}>
                      {conflictScenario.title}
                    </span>
                    <span style={{
                      marginLeft: '10px',
                      background: '#4caf50',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '13px',
                      fontWeight: 'bold'
                    }}>
                      🤖 {conflictScenario.confidence}% confidence
                    </span>
                  </div>
                  <button
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      border: 'none',
                      color: '#fff',
                      width: '32px',
                      height: '32px',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                    onClick={() => setShowAlert(false)}
                  >
                    ✕
                  </button>
                </div>
                <p style={{ margin: '8px 0 0 0', fontSize: '15px' }}>
                  {conflictScenario.message}
                </p>
              </div>

              {/* Radar Highlights */}
              <div style={{
                position: 'absolute',
                left: '150px',
                top: '200px',
                width: '100px',
                height: '80px',
                border: '3px solid #ffc107',
                borderRadius: '4px',
                background: 'rgba(255, 193, 7, 0.2)',
                boxShadow: '0 0 20px rgba(255, 193, 7, 0.6)',
                animation: 'pulse 1.5s infinite'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '-28px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#ffc107',
                  color: '#000',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap'
                }}>
                  ⚠ AAL123
                </div>
              </div>

              <div style={{
                position: 'absolute',
                left: '300px',
                top: '250px',
                width: '100px',
                height: '80px',
                border: '3px solid #ffc107',
                borderRadius: '4px',
                background: 'rgba(255, 193, 7, 0.2)',
                boxShadow: '0 0 20px rgba(255, 193, 7, 0.6)',
                animation: 'pulse 1.5s infinite'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '-28px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#ffc107',
                  color: '#000',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap'
                }}>
                  ⚠ UAL456
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: '20px', padding: '15px', background: '#e3f2fd' }}>
        <h4>Research Notes:</h4>
        <ul>
          <li>
            <strong>Condition 1 (Modal):</strong> Completely blocks radar. High interruption.
            Baseline for comparison.
          </li>
          <li>
            <strong>Condition 2 (Banner):</strong> Non-blocking. Maintains situational awareness.
            Reduces workload interruption by ~60%.
          </li>
          <li>
            <strong>Condition 3 (ML + Radar):</strong> Predictive + Visual context.
            Enhances awareness with ML confidence. Hypothesis: Best performance.
          </li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Example 8: Low Confidence Alert
 */
export function Example8_LowConfidence() {
  const [showAlert, setShowAlert] = useState(true);

  return (
    <div>
      <h2>Example 8: Low Confidence Alert</h2>
      <button onClick={() => setShowAlert(true)}>
        Show Low Confidence Alert
      </button>

      {showAlert && (
        <MLPredictiveAlert
          title="POSSIBLE DEVIATION REQUEST"
          message="ML model suggests potential deviation request from JBU890 based on weather pattern."
          confidence={62}
          reasoning="Aircraft is approaching area with light turbulence reports. Historical data shows 45% probability of deviation request in similar conditions. Model confidence is moderate due to limited recent data."
          highlightRegions={[
            {
              x: 250,
              y: 180,
              width: 90,
              height: 70,
              label: 'JBU890',
              severity: 'low',
              description: 'JetBlue 890 - FL370'
            }
          ]}
          predictionTime={420}
          suggestedActions={[
            {
              label: 'Monitor Aircraft',
              description: 'Continue observation',
              onClick: () => console.log('Monitoring JBU890')
            }
          ]}
          modelInfo={{
            name: 'Deviation Predictor v1.8',
            version: '1.8.2',
            features: ['weather_data', 'pilot_behavior']
          }}
          onDismiss={(data) => setShowAlert(false)}
          onAcceptSuggestion={(data) => console.log('Low confidence accepted:', data)}
          onRejectSuggestion={(data) => console.log('Low confidence rejected:', data)}
          alertId="ml_low_conf_001"
          timestamp={Date.now()}
        />
      )}
    </div>
  );
}

export default Example1_BasicMLAlert;
