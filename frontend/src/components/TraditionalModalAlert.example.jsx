/**
 * Traditional Modal Alert - Usage Examples
 *
 * Demonstrates how to use the TraditionalModalAlert component
 * in various scenarios for the ATC research system.
 */

import React, { useState } from 'react';
import TraditionalModalAlert, { TraditionalModalAlertStack } from './TraditionalModalAlert';

/**
 * Example 1: Basic Critical Alert
 */
export function Example1_CriticalAlert() {
  const [showAlert, setShowAlert] = useState(true);

  const handleAcknowledge = (data) => {
    console.log('Alert acknowledged:', data);
    setShowAlert(false);

    // Send to backend for research tracking
    // trackAlertEvent(data);
  };

  return (
    <div>
      <h2>Example 1: Critical Alert</h2>
      <button onClick={() => setShowAlert(true)}>
        Show Critical Alert
      </button>

      {showAlert && (
        <TraditionalModalAlert
          title="FUEL EMERGENCY"
          message="Aircraft AAL123 reports fuel critical. Immediate landing required. Estimated 15 minutes of fuel remaining."
          severity="critical"
          requiresAcknowledgment={true}
          onAcknowledge={handleAcknowledge}
          alertId="fuel_emergency_001"
          timestamp={Date.now()}
          details={{
            'Aircraft': 'AAL123',
            'Fuel Remaining': '15 minutes',
            'Current Altitude': '10,000 ft',
            'Distance to Airport': '45 nm'
          }}
          enableAudio={true}
        />
      )}
    </div>
  );
}

/**
 * Example 2: Warning Alert
 */
export function Example2_WarningAlert() {
  const [showAlert, setShowAlert] = useState(true);

  return (
    <div>
      <h2>Example 2: Warning Alert</h2>
      <button onClick={() => setShowAlert(true)}>
        Show Warning Alert
      </button>

      {showAlert && (
        <TraditionalModalAlert
          title="CONFLICT ALERT"
          message="Potential traffic conflict detected between UAL456 and DAL789. Separation may be violated in 2 minutes."
          severity="warning"
          requiresAcknowledgment={true}
          onAcknowledge={(data) => {
            console.log('Warning acknowledged:', data);
            setShowAlert(false);
          }}
          alertId="conflict_warning_001"
          timestamp={Date.now()}
          details={{
            'Aircraft 1': 'UAL456 at 15,000 ft',
            'Aircraft 2': 'DAL789 at 15,200 ft',
            'Predicted Separation': '2.4 nm horizontal',
            'Time to CPA': '2 minutes'
          }}
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
      alertId: 'alert_001',
      title: 'WEATHER DEVIATION REQUEST',
      message: 'SWA321 requests deviation 20nm right due to severe turbulence.',
      severity: 'warning',
      requiresAcknowledgment: true,
      timestamp: Date.now(),
      details: {
        'Aircraft': 'SWA321',
        'Deviation': '20 nm right',
        'Reason': 'Severe turbulence'
      }
    },
    {
      alertId: 'alert_002',
      title: 'EMERGENCY DECLARED',
      message: 'JBU555 declares medical emergency. Priority landing requested.',
      severity: 'critical',
      requiresAcknowledgment: true,
      timestamp: Date.now() + 5000,
      details: {
        'Aircraft': 'JBU555',
        'Emergency Type': 'Medical',
        'Souls on Board': '156',
        'Priority': 'Immediate landing'
      }
    }
  ]);

  const handleAcknowledge = (alertId, data) => {
    console.log(`Alert ${alertId} acknowledged:`, data);
    setAlerts(alerts.filter(a => a.alertId !== alertId));
  };

  const handleDismiss = (alertId) => {
    console.log(`Alert ${alertId} dismissed`);
    setAlerts(alerts.filter(a => a.alertId !== alertId));
  };

  const addRandomAlert = () => {
    const newAlert = {
      alertId: `alert_${Date.now()}`,
      title: 'EQUIPMENT FAILURE',
      message: 'Radio communication failure reported by FFT789.',
      severity: Math.random() > 0.5 ? 'critical' : 'warning',
      requiresAcknowledgment: true,
      timestamp: Date.now(),
      details: {
        'Aircraft': 'FFT789',
        'Equipment': 'Radio',
        'Status': 'Lost communication'
      }
    };
    setAlerts([...alerts, newAlert]);
  };

  return (
    <div>
      <h2>Example 3: Multiple Stacked Alerts</h2>
      <p>Current alerts: {alerts.length}</p>
      <button onClick={addRandomAlert}>
        Add Random Alert
      </button>
      <button onClick={() => setAlerts([])}>
        Clear All
      </button>

      <TraditionalModalAlertStack
        alerts={alerts}
        onAcknowledge={handleAcknowledge}
        onDismiss={handleDismiss}
      />
    </div>
  );
}

/**
 * Example 4: Integration with OpenScope
 */
export function Example4_OpenScopeIntegration({ openScopeAdapter }) {
  const [currentAlert, setCurrentAlert] = useState(null);

  React.useEffect(() => {
    if (!openScopeAdapter) return;

    // Listen for conflict alerts from OpenScope
    const unsubscribe = openScopeAdapter.on('CONFLICT_ALERT', (conflict) => {
      setCurrentAlert({
        alertId: `conflict_${Date.now()}`,
        title: 'TRAFFIC CONFLICT ALERT',
        message: `Separation violation predicted between ${conflict.aircraft[0]} and ${conflict.aircraft[1]}.`,
        severity: conflict.severity >= 3 ? 'critical' : 'warning',
        requiresAcknowledgment: true,
        timestamp: conflict.timestamp,
        details: {
          'Aircraft': conflict.aircraft.join(' & '),
          'Horizontal Separation': `${conflict.separation.horizontal.toFixed(1)} nm`,
          'Vertical Separation': `${conflict.separation.vertical} ft`,
          'Severity': `${conflict.severity}/3`
        }
      });
    });

    return unsubscribe;
  }, [openScopeAdapter]);

  const handleAcknowledge = (data) => {
    console.log('Conflict acknowledged:', data);

    // Track in behavioral tracking system
    // behavioralTracker.trackAlertAcknowledged(data.alertId, 'acknowledged');

    // Send to backend
    // trackAlertEvent(data);

    setCurrentAlert(null);
  };

  return (
    <div>
      <h2>Example 4: OpenScope Integration</h2>
      <p>Automatically shows alerts from OpenScope simulator</p>

      {currentAlert && (
        <TraditionalModalAlert
          {...currentAlert}
          onAcknowledge={handleAcknowledge}
        />
      )}
    </div>
  );
}

/**
 * Example 5: Research Scenario Controller
 */
export function Example5_ResearchScenario() {
  const [alerts, setAlerts] = useState([]);
  const [metrics, setMetrics] = useState({
    totalAlerts: 0,
    acknowledged: 0,
    averageResponseTime: 0
  });

  // Simulate L1 scenario: Low complexity, low traffic
  const runL1Scenario = () => {
    const scenarioAlerts = [
      {
        alertId: 'L1_001',
        title: 'ALTITUDE DEVIATION',
        message: 'AAL123 deviating from assigned altitude 10,000 ft.',
        severity: 'warning',
        requiresAcknowledgment: true,
        timestamp: Date.now() + 120000, // 2 minutes in
        details: {
          'Aircraft': 'AAL123',
          'Assigned Altitude': '10,000 ft',
          'Current Altitude': '10,400 ft'
        }
      },
      {
        alertId: 'L1_002',
        title: 'COORDINATION REQUIRED',
        message: 'UAL456 approaching sector boundary. Handoff required.',
        severity: 'warning',
        requiresAcknowledgment: true,
        timestamp: Date.now() + 300000, // 5 minutes in
        details: {
          'Aircraft': 'UAL456',
          'Next Sector': 'Sector 23',
          'ETA': '3 minutes'
        }
      }
    ];

    setAlerts(scenarioAlerts);
    setMetrics({ totalAlerts: scenarioAlerts.length, acknowledged: 0, averageResponseTime: 0 });
  };

  const handleAcknowledge = (alertId, data) => {
    console.log('Research data:', data);

    // Update metrics
    setMetrics(prev => {
      const newAcknowledged = prev.acknowledged + 1;
      const newAverage = (prev.averageResponseTime * prev.acknowledged + data.responseTime) / newAcknowledged;

      return {
        totalAlerts: prev.totalAlerts,
        acknowledged: newAcknowledged,
        averageResponseTime: newAverage
      };
    });

    // Remove alert
    setAlerts(alerts.filter(a => a.alertId !== alertId));
  };

  return (
    <div>
      <h2>Example 5: Research Scenario (L1)</h2>

      <div className="metrics">
        <h3>Metrics</h3>
        <p>Total Alerts: {metrics.totalAlerts}</p>
        <p>Acknowledged: {metrics.acknowledged}</p>
        <p>Avg Response Time: {metrics.averageResponseTime.toFixed(0)}ms</p>
      </div>

      <button onClick={runL1Scenario}>
        Start L1 Scenario
      </button>

      <TraditionalModalAlertStack
        alerts={alerts}
        onAcknowledge={handleAcknowledge}
        onDismiss={() => {}}
      />
    </div>
  );
}

export default Example1_CriticalAlert;
