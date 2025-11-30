/**
 * Adaptive Banner Alert - Usage Examples
 *
 * Demonstrates how to use the AdaptiveBannerAlert component
 * for Condition 2 (Rule-Based Adaptive Alerts) in the ATC research system.
 */

import React, { useState } from 'react';
import AdaptiveBannerAlert, {
  AdaptiveBannerAlertStack,
  AdaptiveBannerAlertManager
} from './AdaptiveBannerAlert';

/**
 * Example 1: Basic Advisory Alert
 */
export function Example1_AdvisoryAlert() {
  const [showAlert, setShowAlert] = useState(true);

  const handleDismiss = (data) => {
    console.log('Alert dismissed:', data);
    setShowAlert(false);
  };

  return (
    <div>
      <h2>Example 1: Advisory Alert</h2>
      <button onClick={() => setShowAlert(true)}>
        Show Advisory
      </button>

      {showAlert && (
        <AdaptiveBannerAlert
          title="Weather Deviation Request"
          message="SWA321 requesting deviation 20nm right due to moderate turbulence."
          severity="advisory"
          recommendedActions={[
            {
              label: 'Approve Deviation (Est. 12min)',
              description: 'Approve 20nm right deviation',
              onClick: () => console.log('Approved deviation')
            },
            {
              label: 'Request Alternate Route',
              description: 'Suggest alternate routing',
              onClick: () => console.log('Requested alternate')
            }
          ]}
          onDismiss={handleDismiss}
          alertId="weather_deviation_001"
          timestamp={Date.now()}
        />
      )}
    </div>
  );
}

/**
 * Example 2: Warning Alert with Auto-Dismiss
 */
export function Example2_WarningAlert() {
  const [showAlert, setShowAlert] = useState(true);

  return (
    <div>
      <h2>Example 2: Warning Alert (Auto-Dismiss)</h2>
      <button onClick={() => setShowAlert(true)}>
        Show Warning
      </button>

      {showAlert && (
        <AdaptiveBannerAlert
          title="Altitude Deviation Detected"
          message="UAL456 deviating from assigned altitude 15,000 ft. Currently at 15,400 ft."
          severity="warning"
          recommendedActions={[
            {
              label: 'Contact Aircraft',
              description: 'Radio contact to verify altitude',
              onClick: () => console.log('Contacting aircraft')
            },
            {
              label: 'Issue Correction',
              description: 'Issue altitude correction clearance',
              onClick: () => console.log('Issuing correction')
            }
          ]}
          onDismiss={(data) => {
            console.log('Warning dismissed:', data);
            setShowAlert(false);
          }}
          alertId="altitude_deviation_001"
          timestamp={Date.now()}
          autoDismiss={true}
          autoDismissDelay={15000} // 15 seconds
          showProgress={true}
        />
      )}
    </div>
  );
}

/**
 * Example 3: Multiple Stacked Alerts
 */
export function Example3_StackedAlerts() {
  const [alerts, setAlerts] = useState([
    {
      alertId: 'stack_001',
      title: 'Coordination Required',
      message: 'AAL123 approaching sector boundary. Handoff to Sector 23 required.',
      severity: 'info',
      recommendedActions: [
        {
          label: 'Initiate Handoff',
          onClick: () => console.log('Handoff initiated')
        }
      ],
      timestamp: Date.now()
    },
    {
      alertId: 'stack_002',
      title: 'Traffic Advisory',
      message: 'Heavy traffic expected in next 10 minutes. 5 arrivals inbound.',
      severity: 'advisory',
      recommendedActions: [
        {
          label: 'Review Traffic Flow',
          onClick: () => console.log('Reviewing traffic')
        },
        {
          label: 'Request Flow Control',
          onClick: () => console.log('Requesting flow control')
        }
      ],
      timestamp: Date.now() + 1000
    }
  ]);

  const handleDismiss = (alertId, data) => {
    console.log(`Alert ${alertId} dismissed:`, data);
    setAlerts(alerts.filter(a => a.alertId !== alertId));
  };

  const addAlert = () => {
    const newAlert = {
      alertId: `stack_${Date.now()}`,
      title: 'Equipment Status',
      message: 'Radar system refresh rate degraded. Technical team notified.',
      severity: 'info',
      recommendedActions: [
        {
          label: 'View Details',
          onClick: () => console.log('Viewing equipment details')
        }
      ],
      timestamp: Date.now()
    };
    setAlerts([...alerts, newAlert]);
  };

  return (
    <div>
      <h2>Example 3: Multiple Stacked Alerts</h2>
      <p>Current alerts: {alerts.length}</p>
      <button onClick={addAlert}>Add Alert</button>
      <button onClick={() => setAlerts([])}>Clear All</button>

      <AdaptiveBannerAlertStack
        alerts={alerts}
        onDismiss={handleDismiss}
        maxVisible={3}
      />
    </div>
  );
}

/**
 * Example 4: Minimize/Expand Functionality
 */
export function Example4_MinimizeExpand() {
  const [showAlert, setShowAlert] = useState(true);

  const handleMinimize = (data) => {
    console.log('Alert minimize state changed:', data);
  };

  return (
    <div>
      <h2>Example 4: Minimize/Expand</h2>
      <p>Click the minimize button (▲) to collapse the banner</p>
      <button onClick={() => setShowAlert(true)}>
        Show Alert
      </button>

      {showAlert && (
        <AdaptiveBannerAlert
          title="Sector Workload Advisory"
          message="Current workload: HIGH. 12 aircraft in sector. Consider requesting assistance."
          severity="warning"
          recommendedActions={[
            {
              label: 'Request D-Side Support',
              description: 'Request additional controller',
              onClick: () => console.log('Requesting support')
            },
            {
              label: 'View Workload Details',
              onClick: () => console.log('Viewing workload')
            }
          ]}
          onDismiss={(data) => {
            console.log('Alert dismissed:', data);
            setShowAlert(false);
          }}
          onMinimize={handleMinimize}
          alertId="workload_advisory_001"
          timestamp={Date.now()}
        />
      )}
    </div>
  );
}

/**
 * Example 5: Alert Manager with Programmatic Control
 */
export function Example5_AlertManager() {
  return (
    <div>
      <h2>Example 5: Alert Manager</h2>

      <AdaptiveBannerAlertManager
        maxVisible={3}
        onActionClick={(data) => console.log('Action clicked:', data)}
      >
        {(manager) => (
          <div>
            <p>Programmatically control alerts</p>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button
                onClick={() =>
                  manager.addAlert({
                    title: 'Conflict Alert',
                    message: 'Potential separation violation in 3 minutes.',
                    severity: 'warning',
                    recommendedActions: [
                      {
                        label: 'Issue Vector',
                        onClick: () => console.log('Vector issued')
                      },
                      {
                        label: 'Altitude Change',
                        onClick: () => console.log('Altitude changed')
                      }
                    ]
                  })
                }
              >
                Add Conflict Alert
              </button>

              <button
                onClick={() =>
                  manager.addAlert({
                    title: 'Weather Update',
                    message: 'Thunderstorms developing 30nm west of airport.',
                    severity: 'advisory',
                    recommendedActions: [
                      {
                        label: 'View Weather Radar',
                        onClick: () => console.log('Weather radar opened')
                      }
                    ],
                    autoDismiss: true,
                    autoDismissDelay: 10000
                  })
                }
              >
                Add Weather Alert
              </button>

              <button onClick={manager.clearAll}>
                Clear All Alerts
              </button>
            </div>
          </div>
        )}
      </AdaptiveBannerAlertManager>
    </div>
  );
}

/**
 * Example 6: Integration with OpenScope
 */
export function Example6_OpenScopeIntegration({ openScopeAdapter }) {
  const [alerts, setAlerts] = useState([]);

  React.useEffect(() => {
    if (!openScopeAdapter) return;

    // Listen for conflict alerts from OpenScope
    const unsubConflict = openScopeAdapter.on('CONFLICT_ALERT', (conflict) => {
      const newAlert = {
        alertId: `conflict_${Date.now()}`,
        title: 'Traffic Conflict Alert',
        message: `Predicted separation violation: ${conflict.aircraft[0]} and ${conflict.aircraft[1]}`,
        severity: conflict.severity >= 3 ? 'warning' : 'advisory',
        recommendedActions: [
          {
            label: `Vector ${conflict.aircraft[0]}`,
            description: 'Issue heading change',
            onClick: () => {
              openScopeAdapter.setHeading(conflict.aircraft[0], 90, 'right');
            }
          },
          {
            label: 'Altitude Separation',
            description: 'Change altitude for separation',
            onClick: () => {
              openScopeAdapter.setAltitude(conflict.aircraft[0], 16000);
            }
          }
        ],
        timestamp: conflict.timestamp,
        autoDismiss: false
      };

      setAlerts(prev => [...prev, newAlert]);
    });

    // Listen for deviation requests
    const unsubDeviation = openScopeAdapter.on('DEVIATION_REQUEST', (deviation) => {
      const newAlert = {
        alertId: `deviation_${Date.now()}`,
        title: 'Deviation Request',
        message: `${deviation.callsign} requests ${deviation.direction} deviation ${deviation.distance}nm`,
        severity: 'advisory',
        recommendedActions: [
          {
            label: `Approve ${deviation.distance}nm ${deviation.direction}`,
            onClick: () => {
              console.log(`Approved deviation for ${deviation.callsign}`);
            }
          },
          {
            label: 'Request Alternate',
            onClick: () => {
              console.log('Requesting alternate routing');
            }
          }
        ],
        timestamp: deviation.timestamp,
        autoDismiss: true,
        autoDismissDelay: 20000
      };

      setAlerts(prev => [...prev, newAlert]);
    });

    return () => {
      unsubConflict();
      unsubDeviation();
    };
  }, [openScopeAdapter]);

  const handleDismiss = (alertId, data) => {
    console.log('OpenScope alert dismissed:', data);
    setAlerts(alerts.filter(a => a.alertId !== alertId));

    // Track dismissal in research system
    // trackAlertEvent({ ...data, alertType: 'adaptive_banner' });
  };

  const handleActionClick = (data) => {
    console.log('OpenScope action clicked:', data);

    // Track action in research system
    // trackAlertAction(data);
  };

  return (
    <div>
      <h2>Example 6: OpenScope Integration</h2>
      <p>Banners automatically appear for OpenScope events</p>
      <p>Current alerts: {alerts.length}</p>

      <AdaptiveBannerAlertStack
        alerts={alerts}
        onDismiss={handleDismiss}
        onActionClick={handleActionClick}
        maxVisible={3}
      />
    </div>
  );
}

/**
 * Example 7: Research Comparison - Banner vs Modal
 */
export function Example7_ResearchComparison() {
  const [alertType, setAlertType] = useState('banner'); // 'banner' or 'modal'
  const [showAlert, setShowAlert] = useState(false);

  const triggerAlert = () => {
    setShowAlert(true);
  };

  return (
    <div>
      <h2>Example 7: Research Comparison</h2>

      <div style={{ marginBottom: '20px' }}>
        <label>
          <input
            type="radio"
            value="banner"
            checked={alertType === 'banner'}
            onChange={(e) => setAlertType(e.target.value)}
          />
          Adaptive Banner (Condition 2)
        </label>
        <label style={{ marginLeft: '20px' }}>
          <input
            type="radio"
            value="modal"
            checked={alertType === 'modal'}
            onChange={(e) => setAlertType(e.target.value)}
          />
          Traditional Modal (Condition 1)
        </label>
      </div>

      <button onClick={triggerAlert}>
        Trigger Alert
      </button>

      <div style={{ marginTop: '20px', padding: '20px', background: '#f0f0f0' }}>
        <h3>Simulated Radar Display</h3>
        <p>
          {alertType === 'banner'
            ? '✓ Radar remains fully visible and interactive'
            : '✗ Radar completely blocked by modal'}
        </p>
        <div style={{
          height: '400px',
          background: '#1a1a1a',
          color: '#00ff00',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'monospace'
        }}>
          [RADAR DISPLAY]<br />
          Aircraft positions...<br />
          {alertType === 'banner' ? 'INTERACTIVE' : 'BLOCKED'}
        </div>
      </div>

      {showAlert && alertType === 'banner' && (
        <AdaptiveBannerAlert
          title="FUEL EMERGENCY"
          message="Aircraft AAL123 reports fuel critical. Immediate landing required."
          severity="warning"
          recommendedActions={[
            {
              label: 'Clear Direct to Airport',
              onClick: () => console.log('Cleared direct')
            },
            {
              label: 'Notify Emergency Services',
              onClick: () => console.log('Services notified')
            }
          ]}
          onDismiss={() => setShowAlert(false)}
          alertId="comparison_test"
          timestamp={Date.now()}
        />
      )}
    </div>
  );
}

export default Example1_AdvisoryAlert;
